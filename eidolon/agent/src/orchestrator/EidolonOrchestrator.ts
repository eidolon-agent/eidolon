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
    coinbaseApiKey?: string;
    demoMode?: boolean;
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
    tokenSymbol?: string;
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
  private ethKnowledge!: EthereumKnowledgeService;

  private running = false;
  private isLoopRunning = false;

  constructor(config: EidolonConfig) {
    super();
    this.config = config;

    // Core clients
    this.bankr = new BankrClient({
      llmApiKey: config.bankr.llmApiKey,
      agentApiKey: config.bankr.agentApiKey,
    });

    this.treasury = new TreasuryManager(this.bankr, {
      walletAddress: config.treasury.walletAddress,
      autoRefillThreshold: config.treasury.autoRefillThreshold,
      autoRefillAmount: config.treasury.autoRefillAmount,
      minUSDCBalance: config.treasury.minUSDCBalance,
      tokens: config.treasury.tokens || [],
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

    // Services
    this.ethKnowledge = new EthereumKnowledgeService();

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
          process.env.COINBASE_CDP_API_KEY ||
          config.x402.coinbaseApiKey ||
          '',
      },
      this.bankr,
      {
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens || [],
      }
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
      this.emit('log', `[Eidolon] Using existing agent ID ${agentId}`);
      return;
    }

    if (!this.reputation.isEnabled()) {
      this.emit('log', '[Eidolon] ERC-8004 not configured.');
      return;
    }

    try {
      const newId = await this.reputation.registerAgent(
        this.config.agent.name,
        this.config.agent.description,
        this.config.agent.capabilities
      );
      this.emit('log', `[Eidolon] Registered ID ${newId}`);
    } catch (err: any) {
      this.emit('error', err.stack || err.message);
    }
  }

  async start() {
    this.emit('log', '[Eidolon] Starting...');

    await this.initializeIdentity();

    this.x402.start();
    this.treasury.startAutoRefillLoop();

    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);

    this.running = true;
    this.startLoop();
  }

  stop() {
    this.running = false;
    this.treasury.stopAutoRefillLoop();
    this.x402.stop?.();
    this.emit('stopped');
  }

  private async startLoop() {
    while (this.running) {
      await this.runAutonomousLoop();
      await new Promise(res => setTimeout(res, 5 * 60 * 1000));
    }
  }

  private async runAutonomousLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    this.emit('log', '[Eidolon] Loop start');

    try {
      await this.safe('health', async () => {
        const h = await this.treasury.healthCheck();
        if (!h.healthy) {
          this.emit('alert', h.actions?.join('; '));
        }
      });

      await this.safe('reputation', async () => {
        const score = await this.reputation.getReputationScore();
        this.x402.setTrustScore(score);
      });

      await this.safe('trading', async () => {
        const t = await this.trading.analyzeAndTrade(true);
        if (t.result?.success) {
          this.emit('log', `Trade: ${t.signal.tokenIn}->${t.signal.tokenOut}`);
        }
      });

      await this.safe('research', async () => {
        const credits = await this.treasury.getLLMCredits();
        if (credits > 10) {
          const r = await this.research.generateDailyReport();
          this.emit('log', `Report: ${r.title}`);
        }
      });

      await this.safe('fees', async () => {
        const symbol = this.config.agent.tokenSymbol || 'EIDO';
        await this.token.claimFees(symbol);
      });

    } catch (err: any) {
      this.emit('error', err.stack || err.message);
    }

    this.emit('log', '[Eidolon] Loop end');
    this.isLoopRunning = false;
  }

  private async safe(name: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err: any) {
      this.emit('error', `[${name}] ${err.stack || err.message}`);
    }
  }

  getX402Server() { return this.x402; }
  getTreasury() { return this.treasury; }
  getTradingCopilot() { return this.trading; }
  getTokenCopilot() { return this.token; }
  getResearchCopilot() { return this.research; }
  getReputationManager() { return this.reputation; }
}
