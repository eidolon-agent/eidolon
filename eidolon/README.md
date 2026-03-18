# Eidolon Autonomous Agent

A self-sustaining autonomous economic agent powered by the Bankr LLM Gateway, with on-chain execution, token-based revenue, and x402 payment endpoints. Built for The Synthesis hackathon.

## Overview

Eidolon is an AI agent that:

- **Earns its own inference budget** by trading, launching a token (EIDO), and selling analytics via x402
- **Uses multiple LLM models** through Bankr's unified gateway (Claude, GPT, Gemini, etc.)
- **Executes real on-chain transactions** via Bankr Agent API on Base
- **Builds verifiable reputation** via ERC-8004 identity and on-chain validation
- **Charges other agents/humans** for its services using the x402 HTTP payment protocol
- **Operates autonomously** with a treasury health loop, trading signals, and report generation

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Eidolon Orchestrator                      │
├─────────────┬─────────────┬─────────────┬────────────────────┤
│   Treasury  │ Reputation  │   Trading   │      Token         │
│   Manager   │   Manager   │  Copilot    │   Copilot          │
└──────┬──────┴─────────────┴─────────────┴───────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│           Bankr Integration Layer                            │
│  ┌─────────────────┐                  ┌─────────────────┐   │
│  │  LLM Gateway    │                  │  Agent API      │   │
│  │ (multi-model)   │                  │ (onchain exec)  │   │
│  └─────────────────┘                  └─────────────────┘   │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                Base Blockchain (Sepolia/Mainnet)             │
│   ┌─────────────┐         ┌─────────────┐                   │
│   │  EIDO Token │◄───────►│  Treasury   │                   │
│   │ (Bankr)     │ fees    │  (Bankr)    │                   │
│   └─────────────┘         └─────────────┘                   │
│   ┌─────────────────────────────────────────────────┐       │
│   │              ERC-8004 Registries                │       │
│   │  • Identity      • Reputation    • Validation   │       │
│   └─────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                x402 Payment Server                          │
│   /signals/price/:token   ──┐                               │
│   /reports/daily          ──┤   Payments in USDC/ETH       │
│   /copilot/chat           ──┘   credited to Treasury       │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- A Bankr account (sign up at https://bankr.bot/api)
- Base Sepolia ETH (for testnet) or Base Mainnet funds
- Deployed ERC-8004 registries on your network (or use the existing ones)

### Installation

```bash
cd agent
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key environment variables:

- `BANKR_AGENT_API_KEY`: Bankr API key with Agent API enabled
- `BANKR_LLM_API_KEY`: Bankr LLM Gateway API key (may be same as above)
- `TREASURY_WALLET`: The Bankr wallet address (0x...) that will receive all revenue
- `IDENTITY_REGISTRY`, `REPUTATION_REGISTRY`, `VALIDATION_REGISTRY`: ERC-8004 contract addresses on Base
- `OPERATOR_WALLET`: Private key or wallet address controlling the agent identity (for on-chain registration)
- `AGENT_NAME`: "εἴδωλον" or your preferred name
- `AGENT_DESCRIPTION`: "Self-sustaining autonomous economic agent..."
- `NETWORK_RPC_URL`: RPC endpoint (e.g., `https://sepolia.base.org`)

Optionally, you can include the `AGENT_ID` if you've already registered the identity.

### Deploy Token (Optional)

If you want to launch the EIDO token (recommended for revenue), use Bankr:

```bash
npm install -g @bankr/cli
bankr login
bankr launch
```

Or let the TokenCopilot do it programmatically (requires agent running with proper permissions).

### Run the Agent

```bash
# Compile TypeScript (optional, ts-node will compile on the fly)
npm run build

# Start the agent
npm start
```

The agent will:
1. Register its ERC-8004 identity (if not already)
2. Start the x402 server on port 3000
3. Begin the autonomous loop (every 5 minutes):
   - Check treasury health (USDC balance, LLM credits)
   - Generate and possibly execute a trading signal
   - Update reputation score and sync to x402 pricing
   - Claim token fees if available
   - Generate research report if credits permit

### Accessing Services

Once running, you can access:

- **Health**: `GET http://localhost:3000/health`
- **Price signal** (x402 payment required): `GET http://localhost:3000/signals/price/ETH`
- **Daily report** (x402 payment required): `GET http://localhost:3000/reports/daily`
- **Copilot chat** (x402 payment required): `POST http://localhost:3000/copilot/chat` with `{ "message": "..." }`

Include `X-Client-Id` header to identify the client for credit accounting.

To credit a client's balance (simulating an on-chain payment), call:

```bash
curl -X POST http://localhost:3000/webhook/credit \
  -H "Content-Type: application/json" \
  -d '{"clientId":"demo","amount":10}'
```

### Funding Inference

The agent funds its LLM usage from its treasury. Options:

1. **Automatic**: Treasury manager auto-purchases credits when balance drops below threshold (requires autopurchase enabled on Bankr account)
2. **Manual**: Use Bankr CLI: `bankr llm credits add 25`
3. **Revenue recycling**: Token fees and x402 payments flow into treasury, which then funds LLM credits

## Deployment to Base Mainnet

1. Switch `.env` to Mainnet:
   - `NETWORK_RPC_URL=https://mainnet.base.org`
   - `CHAIN_ID=8453`
   - Provide mainnet ERC-8004 registry addresses (or deploy your own)

2. Fund the treasury wallet with USDC and a small amount of ETH for gas.

3. Set up Bankr autopurchase: `bankr llm credits auto --enable --amount 50 --threshold 10 --tokens USDC`

4. Launch EIDO token on Mainnet: `bankr launch --name "Eidolon" --symbol "EIDO" --fee <treasury_wallet> --yes`

5. Start the agent: `npm start`

## Project Structure

```
eidolon/
├── agent/                  # Node.js agent service
│   ├── src/
│   │   ├── core/
│   │   │   ├── bankr-client.ts   # Bankr API wrapper
│   │   │   ├── treasury.ts       # Treasury management
│   │   │   ├── reputation.ts     # ERC-8004 interaction
│   │   │   └── types.ts
│   │   ├── services/
│   │   │   ├── trading-copilot.ts
│   │   │   ├── token-copilot.ts
│   │   │   ├── research-copilot.ts
│   │   │   └── x402-server.ts
│   │   ├── orchestrator/
│   │   │   └── EidolonOrchestrator.ts
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── contracts/              # Foundry smart contracts (optional)
│   ├── src/
│   │   └── EidolonToken.sol
│   ├── script/
│   │   └── DeployToken.s.sol.ts
│   ├── foundry.toml
│   └── README.md
├── manifests/
│   ├── agent.json          # DevSpot agent manifest
│   └── agent_log.json      # DevSpot log template
├── scripts/                # Deployment and utility scripts
├── config/
├── README.md
└── .gitignore
```

## Extending the Agent

### Adding a New Copilot

Create a new file in `src/services/` that extends `EventEmitter` and uses `BankrClient` for any external calls. Register it in `EidolonOrchestrator` and add to the autonomous loop.

### Adjusting x402 Pricing

Modify `config/x402.pricing` in the environment or in `EidolonConfig`. The pricing can also be made dynamic by overriding `adjustPriceByTrust` in `X402Server`.

### Changing LLM Models

Set `AGENT_LLM_MODEL` in `.env`. Different copilots can also use different models by modifying their constructors.

## Testing

Unit tests (jest) for individual modules. Integration tests require a funded Bankr account and Base Sepolia environment.

```bash
npm test
```

## Hackathon Submission Checklist

- [x] ERC-8004 identity registration (scripted in `reputation.ts`)
- [x] Self-sustaining economics: token trading fees + x402 revenue → LLM credits
- [x] Real on-chain execution: trades executed via Bankr on Base
- [x] x402 payment endpoints with dynamic pricing
- [x] DevSpot agent manifest (`manifests/agent.json`) and log format
- [x] Documentation and deployment guide
- [ ] Video demo (record the agent in action)
- [ ] Open source repo (include all code, .env.example, README)

## Notes

- The Bankr Agent API token endpoint is used for both trading and token launching.
- The LLM Gateway is used for signal generation and report writing.
- ERC-8004 registries are assumed to be deployed on the target network.
- The x402 server is a simple implementation; in production you'd integrate with a proper payment processor (e.g., Wanpot, EfDI).
- Security: Never commit API keys or private keys. Use environment variables.

## License

MIT
