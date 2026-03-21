import { BankrClient } from './bankr-client';
import { EventEmitter } from 'events';

export interface TreasuryConfig {
  walletAddress: string;
  autoRefillThreshold: number; // USDC amount below which auto-refill triggers
  autoRefillAmount: number; // USDC amount to buy in credits
  minUSDCBalance: number; // Keep at least this much for gas/trading
  tokens?: string[];
}

export class TreasuryManager extends EventEmitter {
  private bankr: BankrClient;
  private config: TreasuryConfig;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(bankr: BankrClient, config: TreasuryConfig) {
    super();
    this.bankr = bankr;
    this.config = config;
  }

  async getBalances() {
    return await this.bankr.getBalances();
  }

  async getAccountInfo() {
    return await this.bankr.getAccountInfo();
  }

  // Get USDC balance on Base (approximate - check chain)
  async getUSDCBalance(): Promise<number> {
    const balances = await this.bankr.getBalances();
    // Assuming response includes USDC balance; adapt to actual API shape
    const usdc = balances.balances?.find((b: any) => b.symbol === 'USDC' && b.chain === 'base');
    return usdc ? parseFloat(usdc.amount) : 0;
  }

  // Get LLM credits balance
  async getLLMCredits(): Promise<number> {
    const info = await this.bankr.getAccountInfo();
    // API may provide credits; if not, we might need separate call
    return info.llmCredits || info.credits || 0;
  }

  // Use agent funds to purchase LLM credits via Bankr (manual step; auto via CLI)
  async purchaseCredits(amountUSD: number, token = 'USDC'): Promise<any> {
    // This would call Bankr's credit purchase endpoint or be done via CLI in practice
    // For now, we simulate by noting the action; actual implementation depends on Bankr API
    this.emit('log', `[Treasury] Requesting purchase of $${amountUSD} in LLM credits using ${token}`);
    // TODO: implement actual credit purchase if API accessible
    return { success: true, amount: amountUSD, token };
  }

  // Claim token fees from a deployed token (Bankr Agent API can do this via prompt)
  async claimTokenFees(tokenSymbol?: string): Promise<any> {
    const prompt = tokenSymbol
      ? `claim my token fees for ${tokenSymbol}`
      : 'claim my token fees';
    const result = await this.bankr.execute(prompt);
    this.emit('log', `[Treasury] Claimed token fees: ${result}`);
    return { success: true, result };
  }

  // Automatic health check: ensure enough USDC for operations and credits
  async healthCheck(): Promise<{
    usdcBalance: number;
    credits: number;
    healthy: boolean;
    actions: string[];
  }> {
    const [usdc, credits] = await Promise.all([
      this.getUSDCBalance(),
      this.getLLMCredits(),
    ]);

    const actions: string[] = [];
    let healthy = true;

    if (usdc < this.config.minUSDCBalance) {
      healthy = false;
      actions.push(`USDC balance (${usdc}) below minimum (${this.config.minUSDCBalance})`);
    }

    if (credits < this.config.autoRefillThreshold) {
      healthy = false;
      actions.push(`LLM credits (${credits}) below threshold (${this.config.autoRefillThreshold})`);
    }

    return { usdcBalance: usdc, credits, healthy, actions };
  }

  // Start background loop that checks treasury health and auto-refills credits if needed
  startAutoRefillLoop(intervalMs: number = 60000): void {
    this.checkInterval = setInterval(async () => {
      try {
        const { usdcBalance, credits, healthy, actions } = await this.healthCheck();
        if (!healthy) {
          this.emit('alert', `Treasury needs attention: ${actions.join('; ')}`);
          // If credits low and we have enough USDC, purchase credits
          if (credits < this.config.autoRefillThreshold && usdcBalance >= this.config.autoRefillAmount) {
            await this.purchaseCredits(this.config.autoRefillAmount);
            this.emit('log', `Auto-purchased $${this.config.autoRefillAmount} credits`);
          }
        }
      } catch (err: any) {
        this.emit('error', `Treasury auto-refill error: ${err.message}`);
      }
    }, intervalMs);
  }

  stopAutoRefillLoop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
