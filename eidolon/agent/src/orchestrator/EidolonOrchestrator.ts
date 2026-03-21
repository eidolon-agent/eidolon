import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';
import { EthereumKnowledgeService } from '../services/ethereum-knowledge';

/* ========================= TYPES ========================= */

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

type LoopState = 'idle' | 'running' | 'error';

/* ========================= ORCHESTRATOR ========================= */

export class EidolonOrchestrator extends EventEmitter {
  private readonly config: EidolonConfig;

  // Core
  private readonly bankr: BankrClient;
  private readonly treasury: TreasuryManager;
  private readonly reputation: ReputationManager;

  // Services
  private readonly trading: TradingCopilot;
  private readonly token: TokenCopilot;
  private readonly research: ResearchCopilot;
  private readonly x402: X402Server;
  private readonly ethKnowledge: EthereumKnowledgeService;

  // Runtime state
  private running = false;
  private loopState: LoopState = 'idle';
  private loopTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();

  constructor(config: EidolonConfig) {
    super();
    this.config = config;

    /* ===== Core ===== */
    this.bankr = new BankrClient({
      llmApiKey: config.bankr.llmApiKey,
      agentApiKey: config.bankr.agentApiKey,
    });

    this.ethKnowledge = new EthereumKnowledgeService();
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

    /* ===== Services ===== */
    this.trading = new TradingCopilot(
      this.bankr,
      config.agent.llmModel,
      this.ethKnowledge
    );

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
        coinbaseApiKey:
          process.env.COINBASE_CDP_API_KEY || config.x402.coinbaseApiKey,
      },
      this.bankr,
      {
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens,
      }
    );

    this.setupEvents();
  }

  /* ========================= EVENTS ========================= */

  private setupEvents() {
    const forward = (emitter: EventEmitter, event: string) => {
      emitter.on(event, (...args: unknown[]) => {
        this.emit(event, ...args);
      });
    };

    forward(this.treasury, 'log');
    forward(this.treasury, 'alert');
    forward(this.trading, 'trade');
    forward(this.x402, 'payment');
  }

  /* ========================= START ========================= */

  async start(): Promise<void> {
    this.emit('log', '[Eidolon] Starting system');

    // 🔥 NEVER BLOCK STARTUP
    try {
      await this.initializeIdentity();
    } catch (err: unknown) {
      this.emit('error', `[Identity] ${this.getError(err)}`);
    }

    // ALWAYS START SERVER
    this.x402.start();

    try {
      this.treasury.startAutoRefillLoop();
    } catch (err) {
      this.emit('error', `[Treasury] ${this.getError(err)}`);
    }

    try {
      const score = await this.reputation.getReputationScore();
      this.x402.setTrustScore(score);
    } catch {
      this.x402.setTrustScore(500);
    }

    this.running = true;
    this.startLoop();
  }

  stop(): void {
    this.running = false;

    if (this.loopTimer) {
      clearInterval(this.loopTimer);
    }

    this.x402.stop();
    this.treasury.stopAutoRefillLoop();
  }

  /* ========================= LOOP ========================= */

  private startLoop() {
    this.loopTimer = setInterval(() => {
      void this.safeLoop();
    }, 60_000);

    void this.safeLoop(); // run immediately
  }

  private async safeLoop(): Promise<void> {
    if (!this.running || this.loopState === 'running') return;

    this.loopState = 'running';

    try {
      await this.runLoop();
      this.loopState = 'idle';
    } catch (err) {
      this.loopState = 'error';
      this.emit('error', `[Loop] ${this.getError(err)}`);
    }
  }

  private async runLoop(): Promise<void> {
    // 1. Treasury health
    const health = await this.treasury.healthCheck();
    if (!health.healthy) {
      this.emit('alert', `Treasury issue: ${health.actions?.join(', ')}`);
    }

    // 2. Reputation sync (safe)
    try {
      const score = await this.reputation.getReputationScore();
      this.x402.setTrustScore(score);
    } catch {
      // ignore
    }

    // 3. Trading
    try {
      const result = await this.trading.analyzeAndTrade(true);
      if (result?.result?.success) {
        this.emit(
          'log',
          `Trade: ${result.signal.tokenIn} → ${result.signal.tokenOut}`
        );
      }
    } catch (err) {
      this.emit('error', `[Trading] ${this.getError(err)}`);
    }

    // 4. Research (budget-aware)
    const credits = await this.treasury.getLLMCredits();
    if (credits > 10) {
      try {
        const report = await this.research.generateDailyReport();
        this.emit('log', `Report generated: ${report.title}`);
      } catch (err) {
        this.emit('error', `[Research] ${this.getError(err)}`);
      }
    }
  }

  /* ========================= IDENTITY ========================= */

  private async initializeIdentity(): Promise<void> {
    const id = this.config.erc8004.agentId;

    if (!id) {
      throw new Error('AGENT_ID is required in production');
    }

    if (!/^0x[0-9a-fA-F]{40,}$/.test(id)) {
      throw new Error('Invalid AGENT_ID format');
    }

    this.reputation.setAgentId(BigInt(id));
    this.emit('log', `[Eidolon] Using agent ${id}`);
  }

  /* ========================= UTILS ========================= */

  private getError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  /* ========================= GETTERS ========================= */

  getX402(): X402Server {
    return this.x402;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
      }
