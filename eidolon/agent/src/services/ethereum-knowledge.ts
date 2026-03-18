import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export class EthereumKnowledgeService extends EventEmitter {
  private fullContent: string;

  constructor() {
    super();
    // Load the ethskills guide from the mounted skill location
    // Path: from src/services/ or dist/services, go up 4 levels to workspace root, then .agents/skills/ethskills/SKILL.md
    const skillMdPath = path.resolve(__dirname, '../../../../.agents/skills/ethskills/SKILL.md');
    try {
      this.fullContent = fs.readFileSync(skillMdPath, 'utf8');
      console.log(`[EthereumKnowledge] Loaded ethskills guide from ${skillMdPath}`);
    } catch (err: any) {
      console.warn(`[EthereumKnowledge] Could not load ${skillMdPath}: ${err.message}. Using built-in minimal knowledge.`);
      this.fullContent = '';
    }
  }

  /**
   * Get relevant Ethereum knowledge for a given query.
   * Returns concise, actionable information.
   */
  async getKnowledge(query: string): Promise<{
    query: string;
    snippets: Array<{ topic: string; content: string }>;
    fullGuide?: string;
  }> {
    const lowerQ = query.toLowerCase();
    const results: Array<{ topic: string; content: string }> = [];

    // If we have the full guide, try to extract sections by heading
    if (this.fullContent) {
      const lines = this.fullContent.split('\n');
      // Find sections that match query
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ')) {
          const heading = line.substring(3).trim();
          const headingLower = heading.toLowerCase();
          if (headingLower.includes(lowerQ) || lowerQ.split(' ').some((word: string) => headingLower.includes(word))) {
            // Collect up to 10 lines after heading
            const snippetLines = [line, ...lines.slice(i + 1, Math.min(i + 11, lines.length))];
            results.push({
              topic: heading,
              content: snippetLines.join('\n').trim()
            });
          }
        }
      }

      // Also search line-by-line for keywords if no sections found
      if (results.length === 0) {
        const matches: Array<{ line: number; text: string }> = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQ)) {
            matches.push({ line: i + 1, text: lines[i].trim() });
            if (matches.length >= 15) break;
          }
        }
        if (matches.length > 0) {
          return {
            query,
            snippets: matches.map(m => ({ topic: 'Search result', content: m.text }))
          };
        }
      }
    }

    // Fallback: built-in quick facts
    const quickFacts: Record<string, string> = {
      'gas': 'Mainnet ETH transfer: ~$0.004 (at 0.1 gwei); L2 swap: $0.002-0.003; L2 transfer: $0.0003',
      'usdc': 'USDC has 6 decimals, not 18. Always use SafeERC20.',
      'erc8004': 'ERC-8004: Onchain agent identity registry, deployed Jan 2026 on 20+ chains',
      'x402': 'x402: HTTP 402 payment protocol for machine-to-machine commerce, production-ready',
      'eip7702': 'EIP-7702: EOAs get smart contract superpowers without migration',
      'safe': 'Use Safe (Gnosis Safe) for production treasuries - secures $60B+',
      'aerodrome': 'Aerodrome is the dominant DEX on Base',
      'foundry': 'Foundry is the default for new projects in 2026, not Hardhat',
      'secrets': 'NEVER commit private keys or API keys to Git. Bots exploit leaked secrets in seconds.',
      'onchain': 'Say "onchain" (one word, no hyphen), not "on-chain".',
    };

    for (const [key, fact] of Object.entries(quickFacts)) {
      if (lowerQ.includes(key) || key.includes(lowerQ)) {
        results.push({ topic: `Quick fact: ${key}`, content: fact });
      }
    }

    return {
      query,
      snippets: results,
      fullGuide: this.fullContent || undefined
    };
  }

  /**
   * Quick answers for common Ethereum questions
   */
  getQuickFact(type: string): string {
    const facts: Record<string, string> = {
      'gas-mainnet-transfer': 'Mainnet ETH transfer: ~$0.004 (at 0.1 gwei)',
      'gas-mainnet-swap': 'Mainnet swap: ~$0.04',
      'gas-l2-swap': 'L2 swap: $0.002-0.003',
      'gas-l2-transfer': 'L2 transfer: $0.0003',
      'usdc-decimals': 'USDC has 6 decimals, not 18',
      'erc8004': 'ERC-8004: Onchain agent identity registry, deployed Jan 2026 on 20+ chains',
      'x402': 'x402: HTTP 402 payment protocol for machine-to-machine commerce, production-ready',
      'eip7702': 'EIP-7702: EOAs get smart contract superpowers without migration',
      'dominant-dex-base': 'Aerodrome is the dominant DEX on Base',
      'safe-treasury': 'Use Safe (Gnosis Safe) for production treasuries - secures $60B+',
      'foundry-default': 'Foundry is the default for new projects in 2026, not Hardhat',
      'never-commit-secrets': 'NEVER commit private keys or API keys to Git. Bots exploit leaked secrets in seconds.',
      'onchain': 'Say "onchain" (one word, no hyphen), not "on-chain".',
    };
    return facts[type] || `No quick fact for ${type}`;
  }
}
