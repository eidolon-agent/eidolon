// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReputationRegistry
 * @dev Manages reputation scores, validation records, and trust metrics for agents
 * Implements multi-factor reputation with decay over time and interaction-based updates
 */

import "./interfaces.sol";

contract ReputationRegistry {
    struct ReputationRecord {
        uint256 overallScore;        // 0-1000 overall reputation
        uint256 performanceScore;    // Task completion rate
        uint256 reliabilityScore;    // Uptime/availability
        uint256 integrityScore;      // Honesty/verification passes
        uint256 lastUpdated;         // Timestamp of last update
        uint256 totalInteractions;   // Total number of interactions
        uint256 successfulInteractions; // Successful interactions
        int256[] scoreHistory;       // Rolling history for decay calculation
    }

    struct Validation {
        bytes32 validationId;
        bytes32 agentId;
        bytes32 validatorId;
        bytes32 capabilityHash;
        uint256 timestamp;
        bool passed;
        string evidence;
        uint256 weight;
    }

    struct AgentPairing {
        bytes32 pairingId;
        bytes32 agent1Id;
        bytes32 agent2Id;
        uint256 interactions;
        uint256 successfulInteractions;
        uint256 trustScore;
        uint256 lastInteraction;
    }

    mapping(bytes32 => ReputationRecord) public reputations;
    mapping(bytes32 => Validation[]) public agentValidations;
    mapping(bytes32 => mapping(bytes32 => AgentPairing)) public agentPairings;
    mapping(bytes32 => mapping(bytes32 => uint256)) public pairingIdToIndex;

    mapping(bytes32 => bool) public isValidator;
    mapping(bytes32 => uint256) public validatorWeight;

    IERC8004Identity public identityRegistry;

    event ReputationUpdated(
        bytes32 indexed agentId,
        uint256 overallScore,
        uint256 performanceScore,
        uint256 reliabilityScore,
        uint256 integrityScore,
        uint256 timestamp
    );
    event ValidationRecorded(
        bytes32 indexed validationId,
        bytes32 indexed agentId,
        bytes32 indexed validatorId,
        bool passed,
        uint256 timestamp
    );
    event PairingUpdated(
        bytes32 indexed pairingId,
        bytes32 indexed agent1Id,
        bytes32 indexed agent2Id,
        uint256 trustScore,
        uint256 timestamp
    );
    event ValidatorAdded(bytes32 indexed agentId, uint256 weight);
    event ValidatorRemoved(bytes32 indexed agentId);

    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant DECAY_RATE = 30 days;
    uint256 public constant MIN_WEIGHT = 1;

    constructor(address _identityRegistry) {
        identityRegistry = IERC8004Identity(_identityRegistry);
    }

    // ============ Internal Helpers ============

    function _isOperator(bytes32 agentId, address addr) internal view returns (bool) {
        (address operator, , , , , , ) = identityRegistry.identities(agentId);
        return operator == addr;
    }

    function _getAgentIdFromAddress(address addr) internal view returns (bytes32) {
        bytes32[] memory agents = identityRegistry.getAgentIdsByOperator(addr);
        require(agents.length > 0, "No agents for address");
        return agents[0];
    }

    function _getPairingKey(bytes32 agent1, bytes32 agent2) internal pure returns (bytes32) {
        if (agent1 < agent2) {
            return keccak256(abi.encodePacked(agent1, agent2));
        } else {
            return keccak256(abi.encodePacked(agent2, agent1));
        }
    }

    function _applyDelta(uint256 current, int256 delta) internal pure returns (uint256) {
        int256 newScore = int256(current) + delta;
        if (newScore < 0) return 0;
        if (newScore > int256(MAX_SCORE)) return MAX_SCORE;
        return uint256(newScore);
    }

    function _applyDecay(uint256 current, uint256 timeElapsed) internal pure returns (uint256) {
        if (timeElapsed < DECAY_RATE) return current;
        uint256 periods = timeElapsed / DECAY_RATE;
        uint256 decay = (current * periods * 5) / 100;
        if (decay >= current) return 0;
        return current - decay;
    }

    // ============ Public Functions ============

    function updateReputation(
        bytes32 agentId,
        int256 performanceDelta,
        int256 reliabilityDelta,
        int256 integrityDelta,
        uint256 interactionCount,
        uint256 successCount
    ) public {
        require(isValidator[msg.sender] || _isOperator(agentId, msg.sender), "Not authorized");
        
        ReputationRecord storage record = reputations[agentId];
        uint256 currentTime = block.timestamp;

        if (record.lastUpdated == 0) {
            record.performanceScore = 100;
            record.reliabilityScore = 100;
            record.integrityScore = 100;
            record.overallScore = 100;
        }

        record.performanceScore = _applyDelta(record.performanceScore, performanceDelta);
        record.reliabilityScore = _applyDelta(record.reliabilityScore, reliabilityDelta);
        record.integrityScore = _applyDelta(record.integrityScore, integrityDelta);

        record.totalInteractions += interactionCount;
        record.successfulInteractions += successCount;

        record.overallScore = (
            record.performanceScore * 4 +
            record.reliabilityScore * 3 +
            record.integrityScore * 3
        ) / 10;

        if (currentTime - record.lastUpdated > DECAY_RATE) {
            record.overallScore = _applyDecay(record.overallScore, currentTime - record.lastUpdated);
        }

        record.lastUpdated = currentTime;
        
        if (record.scoreHistory.length >= 100) {
            for (uint256 i = 0; i < record.scoreHistory.length - 1; i++) {
                record.scoreHistory[i] = record.scoreHistory[i + 1];
            }
            record.scoreHistory.pop();
        }
        record.scoreHistory.push(int256(record.overallScore));

        emit ReputationUpdated(
            agentId,
            record.overallScore,
            record.performanceScore,
            record.reliabilityScore,
            record.integrityScore,
            currentTime
        );
    }

    function recordValidation(
        bytes32 agentId,
        bytes32 capabilityHash,
        bool passed,
        string memory evidence
    ) external returns (bytes32) {
        require(isValidator[msg.sender], "Not a validator");
        ( , , , , , , bool isActive) = identityRegistry.identities(agentId);
        require(isActive, "Agent not active");

        bytes32 validationId = keccak256(abi.encodePacked(
            agentId,
            msg.sender,
            capabilityHash,
            block.timestamp
        ));

        Validation storage validation = Validation({
            validationId: validationId,
            agentId: agentId,
            validatorId: _getAgentIdFromAddress(msg.sender),
            capabilityHash: capabilityHash,
            timestamp: block.timestamp,
            passed: passed,
            evidence: evidence,
            weight: validatorWeight[msg.sender]
        });

        if (agentValidations[agentId].length == 0) {
            agentValidations[agentId] = new Validation[](0);
        }
        agentValidations[agentId].push(validation);

        if (passed) {
            updateReputation(
                agentId,
                0, 0,
                int256(validatorWeight[msg.sender]) / 10,
                0, 0
            );
        } else {
            updateReputation(
                agentId,
                0, 0,
                -int256(validatorWeight[msg.sender]) / 10,
                0, 0
            );
        }

        emit ValidationRecorded(
            validationId,
            agentId,
            _getAgentIdFromAddress(msg.sender),
            passed,
            block.timestamp
        );

        return validationId;
    }

    function recordInteraction(
        bytes32 agent1Id,
        bytes32 agent2Id,
        bool interactionSuccess,
        bytes32 interactionType
    ) external {
        require(
            _isOperator(agent1Id, msg.sender) || _isOperator(agent2Id, msg.sender),
            "Not authorized"
        );

        bytes32 pairingKey = _getPairingKey(agent1Id, agent2Id);
        AgentPairing storage pairing = agentPairings[agent1Id][agent2Id];

        if (pairing.pairingId == 0) {
            pairing.pairingId = pairingKey;
            pairing.agent1Id = agent1Id;
            pairing.agent2Id = agent2Id;
            pairing.interactions = 0;
            pairing.successfulInteractions = 0;
            pairing.trustScore = 500;
        }

        pairing.interactions++;
        if (interactionSuccess) {
            pairing.successfulInteractions++;
        }
        pairing.lastInteraction = block.timestamp;

        uint256 successRate = (pairing.successfulInteractions * 1000) / pairing.interactions;
        pairing.trustScore = successRate < 700 ? successRate * 2 : successRate;

        int256 delta = interactionSuccess ? 5 : -10;
        if (_isOperator(agent1Id, msg.sender)) {
            updateReputation(agent1Id, delta, 0, 0, 1, interactionSuccess ? 1 : 0);
        }
        if (_isOperator(agent2Id, msg.sender)) {
            updateReputation(agent2Id, delta, 0, 0, 1, interactionSuccess ? 1 : 0);
        }

        emit PairingUpdated(
            pairing.pairingId,
            agent1Id,
            agent2Id,
            pairing.trustScore,
            block.timestamp
        );
    }

    // ============ Getters ============

    function getPairingTrust(bytes32 agent1Id, bytes32 agent2Id) external view returns (uint256) {
        return agentPairings[agent1Id][agent2Id].trustScore;
    }

    function getReputation(bytes32 agentId) external view returns (
        uint256 overallScore,
        uint256 performanceScore,
        uint256 reliabilityScore,
        uint256 integrityScore,
        uint256 totalInteractions,
        uint256 successfulInteractions,
        uint256 lastUpdated
    ) {
        ReputationRecord memory record = reputations[agentId];
        return (
            record.overallScore,
            record.performanceScore,
            record.reliabilityScore,
            record.integrityScore,
            record.totalInteractions,
            record.successfulInteractions,
            record.lastUpdated
        );
    }

    function getOperatorAgents(address operator) external view returns (bytes32[] memory) {
        return identityRegistry.getAgentIdsByOperator(operator);
    }

    // ============ Admin ============

    function addValidator(bytes32 agentId, uint256 weight) external {
        require(!isValidator[agentId], "Already validator");
        require(weight >= MIN_WEIGHT && weight <= MAX_SCORE, "Invalid weight");
        isValidator[agentId] = true;
        validatorWeight[agentId] = weight;
        emit ValidatorAdded(agentId, weight);
    }

    function removeValidator(bytes32 agentId) external {
        require(isValidator[agentId], "Not a validator");
        isValidator[agentId] = false;
        delete validatorWeight[agentId];
        emit ValidatorRemoved(agentId);
    }
}
