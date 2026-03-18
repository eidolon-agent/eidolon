// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Shared interfaces for ERC-8004 Trust Framework
 * Avoids duplicate interface definitions across contracts
 */

interface IERC8004Identity {
    function getAgentIdsByOperator(address operator) external view returns (bytes32[] memory);
    function identities(bytes32) external view returns (bytes32 agentId, address operator, string name, string description, uint256 createdAt, uint256 reputationScore, bool isActive);
    function registerAgent(string memory name, string memory description, bytes32[] memory initialCapabilities) external returns (bytes32);
    function transferOperator(bytes32 agentId, address newOperator) external;
    function deactivateAgent(bytes32 agentId) external;
    function generateAgentId(address operator, string memory name) external pure returns (bytes32);
}

interface IReputationRegistry {
    function updateReputation(bytes32 agentId, int256 performanceDelta, int256 reliabilityDelta, int256 integrityDelta, uint256 interactionCount, uint256 successCount) external;
    function recordValidation(bytes32 agentId, bytes32 capabilityHash, bool passed, string memory evidence) external returns (bytes32);
    function recordInteraction(bytes32 agent1Id, bytes32 agent2Id, bool interactionSuccess, bytes32 interactionType) external;
    function getPairingTrust(bytes32 agent1Id, bytes32 agent2Id) external view returns (uint256);
    function getReputation(bytes32 agentId) external view returns (uint256 overallScore, uint256 performanceScore, uint256 reliabilityScore, uint256 integrityScore, uint256 totalInteractions, uint256 successfulInteractions, uint256 lastUpdated);
    function addValidator(bytes32 agentId, uint256 weight) external;
    function removeValidator(bytes32 agentId) external;
    function getOperatorAgents(address operator) external view returns (bytes32[] memory);
    function isValidator(bytes32) external view returns (bool);
    function validatorWeight(bytes32) external view returns (uint256);
}

interface IValidationRegistry {
    // IssueCredential and others that return bytes32
    function issueCredential(bytes32 agentId, bytes32 capabilityHash, uint256 expiresAt, uint256 confidenceScore, string memory evidenceURI, bytes memory signature) external returns (bytes32);
    function createValidationRequest(bytes32 agentId, bytes32 capabilityHash, uint256 timeout, bytes32 dataHash) external returns (bytes32);
    function fulfillValidationRequest(bytes32 requestId, bool passed, uint256 confidenceScore, string memory evidenceURI) external returns (bytes32);
    function revokeCredential(bytes32 credentialId, address revokedBy) external;
    function defineScope(bytes32 scopeId, string memory name, string memory description, bytes32[] memory allowedActions) external;
    function hasValidCredential(bytes32 agentId, bytes32 capabilityHash, uint256 minConfidence) external view returns (bool, uint256, uint256);
    // Note: getAgentCredentials returns a struct array; this is defined in the contract, not in interface
}
