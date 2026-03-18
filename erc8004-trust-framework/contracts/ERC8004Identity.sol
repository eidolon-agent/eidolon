// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ERC8004Identity
 * @dev Identity registry for autonomous agents based on ERC-8004 standard
 * Each agent has a unique identity with metadata, capabilities, and operator linkage
 */
contract ERC8004Identity {
    struct AgentIdentity {
        bytes32 agentId;           // Unique agent identifier
        address operator;         // Operator wallet address (EOA or contract)
        string name;              // Human-readable name
        string description;       // Agent description/purpose
        bytes32[] capabilities;   // Array of capability hashes
        uint256 createdAt;        // Registration timestamp
        uint256 reputationScore;  // Initial reputation (0-1000)
        bool isActive;            // Identity status
    }

    struct Capability {
        bytes32 capabilityHash;   // Keccak256 of capability description
        string name;              // Capability name
        string version;           // Version string
        bool verified;            // Has this capability been validated
    }

    // Mappings
    mapping(bytes32 => AgentIdentity) public identities;
    mapping(address => bytes32[]) public operatorAgents;
    mapping(bytes32 => Capability) public capabilities;
    mapping(bytes32 => mapping(bytes32 => bool)) public agentCapabilities;

    // Events
    event AgentRegistered(bytes32 indexed agentId, address indexed operator, uint256 timestamp);
    event OperatorChanged(bytes32 indexed agentId, address oldOperator, address newOperator);
    event CapabilityAdded(bytes32 indexed agentId, bytes32 indexed capabilityHash);
    event CapabilityVerified(bytes32 indexed agentId, bytes32 indexed capabilityHash);
    event IdentityDeactivated(bytes32 indexed agentId);

    // Identity counter for generating unique IDs
    bytes32 private nextAgentId = 0x0000000000000000000000000000000000000000000000000000000000000001;

    /**
     * @dev Register a new agent identity
     * @param name Agent name
     * @param description Agent description
     * @param initialCapabilities Initial capabilities array
     */
    function registerAgent(
        string memory name,
        string memory description,
        bytes32[] memory initialCapabilities
    ) external returns (bytes32) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(description).length > 0, "Description required");

        bytes32 agentId = generateAgentId(msg.sender, name);
        
        require(identities[agentId].createdAt == 0, "Agent already exists");

        AgentIdentity storage identity = identities[agentId];
        identity.agentId = agentId;
        identity.operator = msg.sender;
        identity.name = name;
        identity.description = description;
        identity.createdAt = block.timestamp;
        identity.reputationScore = 100; // Default starting reputation
        identity.isActive = true;

        operatorAgents[msg.sender].push(agentId);

        // Add initial capabilities
        for (uint256 i = 0; i < initialCapabilities.length; i++) {
            _addCapability(agentId, initialCapabilities[i]);
        }

        emit AgentRegistered(agentId, msg.sender, block.timestamp);
        return agentId;
    }

    /**
     * @dev Change the operator of an agent
     * @param agentId Agent identifier
     * @param newOperator New operator address
     */
    function transferOperator(bytes32 agentId, address newOperator) external {
        require(identities[agentId].operator == msg.sender, "Not authorized");
        require(newOperator != address(0), "Invalid address");

        address oldOperator = identities[agentId].operator;
        identities[agentId].operator = newOperator;

        // Update operator agent lists
        _removeAgentFromOperator(oldOperator, agentId);
        operatorAgents[newOperator].push(agentId);

        emit OperatorChanged(agentId, oldOperator, newOperator);
    }

    /**
     * @dev Add a capability to an agent
     * @param agentId Agent identifier
     * @param capabilityHash Keccak256 hash of capability description
     */
    function _addCapability(bytes32 agentId, bytes32 capabilityHash) internal {
        require(!agentCapabilities[agentId][capabilityHash], "Capability already added");
        
        agentCapabilities[agentId][capabilityHash] = true;
        
        // Store capability metadata if not already stored
        if (capabilities[capabilityHash].capabilityHash == 0) {
            capabilities[capabilityHash] = Capability({
                capabilityHash: capabilityHash,
                name: "", // Would be set separately
                version: "",
                verified: false
            });
        }

        emit CapabilityAdded(agentId, capabilityHash);
    }

    /**
     * @dev Remove agent from operator's list (internal helper)
     */
    function _removeAgentFromOperator(address operator, bytes32 agentId) internal {
        bytes32[] storage agents = operatorAgents[operator];
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i] == agentId) {
                agents[i] = agents[agents.length - 1];
                agents.pop();
                break;
            }
        }
    }

    /**
     * @dev Verify a capability (can only be called by validators, to be expanded)
     * @param agentId Agent identifier
     * @param capabilityHash Capability to verify
     */
    function verifyCapability(bytes32 agentId, bytes32 capabilityHash) external {
        // Validation logic would go here (e.g., only trusted validators can call)
        // For now, we allow self-verification or operator verification
        require(identities[agentId].operator == msg.sender || agentId == generateAgentId(msg.sender, identities[agentId].name), "Not authorized");
        
        capabilities[capabilityHash].verified = true;
        emit CapabilityVerified(agentId, capabilityHash);
    }

    /**
     * @dev Update reputation score
     * @param agentId Agent identifier
     * @param delta Change in reputation (can be positive or negative, bounded)
     */
    function updateReputation(bytes32 agentId, int256 delta) external {
        AgentIdentity storage identity = identities[agentId];
        require(identity.isActive, "Agent inactive");
        
        // In a full implementation, only authorized agents (validators, orchestrators) could call this
        // For demo, allow operator or self-modification with constraints
        uint256 newScore = uint256(int256(identity.reputationScore) + delta);
        require(newScore <= 1000, "Score too high");
        
        identity.reputationScore = newScore;
    }

    /**
     * @dev Deactivate an agent identity
     * @param agentId Agent identifier
     */
    function deactivateAgent(bytes32 agentId) external {
        require(identities[agentId].operator == msg.sender, "Not authorized");
        identities[agentId].isActive = false;
        emit IdentityDeactivated(agentId);
    }

    /**
     * @dev Generate unique agent ID from operator and name
     */
    function generateAgentId(address operator, string memory name) public pure returns (bytes32) {
        bytes memory combined = abi.encodePacked(operator, name);
        return keccak256(combined);
    }

    /**
     * @dev Get all agents for an operator
     */
    function getAgentIdsByOperator(address operator) external view returns (bytes32[] memory) {
        return operatorAgents[operator];
    }

    /**
     * @dev Get agent identity details
     */
    function getAgentIdentity(bytes32 agentId) external view returns (
        address operator,
        string memory name,
        string memory description,
        uint256 createdAt,
        uint256 reputationScore,
        bool isActive
    ) {
        AgentIdentity memory identity = identities[agentId];
        return (
            identity.operator,
            identity.name,
            identity.description,
            identity.createdAt,
            identity.reputationScore,
            identity.isActive
        );
    }

    /**
     * @dev Check if agent has a capability
     */
    function hasCapability(bytes32 agentId, bytes32 capabilityHash) external view returns (bool) {
        return agentCapabilities[agentId][capabilityHash];
    }
}
