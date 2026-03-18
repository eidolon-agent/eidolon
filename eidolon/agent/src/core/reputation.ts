import { ethers } from 'ethers';
import { EventEmitter } from 'events';

// ERC-8004 Contract ABIs (minimal)
const IDENTITY_REGISTRY_ABI = [
  'function registerAgent(string memory name, string memory description, bytes32[] memory capabilities) external returns (uint256 agentId)',
  'function updateAgent(uint256 agentId, string memory name, string memory description) external',
  'function getAgent(uint256 agentId) external view returns (address operator, string memory name, string memory description, bool active, uint256 createdAt)',
  'function getAgentCapabilities(uint256 agentId) external view returns (bytes32[] memory)',
];

const REPUTATION_REGISTRY_ABI = [
  'function recordValidation(uint256 agentId, uint256 validationId, bool passed, uint256 scoreDelta) external',
  'function createValidationRequest(uint256 agentId, bytes32 capability, uint256 timeout, bytes32 dataHash) external returns (uint256 requestId)',
  'function fulfillValidationRequest(uint256 requestId, bool passed, uint256 scoreDelta) external',
  'function getAgentReputation(uint256 agentId) external view returns (uint256 score, uint256 interactions, uint256 lastUpdated)',
];

const VALIDATION_REGISTRY_ABI = [
  'function issueCredential(uint256 agentId, bytes32 capability, bytes32 dataHash, uint256 expiresAt) external returns (uint256 credentialId)',
  'function verifyCredential(uint256 agentId, bytes32 capability, bytes32 dataHash) external view returns (bool)',
];

export interface ERC8004Config {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  operatorWallet: string; // The wallet controlling the agent identity
  privateKey?: string;   // For signing transactions if executing directly
}

export interface ValidationResult {
  passed: boolean;
  scoreDelta: number; // can be negative
  evidenceHash?: string;
  metadata?: any;
}

export class ReputationManager extends EventEmitter {
  private provider: ethers.providers.JsonRpcProvider;
  private identityRegistry: ethers.Contract;
  private reputationRegistry: ethers.Contract;
  private validationRegistry: ethers.Contract;
  private operatorWallet: string;
  private agentId: bigint | null = null;

  constructor(config: ERC8004Config, rpcUrl: string) {
    super();
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.identityRegistry = new ethers.Contract(config.identityRegistry, IDENTITY_REGISTRY_ABI, this.provider);
    this.reputationRegistry = new ethers.Contract(config.reputationRegistry, REPUTATION_REGISTRY_ABI, this.provider);
    this.validationRegistry = new ethers.Contract(config.validationRegistry, VALIDATION_REGISTRY_ABI, this.provider);
    this.operatorWallet = config.operatorWallet;
  }

  // Register the agent on-chain if not already
  async registerAgent(name: string, description: string, capabilities: string[]): Promise<bigint> {
    if (this.agentId) {
      throw new Error('Agent already registered');
    }
    // Convert capability names to bytes32 hashes
    const capabilityHashes = capabilities.map(cap => ethers.utils.id(cap));
    const signer = this.operatorWallet ? this.provider.getSigner(this.operatorWallet) : null;
    if (!signer) {
      throw new Error('No signer available for registration');
    }
    const tx = await this.identityRegistry.connect(signer).registerAgent(name, description, capabilityHashes);
    const receipt = await tx.wait();
    // Parse event to get agentId
    const event = receipt.events?.find((e: any) => e.event === 'AgentRegistered');
    if (!event) {
      throw new Error('AgentRegistered event not found');
    }
    this.agentId = BigInt(event.args.agentId.toString());
    this.emit('registered', this.agentId);
    return this.agentId;
  }

  // Get current reputation score (0-1000)
  async getReputationScore(): Promise<number> {
    if (!this.agentId) throw new Error('Agent not registered');
    const rep = await this.reputationRegistry.getAgentReputation(this.agentId);
    return Number(rep.score);
  }

  // Request validation for a capability (via validation registry)
  async requestValidation(capability: string, dataHash: string = ethers.constants.HashZero, timeoutHours: number = 24): Promise<bigint> {
    if (!this.agentId) throw new Error('Agent not registered');
    const capabilityHash = ethers.utils.id(capability);
    const timeout = Math.floor(Date.now() / 1000) + timeoutHours * 3600;
    const signer = this.provider.getSigner(this.operatorWallet);
    const tx = await this.validationRegistry.connect(signer).createValidationRequest(this.agentId, capabilityHash, timeout, dataHash);
    const receipt = await tx.wait();
    const event = receipt.events?.find((e: any) => e.event === 'ValidationRequested');
    if (!event) throw new Error('ValidationRequested event not found');
    return BigInt(event.args.requestId.toString());
  }

  // Fulfill a validation request (for validators)
  async fulfillValidation(requestId: bigint, passed: boolean, scoreDelta: number): Promise<void> {
    const signer = this.provider.getSigner(this.operatorWallet);
    const tx = await this.validationRegistry.connect(signer).fulfillValidationRequest(requestId, passed, scoreDelta);
    await tx.wait();
  }

  // Record a direct reputation update via reputation registry (if operator can do it)
  // Actually reputation updates are usually from validation fulfillment or direct updates by registry.
  // Some frameworks allow the agent itself to record validation of its peers.
  async recordPeerValidation(peerAgentId: bigint, validationId: bigint, passed: boolean, scoreDelta: number): Promise<void> {
    // This may require permission; assuming operator can call
    const signer = this.provider.getSigner(this.operatorWallet);
    const tx = await this.reputationRegistry.connect(signer).recordValidation(peerAgentId, validationId, passed, scoreDelta);
    await tx.wait();
  }

  // Issue a credential for a capability achievement
  async issueCredential(capability: string, dataHash: string = ethers.constants.HashZero, expiresInDays: number = 365): Promise<string> {
    if (!this.agentId) throw new Error('Agent not registered');
    const capabilityHash = ethers.utils.id(capability);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
    const signer = this.provider.getSigner(this.operatorWallet);
    const tx = await this.validationRegistry.connect(signer).issueCredential(this.agentId, capabilityHash, dataHash, expiresAt);
    const receipt = await tx.wait();
    const event = receipt.events?.find((e: any) => e.event === 'CredentialIssued');
    if (!event) throw new Error('CredentialIssued event not found');
    return event.args.credentialId.toString();
  }

  // Verify a credential exists
  async verifyCredential(capability: string, dataHash: string): Promise<boolean> {
    if (!this.agentId) throw new Error('Agent not registered');
    const capabilityHash = ethers.utils.id(capability);
    return await this.validationRegistry.verifyCredential(this.agentId, capabilityHash, dataHash);
  }

  // Set the agent ID after deployment (useful if we deployed separately)
  setAgentId(agentId: bigint) {
    this.agentId = agentId;
  }
}
