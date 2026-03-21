import { EventEmitter } from 'events';
import { BankrClient } from '../core/bankr-client';
import { TreasuryManager } from '../core/treasury';
import { ReputationManager } from '../core/reputation';
import { TradingCopilot } from '../services/trading-copilot';
import { TokenCopilot } from '../services/token-copilot';
import { ResearchCopilot } from '../services/research-copilot';
import { X402Server } from '../services/x402-server';
import { EthereumKnowledgeService } from '../services/ethereum-knowledge';

export class EidolonOrchestrator extends EventEmitter {
  private running = false;
  private loopLock = false;
  private loopInterval?: NodeJS.Timeout;

  private bankr: BankrClient;
  private treasury: TreasuryManager;
  private reputation: ReputationManager;
  private trading: TradingCopilot;
  private token: TokenCopilot;
  private research: ResearchCopilot;
  private x402: X402Server;
  private ethKnowledge: EthereumKnowledgeService;

  constructor(private config: any) {
    super();

    // Core
    this.bankr = new BankrClient(config.bankr);

    this.ethKnowledge = new EthereumKnowledgeService(config.network.rpcUrl);

    this.treasury = new TreasuryManager(this.bankr, {
      ...config.treasury,
      rpcUrl: config.network.rpcUrl,
    });

    this.reputation = new ReputationManager(config.erc8004, config.network.rpcUrl);

    // Copilots
    this.trading = new TradingCopilot(this.bankr, config.agent.llmModel, this.ethKnowledge);
    this.token = new TokenCopilot(this.bankr);
    this.research = new ResearchCopilot(this.bankr);

    // X402 (FIXED)
    this.x402 = new X402Server(
      {
        ...config.x402,
        coinbaseApiKey:
          process.env.COINBASE_CDP_API_KEY || config.x402.coinbaseApiKey || '',
      },
      this.bankr,
      {
        rpcUrl: config.network.rpcUrl,
        tokens: config.treasury.tokens,
      }
    );
  }

  async start() {
    this.running = true;

    await this.initialize();

    this.loopInterval = setInterval(() => this.safeLoop(), 60_000); // 1 min
    this.safeLoop();
  }

  stop() {
    this.running = false;
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.treasury.stopAutoRefillLoop();
  }

  private async initialize() {
    this.emit('log', 'Initializing...');

    await this.initializeIdentity();

    this.x402.start();
    this.treasury.startAutoRefillLoop();

    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);
  }

  private async safeLoop() {
    if (!this.running || this.loopLock) return;

    this.loopLock = true;

    try {
      await this.runLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit('error', msg);
    } finally {
      this.loopLock = false;
    }
  }

  private async runLoop() {
    this.emit('log', '=== LOOP START ===');

    // 🔴 PRIORITY 1 — Treasury
    await this.handleTreasury();

    // 🟡 PRIORITY 2 — Reputation sync
    await this.syncReputation();

    // 🟢 PRIORITY 3 — Trading (conditional)
    await this.handleTrading();

    // 🔵 PRIORITY 4 — Research (budget-based)
    await this.handleResearch();

    // ⚪ LOW — Token ops
    await this.handleToken();

    this.emit('log', '=== LOOP END ===');
  }

  private async handleTreasury() {
    const health = await this.treasury.healthCheck();
    if (!health.healthy) {
      this.emit('alert', `Treasury issue: ${health.actions?.join(', ')}`);
    }
  }

  private async syncReputation() {
    const score = await this.reputation.getReputationScore();
    this.x402.setTrustScore(score);
  }

  private async handleTrading() {
    // Only trade if enough balance
    const balance = await this.treasury.getLLMCredits();
    if (balance < 5) return;

    const result = await this.trading.analyzeAndTrade(true);

    if (result?.result?.success) {
      this.emit('log', `Trade: ${result.signal.tokenIn} -> ${result.signal.tokenOut}`);
    }
  }

  private async handleResearch() {
    const credits = await this.treasury.getLLMCredits();

    // Only run if cheap + once per hour
    if (credits < 20) return;

    const now = Date.now();
    if ((this as any)._lastResearch && now - (this as any)._lastResearch < 3600000) {
      return;
    }

    const report = await this.research.generateDailyReport();
    this.emit('log', `Report: ${report.title}`);

    (this as any)._lastResearch = now;
  }

  private async handleToken() {
    try {
      await this.token.claimFees('EIDO');
    } catch {
      // silent
    }
  }

  private async initializeIdentity() {
    try {
      const score = await this.reputation.getReputationScore();
      this.emit('log', `Reputation score: ${score}`);
    } catch (err) {
      this.emit('error', 'Identity init failed');
    }
  }
      }
