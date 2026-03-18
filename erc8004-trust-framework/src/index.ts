/**
 * ERC-8004 Trust Framework
 * Decentralized trust for autonomous agents
 */

// Export contract ABIs
export * from './contracts/abis';

// Export agent implementations
export { AutonomousAgent } from './src/agents/AutonomousAgent';
export { MultiAgentOrchestrator } from './src/orchestrator/MultiAgentOrchestrator';
export { DevSpotAgent } from './src/devspot/DevSpotAgent';

// Export deployment utilities
export { deployFramework, deployAgent, quickDeploy } from './scripts/deploy';
import { deployFramework, deployAgent, quickDeploy } from './scripts/deploy';

// Re-export for convenience
export default {
  AutonomousAgent: require('./src/agents/AutonomousAgent').AutonomousAgent,
  MultiAgentOrchestrator: require('./src/orchestrator/MultiAgentOrchestrator').MultiAgentOrchestrator,
  DevSpotAgent: require('./src/devspot/DevSpotAgent').DevSpotAgent,
  deployFramework,
  deployAgent,
  quickDeploy
};
