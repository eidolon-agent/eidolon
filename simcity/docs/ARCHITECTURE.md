# Agentic SimCity — Technical Architecture

## Overview

SimCity is a city‑building game that combines on‑chain ownership with off‑chain simulation. Players own buildings (NFTs), hire citizen agents, and earn real yield through DeFi integrations.

## Core Contracts

### 1. CityToken (ERC‑20)

- **Purpose:** In‑game currency for purchasing buildings and services.
- **Supply:** 1 000 000 CITY minted initially to the deployer (later transferred to treasury).
- **Mintable:** Yes, by owner (for rewards/events).
- **Decimals:** 18 (for flexibility, though production rates use 6‑decimals USDC as base).

### 2. BuildingNFT (ERC‑721)

- **Purpose:** Each building is an NFT with a type and level.
- **Types:** HOUSE, FACTORY, FARM, SOLAR_FARM, DATA_CENTER.
- **Production:** Offchain engine calculates resource output based on type, level, and assigned citizens.
- **Upgrade:** Owner can upgrade (increase level) by paying CITY tokens (not yet implemented on‑chain; UI will call this).
- **URI:** Could be set to IPFS metadata (image + stats).

### 3. CityTreasury (ERC‑4626)

- **Purpose:** Vault for player deposits (USDC). Depositors mint CTSH shares.
- **Yield Mechanism:** Automatically deposits USDC into Aave V3 on Base. Interest accrues to the vault.
- **Harvesting:** Owner (or future governor) can call `harvestYield()` to mint new shares from yield, effectively distributing profit to shareholders.
- **Accounting:** Tracks `aaveDeposited` and `vaultBalance` to compute total assets accurately.
- **Aave Pool:** `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` on Base.

### 4. CitizenRegistry

- **Purpose:** Simplified ERC‑8004‑style identity for autonomous agents.
- **Attributes:** name, skill (farmer/engineer/merchant), reputation (0‑1000), assignedBuilding, owner.
- **ERC‑8004 Hook:** `registerOnChainIdentity()` can create a real on‑chain identity by calling the IdentityRegistry (placeholder for now).
- **Reputation Updates:** Only owner (game engine) can update; used for quality of work.

### 5. CityMarketplace

- **Purpose:** Swap CITY tokens for USDC (and vice versa) using Aerodrome router.
- **Router:** `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` (Base).
- **Route:** Direct pool CITY/USDC (assumes sufficient liquidity).
- **Use Case:** Players cash out earned CITY tokens.

### 6. RandomEvents (Chainlink VRF)

- **Purpose:** Provide verifiable randomness for in‑game events (storms, booms, crashes).
- **Subscription:** Requires funded VRF subscription on Base.
- **Flow:** Anyone can request an event → VRF returns randomness → `fulfillRandomness` triggers event with intensity.
- **Offchain Handling:** The simulation engine listens to `RandomnessReceived` and applies consequences (e.g., production penalties).

## Off‑Chain Components

### Simulation Engine (`packages/engine`)

- **Language:** TypeScript + Express.
- **Tick Loop:** Every 5 minutes (configurable).
- **Logic:**
  1. Fetch all buildings and assigned citizens from contracts.
  2. Compute production per building based on type, level, and citizen reputation.
  3. Mint CITY tokens to treasury (or directly to building owners) — **not yet implemented onchain** (would require a minting authority).
  4. Could trigger VRF events randomly.
- **API Endpoints:**
  - `GET /api/sim/status`
  - `GET /api/sim/buildings`
  - `GET /api/sim/citizens`

### Frontend (`packages/nextjs`)

- **Framework:** Next.js 14 (App Router).
- **Wallet Connect:** Wagmi + viem.
- **Pages:**
  - `/` — Dashboard showing balances, buildings, weather (x402).
  - `/marketplace` — Swap CITY/USDC via Aerodrome.
  - `/agents` — Recruit citizens, assign to buildings.
  - `/treasury` — Show Aave yield metrics.
- **x402 Integration:**
  - `/api/weather` — requires $0.05 USDC.
  - `/api/buy-building` — requires $0.10 USDC.
- **Styling:** Cyberpunk (dark mode, neon accents, monospace font).

## Data Flow

```
User interacts (mint building, recruit agent, swap tokens)
  ↓
Frontend sends signed tx to contract
  ↓
Contract emits event (BuildingMinted, CitizenCreated, Swapped)
  ↓
Off‑chain engine listens to events (or polls) and updates simulation state
  ↓
Periodic tick produces resources → mints CITY tokens to treasury
  ↓
Players claim yield from CityTreasury (redeem shares for USDC + Aave interest)
```

## Security Considerations

- **Reentrancy:** `CityTreasury` uses CEI; `CityMarketplace` does low‑level calls but no state changes before external call.
- **Approvals:** Marketplace uses `approve` then direct call; risk of infinite approvals mitigated by frontend suggesting exact amounts.
- **Access Control:** Critical functions (mint, withdraw, set config) are `onlyOwner` — should be multisig in production.
- **Randomness:** Chainlink VRF is provably fair; subscription funded with LINK/USDC.
- **Decimal Handling:** USDC uses 6 decimals; CITY uses 18. All arithmetic normalized.
- **Upgradeability:** Contracts are upgradeable (foundry script could be extended with OpenZeppelin Transparent or UUPS).

## Gas Optimizations

- Buildings and citizens use `uint256` counters; could use `bytes32` IDs for smaller calldata.
- `CityTreasury` does minimal storage writes; deposits/withdrawals are standard ERC‑4626.
- `CityMarketplace` uses low‑level `call` to avoid ABI mismatches with Aerodrome router.

## Future Improvements

- **Upgradeability:** Make contracts UUPS upgradeable.
- **Cross‑chain:** Deploy same contracts on Arbitrum/Optimism; use ERC‑8004 for cross‑chain agent identity.
- **Governance:** Token‑based voting for treasury parameters.
- **AI Integration:** Let `EidolonOrchestrator` (or similar) auto‑manage city resources.
- **On‑chain Vault Strategies:** Integrate Morpho Blue on Base for higher yield.
- **NFT Metadata:** Encode building stats in ERC‑721 metadata JSON and store on IPFS.

---

Built with [Scaffold‑ETH 2](https://scaffoldeth.io) principles, using 2026 best practices from [ethskills.com](https://ethskills.com).
