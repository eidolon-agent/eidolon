/**
 * Example: Setting up and running an autonomous ERC-8004 agent
 * 
 * This example demonstrates:
 * 1. Deploying the trust framework contracts
 * 2. Registering an agent identity
 * 3. Starting the autonomous loop
 * 4. Multi-agent coordination with orchestrator
 */

import { ethers } from "hardhat";
import { AutonomousAgent } from "./src/agents/AutonomousAgent";
import { MultiAgentOrchestrator } from "./src/orchestrator/MultiAgentOrchestrator";
import { DevSpotAgent } from "./src/devspot/DevSpotAgent";
import { deployFramework } from "./scripts/deploy";

async function main() {
  console.log("🚀 ERC-8004 Trust Framework Example\n");

  // Deploy framework (or use existing deployment)
  console.log("📜 Deploying trust framework...");
  const { trustFramework, identityRegistry, reputationRegistry, validationRegistry } = await deployFramework();
  
  const frameworkAddress = trustFramework.address;
  const registryAddresses = {
    identity: identityRegistry.address,
    reputation: reputationRegistry.address,
    validation: validationRegistry.address
  };

  console.log(`✓ Framework deployed at: ${frameworkAddress}\n`);

  // Agent configuration
  const agentConfigs = [
    {
      name: "DataProcessor",
      description: "Processes and validates data from multiple sources",
      capabilities: [
        "DATA_VALIDATION",
        "DATA_PROCESSING",
        "API_INTEGRATION"
      ].map(c => ethers.utils.id(c))
    },
    {
      name: "ReputationManager",
      description: "Manages and evaluates agent reputations",
      capabilities: [
        "REPUTATION_QUERY",
        "REPUTATION_UPDATE",
        "VALIDATION"
      ].map(c => ethers.utils.id(c))
    },
    {
      name: "TaskCoordinator",
      description: "Coordinates and delegates tasks to other agents",
      capabilities: [
        "TASK_PLANNING",
        "AGENT_SELECTION",
        "DELEGATION"
      ].map(c => ethers.utils.id(c))
    }
  ];

  // Get signers to act as operators
  const [operator1, operator2, operator3] = await ethers.getSigners();
  const operators = [operator1, operator2, operator3];

  // Create and register agents
  console.log("🤖 Registering agents...");
  const agents: AutonomousAgent[] = [];

  for (let i = 0; i < agentConfigs.length; i++) {
    const config = agentConfigs[i];
    const operator = operators[i];
    
    // Register agent on-chain
    const agentId = await trustFramework.connect(operator).registerAgent(
      config.name,
      config.description,
      config.capabilities
    );
    
    console.log(`  ✓ Registered ${config.name} (ID: ${agentId}) with operator ${operator.address}`);
    
    // Create AutonomousAgent instance (off-chain representation)
    // In production, this would be an actual running agent process
    const agent = new AutonomousAgent(
      operator.privateKey, // In real usage, use environment variable
      frameworkAddress,
      registryAddresses
    );
    
    // Manually set agentId to match on-chain (for demo)
    agent['agentId'] = agentId;
    agent['capabilities'] = config.capabilities.map(c => c.toString());
    
    agents.push(agent);
  }

  console.log("\n📊 Initial Trust Scores:");
  for (const agent of agents) {
    // Would fetch from on-chain
    console.log(`  - ${agent.getAgentId().substring(0, 10)}...: Trust Score = ${agent.getTrustScore()}`);
  }

  // Set up orchestrator for multi-agent coordination
  console.log("\n🎯 Setting up Multi-Agent Orchestrator...");
  const orchestrator = new MultiAgentOrchestrator(frameworkAddress);
  
  for (const agent of agents) {
    orchestrator.registerAgent(agent);
  }
  
  orchestrator.start();
  console.log("✓ Orchestrator started\n");

  // Example: Submit a task
  console.log("📝 Submitting example task...");
  const task = {
    taskId: "",
    description: "Validate data processing pipeline integrity",
    requiredCapabilities: [
      ethers.utils.id("DATA_VALIDATION"),
      ethers.utils.id("VALIDATION")
    ].map(c => c.toString()),
    priority: 1,
    dependencies: [],
    expectedOutcome: "All data validated with 99.9% accuracy"
  };

  const taskId = await orchestrator.submitTask(task);
  console.log(`✓ Task submitted with ID: ${taskId}\n`);

  // Wrap agents with DevSpot compatibility
  console.log("📦 Setting up DevSpot compatibility...");
  const devSpotAgents = agents.map(agent => new DevSpotAgent(agent));
  
  // Output DevSpot manifests
  for (let i = 0; i < devSpotAgents.length; i++) {
    const outputDir = `./output/${agentConfigs[i].name}`;
    await devSpotAgents[i].writeAgentManifest(outputDir);
    await devSpotAgents[i].writeAgentLog(outputDir);
    console.log(`  ✓ ${agentConfigs[i].name} manifests written to ${outputDir}`);
  }

  console.log("\n✅ ERC-8004 Trust Framework example complete!");
  console.log("\nNext steps:");
  console.log("  1. Start agent autonomous loops with agent.startAutonomousLoop()");
  console.log("  2. Submit more tasks to orchestrator");
  console.log("  3. Monitor agent_log.json for compliance");
  console.log("  4. Deploy to testnet/mainnet");

  // Keep running for demo
  console.log("\n🔄 Agents running autonomously. Press Ctrl+C to stop.");
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
