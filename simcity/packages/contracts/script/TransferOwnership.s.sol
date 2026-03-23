// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CityToken} from "../src/CityToken.sol";
import {BuildingNFT} from "../src/BuildingNFT.sol";
import {CityTreasury} from "../src/CityTreasury.sol";
import {CitizenRegistry} from "../src/CitizenRegistry.sol";

contract TransferOwnership is Script {
    address public newOwner;

    function setUp() public {}

    function run() public {
        // Expect environment variables:
        // NEW_OWNER - the Safe multisig address
        // CONTRACTS - comma-separated list of contract addresses in order: CityToken,BuildingNFT,CityTreasury,CitizenRegistry
        // PRIVATE_KEY - deployer's key (must be current owner)

        string memory contractsStr = vm.envString("CONTRACTS");
        string[] memory parts = abi.decode(contractsStr, (string[]));

        require(parts.length == 4, "Expected 4 contract addresses");
        address cityTokenAddr = vm.toAddress(parts[0]);
        address buildingNFTAddr = vm.toAddress(parts[1]);
        address treasuryAddr = vm.toAddress(parts[2]);
        address citizenRegistryAddr = vm.toAddress(parts[3]);

        newOwner = vm.envAddress("NEW_OWNER");
        uint256 key = vm.envUint("PRIVATE_KEY"); // not ideal; better to pass via --private-key flag

        // Forge脚本通常通过--private-key传递，这里使用vm.createSelectFork
        vm.createSelectFork(key);
        vm.prank(key);

        // Transfer each contract's ownership
        CityToken(cityTokenAddr).transferOwnership(newOwner);
        emit log("CityToken ownership transferred");

        BuildingNFT(buildingNFTAddr).transferOwnership(newOwner);
        emit log("BuildingNFT ownership transferred");

        CityTreasury(treasuryAddr).transferOwnership(newOwner);
        emit log("CityTreasury ownership transferred");

        CitizenRegistry(citizenRegistryAddr).transferOwnership(newOwner);
        emit log("CitizenRegistry ownership transferred");

        emit log("All ownerships transferred to");
    }
}