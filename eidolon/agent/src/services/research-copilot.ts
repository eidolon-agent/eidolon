import { BankrClient } from '../core/bankr-client';
import { EventEmitter } from 'events';

export interface AnalyticsReport {
  title: string;
  summary: string;
  metrics: Record<string, number | string>;
  insights: string[];
  recommendations?: string[];
  generatedAt: Date;
}

export class ResearchCopilot extends EventEmitter {
  private bankr: BankrClient;
  private llmModel: string;

  constructor(bankr: BankrClient, llmModel = 'gpt-4-turbo') {
    super();
    this.bankr = bankr;
    this.llmModel = llmModel;
  }

  // Generate a daily market analytics report
  async generateDailyReport(tokens: string[] = ['ETH', 'USDC', 'BNKR', 'EIDO']): Promise<AnalyticsReport> {
    const prompt = `
You are an on-chain research analyst for Base ecosystem. Provide a daily market report.

Tokens to analyze: ${tokens.join(', ')}

Include:
- Current price and 24h change for each
- TVL changes for major protocols (Aerodrome, Aave)
- Notable on-chain activities (large swaps, new token launches)
- Overall market sentiment

Return JSON only:
{
  "title": "Daily On-chain Analytics - <date>",
  "summary": "2-3 sentence overview",
  "metrics": { "token1 price": number, "token1 change": number, ... },
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["optional suggestion 1", ...]
}
`.trim();

    const response = await this.bankr.chatCompletion({
      model: this.llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const content = response.choices?.[0]?.message?.content || response.message?.content;
    if (!content) throw new Error('Empty LLM response');

    try {
      const json = JSON.parse(content);
      return {
        ...json,
        generatedAt: new Date(),
      };
    } catch (err) {
      throw new Error(`Failed to parse report: ${err}`);
    }
  }

  // Generate a token-specific deep dive
  async analyzeToken(tokenSymbol: string, tokenAddress: string): Promise<AnalyticsReport> {
    const prompt = `
Analyze the token ${tokenSymbol} (${tokenAddress}) on Base.
Consider:
- Liquidity depth on Aerodrome
- Holders distribution
- Trading volume trends
- Any recent news or contract activity

Return JSON only with title, summary, metrics, insights.
`;

    const response = await this.bankr.chatCompletion({
      model: this.llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const content = response.choices?.[0]?.message?.content || response.message?.content;
    if (!content) throw new Error('Empty LLM response');

    try {
      const json = JSON.parse(content);
      return {
        ...json,
        generatedAt: new Date(),
      };
    } catch (err) {
      throw new Error(`Failed to parse token analysis: ${err}`);
    }
  }

  // Generate a strategy improvement recommendation based on recent trades
  async improveStrategy(recentTrades: any[]): Promise<string> {
    const prompt = `
Given these recent trades:
${JSON.stringify(recentTrades, null, 2)}

Provide 3 specific improvements to our automated trading strategy. Be concise and actionable.
`;
    const response = await this.bankr.chatCompletion({
      model: this.llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 500,
    });

    const content = response.choices?.[0]?.message?.content || response.message?.content;
    return content || 'No improvements suggested.';
  }
}
