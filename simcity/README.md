# Agentic SimCity 🏙️

A city-building game where resources are real ERC-20 tokens, buildings are NFTs, and autonomous AI agents work for you. Built with Scaffold-ETH 2, x402 micropayments, ERC-4626 vaults, and ERC-8004 agent identities.

**Status:** MVP — Ready for Base Sepolia testing. Mainnet deployment coming soon.

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
private_key="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
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