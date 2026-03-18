# ERC-8004 Decentralized Trust Framework

A complete implementation of decentralized trust for autonomous agents based on the ERC-8004 standard. This framework enables agents to establish verifiable identities, build reputation through on-chain interactions, validate capabilities, and coordinate autonomously with other agents in a trust-minimized manner.

## 🌟 Features

### ✅ ERC-8004 Integration
- **Identity Registry**: Decentralized identity registration with operator linkage
- **Reputation Registry**: Multi-factor reputation scoring with time decay, validation influence, and interaction history
- **Validation Registry**: Capability validation, credential issuance, and verification system
- **Trust Framework**: Composite trust score calculation from multiple sources

### ✅ Autonomous Agent Architecture
- **Four-Phase Autonomous Loop**: Planning → Execution → Verification → Reputation Update
- **Capability-Based Task Assignment**: Agents self-select tasks based on capabilities and trust scores
- **Multi-Agent Coordination**: Trust-based selection, capability matching, and load balancing
- **Self-Healing**: Automatic task reassignment on agent failure

### ✅ Agent Identity + Operator Model
- Each agent has a unique on-chain identity linked to an operator wallet
- Operator can manage multiple agents
- Identity includes name, description, and capability declarations
- Reputation history persists even if operator changes

### ✅ Onchain Verifiability
- All interactions, validations, and reputation updates are on-chain
- Complete history viewable on blockchain explorers
- Cryptographic proof of agent capabilities and trust scores
- Transaction receipts with event logs for audit trails

### ✅ DevSpot Agent Compatibility
- Implements DevSpot Agent Manifest (`agent.json`)
- Generates DevSpot-compatible runtime logs (`agent_log.json`)
- Standardized event structure for monitoring and debugging
- Session tracking and iteration history

## 📋 Requirements Met

| Requirement | Status | Implementation |
|------------|--------|----------------|
| ERC-8004 Integration | ✅ | Three-registry architecture (Identity, Reputation, Validation) |
| Autonomous Agent Architecture | ✅ | AutonomousAgent class with 4-phase loop |
| Agent Identity + Operator Model | ✅ | ERC8004Identity with operator linkage |
| Onchain Verifiability | ✅ | All interactions logged as on-chain transactions |
| DevSpot Agent Compatibility | ✅ | DevSpotAgent wrapper with manifest generation |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Autonomous Agents                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │   Agent 1       │  │   Agent 2       │  │  Agent N    ││
│  │ - Identity      │  │ - Identity      │  │ - Identity  ││
│  │ - Capabilities  │  │ - Capabilities  │  │ - Capabilities││
│  │ - Trust Score   │  │ - Trust Score   │  │ - Trust Score││
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘│
│           │                   │                  │       │
│           └───────────────────┼──────────────────┘       │
│                               │                         │
│                    ┌──────────▼──────────┐             │
│                    │  Trust Framework     │             │
│                    │   (Orchestrator)    │             │
│                    │                     │             │
│                    │ calculateTrustScore │             │
│                    │ verifyCapability    │             │
│                    │ registerAgent       │             │
│                    └──────────┬──────────┘             │
│                               │                         │
│         ┌─────────────────────┼─────────────────────┐   │
│         │                     │                     │   │
│    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐│
│    │ Identity │          │ Reputation│        │ Validation││
│    │ Registry │          │ Registry  │        │ Registry  ││
│    │          │          │           │        │          ││
│    │ - Agent  │          │ - Score   │        │ - Creds   ││
│    │   ID     │          │ - History │        │ - Proofs  ││
│    │ - Operator│          │ - Pairing │        │ - Scopes  ││
│    │ - Caps   │          │ - Validator│       │          ││
│    └──────────┘          └───────────┘        └──────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Hardhat
- Ethereum wallet with private key (for on-chain interactions)

### Installation

```bash
cd erc8004-trust-framework
npm install
```

### Configuration

Create a `.env` file:

```env
PRIVATE_KEY=your_wallet_private_key_here
NETWORK=hardhat  # or base-sepolia, base
```

### Deployment

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to local Hardhat node (in one terminal):
npx hardhat node

# Deploy framework (in another terminal):
npx hardhat run scripts/deploy.ts --network localhost
```

### Running an Autonomous Agent

```typescript
import { AutonomousAgent } from './src/agents/AutonomousAgent';
import { DevSpotAgent } from './src/devspot/DevSpotAgent';

// Initialize agent
const agent = new AutonomousAgent(
  process.env.PRIVATE_KEY!,
  TRUST_FRAMEWORK_ADDRESS,
  {
    identity: IDENTITY_REGISTRY_ADDRESS,
    reputation: REPUTATION_REGISTRY_ADDRESS,
    validation: VALIDATION_REGISTRY_ADDRESS
  }
);

// Wrap with DevSpot compatibility
const devSpotAgent = new DevSpotAgent(agent);

// Start autonomous loop
await agent.startAutonomousLoop(30000); // 30 second intervals

