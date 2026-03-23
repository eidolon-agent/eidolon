// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BuildingNFT} from "../src/BuildingNFT.sol";

contract BuildingNFTTest is Test {
    BuildingNFT public nft;

    function setUp() public {
        nft = new BuildingNFT();
    }

    function testMintBuilding() public {
        address alice = address(0x111);
        nft.mintBuilding(alice, BuildingNFT.BuildingType.HOUSE);
        uint256 tokenId = 0;

        assertEq(nft.ownerOf(tokenId), alice);
        BuildingNFT.Building memory b = nft.getBuilding(tokenId);
        assertEq(b.type, BuildingNFT.BuildingType.HOUSE);
        assertEq(b.level, 1);
    }

    function testUpgradeBuilding() public {
        address alice = address(0x111);
        nft.mintBuilding(alice, BuildingNFT.BuildingType.FACTORY);
        uint256 tokenId = 0;

        vm.prank(alice);
        nft.upgradeBuilding(tokenId);

        BuildingNFT.Building memory b = nft.getBuilding(tokenId);
        assertEq(b.level, 2);
    }
}