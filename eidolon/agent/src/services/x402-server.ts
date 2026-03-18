import express, { Request, Response } from 'express';
// import { X402 } from 'x402'; // not needed for header-based x402
// import { Wanpot } from 'wanpot'; // optional, not used in this implementation
import { BankrClient } from '../core/bankr-client';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include x402Required
interface X402Request extends Request {
  x402Required?: number;
}

export interface Pricing {
  priceUSD: number;
  description: string;
  currency?: 'USDC' | 'ETH' | 'BNKR'; // optional, defaults to USDC
}

export interface X402Config {
  port: number;
  paymentAddress: string;
  pricing: Record<string, Pricing>;
  maxDebt: number;
  trustScoreWeight?: number; // optional, 0-1, how much ERC-8004 trust influences price
  dataDir?: string; // optional directory for persistence
}

// Simple in-memory credit ledger for x402 payments with file persistence
class CreditLedger {
  private balances: Map<string, number> = new Map(); // clientId -> credit balance (USDC)
  private debts: Map<string, number> = new Map(); // clientId -> debt (negative balance allowed up to limit)
  private maxDebt: number = 100; // default max debt per client (USD)
  private persistencePath?: string;

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath;
    if (persistencePath) {
      this.load();
    }
  }

  setMaxDebt(max: number) {
    this.maxDebt = max;
  }

  async hasSufficientFunds(clientId: string, cost: number): Promise<boolean> {
    const balance = this.balances.get(clientId) || 0;
    return balance >= cost;
  }

  async charge(clientId: string, cost: number): Promise<boolean> {
    const balance = this.balances.get(clientId) || 0;
    if (balance >= cost) {
      this.balances.set(clientId, balance - cost);
      this.save();
      return true;
    }
    // allow debt
    const currentDebt = this.debts.get(clientId) || 0;
    if (currentDebt + cost <= this.maxDebt) {
      this.debts.set(clientId, currentDebt + cost);
      this.save();
      return true;
    }
    return false;
  }

  async credit(clientId: string, amount: number) {
    const current = this.balances.get(clientId) || 0;
    this.balances.set(clientId, current + amount);
    this.save();
  }

  getBalance(clientId: string): number {
    return this.balances.get(clientId) || 0;
  }

  getDebt(clientId: string): number {
    return this.debts.get(clientId) || 0;
  }

  // Persistence
  private load() {
    if (!this.persistencePath) return;
    try {
      const data = require('fs').readFileSync(this.persistencePath, 'utf8');
      const parsed = JSON.parse(data);
      this.balances = new Map(Object.entries(parsed.balances || {}));
      this.debts = new Map(Object.entries(parsed.debts || {}));
      console.log(`[CreditLedger] Loaded persisted data from ${this.persistencePath} (${Object.keys(this.balances).length} clients)`);
    } catch (err) {
      // File doesn't exist or invalid, start fresh
      console.log('[CreditLedger] No persisted data found, starting fresh');
    }
  }

  private save() {
    if (!this.persistencePath) return;
    try {
      const data = {
        balances: Object.fromEntries(this.balances),
        debts: Object.fromEntries(this.debts),
        updatedAt: new Date().toISOString(),
      };
      require('fs').writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[CreditLedger] Failed to persist data:', err);
    }
  }

  // Expose for debugging
  getAllClients() : string[] {
    const clients = new Set<string>();
    this.balances.forEach((_, id) => clients.add(id));
    this.debts.forEach((_, id) => clients.add(id));
    return Array.from(clients);
  }
}

export class X402Server extends EventEmitter {
  private app: express.Application;
  private config: X402Config;
  private bankr: BankrClient;
  private ledger: CreditLedger;
  private trustScore: number = 500; // default, update via reputation manager

  constructor(config: X402Config, bankr: BankrClient) {
    super();
    this.config = config;
    this.bankr = bankr;
    const ledgerPath = config.dataDir ? `${config.dataDir}/ledger.json` : undefined;
    this.ledger = new CreditLedger(ledgerPath);
    this.ledger.setMaxDebt(config.maxDebt);
    this.app = express();
    this.app.use(express.json());
    this.trustScore = 500; // default trust score
    this.setupRoutes();
  }

  setTrustScore(score: number) {
    this.trustScore = Math.max(0, Math.min(1000, score));
  }

  private adjustPriceByTrust(basePrice: number): number {
    // Higher trust (closer to 1000) => lower price (up to 20% discount)
    // Lower trust => higher price (up to 100% surcharge)
    const factor = 1 - (this.trustScore / 1000) * 0.2; // 0.8 to 1.0
    return Math.max(0.01, basePrice * factor);
  }

  private async requirePayment(req: X402Request, endpoint: string): Promise<boolean> {
    const rawClientId = req.headers['x-client-id'];
    const clientId = typeof rawClientId === 'string' ? rawClientId : (req.ip || 'unknown');
    const pricing = this.config.pricing[endpoint];
    if (!pricing) {
      this.emit('error', `No pricing defined for endpoint ${endpoint}`);
      return false;
    }

    const adjustedPrice = this.adjustPriceByTrust(pricing.priceUSD);
    const canProceed = await this.ledger.hasSufficientFunds(clientId, adjustedPrice);
    if (!canProceed) {
      req.x402Required = adjustedPrice;
      return false;
    }
    // Charge immediately
    await this.ledger.charge(clientId, adjustedPrice);
    this.emit('payment', { clientId, endpoint, amount: adjustedPrice });
    return true;
  }

  // Top up a client's credit balance (e.g., when they pay on-chain)
  async creditClient(clientId: string, amountUSD: number) {
    await this.ledger.credit(clientId, amountUSD);
    this.emit('credit', { clientId, amount: amountUSD });
  }

