// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import required registries
import "./ERC8004Identity.sol";
import "./ReputationRegistry.sol";
import "./ValidationRegistry.sol";

/**
 * @title TrustFramework
 * @dev Main entry point for ERC-8004 decentralized trust framework
 * Integrates Identity, Reputation, and Validation registries
 */
contract TrustFramework {
    // Registry addresses
    ERC8004Identity public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;

    // Governance / admin
    address public owner;
    mapping(address => bool) public administrators;

    // Events for cross-registry coordination
    event AgentFullyRegistered(bytes32 indexed agentId, address indexed operator);
    event TrustScoreCalculated(bytes32 indexed agentId, uint256 compositeScore);
    event CapabilityVerified(bytes32 indexed agentId, bytes32 indexed capabilityHash, bool isValid);

    // Composite trust score weights
    uint256 public constant REPUTATION_WEIGHT = 50;      // 50% weight
    uint256 public constant VALIDATION_WEIGHT = 30;     // 30% weight
    uint256 public constant INTERACTION_WEIGHT = 20;    // 20% weight

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAdmin() {
        require(administrators[msg.sender] || msg.sender == owner, "Not admin");
        _;
    }

    /**
     * @dev Initialize the framework with registry addresses
     */
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_reputationRegistry != address(0), "Invalid reputation registry");
        require(_validationRegistry != address(0), "Invalid validation registry");

        identityRegistry = ERC8004Identity(_identityRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        validationRegistry = ValidationRegistry(_validationRegistry);

        owner = msg.sender;
        administrators[msg.sender] = true;
    }

    /**
     * @dev Register a new agent with full initialization
     * This creates identity automatically and sets up initial reputation
     */
    function registerAgent(
        string memory name,
        string memory description,
        bytes32[] memory capabilities
    ) external returns (bytes32) {
        bytes32 agentId = identityRegistry.registerAgent(name, description, capabilities);
        
        // Initialize minimal reputation for new agent
        reputationRegistry.updateReputation(
            agentId,
            0, 0, 0,
            0, 0
        );

        emit AgentFullyRegistered(agentId, msg.sender);
        return agentId;
    }

    /**
     * @dev Calculate composite trust score for an agent
     * Combines: reputation (50%), validation count/confidence (30%), interaction success (20%)
     */
    function calculateTrustScore(bytes32 agentId) external view returns (uint256 compositeScore) {
        // Get reputation registry data (50% weight)
        (
            uint256 repScore,
            ,
            ,
            ,
            uint256 totalInteractions,
            uint256 successfulInteractions,
            uint256 lastUpdated
        ) = reputationRegistry.getReputation(agentId);

        // Get validation data (30% weight)
        ValidationRegistry.Credential[] memory creds = validationRegistry.getAgentCredentials(agentId);
        uint256 validationScore = 0;
        uint256 validValidations = 0;
        
        for (uint256 i = 0; i < creds.length; i++) {
            if (!creds[i].isRevoked && !_isExpired(creds[i])) {
                validationScore += creds[i].confidenceScore;
                validValidations++;
            }
        }
        
        if (validValidations > 0) {
            validationScore = validationScore / validValidations;
        }

        // Get interaction history (20% weight)
        uint256 interactionScore = 0;
        if (totalInteractions > 0) {
            interactionScore = (successfulInteractions * 1000) / totalInteractions;
        }

        // Calculate weighted composite
        compositeScore = (
            (repScore * REPUTATION_WEIGHT) +
            (validationScore * VALIDATION_WEIGHT) +
            (interactionScore * INTERACTION_WEIGHT)
        ) / (REPUTATION_WEIGHT + VALIDATION_WEIGHT + INTERACTION_WEIGHT);

        emit TrustScoreCalculated(agentId, compositeScore);
    }

    /**
     * @dev Check if a credential is expired
     */
    function _isExpired(ValidationRegistry.Credential memory cred) internal pure returns (bool) {
        return cred.expiresAt > 0 && block.timestamp >= cred.expiresAt;
    }

    /**
     * @dev Verify agent capability (high-level check)
     * Returns true if agent has valid credential for the capability
     */
    function verifyCapability(
        bytes32 agentId,
        bytes32 capabilityHash,
        uint256 minConfidence
    ) external view returns (bool, uint256) {
        (bool hasCred, uint256 confidence, uint256 issuedAt) = 
            validationRegistry.hasValidCredential(agentId, capabilityHash, minConfidence);
        
        // Also check if agent is active in identity registry
        (address operator, , , , , bool isActive) = identityRegistry.getAgentIdentity(agentId);
        
        bool isOperational = isActive && operator != address(0);
        
        emit CapabilityVerified(agentId, capabilityHash, hasCred && isOperational);
        return (hasCred && isOperational, confidence);
    }

    /**
     * @dev Add administrator
     */
    function addAdmin(address admin) external onlyOwner {
        administrators[admin] = true;
    }

    /**
     * @dev Remove administrator
     */
    function removeAdmin(address admin) external onlyOwner {
        administrators[admin] = false;
    }

    /**
     * @dev Update registry addresses (for upgrades)
     */
    function updateRegistry(
        string memory registryName,
        address newAddress
    ) external onlyAdmin {
        if (keccak256(abi.encodePacked(registryName)) == keccak256(abi.encodePacked("identity"))) {
            identityRegistry = ERC8004Identity(newAddress);
        } else if (keccak256(abi.encodePacked(registryName)) == keccak256(abi.encodePacked("reputation"))) {
            reputationRegistry = ReputationRegistry(newAddress);
        } else if (keccak256(abi.encodePacked(registryName)) == keccak256(abi.encodePacked("validation"))) {
            validationRegistry = ValidationRegistry(newAddress);
        }
    }

    /**
     * @dev Batch verify multiple capabilities for an agent
     * Useful for orchestrators checking agent readiness
     */
    function verifyAgentReadiness(
        bytes32 agentId,
        bytes32[] memory requiredCapabilities,
        uint256 minConfidence
    ) external view returns (bool ready, uint256[] memory confidenceScores) {
        ready = true;
        confidenceScores = new uint256[](requiredCapabilities.length);
        
        for (uint256 i = 0; i < requiredCapabilities.length; i++) {
            (bool hasCap, uint256 confidence) = verifyCapability(agentId, requiredCapabilities[i], minConfidence);
            confidenceScores[i] = confidence;
            if (!hasCap) {
                ready = false;
            }
        }
    }

    /**
     * @dev Get agent's composite profile
     */
    function getAgentProfile(bytes32 agentId) external view returns (
        address operator,
        string memory name,
        string memory description,
        uint256 reputationScore,
        uint256 compositeTrustScore,
        uint256 credentialCount,
        bool isActive
    ) {
        (operator, name, description, , , isActive) = identityRegistry.getAgentIdentity(agentId);
        (reputationScore, , , , , , ) = reputationRegistry.getReputation(agentId);
        compositeTrustScore = calculateTrustScore(agentId);
        credentialCount = validationRegistry.getAgentCredentials(agentId).length;
    }
}
