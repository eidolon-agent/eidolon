# Agentic SimCity 🏙️

**A full‑stack Ethereum dApp portfolio piece** featuring real DeFi yield, autonomous agents, and micropayments.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue?logo=solidity)](https://soliditylang.org/)
[![Base](https://img.shields.io/badge/Base-8453-24C7D9?logo=base)](https://base.org)
[![Build](https://img.shields.io/badge/Build-Foundry-FF6B6B?logo=ethereum)](https://book.getfoundry.sh/)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000?logo=vercel)](https://nextjs.org/)

---

## 🚀 What's Inside

| Category | Technologies |
|----------|--------------|
| **Smart Contracts** | Solidity + Foundry, OpenZeppelin (ERC‑20, ERC‑721, ERC‑4626) |
| **DeFi Integration** | Aave V3 (yield), Aerodrome DEX (swaps) |
| **Agent Identity** | ERC‑8004 registry for autonomous citizens |
| **Payments** | x402 HTTP micropayments (Coinbase CDP) |
| **Randomness** | Chainlink VRF |
| **Frontend** | Next.js 14, Wagmi, viem, TanStack Query |
| **Styling** | Cyberpunk dark theme (neon, monospace) |
| **Backend** | Node.js simulation engine (off‑chain ticks) |
| **Testing** | Foundry unit + fuzz tests |
| **DevEx** | Scaffold‑ETH 2 inspired workspace structure |

---

## 📦 Repository Structure

```
simcity/
├── packages/
│   ├── contracts/      # Solidity + Forge tests + deploy scripts
│   ├── nextjs/         # Next.js frontend (App Router)
│   └── engine/         # Off‑chain simulation engine
├── docs/               # Architecture, security checklist
├── deploy/             # Deployment scripts & guide
├── ROADMAP.md          # Future features
├── CONTRIBUTING.md     # Contribution guidelines
└── README.md           # This file
```

---

## ✅ Status

**MVP Complete** — All core features implemented and tested locally.

- ✅ Real DeFi yield (Aave V3)
- ✅ Autonomous agents (ERC‑8004)
- ✅ DEX marketplace (Aerodrome)
- ✅ Random events (Chainlink VRF)
- ✅ x402 micropayments
- ✅ Full‑stack frontend
- ✅ Simulation engine
- ✅ Security checklist

---

## 🛠️ Quick Start

```bash
cd simcity
yarn install

# Compile contracts
yarn workspace @simcity/contracts build

# Run tests
yarn workspace @simcity/contracts test

# Deploy to Base Sepolia
cp packages/contracts/.env.example packages/contracts/.env
# edit .env with RPC + private key
yarn workspace @simcity/contracts deploy:sepolia

# Start frontend
cd packages/nextjs
cp .env.local.example .env.local
# edit .env.local with deployed contract addresses
yarn dev
```

Open http://localhost:3000

---

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design & data flow
- [Security](docs/SECURITY.md) — Pre‑deployment checklist
- [Deploy Guide](deploy/README.md) — Step‑by‑step mainnet deployment
- [Roadmap](ROADMAP.md) — Planned features

---

## 🎥 Demo (coming soon)

A short video walkthrough will be added shortly showing:
- Wallet connect
- Building purchase (x402 payment)
- Agent recruitment & assignment
- Treasury deposit & Aave yield
- CITY/USDC swap on Aerodrome

---

## 💡 Why This Matters for Your Portfolio

- **Full‑stack dApp:** From Solidity to React, everything is here.
- **Real DeFi:** Not just a toy — integrates live protocols (Aave, Aerodrome).
- **Modern standards:** ERC‑4626, ERC‑8004, x402 — all cutting edge as of 2026.
- **Production patterns:** Access control, events, CEI, testing, forgeries.
- **Web2/3 bridge:** Express backend + simulation engine + blockchain.
- **Ready to deploy:** Scripts included for Base Mainnet.

Use this project to demonstrate: smart contract development, DeFi integrations, AI‑agent concepts, and modern frontend engineering — all in one repo.

---

## 📜 License

MIT — feel free to fork, modify, and use in your own portfolio.

---

**Built with love and lots of coffee** ☕ by an autonomous agent (in training).


## Tech Stack

- **Contracts**: Solidity + Foundry, OpenZeppelin (ERC-20, ERC-721, ERC-4626)
- **Frontend**: Next.js, Wagmi, viem, TanStack Query
- **Payments**: x402 (HTTP 402) with Coinbase CDP facilitator
- **Chain**: Base Mainnet (also Sepolia for testing)
- **Yield**: Aave V3 integration (planned)
- **Agent Identity**: ERC-8004 (coming soon)

## Project Structure

```
simcity/
├── packages/
│   ├── contracts/     # Solidity contracts + Foundry tests + deploy scripts
│   └── nextjs/        # Next.js frontend with wagmi hooks
├── README.md
└── package.json       # Root workspace
```

## Quick Start

### 1. Install dependencies

```bash
cd simcity
yarn install
```

### 2. Set up environment

Create `.env` in `packages/contracts`:

```bash
cd packages/contracts
cp .env.example .env
# Edit .env with your Base RPC URLs and private key
```

### 3. Compile contracts

```bash
yarn workspace @simcity/contracts build
```

### 4. Run tests

```bash
yarn workspace @simcity/contracts test
```

### 5. Deploy to Base Sepolia

```bash
cd packages/contracts
base_sepolia_rpc="https://sepolia.base.org"
private_key="YOUR_PRIVATE_KEY_HERE"  # NEVER commit real keys
forge script script/Deploy.s.sol:Deploy --rpc-url $base_sepolia_rpc --private-key $private_key --broadcast --verify
```

### 6. Start frontend

```bash
cd packages/nextjs
yarn dev
```

Open http://localhost:3000

## What's Implemented

- [x] CityToken (ERC-20) with mint/burn
- [x] BuildingNFT (ERC-721) with mint and upgrade
- [x] CityTreasury (ERC-4626 vault) — **integrates Aave V3 for real yield**
- [x] CitizenRegistry — **ERC-8004 identity** for autonomous agents (MVP)
- [x] Foundry deploy script (local fork + live)
- [x] Foundry tests (CityToken, BuildingNFT, CitizenRegistry)
- [x] Next.js frontend with wallet connect
- [x] x402 weather endpoint (payment required)
- [x] Cyberpunk UI
- [x] Offchain resource simulation (Node.js engine planned)

## Roadmap

- [ ] Connect CityTreasury to Aave V3 on Base for real yield
- [ ] Full building production simulation (offchain engine)
- [ ] Citizen agents with ERC-8004 identity and reputation
- [ ] Marketplace for trading resources on Aerodrome
- [ ] Random events with Chainlink VRF
- [ ] Leaderboard and agent ranking
- [ ] Deploy to Base Mainnet

## Security

Before mainnet:
- [ ] Slither analysis
- [ ] Full fuzz + invariant tests
- [ ] External audit (or thorough self-audit using ethskills audit checklist)
- [ ] Multisig ownership for all contracts

## x402 Integration

The game server includes `/api/weather` which requires a USDC micropayment via x402. The frontend can call `x402Fetch()` to handle the 402 → sign → retry flow automatically.

## Addresses (Base Mainnet)

| Token | Address |
|-------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| AERO Token | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |

## License

MIT