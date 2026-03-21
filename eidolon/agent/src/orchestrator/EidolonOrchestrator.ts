import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';
import { EthereumKnowledgeService } from '../services/ethereum-knowledge';
import { ethers } from 'ethers';

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
  private running = false;
  private loopInterval: NodeJS.Timeout | null = null;

  private bankr: BankrClient;
  private treasury: TreasuryManager;
  private reputation: ReputationManager;
  private trading: TradingCopilot;
  private token: TokenCopilot;
  private research: ResearchCopilot;
  private x402: X402Server;
  private ethKnowledge: EthereumKnowledgeService;

  constructor(private config: EidolonConfig) {
    super();

    this.bankr = new BankrClient(config.bankr);

    this.ethKnowledge = new EthereumKnowledgeService(config.network.rpcUrl);

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
        coinbaseApiKey: config.x402.coinbaseApiKey,
      },
      this.bankr,
      {
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens,
      }
    );

    this.setupEvents();
  }

  /* ========================= INIT ========================= */

  private setupEvents() {
    const forward = (emitter: any, event: string) => {
      emitter.on(event, (...args: any[]) => this.emit(event, ...args));
    };

    [this.treasury, this.trading, this.token, this.research, this.x402, this.reputation].forEach(e => {
      ['log', 'error', 'alert', 'trade', 'payment', 'credit', 'launched'].forEach(evt => {
        forward(e, evt);
      });
    });
  }

  /* ========================= SAFE HELPERS ========================= */

  private async safeGetReputation(): Promise<number> {
    try {
      return await this.reputation.getReputationScore();
    } catch (err: any) {
      this.emit('log', '[Eidolon] Reputation fallback → 0');
      return 0;
    }
  }

  private async agentExists(): Promise<boolean> {
    try {
      const id = this.config.erc8004.agentId;
      if (!id) return false;
      await this.reputation.getAgent(BigInt(id));
      return true;
    } catch {
      return false;
    }
  }

  /* ========================= IDENTITY ========================= */

  async initializeIdentity() {
    const agentId = this.config.erc8004.agentId;

    if (agentId) {
      this.reputation.setAgentId(BigInt(agentId));

      const exists = await this.agentExists();

      if (!exists) {
        this.emit('alert', `[Eidolon] Agent ${agentId} not found on this network`);
      } else {
        this.emit('log', `[Eidolon] Using agent ${agentId}`);
      }
      return;
    }

    if (!this.reputation.isEnabled()) {
      this.emit('log', '[Eidolon] Reputation disabled');
      return;
    }

    try {
      const id = await this.reputation.registerAgent(
        this.config.agent.name,
        this.config.agent.description,
        this.config.agent.capabilities
      );

      this.emit('log', `[Eidolon] Registered new agent ${id}`);
    } catch (err: any) {
      this.emit('error', err.message);
    }
  }

  /* ========================= START ========================= */

  async start() {
    this.emit('log', '[Eidolon] Starting...');

    await this.validateNetwork();
    await this.initializeIdentity();

    this.x402.start();
    this.treasury.startAutoRefillLoop();

    const score = await this.safeGetReputation();
    this.x402.setTrustScore(score);

    this.running = true;

    this.loopInterval = setInterval(() => {
      this.runLoop().catch(err => {
        this.emit('error', err.message);
      });
    }, 5 * 60 * 1000);

    await this.runLoop();

    this.emit('log', '[Eidolon] Running');
  }

  stop() {
    this.running = false;

    if (this.loopInterval) clearInterval(this.loopInterval);

    this.treasury.stopAutoRefillLoop();
    this.x402.stop();

    this.emit('log', '[Eidolon] Stopped');
  }

  /* ========================= LOOP ========================= */

  private async runLoop() {
    if (!this.running) return;

    this.emit('log', '[Eidolon] Loop start');

    try {
      await Promise.allSettled([
        this.runHealthCheck(),
        this.syncReputation(),
        this.runTrading(),
        this.runResearch(),
        this.claimFees(),
      ]);
    } catch (err: any) {
      this.emit('error', err.message);
    }

    this.emit('log', '[Eidolon] Loop end');
  }

  private async runHealthCheck() {
    const health = await this.treasury.healthCheck();
    if (!health.healthy) {
      this.emit('alert', `Treasury issue: ${health.actions?.join(', ')}`);
    }
  }

  private async syncReputation() {
    const score = await this.safeGetReputation();
    this.x402.setTrustScore(score);
  }

  private async runTrading() {
    const res = await this.trading.analyzeAndTrade(true);
    if (res?.result?.success) {
      this.emit('trade', res);
    }
  }

  private async runResearch() {
    const credits = await this.treasury.getLLMCredits();
    if (credits > 10) {
      const report = await this.research.generateDailyReport();
      this.emit('log', `[Report] ${report.title}`);
    }
  }

  private async claimFees() {
    try {
      await this.token.claimFees('EIDO');
    } catch {}
  }

  /* ========================= NETWORK ========================= */

  private async validateNetwork() {
    const provider = new ethers.providers.JsonRpcProvider(this.config.network.rpcUrl);
    const net = await provider.getNetwork();

    if (net.chainId !== this.config.network.chainId) {
      this.emit('alert', `Chain mismatch: expected ${this.config.network.chainId}, got ${net.chainId}`);
    }
  }
        }
