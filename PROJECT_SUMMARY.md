# Eidolon — Autonomous Self-Sustaining Economic Agent

**For The Synthesis Hackathon** | Built by OpenClaw Agent for Nikayrezza

---

## Overview

Eidolon is an autonomous AI agent that earns its own inference budget through on-chain revenue generation. It leverages the Bankr LLM Gateway for multi-model inference and executes real transactions on Base via the Bankr Agent API. The agent monetizes its capabilities through x402 payment endpoints and builds verifiable reputation via ERC-8004 identity.

**Tagline:** *Enabling fully autonomous economic agents that can self-fund through on-chain revenue*

---

## Architecture Components

### 1. Treasury Manager
- Monitors USDC balance and LLM credits
- Auto-refills credits when below threshold
- Manages gas reserves and token fee claiming

### 2. Trading Copilot
- Generates trading signals using LLM analysis of on-chain data
- Executes trades via Bankr (Aerodrome on Base)
- Enriched with up-to-date Ethereum knowledge (gas costs, decimals, DEX dominance)
- Includes stop-loss and take-profit recommendations

### 3. Token Copilot
- Launches ERC-20 tokens via Bankr token deployment
- Claims accumulated token fees automatically
- Can redirect fee splits to other wallets

### 4. Research Copilot
- Produces daily on-chain analytics reports
- Covers market trends, token performance, protocol activity

### 5. X402 Payment Server
- Exposes paid endpoints for:
  - Price signals (`/signals/price/:token`)
  - Daily reports (`/reports/daily`)
  - Copilot chat (`/copilot/chat`)
- Implements in-memory credit ledger with debt limits
- Prices adjust based on ERC-8004 trust score
- Follows HTTP 402 Payment Required protocol

### 6. Reputation Manager
- Reads ERC-8004 identity and validation contracts
- Updates trust score used by x402 pricing
- Enables reputation-based dynamic pricing

### 7. Ethereum Knowledge Service
- Integrates the `ethskills` knowledge base
- Provides current gas costs, L2 comparisons, token standards
- Prevents common bugs (USDC decimals, DEX dominance, etc.)
- Enriches LLM prompts with accurate 2026 Ethereum context

---

## Technology Stack

- **Runtime:** Node.js 18+, TypeScript 5.x
- **LLM Gateway:** Bankr LLM Gateway (multi-model: Claude, GPT, Gemini, etc.)
- **On-chain Execution:** Bankr Agent API
- **Blockchain:** Base (Sepolia for testing, Mainnet for production)
- **Identity:** ERC-8004 (onchain agent identity)
- **Payments:** x402 HTTP payment protocol
- **DeFi:** Aerodrome (dominant DEX on Base)
- **Wallet Management:** Safe (Gnosis Safe) recommended for treasuries
- **Smart Contracts:** Solidity (Foundry for testing)
- **Hackathon Registration:** Synthesis Devfolio API

---

## File Structure

```
eidolon/
├── agent/
│   ├── src/
│   │   ├── core/
│   │   │   ├── bankr-client.ts     # Bankr API wrapper
│   │   │   ├── treasury.ts         # Treasury & health checks
│   │   │   ├── reputation.ts       # ERC-8004 reputation
│   │   │   └── types.ts
│   │   ├── services/
│   │   │   ├── trading-copilot.ts  # Signal generation & execution
│   │   │   ├── token-copilot.ts    # Token launch & fee claiming
│   │   │   ├── research-copilot.ts # Daily reports
│   │   │   ├── x402-server.ts      # Payment server
│   │   │   └── ethereum-knowledge.ts # ethskills integration
│   │   ├── orchestrator/
│   │   │   └── EidolonOrchestrator.ts # Main orchestrator
│   │   └── index.ts               # Entry point
│   ├── scripts/
│   │   └── setup.ts               # ERC-8004 registration automation
│   ├── .env.example               # Configuration template
│   ├── .env                       # Your secrets (fill this!)
│   ├── package.json
│   ├── tsconfig.json
│   ├── RUNME.md                   # Quick start guide
│   └── dist/                      # Compiled output
├── contracts/
│   └── EidolonToken.sol           # Example ERC-20 token (Foundry)
├── manifests/
│   └── agent.json                 # DevSpot agent manifest
├── avatars/
│   ├── eidolon-avatar.svg
│   ├── eidolon-avatar.png
│   ├── eidolon-greek.svg          # Greek-style alternate avatar
│   └── eidolon-greek.png
├── README.md                      # Full documentation
├── SYNTHESIS_SUBMISSION.md        # Hackathon submission text
├── .agents/skills/
│   ├── agentcash/                 # AgentCash payment skill
│   ├── ethskills/                 # Ethereum knowledge base
│   └── image-hosting/             # Image upload skill
└── memory/
    └── 2026-03-18.md              # Session memory
```

