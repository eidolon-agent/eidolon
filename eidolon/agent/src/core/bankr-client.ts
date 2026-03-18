import axios, { AxiosInstance } from 'axios';

/**
 * BankrClient handles communication with both:
 * - Bankr LLM Gateway (for inference)
 * - Bankr Agent API (for on-chain execution)
 */
export class BankrClient {
  private llmClient: AxiosInstance;
  private agentClient: AxiosInstance;
  private llmApiKey: string;
  private agentApiKey: string;

  constructor(config: {
    llmApiKey: string;
    agentApiKey: string;
    llmBaseUrl?: string;
    agentBaseUrl?: string;
  }) {
    this.llmApiKey = config.llmApiKey;
    this.agentApiKey = config.agentApiKey;

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

  // Bankr Agent API: Get wallet balances
  async getBalances(): Promise<any> {
    const response = await this.agentClient.get('/agent/balances');
    return response.data;
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
