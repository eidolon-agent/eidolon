// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IPool (Aave V3) — minimal interface for supply/withdraw
 * Full interface: https://github.com/aave/core-v3/blob/main/contracts/interfaces/IPool.sol
 */
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external returns (uint256);
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/**
 * @title CityTreasury
 * @dev ERC-4626 vault that deposits into Aave V3 to generate yield.
 * Underlying asset is expected to be USDC (6 decimals) on Base.
 */
contract CityTreasury is ERC4626, Ownable {
    IPool public immutable aavePool;
    uint256 public constant ASSET_DECIMALS = 6; // USDC

    // Track how much assets are in Aave vs in vault
    uint256 public aaveDeposited;
    uint256 public vaultBalance;

    event DepositedToAave(address indexed from, uint256 amount);
    event YieldHarvested(address indexed to, uint256 yieldAmount);

    /**
     * @dev Set Aave V3 pool address for Base: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
     */
    constructor(IERC20 asset_, address aavePoolAddress) ERC4626(asset_) ERC20("City Treasury Shares", "CTSH") Ownable(msg.sender) {
        aavePool = IPool(aavePoolAddress);
    }

    /**
     * @dev Deposit assets and automatically deposit into Aave for yield.
     * Override to deposit remaining assets into Aave after minting shares.
     */
    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        // Transfer assets from user to vault
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares based on current totalAssets (before Aave deposit)
        shares = convertToShares(assets);
        _mint(receiver, shares);

        // Deposit all received assets into Aave
        _depositToAave(assets);
    }

    /**
     * @dev Withdraw assets — first harvest yield if needed, then withdraw from Aave.
     */
    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        // Withdraw from Aave first
        _withdrawFromAave(assets);

        // Burn shares
        uint256 shares = convertToShares(assets);
        _burn(owner, shares);

        // Transfer assets to receiver
        IERC20(asset()).safeTransfer(receiver, assets);

        return shares;
    }

    /**
     * @dev Deposit assets directly into Aave (internal)
     */
    function _depositToAave(uint256 amount) internal {
        IERC20(asset()).approve(address(aavePool), amount);
        uint256 actualSupplied = aavePool.supply(address(asset()), amount, address(this), 0);
        require(actualSupplied == amount, "Aave partial deposit");
        aaveDeposited += amount;
    }

    /**
     * @dev Withdraw assets from Aave (internal)
     */
    function _withdrawFromAave(uint256 amount) internal {
        // Withdraw from Aave to this vault
        uint256 actualWithdrawn = aavePool.withdraw(address(asset()), amount, address(this));
        require(actualWithdrawn == amount, "Aave partial withdrawal");
        aaveDeposited -= amount;
    }

    /**
     * @dev Harvest accrued yield from Aave and mint as new shares.
     * Callable by owner (could be automated via bot x402).
     */
    function harvestYield() external onlyOwner {
        // Get current Aave balance of this vault
        uint256 currentBalance = IERC20(asset()).balanceOf(address(this));
        uint256 yieldAmount = currentBalance - aaveDeposited;

        if (yieldAmount > 0) {
            // Mint new shares to owner (or a designated beneficiary)
            uint256 yieldShares = convertToShares(yieldAmount);
            _mint(owner(), yieldShares);
            emit YieldHarvested(owner(), yieldAmount);
        }
    }

    /**
     * @dev Total assets = vault balance + aaveDeposited (on-chain authoritative)
     */
    function totalAssets() public view override returns (uint256) {
        // We trust our accounting since we control deposits/withdrawals
        return aaveDeposited + vaultBalance;
    }

    /**
     * @dev Convert assets to shares (overrides to use totalAssets math)
     */
    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        return (assets * totalSupply()) / total;
    }

    /**
     * @dev Convert shares to assets
     */
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        return (shares * total) / totalSupply();
    }

    // Keep vaultBalance in sync (approximate, for UI)
    function _updateVaultBalance() internal {
        vaultBalance = IERC20(asset()).balanceOf(address(this));
    }
}