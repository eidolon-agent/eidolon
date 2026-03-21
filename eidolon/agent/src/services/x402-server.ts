import express, { Request, Response } from 'express';
import * as path from 'path';
import { BankrClient } from '../core/bankr-client';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { ethers } from 'ethers';

export interface X402Config {
  port: number;
  paymentAddress: string;
  pricing: Record<string, { priceUSD: number; description: string }>;
  maxDebt: number;
  dataDir?: string;
  demoMode?: boolean;
  rpcUrl?: string;
  tokens?: string[];
  // Coinbase CDP hosted facilitator (optional)
  facilitatorUrl?: string; // e.g., https://api.coinbase.com/v1/x402/verify
  coinbaseApiKey?: string; // CDP API key
}

export class X402Server extends EventEmitter {
  private app: express.Application;
  private config: X402Config;
  private bankr: BankrClient;
  private ledger: Map<string, { balance: number; debt: number }>;
  private trustScore: number = 500;
  private onChainBalances: any = null;
  private rpcUrl?: string;
  private tokens?: string[];
  private provider?: ethers.providers.JsonRpcProvider;
  private facilitatorUrl?: string;
  private coinbaseApiKey?: string;

  constructor(config: X402Config, bankr: BankrClient, options?: { rpcUrl?: string; tokens?: string[] }) {
    super();
    this.config = config;
    this.bankr = bankr;
    this.rpcUrl = options?.rpcUrl || config.rpcUrl;
    this.tokens = options?.tokens || config.tokens;
    this.facilitatorUrl = config.facilitatorUrl;
    this.coinbaseApiKey = config.coinbaseApiKey;

    if (this.rpcUrl) {
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    }

    // Simple in-memory ledger
    this.ledger = new Map();

    this.app = express();
    this.app.use(express.json());

    // Static files
    this.app.use(express.static(path.join(process.cwd(), 'public')));
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
    });
    this.app.get('/dashboard', (req: Request, res: Response) => {
      res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
    });
    this.app.get('/docs', (req: Request, res: Response) => {
      res.sendFile(path.join(process.cwd(), 'public', 'docs.html'));
    });

    this.setupRoutes();
    this.startBalancePolling();

    // Demo mode: seed demo client
    if (config.demoMode) {
      const demoId = 'demo';
      this.ledger.set(demoId, { balance: 10, debt: 0 });
      this.emit('log', `[X402] Demo mode: seeded client '${demoId}' with $10 credit`);
    }
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        trustScore: this.trustScore,
        timestamp: new Date().toISOString(),
        facilitator: this.facilitatorUrl ? 'coinbase-cdp' : 'custom',
        paymentAddress: this.config.paymentAddress,
      });
    });

    // Stats
    this.app.get('/stats', async (req: Request, res: Response) => {
      const clients = Array.from(this.ledger.keys());
      let totalBalance = 0;
      let totalDebt = 0;
      const clientStats: Array<{id: string; balance: number; debt: number}> = [];
      for (const c of clients) {
        const entry = this.ledger.get(c)!;
        totalBalance += entry.balance;
        totalDebt += entry.debt;
        clientStats.push({ id: c, balance: entry.balance, debt: entry.debt });
      }
      res.json({
        trustScore: this.trustScore,
        clientCount: clients.length,
        totalBalance,
        totalDebt,
        netPosition: totalBalance - totalDebt,
        clients: clientStats,
        pricing: this.config.pricing,
        paymentAddress: this.config.paymentAddress,
        uptime: process.uptime(),
        onChainBalances: this.onChainBalances,
      });
    });

    // SSE events
    this.app.get('/events', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const send = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      send({ level: 'info', message: 'Event stream connected' });

      const onLog = (data: any) => send({ level: 'info', message: data });
      const onError = (data: any) => send({ level: 'error', error: data });
      const onCredit = (data: any) => send({ level: 'info', message: `Credit: ${data.clientId} +$${data.amount}` });

      this.on('log', onLog);
      this.on('error', onError);
      this.on('credit', onCredit);

      req.on('close', () => {
        this.removeListener('log', onLog);
        this.removeListener('error', onError);
        this.removeListener('credit', onCredit);
        res.end();
      });
    });

    // Protected endpoints (x402)
    this.setupPricedEndpoint('/signals/price/:token', 'GET', async (req: Request, res: Response) => {
      const { token } = req.params;
      const signal = {
        token,
        signal: Math.random() > 0.5 ? 'BUY' : 'HOLD',
        confidence: 0.5 + Math.random() * 0.5,
        reason: 'LLM analysis of on-chain flows',
        timestamp: new Date().toISOString(),
      };
      res.json({ success: true, data: signal });
    });

    this.setupPricedEndpoint('/reports/daily', 'GET', async (req: Request, res: Response) => {
      const report = {
        title: `Daily Report - ${new Date().toISOString().split('T')[0]}`,
        summary: 'Market bullish on Base; Aerodrome volume up 12%.',
        metrics: { 'ETH price': 3200, '24h change': '+2.4%' },
        insights: ['Increased inflow to USDC on Base', 'New token launches trending'],
        generatedAt: new Date().toISOString(),
      };
      res.json({ success: true, data: report });
    });

    this.setupPricedEndpoint('/copilot/chat', 'POST', async (req: Request, res: Response) => {
      const { message } = req.body;
      const response = `[Copilot] I heard you: "${message}". (Integrate Bankr LLM Gateway for real responses.)`;
      res.json({ success: true, response, timestamp: new Date().toISOString() });
    });
  }

  private setupPricedEndpoint(path: string, method: string, handler: (req: Request, res: Response) => Promise<any>) {
    const pricing = this.config.pricing[path];
    if (!pricing) {
      throw new Error(`No pricing configured for ${path}`);
    }
    const priceUSD = pricing.priceUSD;

    // Create middleware that enforces payment
    const middleware = async (req: Request, res: Response, next: Function) => {
      const clientId = req.header('X-Client-ID') || uuidv4();

      // If Coinbase CDP facilitator is configured, use it
      if (this.facilitatorUrl) {
        const verified = await this.verifyWithCoinbase(clientId, path, priceUSD);
        if (!verified) {
          this.return402(res, priceUSD, path);
          return;
        }
        // proceed
        next();
        return;
      }

      // Fallback: custom in-memory ledger
      let entry = this.ledger.get(clientId);
      if (!entry) {
        entry = { balance: 0, debt: 0 };
        this.ledger.set(clientId, entry);
      }
      if (entry.balance >= priceUSD) {
        entry.balance -= priceUSD;
        entry.debt += priceUSD;
        this.emit('credit', { clientId, amount: priceUSD, resource: path });
        next();
      } else {
        this.return402(res, priceUSD, path);
      }
    };

    // Register route with middleware
    if (method === 'GET') {
      this.app.get(path, middleware, async (req: Request, res: Response) => {
        try {
          const result = await handler(req, res);
          res.json(result);
        } catch (err: any) {
          this.emit('error', err.message);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    } else if (method === 'POST') {
      this.app.post(path, middleware, async (req: Request, res: Response) => {
        try {
          const result = await handler(req, res);
          res.json(result);
        } catch (err: any) {
          this.emit('error', err.message);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    } else {
      throw new Error(`Unsupported method ${method}`);
    }
  }

  private return402(res: Response, priceUSD: number, resource: string) {
    res.set('X-402-Payment-Required', `${priceUSD} USDC`);
    res.set('X-402-Payment-Address', this.config.paymentAddress);
    res.set('X-402-Payment-Description', `Access to ${resource}`);
    res.set('X-Payment-Provider', this.facilitatorUrl ? 'coinbase-cdp' : 'eidolon-custom');
    res.status(402).json({
      error: 'Payment required',
      priceUSD,
      paymentAddress: this.config.paymentAddress,
      resource,
    });
  }

  // Verify payment via Coinbase CDP hosted facilitator
  private async verifyWithCoinbase(clientId: string, resource: string, amount: number): Promise<boolean> {
    if (!this.facilitatorUrl) return false;
    try {
      const response = await axios.post(
        `${this.facilitatorUrl}/verify`, // adjust path as needed
        {
          clientId,
          resource,
          amount,
          currency: 'USDC',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.coinbaseApiKey,
          },
          timeout: 5000,
        }
      );
      // Expected response: { valid: true } or { valid: false, reason?: string }
      return response.data.valid === true;
    } catch (error: any) {
      console.error('[X402] Coinbase verification error:', error.message);
      return false;
    }
  }

  // Update trust score from ERC-8004
  setTrustScore(score: number) {
    this.trustScore = score;
    this.emit('log', `[X402] Trust score updated: ${score}`);
  }

  private async fetchOnChainBalances(): Promise<any> {
    try {
      const balances = await this.bankr.getBalances();

      // Include custom token balances if configured
      if (this.tokens && this.tokens.length > 0 && this.provider) {
        const wallet = this.config.paymentAddress;
        for (const tokenAddr of this.tokens) {
          try {
            const info = await this.fetchTokenInfo(tokenAddr);
            const balanceWei = await this.fetchTokenBalanceRaw(tokenAddr, wallet);
            const balanceHuman = ethers.utils.formatUnits(balanceWei, info.decimals);
            if (!balances.balances) balances.balances = [];
            balances.balances.push({
              currency: info.symbol,
              balance: balanceHuman,
              address: tokenAddr,
              decimals: info.decimals,
            });
          } catch (err) {
            console.error(`[X402] Failed to fetch custom token ${tokenAddr}:`, err);
          }
        }
      }

      this.onChainBalances = balances;
      return balances;
    } catch (err: any) {
      console.warn('[X402] Failed to fetch on-chain balances:', err.message);
      return null;
    }
  }

  // Fetch token symbol and decimals via RPC
  private async fetchTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
    if (!this.provider) throw new Error('No RPC provider configured');
    const iface = new ethers.utils.Interface([
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ]);
    const [symbolRes, decimalsRes] = await Promise.all([
      this.provider.send('eth_call', [{
        to: tokenAddress,
        data: iface.encodeFunctionData('symbol', [])
      }, 'latest']),
      this.provider.send('eth_call', [{
        to: tokenAddress,
        data: iface.encodeFunctionData('decimals', [])
      }, 'latest'])
    ]);
    const symbol = iface.decodeFunctionResult('symbol', symbolRes) as any;
    const decimals = iface.decodeFunctionResult('decimals', decimalsRes).toNumber();
    return { symbol, decimals };
  }

  // Fetch raw token balance (wei/atomic) via RPC
  private async fetchTokenBalanceRaw(tokenAddress: string, walletAddress: string): Promise<string> {
    if (!this.provider) throw new Error('No RPC provider configured');
    const iface = new ethers.utils.Interface([
      'function balanceOf(address) view returns (uint256)'
    ]);
    const data = iface.encodeFunctionData('balanceOf', [walletAddress]);
    const result = await this.provider.send('eth_call', [{
      to: tokenAddress,
      data: data
    }, 'latest']);
    const bal = ethers.BigNumber.from(result);
    return bal.toString();
  }

  private startBalancePolling() {
    setInterval(() => {
      this.fetchOnChainBalances().catch(console.error);
    }, 60_000);
    this.fetchOnChainBalances().catch(console.error);
  }

  start() {
    this.app.listen(this.config.port, () => {
      this.emit('started', { port: this.config.port });
      console.log(`X402 server listening on port ${this.config.port}`);
    });
  }
}
