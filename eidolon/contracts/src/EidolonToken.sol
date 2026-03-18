// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EidolonToken is ERC20, Ownable {
    uint256 public constant SUPPLY = 100_000_000_000 * 10**18; // 100 billion with decimals

    // Bankr token launch typically uses a 1.2% swap fee on Uniswap V4 pool
    // This is handled off-contract by the pool; we just need a standard ERC20.

    constructor() ERC20("Eidolon", "EIDO") Ownable(msg.sender) {
        _mint(msg.sender, SUPPLY);
    }

    // If you need to enable fee-on-transfer, you'd override _transfer, but Bankr pools handle fees separately.
}
