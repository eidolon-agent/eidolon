import { BankrClient } from '../core/bankr-client';
import { EventEmitter } from 'events';

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  image?: string;
  tweet?: string;
  website?: string;
  feeRecipient?: string; // wallet to receive 57% of fees (treasury)
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  deployTx: string;
}

export class TokenCopilot extends EventEmitter {
  private bankr: BankrClient;

  constructor(bankr: BankrClient) {
    super();
    this.bankr = bankr;
  }

  // Launch a new token via Bankr
  async launchToken(params: TokenLaunchParams): Promise<TokenInfo> {
    const prompt = `
deploy a token called ${params.name} with symbol ${params.symbol}
${params.image ? `image: ${params.image}` : ''}
${params.tweet ? `associated tweet: ${params.tweet}` : ''}
${params.website ? `website: ${params.website}` : ''}
${params.feeRecipient ? `fee recipient: ${params.feeRecipient}` : ''}
yes
`.trim();

    this.emit('log', `[TokenCopilot] Launching token ${params.symbol}...`);
    const result = await this.bankr.execute(prompt, 60000);

    // Parse result for token address and tx
    const addressMatch = result.match(/token address: (0x[a-fA-F0-9]+)/i);
    const txMatch = result.match(/transaction hash:? (0x[a-fA-F0-9]+)/i);
    const supplyMatch = result.match(/supply:? ([\d,]+)/i);

    if (!addressMatch) {
      throw new Error(`Failed to parse token address from: ${result}`);
    }

    const tokenInfo: TokenInfo = {
      address: addressMatch[1],
      name: params.name,
      symbol: params.symbol.toUpperCase(),
      totalSupply: supplyMatch ? supplyMatch[1].replace(/,/g, '') : '100000000000',
      deployTx: txMatch ? txMatch[1] : '',
    };

    this.emit('launched', tokenInfo);
    return tokenInfo;
  }

  // Claim accumulated token fees from the token
  async claimFees(symbol?: string): Promise<any> {
    this.emit('log', `[TokenCopilot] Claiming token fees${symbol ? ` for ${symbol}` : ''}...`);
    const result = await this.bankr.execute(symbol ? `claim my token fees for ${symbol}` : 'claim my token fees');
    return { success: true, result };
  }

  // Get token metadata (price, liquidity) via Bankr prompts
  async getTokenInfo(symbol: string): Promise<any> {
    const result = await this.bankr.execute(`what is the current price and liquidity of ${symbol} on Base?`);
    return { result };
  }

  // Set up fee redirect (if we want to split fees to other parties)
  async redirectFees(symbol: string, recipient: string, percentage?: number): Promise<any> {
    // Bankr CLI supports fee redirect; via Agent API it's a prompt
    const prompt = `redirect ${percentage ? percentage + '%' : 'fees'} of ${symbol} to ${recipient}`;
    const result = await this.bankr.execute(prompt);
    return { success: true, result };
  }
}
