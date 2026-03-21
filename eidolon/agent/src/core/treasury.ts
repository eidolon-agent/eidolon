import { BankrClient } from './bankr-client';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface TreasuryConfig {
  walletAddress: string;
  autoRefillThreshold: number;
  autoRefillAmount: number;
  minUSDCBalance: number;
  tokens?: string[]; // custom ERC-20 addresses to track
  rpcUrl: string; // Base RPC endpoint
}

export class TreasuryManager extends EventEmitter {
  private bankr: BankrClient;
  private config: TreasuryConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private provider: ethers.providers.JsonRpcProvider;

  constructor(bankr: BankrClient, config: TreasuryConfig) {
    super();
    this.bankr = bankr;
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
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

  // Fetch ERC-20 token balance via direct RPC
  async getTokenBalance(tokenAddress: string): Promise<string> {
    const wallet = this.config.walletAddress;
    const iface = new ethers.utils.Interface([
      'function balanceOf(address) view returns (uint256)'
    ]);
    const data = iface.encodeFunctionData('balanceOf', [wallet]);

    try {
      const result = await this.provider.send('eth_call', [{
        to: tokenAddress,
        data: data
      }, 'latest']);
      const bal = ethers.BigNumber.from(result);
      return bal.toString();
    } catch (error) {
      this.emit('error', `Failed to fetch token balance for ${tokenAddress}: ${error}`);
      return '0';
    }
  }

  // Get token metadata (symbol, decimals) via ERC-20 standard calls
  async getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
    const iface = new ethers.utils.Interface([
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ]);

    try {
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
    } catch (error) {
      this.emit('error', `Failed to fetch token info for ${tokenAddress}: ${error}`);
      return { symbol: 'UNKNOWN', decimals: 18 };
    }
  }

  // Use agent funds to purchase LLM credits via Bankr (manual step; auto via CLI)
  async purchaseCredits(amountUSD: number, token = 'USDC'): Promise<any> {
    this.emit('log', `[Treasury] Requesting purchase of $${amountUSD} in LLM credits using ${token}`);
    return { success: true, amount: amountUSD, token };
  }

  // Claim token fees from a deployed token
  async claimTokenFees(tokenSymbol?: string): Promise<any> {
    const prompt = tokenSymbol
      ? `claim my token fees for ${tokenSymbol}`
      : 'claim my token fees';
    const result = await this.bankr.execute(prompt);
    this.emit('log', `[Treasury] Claimed token fees: ${result}`);
    return { success: true, result };
  }

  // Automatic health check
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
      actions.push(`USDC balance $${usdc} is below minimum $${this.config.minUSDCBalance}. Consider topping up.`);
    }

    if (credits < 10) {
      healthy = false;
      actions.push(`LLM credits low (${credits}). Consider purchasing more.`);
    }

    this.emit('log', `[Treasury] Health: USDC $${usdc}, credits ${credits} ${healthy ? '✓' : '✗'}`);
    return { usdcBalance: usdc, credits, healthy, actions };
  }

  // Start autonomous health check loop (every 5 minutes)
  startHealthLoop(intervalMs: number = 5 * 60 * 1000) {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        this.emit('health', health);
      } catch (error: any) {
        this.emit('error', `Health check error: ${error.message}`);
      }
    }, intervalMs);
    this.emit('log', '[Treasury] Health loop started');
  }

  stopHealthLoop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.emit('log', '[Treasury] Health loop stopped');
    }
  }

  // Auto-refill loop (placeholder)
  startAutoRefillLoop(intervalMs: number = 60 * 60 * 1000) {
    this.emit('log', '[Treasury] Auto-refill loop not implemented');
  }

  stopAutoRefillLoop() {
    // No-op
  }
}