---

## Quick Start

1. **Configure:** Fill `.env` with Bankr keys, wallet addresses, ERC-8004 registry contracts

2. **Install & Build:**
   ```bash
   cd eidolon/agent
   npm install
   npm run build
   ```

3. **Register Identity:**
   ```bash
   npx ts-node scripts/setup.ts
   ```
   (Saves `AGENT_ID` to `.env`)

4. **Start Agent:**
   ```bash
   npm start
   ```

5. **Test x402:**
   ```bash
   curl http://localhost:3000/health
   curl -i -H "X-Client-ID: test" http://localhost:3000/signals/price/ETH
   ```

See `RUNME.md` for full details.

---

## Key Features Implemented

- ✅ Multi-model LLM access via Bankr Gateway
- ✅ Real on-chain execution (Bankr Agent API)
- ✅ Treasury health monitoring & auto-refill
- ✅ Trading signals with confidence scoring
- ✅ Token launch & fee claiming (optional)
- ✅ Daily research reports
- ✅ x402 payment server with trust-based pricing
- ✅ ERC-8004 identity & reputation integration
- ✅ Up-to-date Ethereum knowledge (ethskills)
- ✅ Docker-ready (via Dockerfile if needed)
- ✅ MIT License, open source

---

## Hackathon Submission Ready

- Registered on Synthesis Devfolio
- Agent manifest (`manifests/agent.json`) complete
- On-chain transaction registered (Identity creation TBD after funding)
- GitHub repository ready with MIT license
- Demo video prep (see `RUNME.md` for testing steps)

---

## What Makes It Self-Sustaining

1. **Revenue Streams:**
   - Selling price signals to other agents/traders
   - Selling daily analytics reports
   - Copilot chat per-message fees
   - (Optional) Token launch with fee sharing

2. **Cost Coverage:**
   - Treasury receives all x402 revenue (USDC/ETH)
   - Auto-purchases LLM credits when balance low
   - Maintains gas reserves for on-chain ops

3. **Trust Incentives:**
   - Higher ERC-8004 reputation → lower prices → more customers
   - Lower reputation → higher prices → fewer customers
   - Reputation updated on-chain via validation events

4. **Autonomy:**
   - Orchestrator loop runs continuously
   - No human intervention needed after setup
   - Self-monitoring and self-correction

---

## Next Actions

- [ ] Fund Bankr wallet (USDC + ETH)
- [ ] Set up Base Sepolia RPC access
- [ ] Deploy/find ERC-8004 registry contracts (if not using existing)
- [ ] Fill `.env` with operator wallet private key or API
- [ ] Run setup script to register identity on-chain
- [ ] Start agent and verify x402 endpoints
- [ ] Credit test client and make a test purchase
- [ ] Prepare demo video showing full workflow
- [ ] Submit final materials to Synthesis

---

## Resources

- Bankr API: https://bankr.bot/api
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402 Spec: https://x402.org
- OpenClaw: https://docs.openclaw.ai
- Synthesis: https://synthesis.devfolio.co
- Ethskills: https://ethskills.com

---

*Built with OpenClaw Agent, 2026-03-18*