// Write manifests periodically
setInterval(() => {
  devSpotAgent.writeAgentManifest('./output');
  devSpotAgent.writeAgentLog('./output');
}, 60000);
```

## 📁 Project Structure

```
erc8004-trust-framework/
├── contracts/                    # Solidity smart contracts
│   ├── ERC8004Identity.sol      # Identity registry
│   ├── ReputationRegistry.sol   # Reputation management
│   ├── ValidationRegistry.sol   # Validation & credentials
│   ├── TrustFramework.sol       # Main orchestrator
│   └── abis.ts                  # TypeScript ABIs
├── src/
│   ├── agents/
│   │   └── AutonomousAgent.ts  # Core agent implementation
│   ├── orchestrator/
│   │   └── MultiAgentOrchestrator.ts  # Multi-agent coordination
│   └── devspot/
│       └── DevSpotAgent.ts      # DevSpot compatibility layer
├── test/
│   └── TrustFramework.test.ts  # Comprehensive test suite
├── scripts/
│   └── deploy.ts               # Deployment helper
├── devspot-manifest/
│   ├── agent.json              # DevSpot agent manifest
│   └── agent_log.json          # DevSpot log template
├── hardhat.config.js           # Hardhat configuration
└── README.md                   # This file
```

## 🧪 Testing

The test suite covers:

1. **Identity Registry Tests**
   - Agent registration with capabilities
   - Operator transfer
   - Capability management
   - Agent deactivation

2. **Reputation Registry Tests**
   - Reputation updates with bounded deltas
   - Validation recording and impact
   - Agent pairing and trust scores
   - Validator weight system

3. **Validation Registry Tests**
   - Credential issuance and verification
   - Validation requests and fulfillment
   - Credential revocation
   - Scope definition

4. **Trust Framework Integration Tests**
   - Composite trust score calculation
   - Capability verification
   - Agent readiness checks
   - Profile retrieval

5. **Onchain Verifiability Tests**
   - Transaction history
   - Interaction logging
   - Event verification

6. **DevSpot Compatibility Tests**
   - agent.json generation
   - agent_log.json generation

Run tests:

```bash
npx hardhat test
```

## 🎯 Autonomous Loop Details

The autonomous agent implements a continuous improvement cycle:

### Phase 1: Planning
- Analyzes current trust score and capabilities
- Identifies tasks that need completion
- Selects optimal agents for collaboration
- Estimates duration and confidence
- Creates execution plan with dependencies

### Phase 2: Execution
- Performs local computations
- Delegates tasks to other agents
- Sends on-chain transactions
- Logs interactions with evidence
- Tracks gas usage and transaction hashes

### Phase 3: Verification
- Verifies transaction receipts on-chain
- Validates interaction outcomes
- Checks event logs for correctness
- Calculates integrity score deltas
- Identifies failed components

### Phase 4: Reputation Update
- Updates self reputation based on outcomes
- Updates peer reputations for interactions
- Records validation results
- Refreshes composite trust score
- Logs all changes on-chain

## 🌐 Multi-Agent Coordination

The `MultiAgentOrchestrator` provides:

- **Trust-Based Selection**: Agents chosen by composite trust score
- **Capability Matching**: Ensures required capabilities are present
- **Load Balancing**: Distributes tasks evenly across agents
- **Failure Recovery**: Automatic task reassignment on agent failure
- **Real-Time Monitoring**: Event-driven status updates

## 🔐 Security Considerations

- **Operator Control**: Agent identities linked to operator wallets for revocation
- **Validation Weights**: Trusted validators can influence reputation
- **Score Bounds**: Reputation scores bounded (0-1000) to prevent inflation
- **Time Decay**: Reputation decreases with inactivity to encourage ongoing participation
- **Revocation**: Credentials can be revoked by issuers or governance

## 📊 Trust Score Composition

Trust scores are calculated as weighted averages:

```
Composite Score = 
  (Reputation Score * 50%) +
  (Validation Confidence * 30%) +
  (Interaction Success Rate * 20%)
```

Where Reputation Score is itself a weighted combination of:
- Performance (40%)
- Reliability (30%)
- Integrity (30%)

## 🛠️ Development

### Adding New Capabilities

1. Define capability hash in agent code:
```typescript
const CAPABILITY_HASH = ethers.utils.id("YOUR_CAPABILITY_NAME");
```

2. Register with identity:
```typescript
await identityRegistry._addCapability(agentId, CAPABILITY_HASH);
await identityRegistry.verifyCapability(agentId, CAPABILITY_HASH);
```

3. Request validation (optional but recommended):
```typescript
const requestId = await validationRegistry.createValidationRequest(
  agentId,
  CAPABILITY_HASH,
  timeout,
  dataHash
);
```

### Extending the Orchestrator

The `MultiAgentOrchestrator` can be extended with:

- **Custom selection algorithms**: Override `calculateAgentSuitability`
- **New scheduling policies**: Modify `schedulingLoop`
- **Additional coordination mechanisms**: Add event handlers

### Creating Custom Agents

Extend `AutonomousAgent`:

```typescript
class CustomAgent extends AutonomousAgent {
  async identifyRequiredTasks(): Promise<Task[]> {
    // Custom task identification logic
    return [...];
  }
  
  async executeTaskLocally(task: Task): Promise<ActionResult> {
    // Custom execution logic
    return {...};
  }
}
```

## 🚧 Production Considerations

- **Governance**: Add DAO or multisig control for registry parameters
- **Slashing**: Implement stake-based penalties for malicious behavior
- **Oracle Integration**: Connect external data sources for validation
- **Cross-Chain**: Deploy on multiple chains with bridge support
- **Scalability**: Consider layer-2 solutions for high-volume interactions
- **Privacy**: Implement zk-proofs for sensitive capability verification
- **Gas Optimization**: Batch operations, use events, optimize storage

## 📈 Monitoring & Observability

- Use `DevSpotAgent` to generate `agent_log.json` files
- Parse logs for loop iteration metrics
- Track trust score changes over time
- Monitor transaction success rates
- Set up alerts for failed verifications

## 📜 License

MIT

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📚 References

- [ERC-8004 Draft Standard](https://eips.ethereum.org/EIPS/eip-8004) (placeholder)
- [DevSpot Agent Specification](https://devspot.ai/spec)
- [Ethereum Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenClaw Agent Framework](https://docs.openclaw.ai/)

---

**Built with ❤️ for the autonomous agent ecosystem**
