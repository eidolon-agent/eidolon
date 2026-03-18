import { BankrClient } from '../core/bankr-client';
import { EventEmitter } from 'events';

export interface TradeSignal {
  tokenIn: string;      // address or symbol
  tokenOut: string;
  amount: number;       // amount in tokenIn
  confidence: number;   // 0-1
  reasoning: string;
  timeframe?: string;   // e.g., "1h", "4h"
  stopLoss?: number;    // optional
  takeProfit?: number;  // optional
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  message: string;
  profit?: number;
  timestamp: Date;
}

export class TradingCopilot extends EventEmitter {
  private bankr: BankrClient;
  private llmModel: string;

  constructor(bankr: BankrClient, llmModel = 'claude-sonnet-4-6') {
    super();
    this.bankr = bankr;
    this.llmModel = llmModel;
  }

  // Generate a trading signal using LLM analysis of on-chain data
  async generateSignal(baseToken: string = 'USDC', targetToken: string = 'ETH'): Promise<TradeSignal> {
    const prompt = `
You are an expert DeFi trader analyzing the ${baseToken}/${targetToken} pair on Base (Aerodrome). 
Consider recent price action, liquidity depth, and volatility. Provide a concise signal.

Base token: ${baseToken}
Target token: ${targetToken}

Return JSON only:
{
  "tokenIn": "${baseToken}",
  "tokenOut": "${targetToken}",
  "amount": number (suggested amount in USD, 10-1000),
  "confidence": number (0-1),
  "reasoning": "brief explanation",
  "timeframe": "1h" or "4h" or "1d",
  "stopLoss": optional percentage below entry,
  "takeProfit": optional percentage above entry
}
`.trim();

    const response = await this.bankr.chatCompletion({
      model: this.llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices?.[0]?.message?.content || response.message?.content;
    if (!content) throw new Error('Empty LLM response');

    try {
      const json = JSON.parse(content);
      return {
        ...json,
        amount: Number(json.amount),
        confidence: Number(json.confidence),
      };
    } catch (err) {
      throw new Error(`Failed to parse signal: ${err}`);
    }
  }

  // Execute a trade via Bankr Agent API
  async executeTrade(signal: TradeSignal): Promise<TradeResult> {
    if (signal.confidence < 0.6) {
      return { success: false, message: 'Signal confidence too low to execute', timestamp: new Date() };
    }

    const amount = signal.amount; // USD amount
    const tokenIn = signal.tokenIn;
    const tokenOut = signal.tokenOut;

    const prompt = `Swap ${amount} USD of ${tokenIn} to ${tokenOut} on Base via Aerodrome. Use best price.`;
    try {
      const job = await this.bankr.submitPrompt(prompt);
      const result = await this.bankr.waitForJob(job.jobId);
      if (result.status === 'completed') {
        // Try to extract txHash from response; depends on Bankr output format
        const txHashMatch = result.response?.match(/tx hash:? (0x[a-fA-F0-9]+)/);
        const txHash = txHashMatch ? txHashMatch[1] : undefined;
        this.emit('trade', { signal, result: result.response, txHash, profit: null });
        return { success: true, txHash, message: result.response || 'Trade executed', timestamp: new Date() };
      } else {
        return { success: false, message: `Trade failed: ${result.status}`, timestamp: new Date() };
      }
    } catch (err: any) {
      this.emit('error', err);
      return { success: false, message: err.message, timestamp: new Date() };
    }
  }

  // Full cycle: generate signal and optionally execute
  async analyzeAndTrade(execute: boolean = false): Promise<{ signal: TradeSignal; result?: TradeResult }> {
    this.emit('log', '[TradingCopilot] Starting analysis...');
    const signal = await this.generateSignal();
    this.emit('log', `[TradingCopilot] Signal generated: ${signal.tokenIn}->${signal.tokenOut} (confidence ${signal.confidence})`);

    let result: TradeResult | undefined;
    if (execute && signal.confidence >= 0.6) {
      result = await this.executeTrade(signal);
      this.emit('log', `[TradingCopilot] Trade result: ${result.success ? 'success' : 'failed'}`);
    }

    return { signal, result };
  }

  // Get account balances (used for treasury decisions)
  async getBalances() {
    return await this.bankr.getBalances();
  }
}
