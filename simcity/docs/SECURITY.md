# Security Checklist

Before deploying SimCity to mainnet (or presenting as production‑ready), ensure the following:

## Smart Contracts

- [ ] **Slither analysis** — run `slither .` and fix all warnings.
- [ ] **Mythril** — optional deeper analysis.
- [ ] **Full fuzz tests** — `forge test --fuzz-runs 10000`.
- [ ] **Invariant tests** — check that `totalAssets` always equals `aaveDeposited + vaultBalance`, etc.
- [ ] **CEI pattern** verified in all state‑changing functions.
- [ ] **Reentrancy guards** — currently not needed for CityTreasury (no external calls after state change), but consider adding if extending.
- [ ] **SafeERC20** used for all token transfers (Aave uses its own safe variants; our `CityMarketplace` uses `approve` then external call — consider using `safeTransferFrom` if possible).
- [ ] **No delegate calls** in current codebase.
- [ ] **Input validation** — zero address checks, amount > 0 checks where appropriate.
- [ ] **Events** — all state changes emit indexed events (mint, upgrade, assign, swap, etc.).
- [ ] **Overflow/underflow** — Solidity ^0.8.20 has built‑in checks.

## Access Control

- [ ] **Owner is multisig** — in production, transfer ownership to a Gnosis Safe (2/3 or 3/5).
- [ ] **Timelock** — for critical parameter changes (e.g., `CityTreasury` upgrade to withdraw fees).
- [ ] **No `onlyOwner` on user‑facing functions** — only administrative functions.

## External Dependencies

- [ ] **Aave V3 pool address** verified on Base: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`.
- [ ] **Aerodrome router** address verified: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`.
- [ ] **USDC token** address correct for Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- [ ] **Chainlink VRF** subscription funded and `keyHash` correct for Base.

## Frontend

- [ ] **Exact approvals** — frontend requests `type(uint256).max` for swaps; could be refined to exact amounts.
- [ ] **Error handling** — all contract calls have error messages shown.
- [ ] **RPC endpoints** — use dedicated RPCs (Alchemy/Infura) not public endpoints.
- [ ] **CORS** — Next.js API routes properly configured.
- [ ] **x402 facilitator** — using Coinbase public facilitator; consider self‑hosting for reliability.

## Operational

- [ ] **Monitoring** — set up logs for simulation engine ticks.
- [ ] **Treasury balance alerts** — if Aave deposit fails or USDC balance drops unexpectedly.
- [ ] **VRF subscription management** — ensure LINK/USDC balance never runs out.

## Compliance

- [ ] **No prohibited jurisdictions** — ensure the game does not violate local gambling laws (if adding betting mechanics).
- [ ] **KYC/AML** — not required unless offering regulated financial services.

## Deploy Verification

- [ ] **All contracts verified** on Basescan.
- [ ] **Constructor arguments encoded correctly** (especially `CityTreasury` with Aave address).
- [ ] **Proxy ownership** — if using upgradeable proxies, ensure proxy admin is multisig.

---

Once all items are checked, the contracts can be considered **production‑ready** for a portfolio showcase or small‑scale public launch.
