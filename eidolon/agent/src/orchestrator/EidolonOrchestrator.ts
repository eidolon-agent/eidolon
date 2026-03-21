import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';
import { EthereumKnowledgeService } from '../services/ethereum-knowledge';

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
  private config: EidolonConfig;
  private bankr: BankrClient;
  private treasury: TreasuryManager;
  private reputation: ReputationManager;
  private trading: TradingCopilot;
  private token: TokenCopilot;
  private research: ResearchCopilot;
  private x402: X402Server;
  private ethKnowledge: EthereumKnowledgeService;

  private running = false;
  private loopInterval: NodeJS.Timeout | null = null;
  private loopInProgress = false;

  constructor(config: EidolonConfig) {
    super();
    this.config = config;

    // ✅ INIT CORE
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

    // ✅ FIX: pass initialized ethKnowledge
    this.trading = new TradingCopilot(
      this.bankr,
      config.agent.llmModel,
      this.ethKnowledge
    );

    this.token = new TokenCopilot(this.bankr);
    this.research = new ResearchCopilot(this.bankr);

    // ✅ FIX: CLEAN constructor (no duplicate garbage)
    this.x402 = new X402Server(
      {
        port: config.x402.port,
        paymentAddress: config.x402.paymentAddress,
        pricing: config.x402.pricing,
        maxDebt: config.x402.maxDebt,
        dataDir: config.x402.dataDir,
        demoMode: config.x402.demoMode,
        coinbaseApiKey: config.x402.coinbaseApiKey,
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens,
      },
      this.bankr
    );

    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    const forward = (emitter: any, event: string) => {
      emitter.on(event, (...args: any[]) => {
        this.emit(event, ...args);
      });
    };

    forward(this.treasury, 'log');
    forward(this.treasury, 'alert');
    forward(this.treasury, 'error');

    forward(this.trading, 'log');
    forward(this.trading, 'trade');
    forward(this.trading, 'error');

    forward(this.token, 'log');
    forward(this.token, 'launched');
    forward(this.token, 'error');

    forward(this.research, 'log');
    forward(this.research, 'error');

    forward(this.x402, 'payment');
    forward(this.x402, 'credit');
    forward(this.x402, 'error');

    forward(this.reputation, 'registered');
  }

  async initializeIdentity(): Promise<void> {
    const agentId = this.config.erc8004.agentId;

    const isValid = agentId && /^0x[0-9a-fA-F]{40,}$/.test(agentId);

    if (isValid) {
      this.reputation.setAgentId(BigInt(agentId));
      this.emit('log', `Using existing agent ID ${agentId}`);
      return;
    }

    if (!this.reputation.isEnabled()) {
      this.emit('log', 'ERC-8004 disabled, skipping identity');
      return;
    }

    try {
      const newId = await this.reputation.registerAgent(
        this.config.agent.name,
        this.config.agent.description,
        this.config.agent.capabilities
      );
      this.emit('log', `Agent registered: ${newId}`);
    } catch (err: any) {
      this.emit('error', err.message);
    }
  }

  async start() {
    if (this.running) return;

    this.emit('log', 'Starting system...');

    await this.initializeIdentity();

    this.x402.start();
    this.treasury.startAutoRefillLoop();

    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);

    this.running = true;

    // ✅ FIX: safe loop
    this.loopInterval = setInterval(() => {
      this.safeLoop();
    }, 5 * 60 * 1000);

    await this.safeLoop();
  }

  stop() {
    this.running = false;

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    this.treasury.stopAutoRefillLoop();

    this.emit('stopped');
  }

  private async safeLoop() {
    if (this.loopInProgress) {
      this.emit('log', 'Skipping loop (still running)');
      return;
    }

    this.loopInProgress = true;

    try {
      await this.runAutonomousLoop();
    } finally {
      this.loopInProgress = false;
    }
  }

  private async runAutonomousLoop() {
    if (!this.running) return;

    this.emit('log', '=== LOOP START ===');

    try {
      // 1. treasury check
      const health = await this.treasury.healthCheck();
      if (!health.healthy) {
        this.emit('alert', JSON.stringify(health));
      }

      // 2. trust score sync
      const score = await this.reputation.getReputationScore();
      this.x402.setTrustScore(score);

      // 3. trading
      const trade = await this.trading.analyzeAndTrade(true);
      if (trade?.result?.success) {
        this.emit('log', `Trade success`);
      }

      // 4. research (guard)
      const credits = await this.treasury.getLLMCredits();
      if (credits > 10) {
        const report = await this.research.generateDailyReport();
        this.emit('log', report.title);
      }

      // 5. claim fees (safe)
      try {
        await this.token.claimFees('EIDO');
      } catch {
        // ignore
      }

    } catch (err: any) {
      this.emit('error', err.stack || err.message);
    }

    this.emit('log', '=== LOOP END ===');
  }

  getX402Server() {
    return this.x402;
  }

  getTreasury() {
    return this.treasury;
  }

  getTradingCopilot() {
    return this.trading;
  }

  getTokenCopilot() {
    return this.token;
  }

  getResearchCopilot() {
    return this.research;
  }

  getReputationManager() {
    return this.reputation;
  }
  }
