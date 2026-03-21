import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';

export interface EidolonConfig {
  bankr: {
    llmApiKey: string;
    agentApiKey: string;
  };
  treasury: {
    walletAddress: string;
    autoRefillThreshold: number;
    autoRefillAmount: number;
    minUSDCBalance: number;
    tokens?: string[];
  };
  erc8004: {
    identityRegistry: string;
    reputationRegistry: string;
    validationRegistry: string;
    operatorWallet: string;
    agentId?: string;
  };
  x402: {
    port: number;
    paymentAddress: string;
    pricing: Record<string, { priceUSD: number; description: string }>;
    maxDebt: number;
    dataDir?: string;
    demoMode?: boolean;
    coinbaseApiKey?: string;
  };
  network: {
    rpcUrl: string;
    chainId: number;
  };
  agent: {
    name: string;
    description: string;
    capabilities: string[];
    llmModel?: string;
  };
}

export class EidolonOrchestrator extends EventEmitter {
  private bankr: BankrClient;
  private treasury: TreasuryManager;
  private reputation: ReputationManager;
  private trading: TradingCopilot;
  private token: TokenCopilot;
  private research: ResearchCopilot;
  private x402: X402Server;

  private running = false;
  private loop?: NodeJS.Timeout;

  constructor(private config: EidolonConfig) {
    super();

    // ✅ VALIDATION
    if (!config.erc8004.agentId) {
      throw new Error('AGENT_ID wajib di production');
    }

    this.bankr = new BankrClient({
      llmApiKey: config.bankr.llmApiKey,
      agentApiKey: config.bankr.agentApiKey,
    });

    this.treasury = new TreasuryManager(this.bankr, {
      walletAddress: config.treasury.walletAddress,
      autoRefillThreshold: config.treasury.autoRefillThreshold,
      autoRefillAmount: config.treasury.autoRefillAmount,
      minUSDCBalance: config.treasury.minUSDCBalance,
      tokens: config.treasury.tokens,
      rpcUrl: config.network.rpcUrl,
    });

    this.reputation = new ReputationManager(
      {
        identityRegistry: config.erc8004.identityRegistry,
        reputationRegistry: config.erc8004.reputationRegistry,
        validationRegistry: config.erc8004.validationRegistry,
        operatorWallet: config.erc8004.operatorWallet,
      },
      config.network.rpcUrl
    );

    this.trading = new TradingCopilot(this.bankr, config.agent.llmModel);
    this.token = new TokenCopilot(this.bankr);
    this.research = new ResearchCopilot(this.bankr);

    this.x402 = new X402Server(
      {
        port: config.x402.port,
        paymentAddress: config.x402.paymentAddress,
        pricing: config.x402.pricing,
        maxDebt: config.x402.maxDebt,
        dataDir: config.x402.dataDir,
        demoMode: config.x402.demoMode,
        coinbaseApiKey: config.x402.coinbaseApiKey,
      },
      this.bankr,
      {
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens,
      }
    );

    this.forwardEvents();
  }

  /* ========================= IDENTITY ========================= */

  async initializeIdentity() {
    const raw = this.config.erc8004.agentId!;

    try {
      const id = BigInt(raw);

      this.reputation.setAgentId(id);

      this.emit('log', `[Eidolon] Using existing agent ID ${id}`);

    } catch (err: any) {
      this.emit('error', `Invalid AGENT_ID: ${err.message}`);
      throw err;
    }
  }

  /* ========================= START ========================= */

  async start() {
    this.emit('log', '[Eidolon] Starting...');

    await this.initializeIdentity();

    this.x402.start();
    this.treasury.startAutoRefillLoop();

    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);

    this.running = true;

    // ✅ improved loop (no overlap)
    this.loop = setInterval(() => {
      this.safeLoop();
    }, 60_000); // 1 min

    await this.safeLoop();

    this.emit('log', '[Eidolon] Running');
  }

  stop() {
    this.running = false;

    if (this.loop) clearInterval(this.loop);

    this.treasury.stopAutoRefillLoop();
    this.x402.stop();

    this.emit('log', '[Eidolon] Stopped');
  }

  /* ========================= LOOP ========================= */

  private isRunningLoop = false;

  private async safeLoop() {
    if (this.isRunningLoop) return; // prevent overlap
    this.isRunningLoop = true;

    try {
      await this.runLoop();
    } catch (err: any) {
      this.emit('error', err.message);
    } finally {
      this.isRunningLoop = false;
    }
  }

  private async runLoop() {
    if (!this.running) return;

    this.emit('log', '[Loop] start');

    // 1. treasury health
    const health = await this.treasury.healthCheck();
    if (!health.healthy) {
      this.emit('alert', `Treasury issue: ${health.actions?.join(', ')}`);
    }

    // 2. reputation sync
    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);

    // 3. trading (safe)
    try {
      const trade = await this.trading.analyzeAndTrade(true);
      if (trade?.result?.success) {
        this.emit('trade', trade);
      }
    } catch (err) {
      this.emit('log', 'Trade skipped');
    }

    // 4. research (only if enough credits)
    try {
      const credits = await this.treasury.getLLMCredits();
      if (credits > 10) {
        const report = await this.research.generateDailyReport();
        this.emit('log', `Report: ${report.title}`);
      }
    } catch {}

    // 5. token fees (non-blocking)
    this.token.claimFees('EIDO').catch(() => {});

    this.emit('log', '[Loop] end');
  }

  /* ========================= EVENTS ========================= */

  private forwardEvents() {
    const f = (em: any, ev: string) =>
      em.on(ev, (...a: any[]) => this.emit(ev, ...a));

    f(this.treasury, 'log');
    f(this.treasury, 'alert');
    f(this.trading, 'trade');
    f(this.trading, 'error');
    f(this.token, 'launched');
    f(this.research, 'log');
    f(this.x402, 'credit');
    f(this.x402, 'payment');
  }

  /* ========================= GETTERS ========================= */

  getX402() {
    return this.x402;
  }
      }
