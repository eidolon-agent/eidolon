# Roadmap

## Phase 1 — Core MVP (✅ Completed)

- [x] CityToken (ERC‑20)
- [x] BuildingNFT (ERC‑721)
- [x] CityTreasury (ERC‑4626)
- [x] CitizenRegistry (ERC‑8004 inspired)
- [x] CityMarketplace (Aerodrome DEX swap)
- [x] RandomEvents (Chainlink VRF)
- [x] Simulation engine (Node.js)
- [x] Next.js frontend (dashboard, marketplace, agents, treasury)
- [x] x402 micropayment endpoints
- [x] Foundry tests + deploy script

## Phase 2 — Integration Polish (🛠️ In Progress)

- [ ] Connect simulation engine to real contract events (listen to `BuildingMinted`, `CitizenCreated`, `RandomnessReceived`)
- [ ] Implement CITY token minting on each tick to building owners (requires `CityToken.mint` with proper access control)
- [ ] Add stamina/energy system for citizens (off‑chain state)
- [ ] Full Aerodrome LP integration: allow players to provide liquidity and earn AERO rewards
- [ ] Add Aave yield harvesting UI (call `harvestYield()` from frontend)
- [ ] Add VRF subscription configuration in deploy script

## Phase 3 — Mainnet Launch

- [ ] Deploy all contracts to Base Mainnet
- [ ] Verify contracts on Basescan
- [ ] Fund Chainlink VRF subscription with LINK/USDC
- [ ] Transfer ownership to Gnosis Safe (3/5 multisig)
- [ ] Deploy frontend to Vercel with real contract addresses
- [ ] Seed initial USDC liquidity for marketplace (if needed)
- [ ] Create tutorial video (2‑3 min demo)

## Phase 4 — Advanced Features

- [ ] Cross‑chain support (Arbitrum, Optimism) using ERC‑8004 cross‑chain identity
- [ ] AI‑driven autonomous agents: plug in `EidolonOrchestrator` to manage city resources autonomously.
- [ ] On‑chain governance: CITY token holders vote on treasury parameters.
- [ ] Morpho Blue integration for leveraged yield strategies.
- [ ] NFT marketplace for building skins (ERC‑721, OpenSea compatible).
- [ ] Mobile‑responsive UI with PWA support.
- [ ] Leaderboard & reputation API for third‑party apps.
- [ ] DAO treasury to fund community events.

## Phase 5 — Scaling

- [ ] Staking: lock CITY tokens to earn a share of game revenue.
- [ ] L2 expansion: deploy Same system on Scroll, zkSync, Linea.
- [ ] Cross‑game composability: let other dApps use SimCity buildings as assets.
- [ ] On‑chain quests: players complete real on‑chain actions (swap, stake) for rewards.
- [ ] Farcaster Frames integration: playable mini‑games in social feed.

---

## Milestone Tracking

- **MVP complete** — Mar 2026
- **Testnet demo ready** — Apr 2026
- **Mainnet launch** — TBD (after audit & funding)
- **First external audit** — TBD
