// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CityToken} from "../src/CityToken.sol";
import {BuildingNFT} from "../src/BuildingNFT.sol";
import {CityTreasury} from "../src/CityTreasury.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Deploy is Script {
    CityToken public cityToken;
    BuildingNFT public buildingNFT;
    CityTreasury public treasury;

    uint256 private deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address private deployer = vm.addr(deployerKey);

    function setUp() public {}

    function run() public {
        vm.createSelectFork(deployerKey);
        vm.prank(deployer);

        // Deploy CityToken
        cityToken = new CityToken();
        // Transfer initial supply to the game operator (later to treasury)
        cityToken.transfer(deployer, cityToken.balanceOf(address(this)));

        // Deploy BuildingNFT
        buildingNFT = new BuildingNFT();

        // Deploy CityTreasury (backed by USDC initially for MVP)
        // In production, use USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        IERC20 usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
        treasury = new CityTreasury(usdc);

        // Mint a sample building
        buildingNFT.mintBuilding(deployer, BuildingNFT.BuildingType.HOUSE);

        emit log(address(cityToken));
        emit log(address(buildingNFT));
        emit log(address(treasury));
    }
}