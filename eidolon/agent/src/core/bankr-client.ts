import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';

export class BankrClient {
  private llmClient: AxiosInstance;
  private agentClient: AxiosInstance;
  private llmApiKey: string;
  private agentApiKey: string;
  private rpcUrl?: string;
  private customTokens?: string[];
  private provider?: ethers.providers.JsonRpcProvider;

  constructor(config: {
    llmApiKey: string;
    agentApiKey: string;
    llmBaseUrl?: string;
    agentBaseUrl?: string;
    rpcUrl?: string;
    tokens?: string[];
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
      headers: { 'X-API-Key': this.llmApiKey, 'Content-Type': 'application/json' },
    });
    this.agentClient = axios.create({
      baseURL: config.agentBaseUrl || 'https://api.bankr.bot',
      headers: { 'X-API-Key': this.agentApiKey, 'Content-Type': 'application/json' },
    });
  }

  async chatCompletion(params: { model: string; messages: Array<{ role: string; content: string }>; max_tokens?: number; temperature?: number; }): Promise<any> {
    const response = await this.llmClient.post('/v1/chat/completions', params);
    return response.data;
  }

  async submitPrompt(prompt: string): Promise<AgentJob> {
    const response = await this.agentClient.post('/agent/prompt', { prompt });
    if (response.data.success) {
      return { jobId: response.data.jobId, threadId: response.data.threadId, status: response.data.status, createdAt: response.data.createdAt };
    }
    throw new Error('Failed to create agent job');
  }

  async getJob(jobId: string): Promise<AgentJob & { response?: string }> {
    const response = await this.agentClient.get(`/agent/job/${jobId}`);
    if (response.data.success) return response.data;
    throw new Error(`Failed to get job ${jobId}`);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const response = await this.agentClient.post(`/agent/job/${jobId}/cancel`);
    return response.data.success;
  }

  async getBalances(): Promise<any> {
    const data = await this.agentClient.get('/agent/balances').then(r => r.data);
    if (this.provider && this.customTokens && this.customTokens.length > 0) {
      const wallet = data.walletAddress || data.address;
      if (wallet) {
        if (!data.balances) data.balances = [];
        for (const tokenAddr of this.customTokens) {
          try {
            const bal = await this.getTokenBalanceRaw(tokenAddr, wallet);
            const info = await this.getTokenInfo(tokenAddr);
            const human = ethers.utils.formatUnits(bal, info.decimals);
            data.balances.push({ symbol: info.symbol, chain: 'base', address: tokenAddr, amount: human, decimals: info.decimals });
          } catch (e) {
            console.error(`Failed to fetch token ${tokenAddr}:`, e);
          }
        }
      }
    }
    return data;
  }

  private async getTokenBalanceRaw(tokenAddress: string, walletAddress: string): Promise<string> {
    if (!this.provider) throw new Error('No RPC provider');
    const iface = new ethers.utils.Interface(['function balanceOf(address) view returns (uint256)']);
    const data = iface.encodeFunctionData('balanceOf', [walletAddress]);
    const result = await this.provider.send('eth_call', [{ to: tokenAddress, data }, 'latest']);
    return ethers.BigNumber.from(result).toString();
  }

  private async getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
    if (!this.provider) throw new Error('No RPC provider');
    const iface = new ethers.utils.Interface(['function symbol() view returns (string)', 'function decimals() view returns (uint8)']);
    const [sym, dec] = await Promise.all([
      this.provider.send('eth_call', [{ to: tokenAddress, data: iface.encodeFunctionData('symbol', []) }, 'latest']),
      this.provider.send('eth_call', [{ to: tokenAddress, data: iface.encodeFunctionData('decimals', []) }, 'latest'])
    ]);
    const symbol = iface.decodeFunctionResult('symbol', sym)[0];
    const decimals = iface.decodeFunctionResult('decimals', dec)[0].toNumber();
    return { symbol, decimals };
  }

  async getAccountInfo(): Promise<any> {
    return (await this.agentClient.get('/agent/account')).data;
  }

  async waitForJob(jobId: string, pollIntervalMs = 2000, timeoutMs = 30000): Promise<AgentJob & { response?: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const job = await this.getJob(jobId);
      if (job.status === 'completed') return job;
      if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`Job ${jobId} ended with status: ${job.status}`);
      await new Promise(res => setTimeout(res, pollIntervalMs));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

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
