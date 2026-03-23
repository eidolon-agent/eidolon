// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CitizenRegistry} from "../src/CitizenRegistry.sol";

contract CitizenRegistryTest is Test {
    CitizenRegistry public registry;

    function setUp() public {
        registry = new CitizenRegistry();
    }

    function testCreateCitizen() public {
        uint256 id = registry.createCitizen("Alice", "engineer");
        CitizenRegistry.Citizen memory c = registry.getCitizen(id);
        assertEq(c.name, "Alice");
        assertEq(c.skill, "engineer");
        assertEq(c.reputation, 100);
        assertEq(c.owner, msg.sender);
    }

    function testAssignCitizen() public {
        uint256 citizenId = registry.createCitizen("Bob", "farmer");
        uint256 buildingTokenId = 0; // pretend building

        vm.prank(msg.sender);
        registry.assignToBuilding(citizenId, buildingTokenId);

        CitizenRegistry.Citizen memory c = registry.getCitizen(citizenId);
        assertEq(c.assignedBuilding, buildingTokenId);
    }

    function testUpdateReputation() public {
        uint256 id = registry.createCitizen("Carol", "merchant");
        vm.prank(owner());
        registry.updateReputation(id, 50); // +50

        CitizenRegistry.Citizen memory c = registry.getCitizen(id);
        assertEq(c.reputation, 150);

        vm.prank(owner());
        registry.updateReputation(id, -30); // -30
        c = registry.getCitizen(id);
        assertEq(c.reputation, 120);
    }

    function testReputationClamp() public {
        uint256 id = registry.createCitizen("Dave", "engineer");
        vm.prank(owner());
        registry.updateReputation(id, 10000); // large positive
        assertEq(registry.getCitizen(id).reputation, 1000);

        vm.prank(owner());
        registry.updateReputation(id, -200); // negative
        assertEq(registry.getCitizen(id).reputation, 800);
    }
}