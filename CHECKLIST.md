# Eidolon Deployment Checklist

## Before First Run

- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required environment variables (no placeholders left)
- [ ] Verify Node.js 18+ (`node --version`)
- [ ] Run `npm install` in `eidolon/agent/`
- [ ] Run `npm run build` — should output just `> tsc` with no errors

## Bankr Setup

- [ ] Create/sign in to Bankr account: https://bankr.bot/api
- [ ] Generate **Agent API Key** (with Agent API access)
- [ ] Generate **LLM Gateway API Key** (may be same)
- [ ] Copy keys to `.env`: `BANKR_AGENT_API_KEY`, `BANKR_LLM_API_KEY`
- [ ] Note your Bankr wallet address (from dashboard) → `TREASURY_WALLET`
- [ ] Fund wallet with USDC (for LLM credits) and ETH (for gas)

## ERC-8004 Identity

- [ ] Deploy or obtain addresses for:
  - `IDENTITY_REGISTRY`
  - `REPUTATION_REGISTRY`
  - `VALIDATION_REGISTRY`
  (On Base Sepolia; test with existing deployed registries if available)
- [ ] Set `OPERATOR_WALLET` (wallet address that will register/manage agent)
- [ ] Ensure operator wallet has Base Sepolia ETH for gas
- [ ] Run setup script: `npx ts-node scripts/setup.ts`
- [ ] Copy printed `AGENT_ID` to `.env`

## Network Configuration

- [ ] Set `NETWORK=base-sepolia` (or `base-mainnet` for production)
- [ ] Set `NETWORK_RPC_URL` (e.g., `https://sepolia.base.org`)
- [ ] Set `CHAIN_ID` (84532 for Sepolia, 8453 for Mainnet)

## X402 Server

- [ ] Set `PORT` (default 3000)
- [ ] Set `X402_PAYMENT_ADDRESS` (defaults to `TREASURY_WALLET`)
- [ ] Configure pricing (defaults are fine):
  - `PRICE_SIGNAL_PRICE=1`
  - `DAILY_REPORT_PRICE=5`
  - `COPILOT_CHAT_PRICE=0.10`
  - `MAX_DEBT=50`

## Agent Identity

- [ ] Set `AGENT_NAME=εἴδωλον` (or preferred name)
- [ ] Set `AGENT_DESCRIPTION="Enabling fully autonomous economic agents that can self-fund through on-chain revenue"`
- [ ] Set `AGENT_LLM_MODEL=claude-sonnet-4-6` (or other Bankr-supported model)
- [ ] Optional: set `AGENT_CAPABILITIES` (comma-separated)

## First Run

- [ ] Start agent: `npm start` (or `npm run dev`)
- [ ] Check logs for "Eidolon is now running"
- [ ] Verify x402 server listening: `netstat -tuln | grep 3000`

## Testing

- [ ] Health check: `curl http://localhost:3000/health`
- [ ] Test payment flow:
  - `curl -i -H "X-Client-ID: test" http://localhost:3000/signals/price/ETH` (should return 402)
  - `curl -X POST -H "Content-Type: application/json" -d '{"clientId":"test","amount":10}' http://localhost:3000/webhook/credit`
  - Repeat signal request (should return 200 with data)
- [ ] Test daily report: `curl -H "X-Client-ID: test" http://localhost:3000/reports/daily`
- [ ] Test copilot chat: `curl -X POST -H "Content-Type: application/json" -H "X-Client-ID: test" -d '{"message":"Hello"}' http://localhost:3000/copilot/chat`
- [ ] Test trust score: `curl -X POST -H "Content-Type: application/json" -d '{"score":750}' http://localhost:3000/admin/trust-score`
- [ ] Optional: run full test suite `node scripts/test-x402.js`

## Go Live (Production)

For Base Mainnet deployment:

- [ ] Switch `NETWORK=base-mainnet`, `CHAIN_ID=8453`, `NETWORK_RPC_URL=https://mainnet.base.org`
- [ ] Use mainnet ERC-8004 registry addresses
- [ ] Fund mainnet wallet with USDC and ETH
- [ ] Re-register identity on mainnet (new `AGENT_ID`)
- [ ] Adjust `AUTO_REFILL_THRESHOLD` and `MIN_USDC_BALANCE` for scale
- [ ] Consider using Safe (Gnosis Safe) for `TREASURY_WALLET`
- [ ] Review security: private keys, API keys, secrets management
- [ ] Set up monitoring/alerting (logs, metrics, on-chain events)

## Synthesis Submission

- [ ] Commit all code to repo (MIT license)
- [ ] Write demo video (3-5 min) showing:
  - Setup and configuration
  - Identity registration on-chain (tx hash)
  - Agent startup
  - x402 payment flow (client credits, gets signal)
  - Treasury balance updates
  - Optional: token launch
- [ ] Update `SYNTHESIS_SUBMISSION.md` with final details
- [ ] Submit via Devfolio

## Post-Launch

- [ ] Monitor treasury health (auto-refill loop every 60s)
- [ ] Adjust trading strategy based on performance
- [ ] Collect on-chain revenue and reinvest in LLM credits
- [ ] Build reputation via ERC-8004 validation events
- [ ] Expand copilot capabilities as needed

---

**Need help?** See `RUNME.md` for detailed docs, or check `memory/2026-03-18.md` for progress.
