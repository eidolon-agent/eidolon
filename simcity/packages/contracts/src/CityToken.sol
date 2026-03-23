// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CityToken
 * @dev In-game currency token (ERC-20). Can be minted by owner for game rewards.
 * For MVP, we use a fixed supply minted to the treasury.
 */
contract CityToken is ERC20, Ownable {
    uint8 public constant DECIMALS = 6; // USDC-like

    constructor() ERC20("CityToken", "CITY") Ownable(msg.sender) {
        // Mint initial supply to the owner (treasury will be set later)
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS); // 1M tokens
    }

    /**
     * @dev Mint new tokens (only owner). Used for rewards/events.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens (anyone can burn their own)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}