// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC8004IdentityRegistry {
    event AgentRegistered(uint256 indexed agentId, address indexed operator, string name, string description);

    struct Agent {
        address operator;
        string name;
        string description;
        bool active;
        uint256 createdAt;
        bytes32[] capabilities;
    }

    mapping(uint256 => Agent) public agents;
    uint256 public nextAgentId = 1;
    mapping(uint256 => address) public operatorOf; // convenience

    function registerAgent(
        string memory name,
        string memory description,
        bytes32[] memory capabilities
    ) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            operator: msg.sender,
            name: name,
            description: description,
            active: true,
            createdAt: block.timestamp,
            capabilities: capabilities
        });
        operatorOf[agentId] = msg.sender;
        emit AgentRegistered(agentId, msg.sender, name, description);
    }

    function getAgent(uint256 agentId) external view returns (
        address operator,
        string memory name,
        string memory description,
        bool active,
        uint256 createdAt
    ) {
        Agent storage a = agents[agentId];
        require(a.active, "Agent not found");
        return (a.operator, a.name, a.description, a.active, a.createdAt);
    }

    function getAgentCapabilities(uint256 agentId) external view returns (bytes32[] memory) {
        return agents[agentId].capabilities;
    }

    function setOperator(uint256 agentId, address newOperator) external {
        require(agents[agentId].operator == msg.sender, "Not authorized");
        agents[agentId].operator = newOperator;
        operatorOf[agentId] = newOperator;
    }
}
