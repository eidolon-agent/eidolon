# Eidolon Agent — Quick Start Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Bankr account (https://bankr.bot/api)
- Base Sepolia ETH (for testnet) or Base Mainnet funds
- ERC-8004 registry contracts deployed on your chosen network

## 1. Configuration

Copy `.env.example` to `.env` and fill in all required variables:

```bash
cp .env.example .env
```

**Required fields:**

- `BANKR_AGENT_API_KEY` — Bankr Agent API key
- `BANKR_LLM_API_KEY` — Bankr LLM Gateway API key
- `TREASURY_WALLET` — Your Bankr wallet address (0x...)
- `NETWORK_RPC_URL` — RPC endpoint (e.g., `https://sepolia.base.org`)
- `AGENT_NAME` — e.g., `εἴδωλον`
- `AGENT_DESCRIPTION` — Short description

**ERC-8004 Identity (optional but recommended):**

- `IDENTITY_REGISTRY` — ERC-8004 Identity Registry contract address
- `REPUTATION_REGISTRY` — ERC-8004 Reputation Registry address
- `VALIDATION_REGISTRY` — ERC-8004 Validation Registry address
- `OPERATOR_WALLET` — Wallet address controlling the agent identity (must have ETH for gas)
- `AGENT_ID` — Leave blank if you want the agent to register automatically (requires the above addresses)

If you don't have ERC-8004 registries yet, you can:
- Check with Bankr support for testnet addresses
- Deploy your own (requires ERC-8004 contract bytecode)
- Skip for now — the agent will run with a default trust score of 500

**Optional (defaults provided):**

- `AGENT_LLM_MODEL` — Default: `claude-sonnet-4-6`
- `PORT` — Default: `3000`
- `DATA_DIR` — Default: `./data` (directory for x402 ledger persistence)
- `PRICE_SIGNAL_PRICE` — Default: `1` (USD)
- `DAILY_REPORT_PRICE` — Default: `5`
- `COPILOT_CHAT_PRICE` — Default: `0.10`
- `MAX_DEBT` — Default: `50` (USD per client)
- `LOG_LEVEL` — Default: `info`

## 2. Install Dependencies

```bash
npm install
```

## 3. Build

```bash
npm run build
```

Compiles TypeScript to `dist/`.

## 4. ERC-8004 Identity Registration (Optional)

If you have ERC-8004 registry addresses, run the setup script to register your agent on-chain:

```bash
npx ts-node scripts/setup.ts
```

This will:
- Validate your configuration
- Check Bankr connectivity
- Register ERC-8004 identity (if `AGENT_ID` not set)
- Print the new `AGENT_ID` to add to `.env`

**Important:** Save the printed `AGENT_ID` to your `.env` file.

If you don't have registry addresses yet, you can skip this step. The agent will run with a default trust score of 500 (neutral). Reputation features will be disabled, but x402 payments, trading, and research will still work.

**Note:** To deploy your own ERC-8004 registries on Base Sepolia, you'll need the contract bytecode and ABI. Check the official ERC-8004 specification or ask Bankr support for existing deployments.

## 5. Fund Your Bankr Wallet

- Add USDC to purchase LLM credits
- Add ETH (Base Sepolia) for gas if executing on-chain actions

## 6. Start the Agent

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The agent will:
- Start the x402 payment server on `PORT` (default 3000)
- Begin treasury health checks (every 60s)
- Initialize trading, token, and research copilots
- Connect to Bankr LLM Gateway and Agent API

## 7. Test x402 Endpoints

Once the agent is running:

```bash
# Health check (free)
curl http://localhost:3000/health

# Price signal (requires payment)
curl -i -H "X-Client-ID: test-client" http://localhost:3000/signals/price/ETH
# Returns 402 with X-402-Payment-Required header if no credit

# Daily report
curl -i -H "X-Client-ID: test-client" http://localhost:3000/reports/daily

# Copilot chat (POST)
curl -X POST -H "Content-Type: application/json" \
  -H "X-Client-ID: test-client" \
  -d '{"message":"Hello"}' \
  http://localhost:3000/copilot/chat
```

**Credit a client (simulate on-chain payment):**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"clientId":"test-client","amount":10}' \
  http://localhost:3000/webhook/credit
```

Then retry the endpoint — it should succeed.

## 8. Adjust Trust Score

The agent's x402 prices adjust based on ERC-8004 reputation score (0-1000). To set:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"score":750}' \
  http://localhost:3000/admin/trust-score
```

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│ Eidolon Orchestrator                         │
├─────────────┬─────────────┬─────────────────┤
│ Treasury    │ Reputation  │ Copilots        │
│ Manager     │ Manager     │ (Trading, Token │
│             │             │  Research)      │
└──────┬──────┴─────────────┴─────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Bankr Integration Layer                     │
│  • LLM Gateway (Claude, Gemini, GPT, etc.)  │
│  • Agent API (on-chain execution)           │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Base Blockchain (Sepolia/Mainnet)           │
│  • ERC-8004 Identity & Reputation          │
│  • Token (EIDO) optional                    │
│  • Treasury (USDC + ETH)                    │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ x402 Payment Server                         │
│  • /signals/price/:token                    │
│  • /reports/daily                           │
│  • /copilot/chat                            │
│  Payments in USDC/ETH credited to Treasury  │
└──────────────────────────────────────────────┘
```

## Troubleshooting

**Build errors:**
- Ensure all dependencies installed: `npm install`
- TypeScript version: `tsc --version` should be 5.x

**Bankr API errors:**
- Check API keys are correct and have credits
- Verify wallet addresses are valid

**x402 endpoints return 402:**
- Credit the client via `/webhook/credit` first
- Or set up automatic on-chain payment listener

**ERC-8004 registration fails:**
- Ensure operator wallet has Base Sepolia ETH for gas
- Check registry addresses are correct for the network
- Verify Agent API has access to prompt for registration

## Next Steps

- Set up automatic treasury refill from on-chain revenue
- Deploy token (optional) via Bankr CLI
- Add more advanced trading strategies
- Integrate on-chain event listeners for reputation updates
- Prepare demo video for Synthesis hackathon

## Support

- Docs: https://docs.openclaw.ai
- Bankr: https://bankr.bot
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402: https://x402.org
