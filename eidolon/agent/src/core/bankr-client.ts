import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';

/**
 * BankrClient handles communication with both:
 * - Bankr LLM Gateway (for inference)
 * - Bankr Agent API (for on-chain execution)
 * - Direct RPC calls for custom token balance queries
 */
export class BankrClient {
  private llmClient: AxiosInstance;
  private agentClient: AxiosInstance;
  private llmApiKey: string;
  private agentApiKey: string;
  private rpcUrl?: string;
  private customTokens?: string[]; // ERC-20 addresses to track alongside Bankr balances
  private provider?: ethers.providers.JsonRpcProvider;

  constructor(config: {
    llmApiKey: string;
    agentApiKey: string;
    llmBaseUrl?: string;
    agentBaseUrl?: string;
    rpcUrl?: string; // Base RPC for custom token balance queries
    tokens?: string[]; // custom ERC-20 addresses to track
  }) {
    this.llmApiKey = config.llmApiKey;
    this.agentApiKey = config.agentApiKey;
    this.rpcUrl = config.rpcUrl;
    this.customTokens = config.tokens;

    if (config.rpcUrl) {
      this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    }

    this.llmClient = axios.create({
      baseURL: config.llmBaseUrl || 'https://llm.bankr.bot',
      headers: {
        'X-API-Key': this.llmApiKey,
        'Content-Type': 'application/json',
      },
    });

    this.agentClient = axios.create({
      baseURL: config.agentBaseUrl || 'https://api.bankr.bot',
      headers: {
        'X-API-Key': this.agentApiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // LLM Gateway: OpenAI-compatible chat completion
  async chatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }): Promise<any> {
    try {
      const response = await this.llmClient.post('/v1/chat/completions', params);
      return response.data;
    } catch (error: any) {
      throw new Error(`LLM Gateway error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Bankr Agent API: Submit a natural language prompt
  async submitPrompt(prompt: string): Promise<AgentJob> {
    const response = await this.agentClient.post('/agent/prompt', { prompt });
    if (response.data.success) {
      return {
        jobId: response.data.jobId,
        threadId: response.data.threadId,
        status: response.data.status,
        createdAt: response.data.createdAt,
      };
    }
    throw new Error('Failed to create agent job');
  }

  // Bankr Agent API: Poll job status
  async getJob(jobId: string): Promise<AgentJob & { response?: string }> {
    const response = await this.agentClient.get(`/agent/job/${jobId}`);
    if (response.data.success) {
      return response.data;
    }
    throw new Error(`Failed to get job ${jobId}`);
  }

  // Bankr Agent API: Cancel job
  async cancelJob(jobId: string): Promise<boolean> {
    const response = await this.agentClient.post(`/agent/job/${jobId}/cancel`);
    return response.data.success;
  }

  // Bankr Agent API: Get wallet balances (native + USDC etc.)
  async getBalances(): Promise<any> {
    const response = await this.agentClient.get('/agent/balances');
    const data = response.data;

    // If custom tokens configured, fetch their balances and merge
    if (this.rpcUrl && this.customTokens && this.customTokens.length > 0 && this.provider) {
      const wallet = data.walletAddress || data.address;
      if (!wallet) {
        console.warn('[BankrClient] No wallet address in balances response; skipping custom tokens');
        return data;
      }

      // Ensure balances array exists
      if (!data.balances) data.balances = [];

      for (const tokenAddr of this.customTokens) {
        try {
          const balanceWei = await this.getTokenBalanceRaw(tokenAddr, wallet);
          const info = await this.getTokenInfo(tokenAddr);
          // Convert from wei/atomic to human
          const divisor = ethers.utils.parseUnits('1', info.decimals);
          const balanceHuman = ethers.utils.formatUnits(balanceWei, info.decimals);

          data.balances.push({
            symbol: info.symbol,
            chain: 'base', // assume Base; could make configurable
            address: tokenAddr,
            amount: balanceHuman,
            decimals: info.decimals,
          });
        } catch (err) {
          console.error(`[BankrClient] Failed to fetch custom token ${tokenAddr}:`, err);
        }
      }
    }

    return data;
  }

  // Low-level: fetch raw token balance (big number string) via RPC
  private async getTokenBalanceRaw(tokenAddress: string, walletAddress: string): Promise<string> {
    if (!this.provider) throw new Error('No RPC provider configured');
    const iface = new ethers.utils.Interface([
      'function balanceOf(address) view returns (uint256)'
    ]);
    const data = iface.encodeFunctionData('balanceOf', [walletAddress]);
    const result = await this.provider.send('eth_call', [{
      to: tokenAddress,
      data: data
    }, 'latest']);
    const bal = ethers.BigNumber.from(result);
    return bal.toString();
  }

  // Fetch token symbol and decimals
  private async getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
    if (!this.provider) throw new Error('No RPC provider configured');
    const iface = new ethers.utils.Interface([
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ]);
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
  }

  // Bankr Agent API: Get account info
  async getAccountInfo(): Promise<any> {
    const response = await this.agentClient.get('/agent/account');
    return response.data;
  }

  // Wait for a job to complete (polling)
  async waitForJob(jobId: string, pollIntervalMs: number = 2000, timeoutMs: number = 30000): Promise<AgentJob & { response?: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const job = await this.getJob(jobId);
      if (job.status === 'completed') {
        return job;
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new Error(`Job ${jobId} ended with status: ${job.status}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  // Convenience: submit prompt and wait for result
  async execute(prompt: string, waitTimeoutMs?: number): Promise<string> {
    const job = await this.submitPrompt(prompt);
    const result = await this.waitForJob(job.jobId, 2000, waitTimeoutMs || 30000);
    return result.response || '';
  }
}

export interface AgentJob {
  jobId: string;
  threadId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  response?: string;
}