  private setupRoutes() {
    // Health check (free)
    this.app.get('/health', (req: X402Request, res: Response) => {
      res.json({ status: 'ok', trustScore: this.trustScore, timestamp: new Date() });
    });

    // Example endpoint: price signal
    this.app.get('/signals/price/:token', async (req: X402Request, res: Response) => {
      const endpoint = '/signals/price/:token';
      if (!(await this.requirePayment(req, endpoint))) {
        const amount = req.x402Required;
        res.set('X-402-Payment-Required', `${amount} USDC`);
        res.set('X-402-Payment-Address', this.config.paymentAddress);
        res.set('X-402-Payment-Description', this.config.pricing[endpoint]?.description || 'Access to price signals');
        return res.status(402).json({ error: 'Payment required', priceUSD: amount });
      }

      const { token } = req.params;
      // Fetch signal from trading copilot? In a real implementation, we'd have an internal reference.
      // For now, we simulate with a placeholder.
      const signal = {
        token,
        signal: 'BUY',
        confidence: 0.75,
        reason: 'Based on LLM analysis of on-chain flows',
        timestamp: new Date(),
      };
      res.json({ success: true, data: signal });
    });

    // Daily report
    this.app.get('/reports/daily', async (req: X402Request, res: Response) => {
      const endpoint = '/reports/daily';
      if (!(await this.requirePayment(req, endpoint))) {
        const amount = req.x402Required;
        res.set('X-402-Payment-Required', `${amount} USDC`);
        res.set('X-402-Payment-Address', this.config.paymentAddress);
        res.set('X-402-Payment-Description', this.config.pricing[endpoint]?.description || 'Daily analytics report');
        return res.status(402).json({ error: 'Payment required', priceUSD: amount });
      }

      // Generate or fetch latest report
      const report = {
        title: `Daily Report - ${new Date().toISOString().split('T')[0]}`,
        summary: 'Market bullish on Base; Aerodrome volume up 12%.',
        metrics: {
          'ETH price': 3200,
          '24h change': '+2.4%',
        },
        insights: [
          'Increased inflow to USDC on Base',
          'New token launches trending',
        ],
        generatedAt: new Date(),
      };
      res.json({ success: true, data: report });
    });

    // Copilot chat endpoint
    this.app.post('/copilot/chat', async (req: X402Request, res: Response) => {
      const endpoint = '/copilot/chat';
      if (!(await this.requirePayment(req, endpoint))) {
        const amount = req.x402Required;
        res.set('X-402-Payment-Required', `${amount} USDC`);
        res.set('X-402-Payment-Address', this.config.paymentAddress);
        res.set('X-402-Payment-Description', this.config.pricing[endpoint]?.description || 'Copilot chat per message');
        return res.status(402).json({ error: 'Payment required', priceUSD: amount });
      }

      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Missing message' });
      }

      // Use LLM to respond (could use Bankr LLM Gateway)
      // For simplicity, we'll return a canned response; in prod, call bankr.chatCompletion
      const response = `[Copilot] I heard you: "${message}". (This is a demo; integrate Bankr LLM Gateway for real responses.)`;
      res.json({ success: true, response, timestamp: new Date() });
    });

    // Webhook for on-chain payments to credit accounts (requires off-chain signature or contract event)
    this.app.post('/webhook/credit', async (req: X402Request, res: Response) => {
      // In reality, verify signature from Bankr or on-chain event
      const { clientId, amount } = req.body;
      if (!clientId || !amount) {
        return res.status(400).json({ error: 'Missing clientId or amount' });
      }
      await this.ledger.credit(clientId, amount);
      this.emit('credit', { clientId, amount, source: 'webhook' });
      res.json({ success: true, newBalance: this.ledger.getBalance(clientId) });
    });

    // Admin endpoint to adjust trust score (for reputation updates)
    this.app.post('/admin/trust-score', async (req: X402Request, res: Response) => {
      const { score } = req.body;
      if (typeof score === 'number') {
        this.setTrustScore(score);
        res.json({ success: true, trustScore: this.trustScore });
      } else {
        res.status(400).json({ error: 'Invalid score' });
      }
    });

    // Root page for demo
    this.app.get('/', (req: Request, res: Response) => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Eidolon Agent</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;background:#f5f5f5;color:#333}a{color:#0066cc}code{background:#eee;padding:2px 4px;border-radius:3px}</style>
</head>
<body>
  <h1>🏛️ Eidolon Agent</h1>
  <p><strong>Status:</strong> <span style="color:green;">Running</span></p>
  <p><strong>Port:</strong> ${this.config.port}</p>
  <p><strong>Treasury Wallet:</strong> ${this.config.paymentAddress}</p>
  <p><strong>x402 Trust Score:</strong> ${this.trustScore}/1000</p>
  <h2>Endpoints</h2>
  <ul>
    <li><a href="/health">/health</a> — Health check</li>
    <li><code>GET /signals/price/:token</code> — Price signal (x402)</li>
    <li><code>GET /reports/daily</code> — Daily report (x402)</li>
    <li><code>POST /copilot/chat</code> — Chat (x402)</li>
    <li><code>POST /webhook/credit</code> — Credit client</li>
  </ul>
  <p><em>Built with OpenClaw | Bankr LLM Gateway | x402</em></p>
</body>
</html>`;
      res.send(html);
    });
  }

  start() {
    this.app.listen(this.config.port, () => {
      this.emit('started', { port: this.config.port });
      console.log(`X402 server listening on port ${this.config.port}`);
    });
  }

  stop() {
    // In express, we need to keep server instance; for simplicity, assume process exit
    this.emit('stopped');
  }

  getApp() {
    return this.app;
  }
}
