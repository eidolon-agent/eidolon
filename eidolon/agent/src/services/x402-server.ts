import express, { Request, Response } from 'express';
import * as path from 'path';
import { EventEmitter } from 'events';
import axios from 'axios';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { BankrClient } from '../core/bankr-client';

export interface X402Config {
  port: number;
  paymentAddress: string;
  pricing: Record<string, { priceUSD: number; description: string }>;
  maxDebt: number;
  dataDir?: string;
  demoMode?: boolean;
  rpcUrl?: string;
  tokens?: string[];
  facilitatorUrl?: string;
  coinbaseApiKey?: string;
}

export class X402Server extends EventEmitter {
  private app = express();
  private server?: any;
  private ledger = new Map<string, { balance: number; debt: number }>();
  private trustScore = 500;
  private balanceInterval?: NodeJS.Timeout;

  private provider?: ethers.providers.JsonRpcProvider;

  constructor(
    private config: X402Config,
    private bankr: BankrClient,
    private options?: { rpcUrl?: string; tokens?: string[] }
  ) {
    super();

    if (options?.rpcUrl || config.rpcUrl) {
      this.provider = new ethers.providers.JsonRpcProvider(
        options?.rpcUrl || config.rpcUrl
      );
    }

    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'public')));

    this.setupRoutes();
  }

  /* ========================= START / STOP ========================= */

  start() {
    this.server = this.app.listen(this.config.port, () => {
      console.log(`[X402] running on port ${this.config.port}`);
      this.emit('started', this.config.port);
    });

    this.startBalancePolling();
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('[X402] stopped');
      });
    }

    if (this.balanceInterval) {
      clearInterval(this.balanceInterval);
    }
  }

  /* ========================= ROUTES ========================= */

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        trustScore: this.trustScore,
        facilitator: this.config.facilitatorUrl ? 'coinbase' : 'custom',
      });
    });

    this.app.get('/stats', (req, res) => {
      const clients = Array.from(this.ledger.entries());

      const stats = clients.map(([id, v]) => ({
        id,
        balance: v.balance,
        debt: v.debt,
      }));

      res.json({
        clients: stats,
        trustScore: this.trustScore,
      });
    });
  }

  /* ========================= PRICED ENDPOINT ========================= */

  setupPricedEndpoint(
    routePath: string,
    method: 'GET' | 'POST',
    handler: (req: Request, res: Response) => Promise<void>
  ) {
    const price = this.config.pricing[routePath]?.priceUSD;

    if (!price) throw new Error(`Missing pricing for ${routePath}`);

    const middleware = async (req: Request, res: Response, next: Function) => {
      const clientId = req.header('X-Client-ID');

      if (!clientId) {
        return res.status(400).json({ error: 'Missing X-Client-ID' });
      }

      // Coinbase flow
      if (this.config.facilitatorUrl) {
        const ok = await this.verifyWithCoinbase(clientId, routePath, price);
        if (!ok) return this.return402(res, price, routePath);
        return next();
      }

      // Ledger flow
      let entry = this.ledger.get(clientId);
      if (!entry) {
        entry = { balance: 0, debt: 0 };
        this.ledger.set(clientId, entry);
      }

      if (entry.balance >= price) {
        entry.balance -= price;
        entry.debt += price;
        this.emit('credit', { clientId, amount: price });
        return next();
      }

      return this.return402(res, price, routePath);
    };

    const wrapped = async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (err: any) {
        this.emit('error', err?.message || err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal error' });
        }
      }
    };

    if (method === 'GET') this.app.get(routePath, middleware, wrapped);
    else this.app.post(routePath, middleware, wrapped);
  }

  /* ========================= PAYMENT ========================= */

  private return402(res: Response, price: number, resource: string) {
    res.set('X-402-Payment-Required', `${price} USDC`);
    res.set('X-402-Payment-Address', this.config.paymentAddress);

    res.status(402).json({
      error: 'Payment required',
      price,
      resource,
    });
  }

  private async verifyWithCoinbase(
    clientId: string,
    resource: string,
    amount: number
  ): Promise<boolean> {
    try {
      const res = await axios.post(
        `${this.config.facilitatorUrl}/verify`,
        { clientId, resource, amount },
        {
          headers: {
            'X-API-Key': this.config.coinbaseApiKey || '',
          },
          timeout: 5000,
        }
      );

      return res.data?.valid === true;
    } catch (err: any) {
      console.error('[X402] verify error:', err?.message || err);
      return false;
    }
  }

  /* ========================= BALANCES ========================= */

  private async fetchBalances() {
    try {
      const balances = await this.bankr.getBalances();
      return balances;
    } catch (err: any) {
      console.error('[X402] balance error:', err?.message || err);
      return null;
    }
  }

  private startBalancePolling() {
    this.balanceInterval = setInterval(() => {
      this.fetchBalances();
    }, 60000);
  }

  /* ========================= TRUST ========================= */

  setTrustScore(score: number) {
    this.trustScore = score;
  }
  }
