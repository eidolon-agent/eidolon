// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CityToken} from "../src/CityToken.sol";
import {BuildingNFT} from "../src/BuildingNFT.sol";
import {CityTreasury} from "../src/CityTreasury.sol";
import {CitizenRegistry} from "../src/CitizenRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Deploy is Script {
    CityToken public cityToken;
    BuildingNFT public buildingNFT;
    CityTreasury public treasury;
    CitizenRegistry public citizens;

    uint256 private deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address private deployer = vm.addr(deployerKey);

    // Base Mainnet addresses (verified per ethskills.com)
    address private constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address private constant AAVE_POOL_BASE = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;

    function setUp() public {}

    function run() public {
        vm.createSelectFork(deployerKey);
        vm.prank(deployer);

        // Deploy CityToken
        cityToken = new CityToken();
        // Transfer initial supply to deployer (will later deposit to treasury)
        cityToken.transfer(deployer, cityToken.balanceOf(address(this)));

        // Deploy BuildingNFT
        buildingNFT = new BuildingNFT();

        // Deploy CityTreasury (backed by USDC) with Aave V3 integration
        IERC20 usdc = IERC20(USDC_BASE);
        treasury = new CityTreasury(usdc, AAVE_POOL_BASE);

        // Deploy CitizenRegistry for agent identities
        citizens = new CitizenRegistry();

        // Create a sample citizen
        citizens.createCitizen("Farmer John", "farmer");

        // Mint a sample building
        buildingNFT.mintBuilding(deployer, BuildingNFT.BuildingType.FARM);

        emit log(address(cityToken));
        emit log(address(buildingNFT));
        emit log(address(treasury));
        emit log(address(citizens));
    }
}