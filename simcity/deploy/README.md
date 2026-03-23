# Deployment Guide

This directory contains scripts and instructions for deploying SimCity to Base Mainnet.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Base RPC URL (Alchemy/Infura/QuickNode)
- Private key with ETH for gas
- [Etherscan API key](https://etherscan.io/apis)
- Aave V3 pool address on Base (already configured)

## Steps

### 1. Set Environment Variables

```bash
export BASE_MAINNET_RPC="https://mainnet.base.org"
export PRIVATE_KEY="0x... (your deployer key, NEVER commit this)"
export ETHERSCAN_API_KEY="YourEtherscanKey"
```

### 2. Deploy Contracts

```bash
cd packages/contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

The script will deploy:
- CityToken (CITY)
- BuildingNFT (SCB)
- CityTreasury (CTSH) — backed by USDC on Base, deposits into Aave V3
- CitizenRegistry

**Save the emitted addresses** — you'll need them for the frontend.

### 3. Transfer Ownership to a Safe Multisig (HIGHLY RECOMMENDED)

**Do not leave contract ownership with a single EOA.** Create a Safe multisig and transfer ownership:

1. Create a Safe on Base: https://app.safe.global/
   - Recommended: 2-of-3 or 3-of-5 multisig
   - Owners: your hot wallet, cold wallet, and a trusted contact (recovery)
2. For each contract, call `transferOwnership(newSafeAddress)` from the deployer.
3. Verify on Basescan that the new owner is the Safe.

**Why:** A single compromised key could drain funds or break the protocol. A Safe multisig requires multiple signatures and provides recovery options.

### 4. Update Frontend Configuration

Edit `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_CITY_TOKEN_ADDRESS="0x..."
NEXT_PUBLIC_BUILDING_NFT_ADDRESS="0x..."
NEXT_PUBLIC_TREASURY_ADDRESS="0x..."
NEXT_PUBLIC_MARKETPLACE_ADDRESS="0x..."
NEXT_PUBLIC_CITIZEN_REGISTRY_ADDRESS="0x..."
NEXT_PUBLIC_USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

### 5. Deploy Frontend

```bash
cd packages/nextjs
yarn build
# Deploy to Vercel, Netlify, or any static host
```

Recommended: Vercel (auto-detects Next.js)

```bash
vercel --prod
```

### 6. Post‑Deployment

- Fund the treasury with USDC if you want real yield
- Set up Chainlink VRF subscription for RandomEvents (if enabled)
- Create a governance timelock for future parameter changes (optional)

## Maintenance

- **Yield harvesting:** call `CityTreasury.harvestYield()` periodically (could automate via x402‑protected endpoint)
- **Building upgrades:** players upgrade via frontend (calls `upgradeBuilding`)
- **Agent reputation:** offchain engine calls `CitizenRegistry.updateReputation()`

## Security

Before mainnet, run:

```bash
cd packages/contracts
slither .
forge test --fuzz-runs 10000
```

See `../docs/SECURITY.md` for audit checklist and `../docs/AUDIT_REPORT.md` for full review.

---

## Wallet Safety (Players & Developers)

⚠️ **NEVER commit private keys or API keys to Git.** Bots scan repos and drain funds in seconds.

```bash
# Check before every commit
git diff --cached --name-only | grep -iE '\.env|key|secret|private'
```

**For players:**
- Use a dedicated wallet (not your main holding wallet)
- Set token approval limits (exact amounts, not infinite)
- Verify contract addresses before interacting
- Use a Safe multisig for high-value positions (optional)

**For developers:**
- Store keys in environment variables (`.env` in `.gitignore`)
- Use hardware wallets or encrypted keystores for deployment
- Transfer contract ownership to a Safe multisig after deployment
- Implement spending limits in frontend (show warnings for large txs)

---

## Contracts on Base Mainnet (once deployed)

| Name | Address | Verification |
|------|---------|--------------|
| CityToken | `0x...` | [Basescan] |
| BuildingNFT | `0x...` | [Basescan] |
| CityTreasury | `0x...` | [Basescan] |
| CitizenRegistry | `0x...` | [Basescan] |

---

## Support

- **Docs:** `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/AUDIT_REPORT.md`
- **Issues:** Open on GitHub
- **Community:** (coming soon)

