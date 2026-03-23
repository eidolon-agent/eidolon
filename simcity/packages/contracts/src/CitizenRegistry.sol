// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title CitizenRegistry
 * @dev Simplified ERC-8004-like registry for citizen agents in SimCity.
 * Citizens have skills, reputation, and can be assigned to buildings.
 * Uses a simple counter instead of full ERC-721 for MVP.
 */
contract CitizenRegistry is Ownable2Step {
    struct Citizen {
        uint256 agentId; // ERC-8004 identity (if registered onchain)
        string name;
        string skill; // "farmer", "engineer", "merchant"
        uint256 reputation; // 0-1000
        uint256 assignedBuilding; // tokenId of BuildingNFT
        uint256 createdAt;
        address owner;
    }

    uint256 public nextCitizenId;
    mapping(uint256 => Citizen) public citizens;
    mapping(address => uint256[]) public ownerCitizens;

    event CitizenCreated(uint256 indexed citizenId, address indexed owner, string skill);
    event CitizenAssigned(uint256 indexed citizenId, uint256 buildingTokenId);
    event ReputationUpdated(uint256 indexed citizenId, uint256 newReputation);

    // ERC-8004 registry address (Base mainnet testnet)
    address public identityRegistry = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    /**
     * @dev Register a new citizen agent
     */
    function createCitizen(string memory name, string memory skill) external returns (uint256) {
        require(bytes(skill).length > 0, "Skill required");
        uint256 citizenId = nextCitizenId++;
        Citizen storage c = citizens[citizenId];
        c.name = name;
        c.skill = skill;
        c.reputation = 100; // starting reputation
        c.createdAt = block.timestamp;
        c.owner = msg.sender;
        c.agentId = 0; // Not ERC-8004 registered yet

        ownerCitizens[msg.sender].push(citizenId);

        emit CitizenCreated(citizenId, msg.sender, skill);
        return citizenId;
    }

    /**
     * @dev Assign citizen to a building (increases production)
     */
    function assignToBuilding(uint256 citizenId, uint256 buildingTokenId) external {
        Citizen storage c = citizens[citizenId];
        require(c.owner == msg.sender, "Not citizen owner");
        c.assignedBuilding = buildingTokenId;
        emit CitizenAssigned(citizenId, buildingTokenId);
    }

    /**
     * @dev Update reputation (called by game engine after task)
     */
    function updateReputation(uint256 citizenId, int256 delta) external onlyOwner {
        Citizen storage c = citizens[citizenId];
        int256 newRep = int256(c.reputation) + delta;
        if (newRep > 1000) newRep = 1000;
        if (newRep < 0) newRep = 0;
        c.reputation = uint256(newRep);
        emit ReputationUpdated(citizenId, c.reputation);
    }

    /**
     * @dev Get citizen details
     */
    function getCitizen(uint256 citizenId) external view returns (Citizen memory) {
        return citizens[citizenId];
    }

    /**
     * @dev Get citizens owned by address
     */
    function getOwnedCitizens(address owner) external view returns (uint256[] memory) {
        return ownerCitizens[owner];
    }

    /**
     * @dev Set ERC-8004 registry address (for future cross-chain identity)
     */
    function setIdentityRegistry(address registry) external onlyOwner {
        identityRegistry = registry;
    }

    /**
     * @dev Register citizen on ERC-8004 (advanced, requires metadata IPFS)
     */
    function registerOnChainIdentity(uint256 citizenId, string memory metadataURI) external returns (uint256 agentId) {
        Citizen storage c = citizens[citizenId];
        require(c.owner == msg.sender, "Not owner");
        require(identityRegistry != address(0), "Registry not set");

        // In production: call IIdentityRegistry(identityRegistry).register(metadataURI, "");
        // For MVP, we simulate with a fake ID
        agentId = citizenId + 1000000; // offset to avoid collisions
        c.agentId = agentId;

        return agentId;
    }
}