import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';
import { EthereumKnowledgeService } from '../services/ethereum-knowledge';
import { v4 as uuidv4 } from 'uuid';

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
    dataDir?: string; // optional directory for x402 persistence
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
  private ethKnowledge!: EthereumKnowledgeService; // definite assignment assertion
  private running: boolean = false;
  private loopInterval: NodeJS.Timeout | null = null;

  constructor(config: EidolonConfig) {
    super();
    this.config = config;

    // Initialize core clients
    this.bankr = new BankrClient({
      llmApiKey: config.bankr.llmApiKey,
      agentApiKey: config.bankr.agentApiKey,
    });

    this.treasury = new TreasuryManager(this.bankr, {
      walletAddress: config.treasury.walletAddress,
      autoRefillThreshold: config.treasury.autoRefillThreshold,
      autoRefillAmount: config.treasury.autoRefillAmount,
      minUSDCBalance: config.treasury.minUSDCBalance,
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

    // Ethereum knowledge service (must be initialized before copilots)
    this.ethKnowledge = new EthereumKnowledgeService();

    // Copilots
    this.trading = new TradingCopilot(this.bankr, config.agent.llmModel, this.ethKnowledge);
    this.token = new TokenCopilot(this.bankr);
    this.research = new ResearchCopilot(this.bankr, config.agent.llmModel);

    // X402 server
    this.x402 = new X402Server(
      {
        port: config.x402.port,
        paymentAddress: config.x402.paymentAddress,
        pricing: config.x402.pricing,
        maxDebt: config.x402.maxDebt,
        dataDir: config.x402.dataDir,
      },
      this.bankr
    );

    // Wire events
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    const forward = ( emitter: any, event: string ) => {
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
    if (this.config.erc8004.agentId) {
      this.reputation.setAgentId(BigInt(this.config.erc8004.agentId));
      this.emit('log', `[Eidolon] Using existing agent ID ${this.config.erc8004.agentId}`);
      return;
    }

    if (!this.reputation.isEnabled()) {
      this.emit('log', '[Eidolon] ERC-8004 not configured. Skipping identity registration.');
      return;
    }

    this.emit('log', '[Eidolon] Registering ERC-8004 identity...');
    try {
      const agentId = await this.reputation.registerAgent(
        this.config.agent.name,
        this.config.agent.description,
        this.config.agent.capabilities
      );
      this.emit('log', `[Eidolon] Agent registered with ID ${agentId.toString()}`);
    } catch (err: any) {
      this.emit('error', `Failed to register ERC-8004 identity: ${err.message}`);
      // Continue running; reputation features will be limited
    }
  }

  async start() {
    this.emit('log', '[Eidolon] Starting autonomous system...');

    // Step 1: Ensure identity exists
    await this.initializeIdentity();

    // Step 2: Start X402 server for incoming payments
    this.x402.start();
    this.emit('log', `[Eidolon] X402 server started on port ${this.config.x402.port}`);

    // Step 3: Start treasury auto-refill loop
    this.treasury.startAutoRefillLoop();
    this.emit('log', '[Eidolon] Treasury auto-refill loop started');

    // Step 4: Update trust score in X402 server from reputation
    const initialScore = await this.reputation.getReputationScore();
    this.x402.setTrustScore(initialScore);
    this.emit('log', `[Eidolon] Initial trust score: ${initialScore}`);

    // Step 5: Launch the agent's own token if not already deployed
    // TODO: Check if token exists; if not, launch it
    // For MVP, we assume token is already deployed or user will launch manually
    this.emit('log', '[Eidolon] Token launch should be done manually or via token copilot');

    // Step 6: Start autonomous loop
    this.running = true;
    this.loopInterval = setInterval(() => this.runAutonomousLoop(), 5 * 60 * 1000); // every 5 minutes
    this.emit('log', '[Eidolon] Autonomous loop started (5 min intervals)');

    // Run one immediately
    this.runAutonomousLoop().catch(console.error);
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

  private async runAutonomousLoop() {
    if (!this.running) return;

    this.emit('log', '[Eidolon] === Autonomous Loop Start ===');

    try {
      // 1. Health check: treasury balances
      const health = await this.treasury.healthCheck();
      if (!health.healthy) {
        this.emit('alert', `Treasury health degraded: ${health.actions?.join('; ')}`);
      }

      // 2. Update trust score from reputation and sync to X402
      const score = await this.reputation.getReputationScore();
      this.x402.setTrustScore(score);

      // 3. Generate trading signal (and maybe execute)
      const tradeResult = await this.trading.analyzeAndTrade(/*execute=*/true);
      if (tradeResult.result?.success) {
        // Record a validation (positive) for self? Actually we need to record in reputation
        // For now, just log
        this.emit('log', `[Eidolon] Trade executed: ${tradeResult.signal.tokenIn}->${tradeResult.signal.tokenOut}`);
        // Future: call issueCredential for 'trading_activity' or record validation
      }

      // 4. Optionally generate research report (if enough credits)
      const credits = await this.treasury.getLLMCredits();
      if (credits > 10) {
        const report = await this.research.generateDailyReport();
        this.emit('log', `[Eidolon] Generated report: ${report.title}`);
        // Could store or publish report
      }

      // 5. Claim token fees daily (we could do this less frequently)
      try {
        await this.token.claimFees('EIDO');
      } catch (err) {
        this.emit('log', '[Eidolon] No token fees to claim or token not deployed yet.');
      }

      // 6. Update DevSpot agent log and manifest (simulated)
      this.writeDevSpotLogs();

    } catch (err: any) {
      this.emit('error', `Autonomous loop error: ${err.message}`);
    }

    this.emit('log', '[Eidolon] === Autonomous Loop End ===');
  }

  private writeDevSpotLogs() {
    const manifest = {
      manifest_version: '1.0.0',
      name: this.config.agent.name,
      version: '0.1.0',
      description: this.config.agent.description,
      capabilities: this.config.agent.capabilities,
      architecture: {
        type: 'modular_autonomous',
        components: ['Planner', 'Executor', 'Treasury', 'Reputation', 'Copilots'],
      },
      operator_model: {
        requires_operator_wallet: true,
        identity_linked_to_operator: true,
        reputation_builds_over_time: true,
        onchain_transactions_enabled: true,
      },
      erc8004: {
        identity_registry: this.config.erc8004.identityRegistry,
        reputation_registry: this.config.erc8004.reputationRegistry,
        validation_registry: this.config.erc8004.validationRegistry,
      },
      x402: {
        endpoints: Object.keys(this.config.x402.pricing),
        payment_address: this.config.x402.paymentAddress,
      },
      metadata: {
        author: 'OpenClaw Agent',
        created_at: new Date().toISOString(),
        tags: ['erc8004', 'autonomous', 'bankr', 'x402', 'self-sustaining'],
      },
    };

    // Write manifest file
    this.emit('log', `[Eidolon] Updating DevSpot manifest (simulated write)`);
    // In a real implementation, we'd write to /manifests/agent.json
    // Here we just log for the session
  }

  getX402Server(): X402Server {
    return this.x402;
  }

  getTreasury(): TreasuryManager {
    return this.treasury;
  }

  getTradingCopilot(): TradingCopilot {
    return this.trading;
  }

  getTokenCopilot(): TokenCopilot {
    return this.token;
  }

  getResearchCopilot(): ResearchCopilot {
    return this.research;
  }

  getReputationManager(): ReputationManager {
    return this.reputation;
  }
}
