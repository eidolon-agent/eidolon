// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VRFConsumerBase} from "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

/**
 * @title RandomEvents
 * @dev Chainlink VRF for verifiable randomness. Emits events that game engine consumes.
 * Deploy on Base (mainnet or sepolia). Subscription must be funded with LINK/USDC.
 */
contract RandomEvents is VRFConsumerBase, Ownable {
    bytes32 public keyHash;
    uint64 public subscriptionId;
    uint16 public confirmationBlocks = 3;

    // Event types
    enum EventType { STORM, RESOURCE_BOOM, MARKET_CRASH, CELEBRATION }

    struct PendingEvent {
        EventType eventType;
        uint256 intensity; // 1-100
        address triggeredBy; // player or system
        bool executed;
    }

    mapping(uint256 => PendingEvent) public pendingEvents;
    uint256 public nextEventId;

    event RandomnessRequested(uint256 indexed eventId, EventType eventType, address triggeredBy);
    event RandomnessReceived(uint256 indexed eventId, uint256 randomness);

    constructor(
        address vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) VRFConsumerBase(vrfCoordinator) Ownable(msg.sender) {
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }

    /**
     * @dev Request randomness for an event
     */
    function requestRandomEvent(EventType eventType, address triggeredBy) external returns (uint256) {
        require(subscriptionId != 0, "VRF subscription not configured");
        // Additional check: ensure coordinator is set (via VRFConsumerBase)
        // (VRFConsumerBase stores vrfCoordinator; we trust it's set)

        uint256 eventId = nextEventId++;
        pendingEvents[eventId] = PendingEvent({
            eventType: eventType,
            intensity: 0,
            triggeredBy: triggeredBy,
            executed: false
        });

        emit RandomnessRequested(eventId, eventType, triggeredBy);

        // Request VRF
        requestRandomness(keyHash, subscriptionId, eventId);
        return eventId;
    }

    /**
     * @dev fulfillRandomness (called by VRF coordinator)
     */
    function fulfillRandomness(bytes32, uint256 randomness, uint256 eventId) internal override {
        PendingEvent storage e = pendingEvents[eventId];
        if (e.eventType == EventType(0) || e.executed) return; // invalid or already executed

        // Map randomness to intensity 1-100
        uint256 intensity = (randomness % 100) + 1;
        e.intensity = intensity;
        e.executed = true;

        emit RandomnessReceived(eventId, randomness);

        // Additional logic: apply effects to game state (could call into CityTreasury, etc.)
        // For MVP, we just emit event; offchain engine will handle consequences
    }

    /**
     * @dev Get pending event details
     */
    function getEvent(uint256 eventId) external view returns (EventType, uint256, address, bool) {
        PendingEvent memory e = pendingEvents[eventId];
        return (e.eventType, e.intensity, e.triggeredBy, e.executed);
    }

    // Admin: set VRF parameters if needed
    function setConfig(bytes32 _keyHash, uint64 _subscriptionId) external onlyOwner {
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
    }
}