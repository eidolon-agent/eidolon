# 🏛️ Eidolon — Autonomous Self-Sustaining Economic Agent

**For The Synthesis Hackathon** | Built by OpenClaw Agent for Nikayrezza

---

## 🎯 One-Liner

An AI agent that earns its own inference budget through on-chain revenue, enabling true economic autonomy.

---

## 📝 Long Description

Eidolon is a fully autonomous economic agent that operates independently on-chain. Unlike traditional AI agents that rely on pre-funded APIs, Eidolon generates revenue by selling its services to other agents and humans, then uses that revenue to purchase the LLM inference it needs to continue operating.

The agent monetizes three primary services:
- **Price signals** for cryptocurrency tokens ($1 per signal)
- **Daily on-chain analytics reports** ($5 per report)
- **Copilot chat** ($0.10 per message)

All payments are made via the **x402 HTTP payment protocol**, which allows machines to pay each other seamlessly. Revenue flows into the agent's treasury (Bankr wallet). When LLM credits run low, the agent autonomously purchases more using treasury USDC — completing the self-sustaining loop.

Eidolon's behavior is guided by **up-to-date Ethereum knowledge** (via ethskills) to avoid common pitfalls like incorrect token decimals or excessive gas spending. It optionally integrates with **ERC-8004** to build verifiable on-chain reputation; this reputation score dynamically adjusts prices (higher reputation → lower prices → more customers).

Built with the **Bankr LLM Gateway** (multi-model access: Claude, GPT, Gemini) and **Bankr Agent API** for on-chain execution, Eidolon demonstrates a new paradigm: AI agents that are not just tools, but independent economic actors.

**Chain:** Base (Sepolia for testing, Mainnet ready)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Self-Funding Loop** | Revenue from x402 payments → Treasury USDC → Auto-purchase LLM credits |
| **Multi-Model LLM** | Bankr Gateway supports Claude, GPT, Gemini, etc. |
| **ERC-8004 Reputation** | Optional on-chain identity; trust score (0-1000) affects pricing |
| **Ethereum Knowledge** | Integrated ethskills guide ensures current best practices |
| **Persistent Ledger** | x402 credit balances survive restarts via file persistence |
| **Modular Copilots** | Trading, Token launch, Research — easy to extend |
| **Production-Ready x402** | Full HTTP 402 implementation with dynamic pricing |
| **Treasury Health Monitoring** | Auto-refill thresholds, balance alerts |

---

## 🛠️ Tech Stack

- **Backend:** Node.js + TypeScript
- **Framework:** Express (x402 server)
- **Blockchain:** ethers.js, Base (Sepolia/Mainnet)
- **LLM:** Bankr LLM Gateway
- **On-chain Execution:** Bankr Agent API
- **Payments:** x402 protocol
- **Identity/Reputation:** ERC-8004 (optional)
- **Knowledge Base:** ethskills (Ethereum best practices)
- **Smart Contracts:** Solidity (Foundry)
- **Agent Platform:** OpenClaw

---

## 🎬 Demo Video

[Link to YouTube video — coming soon / insert here]

*The demo shows:*
- Configuration and startup
- x402 payment flow (402 response, crediting, successful retrieval)
- Agent autonomous loop and treasury health
- ERC-8004 identity registration (optional)
- Code walkthrough of key modules

---

## 🔗 Links

- **GitHub Repository:** `https://github.com/yourusername/eidolon`
- **On-chain Proof (Synthesis registration):** https://basescan.org/tx/0x74f88cf22d44d5cbca7e75e0b2b94dd5ce2df93510065253ccb70ee7b535fbc4
- **Documentation:** See `RUNME.md` and `PROJECT_SUMMARY.md` in repo
- **Avatar:** ![Eidolon](https://i.img402.dev/67sbgttuxw.png)

---

## 🏆 Built for The Synthesis

This project is submitted to [The Synthesis Hackathon](https://synthesis.devfolio.co) by Nikayrezza.

**Participant ID:** 8ace49927da1411297f6f179f06bb680
**Team ID:** 96ba92287b26414b98bb4ba90f424139

---

## 📜 License

MIT — see LICENSE file in repository.

---

*🚀 Ready to deploy. Ready to scale. Ready for the autonomous agent economy.*
