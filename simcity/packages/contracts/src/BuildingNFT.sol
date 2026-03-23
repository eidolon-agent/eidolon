// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Metadata.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BuildingNFT
 * @dev Represents a building in the city. Each NFT has a building type and level.
 * Produces resources over time (offchain tracked). Owner can upgrade.
 */
contract BuildingNFT is ERC721, ERC721Metadata, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    struct Building {
        uint256 tokenId;
        BuildingType type;
        uint256 level;
        uint256 createdAt;
        address owner;
    }

    enum BuildingType {
        HOUSE,
        FACTORY,
        FARM,
        SOLAR_FARM,
        DATA_CENTER
    }

    // Mapping from tokenId => Building
    mapping(uint256 => Building) public buildings;

    // Events
    event BuildingMinted(uint256 indexed tokenId, address indexed owner, BuildingType type);
    event BuildingUpgraded(uint256 indexed tokenId, uint256 newLevel);

    constructor() ERC721("SimCity Building", "SCB") Ownable(msg.sender) {}

    /**
     * @dev Mint a new building NFT
     */
    function mintBuilding(address to, BuildingType type) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);

        buildings[tokenId] = Building({
            tokenId: tokenId,
            type: type,
            level: 1,
            createdAt: block.timestamp,
            owner: to
        });

        // Set metadata (could point to IPFS)
        string memory name = buildingName(type);
        string memory description = buildingDescription(type);
        _setTokenURI(tokenId, ""); // Optional: IPFS URI

        emit BuildingMinted(tokenId, to, type);
    }

    /**
     * @dev Upgrade a building to next level (costs CITY tokens offchain)
     */
    function upgradeBuilding(uint256 tokenId) external onlyOwner {
        Building storage b = buildings[tokenId];
        require(b.owner == msg.sender, "Not building owner");
        b.level += 1;
        emit BuildingUpgraded(tokenId, b.level);
    }

    /**
     * @dev Get building info
     */
    function getBuilding(uint256 tokenId) external view returns (Building memory) {
        return buildings[tokenId];
    }

    /**
     * @dev Get all building types (for UI)
     */
    function buildingName(BuildingType type) internal pure returns (string memory) {
        if (type == BuildingType.HOUSE) return "House";
        if (type == BuildingType.FACTORY) return "Factory";
        if (type == BuildingType.FARM) return "Farm";
        if (type == BuildingType.SOLAR_FARM) return "Solar Farm";
        if (type == BuildingType.DATA_CENTER) return "Data Center";
        return "Unknown";
    }

    function buildingDescription(BuildingType type) internal pure returns (string memory) {
        if (type == BuildingType.HOUSE) return "Increases population capacity.";
        if (type == BuildingType.FACTORY) return "Generates industrial goods.";
        if (type == BuildingType.FARM) return "Produces food.";
        if (type == BuildingType.SOLAR_FARM) return "Generates energy.";
        if (type == BuildingType.DATA_CENTER) return "Produces data/tech.";
        return "A building in your city.";
    }

    // Override required due to compiler 0.8.20
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721Metadata) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}