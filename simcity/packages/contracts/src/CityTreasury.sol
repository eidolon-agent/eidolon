// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CityTreasury is ERC4626, Ownable {
    constructor(IERC20 asset_) ERC4626(asset_) ERC20("City Treasury Shares", "CTSH") Ownable(msg.sender) {}
}