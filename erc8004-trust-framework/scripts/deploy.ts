import { ethers } from "hardhat";
import {
  TrustFrameworkABI,
  ERC8004IdentityABI,
  ReputationRegistryABI,
  ValidationRegistryABI
} from "../contracts/abis";

/**
 * Deploy the complete ERC-8004 Trust Framework
 * Returns all contract instances
 */
export async function deployFramework(deployer: any): Promise<{
  trustFramework: any;
  identityRegistry: any;
  reputationRegistry: any;
  validationRegistry: any;
}> {
  console.log("Deploying ERC-8004 Trust Framework...");

  // 1. Deploy Identity Registry
  const IdentityRegistry = await ethers.getContractFactory("ERC8004Identity");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.deployed();
  console.log(`IdentityRegistry deployed to: ${identityRegistry.address}`);

  // 2. Deploy Reputation Registry (with identity registry address)
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(identityRegistry.address);
  await reputationRegistry.deployed();
  console.log(`ReputationRegistry deployed to: ${reputationRegistry.address}`);

  // 3. Deploy Validation Registry (with reputation registry address)
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy(reputationRegistry.address);
  await validationRegistry.deployed();
  console.log(`ValidationRegistry deployed to: ${validationRegistry.address}`);

  // 4. Deploy Trust Framework (orchestrator)
  const TrustFramework = await ethers.getContractFactory("TrustFramework");
  const trustFramework = await TrustFramework.deploy(
    identityRegistry.address,
    reputationRegistry.address,
    validationRegistry.address
  );
  await trustFramework.deployed();
  console.log(`TrustFramework deployed to: ${trustFramework.address}`);

  // Set up initial validators (could be done by owner)
  // await reputationRegistry.addValidator(trustFramework.address, 1000);

  return {
    trustFramework,
    identityRegistry,
    reputationRegistry,
    validationRegistry
  };
}

/**
 * Deploy a standalone Autonomous Agent
 * Requires framework address and operator private key
 */
export async function deployAgent(
  frameworkAddress: string,
  registryAddresses: {
    identity: string;
    reputation: string;
    validation: string;
  },
  agentName: string,
  agentDescription: string,
  initialCapabilities: string[]
): Promise<any> {
  // In production, this would deploy the AutonomousAgent contract
  // For now, this is a placeholder - agents are off-chain entities
  // that interact with the framework
  
  console.log(`Agent "${agentName}" would be instantiated with:`);
  console.log(`- Framework: ${frameworkAddress}`);
  console.log(`- Identity: ${registryAddresses.identity}`);
  console.log(`- Reputation: ${registryAddresses.reputation}`);
  console.log(`- Validation: ${registryAddresses.validation}`);
  console.log(`- Capabilities: ${initialCapabilities.join(", ")}`);
  
  return {
    name: agentName,
    description: agentDescription,
    capabilities: initialCapabilities,
    frameworkAddress,
    registryAddresses
  };
}

/**
 * Quick test deployment for local development
 */
export async function quickDeploy(): Promise<any> {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  const deployed = await deployFramework(deployer);
  
  console.log("\n=== Deployment Summary ===");
  console.log(`Trust Framework: ${deployed.trustFramework.address}`);
  console.log(`Identity Registry: ${deployed.identityRegistry.address}`);
  console.log(`Reputation Registry: ${deployed.reputationRegistry.address}`);
  console.log(`Validation Registry: ${deployed.validationRegistry.address}`);
  
  return deployed;
}
