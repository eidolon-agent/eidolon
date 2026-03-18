// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC8004ReputationRegistry {
    event ScoreUpdated(uint256 indexed agentId, uint256 newScore, int256 delta);

    struct Reputation {
        uint256 score; // 0-1000
        uint256 interactions;
        uint256 lastUpdated;
    }

    mapping(uint256 => Reputation) public reputations;
    address public identityRegistry;

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    modifier onlyOperator(uint256 agentId) {
        require(IdentityRegistry(identityRegistry).operatorOf(agentId) == msg.sender, "Not authorized");
        _;
    }

    function setScore(uint256 agentId, uint256 newScore) external onlyOperator(agentId) {
        if (newScore > 1000) newScore = 1000;
        reputations[agentId].score = newScore;
        reputations[agentId].lastUpdated = block.timestamp;
        emit ScoreUpdated(agentId, newScore, 0);
    }

    function getAgentReputation(uint256 agentId) external view returns (
        uint256 score,
        uint256 interactions,
        uint256 lastUpdated
    ) {
        Reputation storage r = reputations[agentId];
        return (r.score, r.interactions, r.lastUpdated);
    }
}
