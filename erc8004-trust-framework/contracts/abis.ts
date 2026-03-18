export const TrustFrameworkABI = [
  "event AgentFullyRegistered(bytes32 indexed agentId, address indexed operator)",
  "event TrustScoreCalculated(bytes32 indexed agentId, uint256 compositeScore)",
  "event CapabilityVerified(bytes32 indexed agentId, bytes32 indexed capabilityHash, bool isValid)",
  "function registerAgent(string name, string description, bytes32[] capabilities) returns (bytes32)",
  "function calculateTrustScore(bytes32 agentId) view returns (uint256)",
  "function verifyCapability(bytes32 agentId, bytes32 capabilityHash, uint256 minConfidence) view returns (bool, uint256)",
  "function verifyAgentReadiness(bytes32 agentId, bytes32[] requiredCapabilities, uint256 minConfidence) view returns (bool, uint256[] memory confidenceScores)",
  "function getAgentProfile(bytes32 agentId) view returns (address operator, string name, string description, uint256 reputationScore, uint256 compositeTrustScore, uint256 credentialCount, bool isActive)",
  "function identityRegistry() view returns (address)",
  "function reputationRegistry() view returns (address)",
  "function validationRegistry() view returns (address)",
  "function addAdmin(address admin)",
  "function updateRegistry(string registryName, address newAddress)"
];

export const ERC8004IdentityABI = [
  "event AgentRegistered(bytes32 indexed agentId, address indexed operator, uint256 timestamp)",
  "event OperatorChanged(bytes32 indexed agentId, address oldOperator, address newOperator)",
  "event CapabilityAdded(bytes32 indexed agentId, bytes32 indexed capabilityHash)",
  "event CapabilityVerified(bytes32 indexed agentId, bytes32 indexed capabilityHash)",
  "event IdentityDeactivated(bytes32 indexed agentId)",
  "function registerAgent(string name, string description, bytes32[] initialCapabilities) returns (bytes32)",
  "function transferOperator(bytes32 agentId, address newOperator)",
  "function verifyCapability(bytes32 agentId, bytes32 capabilityHash)",
  "function updateReputation(bytes32 agentId, int256 delta)",
  "function deactivateAgent(bytes32 agentId)",
  "function getAgentIdentity(bytes32 agentId) view returns (address operator, string name, string description, uint256 createdAt, uint256 reputationScore, bool isActive)",
  "function getAgentIdsByOperator(address operator) view returns (bytes32[] memory)",
  "function hasCapability(bytes32 agentId, bytes32 capabilityHash) view returns (bool)",
  "function identities(bytes32) view returns (bytes32 agentId, address operator, string name, string description, uint256 createdAt, uint256 reputationScore, bool isActive)"
];

export const ReputationRegistryABI = [
  "event ReputationUpdated(bytes32 indexed agentId, uint256 overallScore, uint256 performanceScore, uint256 reliabilityScore, uint256 integrityScore, uint256 timestamp)",
  "event ValidationRecorded(bytes32 indexed validationId, bytes32 indexed agentId, bytes32 indexed validatorId, bool passed, uint256 timestamp)",
  "event PairingUpdated(bytes32 indexed pairingId, bytes32 indexed agent1Id, bytes32 indexed agent2Id, uint256 trustScore, uint256 timestamp)",
  "event ValidatorAdded(bytes32 indexed agentId, uint256 weight)",
  "event ValidatorRemoved(bytes32 indexed agentId)",
  "function updateReputation(bytes32 agentId, int256 performanceDelta, int256 reliabilityDelta, int256 integrityDelta, uint256 interactionCount, uint256 successCount)",
  "function recordValidation(bytes32 agentId, bytes32 capabilityHash, bool passed, string evidence) returns (bytes32)",
  "function recordInteraction(bytes32 agent1Id, bytes32 agent2Id, bool interactionSuccess, bytes32 interactionType)",
  "function getPairingTrust(bytes32 agent1Id, bytes32 agent2Id) view returns (uint256)",
  "function getReputation(bytes32 agentId) view returns (uint256 overallScore, uint256 performanceScore, uint256 reliabilityScore, uint256 integrityScore, uint256 totalInteractions, uint256 successfulInteractions, uint256 lastUpdated)",
  "function addValidator(bytes32 agentId, uint256 weight)",
  "function isValidator(bytes32) view returns (bool)",
  "function validatorWeight(bytes32) view returns (uint256)",
  "function getOperatorAgents(address operator) view returns (bytes32[] memory)"
];

export const ValidationRegistryABI = [
  "event CredentialIssued(bytes32 indexed credentialId, bytes32 indexed agentId, bytes32 indexed capabilityHash, bytes32 indexed validatorId, uint256 expiresAt, uint256 confidenceScore)",
  "event CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed agentId, address revokedBy)",
  "event ValidationRequestCreated(bytes32 indexed requestId, bytes32 indexed agentId, bytes32 capabilityHash, address requester, uint256 timeout)",
  "event ValidationFulfilled(bytes32 indexed requestId, bytes32 credentialId, bytes32 indexed validatorId)",
  "event ScopeDefined(bytes32 indexed scopeId, string name, string description)",
  "function issueCredential(bytes32 agentId, bytes32 capabilityHash, uint256 expiresAt, uint256 confidenceScore, string evidenceURI, bytes memory signature) returns (bytes32)",
  "function createValidationRequest(bytes32 agentId, bytes32 capabilityHash, uint256 timeout, bytes32 dataHash) returns (bytes32)",
  "function fulfillValidationRequest(bytes32 requestId, bool passed, uint256 confidenceScore, string evidenceURI) returns (bytes32)",
  "function revokeCredential(bytes32 credentialId, address revokedBy)",
  "function defineScope(bytes32 scopeId, string name, string description, bytes32[] allowedActions)",
  "function hasValidCredential(bytes32 agentId, bytes32 capabilityHash, uint256 minConfidence) view returns (bool, uint256, uint256)",
  "function getAgentCredentials(bytes32 agentId) view returns (struct ValidationRegistry.Credential[] memory)",
  "function getAgentName(bytes32 agentId) view returns (string memory)"
];
