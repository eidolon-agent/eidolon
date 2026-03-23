// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CityToken} from "../src/CityToken.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

contract CityTokenTest is Test, StdCheats {
    CityToken public token;

    function setUp() public {
        token = new CityToken();
    }

    function testMintAndBurn() public {
        address alice = address(0x111);
        uint256 amount = 1000 * 10 ** token.DECIMALS();

        // Mint to alice
        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);

        // Burn
        vm.prank(alice);
        token.burn(amount);
        assertEq(token.balanceOf(alice), 0);
    }
}