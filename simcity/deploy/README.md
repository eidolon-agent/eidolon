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
export PRIVATE_KEY="0x... (your deployer key)"
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

### 3. Update Frontend Configuration

Edit `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_CITY_TOKEN_ADDRESS="0x..."
NEXT_PUBLIC_BUILDING_NFT_ADDRESS="0x..."
NEXT_PUBLIC_TREASURY_ADDRESS="0x..."
NEXT_PUBLIC_MARKETPLACE_ADDRESS="0x..."
NEXT_PUBLIC_CITIZEN_REGISTRY_ADDRESS="0x..."
NEXT_PUBLIC_USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

### 4. Deploy Frontend

```bash
cd packages/nextjs
yarn build
# Deploy to Vercel, Netlify, or any static host
```

Recommended: Vercel (auto-detects Next.js)

```bash
vercel --prod
```

### 5. Post‑Deployment

- Fund the treasury with USDC if you want real yield
- Set up multisig ownership for upgradeable contracts (if any)
- Add Chainlink VRF subscription for RandomEvents (if enabled)
- Create a governance timelock for future parameter changes

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

See `../docs/SECURITY.md` for audit checklist.

---

## Contracts on Base Mainnet (once deployed)

| Name | Address | Verification |
|------|---------|--------------|
| CityToken | `0x...` | [Etherscan] |
| BuildingNFT | `0x...` | [Etherscan] |
| CityTreasury | `0x...` | [Etherscan] |
| CitizenRegistry | `0x...` | [Etherscan] |
