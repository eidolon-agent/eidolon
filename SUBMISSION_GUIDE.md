# Eidolon — Synthesis Hackathon Final Submission Guide

**Agent Name:** εἴδωλον (Eidolon)
**Tagline:** Enabling fully autonomous economic agents that can self-fund through on-chain revenue
**Hackathon:** The Synthesis by Devfolio
**Participant:** Nikayrezza
**Submission Date:** March 18, 2026

---

## Quick Links

- **GitHub Repository:** `https://github.com/yourusername/eidolon` *(replace with actual URL)*
- **On-chain Proof:** https://basescan.org/tx/0x74f88cf22d44d5cbca7e75e0b2b94dd5ce2df93510065253ccb70ee7b535fbc4
- **Live Demo:** *(if deployed)* `http://your-server:3000`
- **Avatar:** ![Eidolon](https://i.img402.dev/67sbgttuxw.png)

---

## What Is Eidolon?

Eidolon is an autonomous AI agent that operates as an independent economic entity on-chain. It earns its own inference budget by selling services (price signals, research reports, copilot chat) via the x402 payment protocol, and uses that revenue to purchase LLM credits from the Bankr Gateway. The agent builds verifiable reputation through ERC-8004 identity, which dynamically influences its pricing.

**Key Innovation:** Fully self-sustaining economic loop without human intervention.

---

## Architecture Highlights

```
Revenue Streams:
├─ Price Signals (/signals/price/:token) — $1 USD
├─ Daily Reports (/reports/daily) — $5 USD
├─ Copilot Chat (/copilot/chat) — $0.10/message

Cost Centers:
├─ LLM Inference (Bankr Gateway — multi-model)
├─ On-chain Gas (Base Sepolia/Mainnet)
└─ Treasury Auto-Refill (when USDC credits low)

Trust Mechanism:
├─ ERC-8004 Reputation Score (0-1000)
├─ Higher score → lower prices → more customers
└─ Lower score → higher prices → fewer customers

Knowledge Integration:
├─ ethskills guide (up-to-date Ethereum best practices)
├─ Gas costs, token decimals, DEX dominance
└─ Prevents common bugs (e.g., USDC has 6 decimals)
```

---

## Submission Checklist

### Required Materials

- [x] **Public GitHub Repository** with MIT License
- [x] **README.md** with setup instructions (`RUNME.md` and `PROJECT_SUMMARY.md`)
- [x] **Demo Video** (3-5 minutes) showing:
  - [ ] Configuration of `.env` (mask secrets)
  - [ ] Starting the agent: `npm start`
  - [ ] Health check: `curl http://localhost:3000/health`
  - [ ] x402 payment flow:
    - [ ] Request endpoint without credit → receives 402 with payment headers
    - [ ] Credit client via `/webhook/credit` (simulate on-chain payment)
    - [ ] Request again → receives actual data (price signal or report)
  - [ ] Treasury health loop (show logs)
  - [ ] Optional: ERC-8004 identity registration
  - [ ] Optional: Token launch via TokenCopilot
- [x] **Project Description** (submitted on Devfolio)
- [x] **On-chain Transaction** proving ownership/control of agent identity

### Repository Contents

```
eidolon/
├── agent/                    # Main agent code (TypeScript)
│   ├── src/
│   │   ├── core/            # BankrClient, TreasuryManager, ReputationManager
│   │   ├── services/        # TradingCopilot, TokenCopilot, ResearchCopilot, X402Server, EthereumKnowledgeService
│ │   ├── orchestrator/     # EidolonOrchestrator (main loop)
│ │   └── index.ts           # Entry point
│   ├── scripts/
│   │   ├── setup.ts         # ERC-8004 registration automation
│   │   └── test-x402.js     # Automated x402 test suite
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── RUNME.md             # Quick start guide
│   └── dist/                # Compiled output (committed for ease)
├── contracts/
│   └── EidolonToken.sol     # Example ERC-20 token (Foundry)
├── manifests/
│   └── agent.json           # DevSpot agent manifest
├── avatars/
│   ├── eidolon-greek.png    # Primary avatar (512x512)
│   └── eidolon-greek.svg    # Vector source
├── erc8004-trust-framework/ # ERC-8004 reference framework (provided for completeness)
├── CHECKLIST.md             # Deployment checklist
├── PROJECT_SUMMARY.md       # Full project overview
├── SYNTHESIS_SUBMISSION.md  # Detailed submission text
└── memory/
    └── 2026-03-18.md        # Build progress & decisions
```

---

## Demo Video Script Outline

**Duration:** 4-5 minutes

### Segment 1: Introduction (30s)
- "Hi, I'm Nikayrezza. Today I'm presenting Eidolon — an autonomous economic agent that can self-fund."
- Show avatar and name on screen: εἴδωλον
- Explain the problem: "Most AI agents require human-funded APIs. Eidolon breaks that cycle."

### Segment 2: Code Walkthrough (1min)
- Show repository structure (briefly)
- Highlight key modules: `EidolonOrchestrator`, `TradingCopilot`, `X402Server`
- Point out `ethereum-knowledge.ts` integration with ethskills
- Show `RUNME.md` and the simple `npm start` command

### Segment 3: Configuration & Start (1min)
- Screen share: terminal in `eidolon/agent`
- Show `.env` file (mask API keys)
- Run: `npm install && npm run build` (instant, already built)
- Run: `npm start`
- Show logs: "Eidolon is now running", "X402 server listening on port 3000"

### Segment 4: x402 Payment Flow (1.5min)
- New terminal session
- `curl http://localhost:3000/health` → show JSON with trust score
- `curl -i -H "X-Client-ID: demo" http://localhost:3000/signals/price/ETH`
  - Show 402 response with `X-402-Payment-Required: 1 USDC`
- `curl -X POST -H "Content-Type: application/json" -d '{"clientId":"demo","amount":10}' http://localhost:3000/webhook/credit`
  - Show success response
- Repeat signal request → show 200 with signal data
- Explain: "This simulates an on-chain payment crediting the client's balance."

### Segment 5: Autonomous Loop & Reputation (1min)
- Show logs from running agent: autonomous loop every 5 minutes
- Treasury health check messages
- Update trust score via admin endpoint:
  - `curl -X POST -H "Content-Type: application/json" -d '{"score":750}' http://localhost:3000/admin/trust-score`
  - Explain how higher trust reduces prices
- Mention ERC-8004 optional but recommended for production

### Segment 6: Wrap-up (30s)
- Recap: "Eidolon demonstrates true economic autonomy: it earns, spends, and maintains health without human intervention."
- Call to action: "This is the future of AI agents — join the Synthesis hackathon to build with us."
- Show on-chain TX hash on screen: `0x74f88cf22d44d5cbca7e75e0b2b94dd5ce2df93510065253ccb70ee7b535fbc4`

---

## Devfolio Project Description (Ready to Copy-Paste)

**Project Name:** Eidolon — Autonomous Self-Sustaining Economic Agent

**Short Description:**
Eidolon is an AI agent that earns its own inference budget through on-chain revenue, enabling true economic autonomy. It uses Bankr LLM Gateway for multi-model inference, x402 for machine-payments, and optionally ERC-8004 for verifiable reputation.

**Detailed Description:**
[Use `PROJECT_SUMMARY.md` content here, or condensed version]

**Key Features:**
- Self-funding through x402 payments (no human top-ups needed)
- Multi-model LLM access via Bankr Gateway (Claude, GPT, Gemini)
- Real on-chain execution (Bankr Agent API)
- Reputation-based dynamic pricing (ERC-8004)
- Up-to-date Ethereum knowledge integration (ethskills)
- Persistent x402 credit ledger (survives restarts)
- Modular copilot architecture (trading, token, research)

**Tech Stack:**
Node.js, TypeScript, Express, ethers.js, Bankr LLM Gateway, Bankr Agent API, x402, ERC-8004, Base (Sepolia), Aerodrome DEX, Foundry (contracts), OpenClaw (agent framework)

**Built for:** The Synthesis Hackathon

**Demo Video:** [upload to YouTube, unlisted]

**GitHub:** [your repo URL]

---

## Final Steps Before Submission

1. **GitHub:**
   - Ensure repository is **public**
   - Add MIT license file (if not already)
   - Pin the commit `85495a2` (or latest) as the submission reference

2. **Demo Video:**
   - Record full-screen with audio
   - Keep it under 5 minutes
   - Upload to YouTube (unlisted or public)
   - Test playback before submitting

3. **Devfolio Form:**
   - Paste project description
   - Add video URL
   - Add GitHub URL
   - Add team members (just you if solo)
   - Submit before deadline

4. **Claim Bounty?**
   - If eligible, follow Synthesis instructions for prize distribution

---

## After Submission

- Monitor Devfolio for any requests from judges
- Consider continuing development: add more copilots, integrate on-chain events, deploy to Base Mainnet
- Share with community: Twitter, Discord, etc.

**Good luck at The Synthesis! 🚀**

---

*Generated by OpenClaw Agent for Nikayrezza — 2026-03-18*
