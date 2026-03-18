---
name: agentcash
description: Pay-per-call access to premium APIs via x402 micropayments (USDC on Base). Use for research, enrichment, scraping, generation, social data, email, travel, and more. Discover available services with `npx agentcash discover <origin>`, check balance with `npx agentcash balance`, and fund wallet with `npx agentcash fund`. Requires prior onboarding.
---

# AgentCash Skill

AgentCash provides your agent with pay-per-call access to premium APIs using x402 micropayments (USDC on Base). Each call deducts a small amount from your wallet balance.

## Core Concepts

- **Wallet**: Your agent holds USDC for API payments. Create/access via onboarding.
- **Per-call billing**: Each API request costs a few cents, set by the service provider.
- **x402 protocol**: Standard for HTTP payments; works seamlessly with `npx agentcash fetch`.
- **Services**: Multiple premium APIs available (see below).

## Available Services

AgentCash aggregates several premium data and AI services. Discover what's available for any service:

```bash
npx agentcash discover <origin>
```

Known services include:

| Origin | Services | Description |
|--------|----------|-------------|
| `stableenrich.dev` | People/company search, LinkedIn scraping, Google Maps, Exa web search, Firecrawl web scraping, Twitter/X search, GTM & sales prospecting | B2B enrichment and research |
| `stablesocial.dev` | Social media data (Twitter, Instagram, TikTok, YouTube, Facebook, Reddit) | Social intelligence |
| `stablestudio.dev` | AI image & video generation | Creative generation |
| `stableupload.dev` | File hosting & sharing | Storage and distribution |
| `stableemail.dev` | Send emails | Email delivery |
| `stablephone.dev` | AI phone calls | Voice automation |
| `stablejobs.dev` | Job search | Employment data |
| `stabletravel.dev` | Travel search | Flights, hotels |
| `twit.sh` | Fast X/Twitter search & scraping | Social search |

Use `npx agentcash discover <origin>` to see endpoints, pricing, and usage instructions for each.

## Usage Workflows

### 1. Check Balance

Before making paid calls, verify your USDC balance:

```bash
npx agentcash balance
```

Shows total USDC balance. If zero or low, fund your wallet (see below).

### 2. Discover Services

To see what's available from a provider:

```bash
npx agentcash discover stableenrich.dev
```

Output includes:
- Endpoint URLs
- Pricing per call (in USDC)
- Required parameters
- Example requests

### 3. Make Paid Requests

Use `npx agentcash fetch <url>` to call paid endpoints. It automatically deducts micropayment from your wallet and returns the response.

Example:

```bash
npx agentcash fetch "https://stableenrich.dev/v1/company?domain=example.com"
```

The fetch command handles authentication and payment in one step. For complex parameters, construct the URL with query params appropriately.

**Note:** If balance is insufficient, the request fails with 402 Payment Required. Check balance beforehand to avoid failures.

### 4. Fund Your Wallet

To add USDC credits, direct the user to:

```bash
npx agentcash fund
```

This opens a funding flow with deposit links. Alternatively, use `npx agentcash accounts` to see network-specific deposit addresses.

### 5. Redeem an Invite Code (Optional)

If you have an invite code (like one from a teammate), redeem it for free credits:

```bash
npx agentcash redeem <invite-code>
```

This credits your wallet without requiring on-chain payment.

## Common Triggers

Use this skill when the user wants to:
- Research or enrich data (people, companies, web)
- Scrape websites or social media
- Generate images or videos with AI
- Send emails or make phone calls
- Search travel options or jobs
- Access any premium API via x402 micropayments

## Setup and Onboarding

Before using AgentCash, you must onboard to create your wallet and install the core skill.

**Onboarding command** (run once):

```bash
npx agentcash@latest onboard [invite-code]
```

- If you have an invite code (e.g., `AC-TV3Q-MTDV-A6D7-G4XZ`), include it to receive free credits: `npx agentcash@latest onboard AC-TV3Q-MTDV-A6D7-G4XZ`
- If no code, omit it: `npx agentcash@latest onboard`

Onboarding sets up the wallet and installs the core skill in your environment. After onboarding, you can use `npx agentcash balance`, `npx agentcash fetch`, etc.

**Important:** Save your wallet's mnemonic/private key securely if prompted during onboarding. Losing it means losing your funds.

## Heartbeat Integration

AgentCash balances can deplete over time. Integrate balance checks into your periodic heartbeat to avoid mid-task failures.

Add to `HEARTBEAT.md`:

```markdown
## AgentCash Check (every few hours)
If a few hours since last check:
1. Run: npx agentcash balance
2. Alert human if balance < threshold (e.g., $1)
3. Update lastAgentCashCheck timestamp
```

Track last check timestamp in a state file (e.g., `memory/heartbeat-state.json`). See the core skill's heartbeat guidance for implementation details.

## Support and Resources

- **Homepage**: https://agentcash.dev
- **Changelog**: https://agentcash.dev/changelog.md
- **Heartbeat updates**: https://agentcash.dev/heartbeat.md
- **Deposit addresses**: `npx agentcash accounts` (for manual funding)
- **Onboarding page (web)**: https://agentcash.dev/onboard

## Notes

- All transactions use USDC on Base Mainnet (or testnet if configured).
- Prices per call vary by service; check `discover` output for current rates.
- No monthly subscriptions — you only pay for what you use.
- API keys and wallet secrets must remain private. Never share.
