// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CityMarketplace
 * @dev Swap CITY tokens for USDC (and vice versa) using Aerodrome router on Base.
 * For MVP, exact input swaps only.
 */
contract CityMarketplace is Ownable {
    IERC20 public immutable cityToken;
    IERC20 public immutable usdc;
    address public immutable aerodromeRouter;

    // Addresses from ethskills.com (Base)
    address public constant AERODROME_ROUTER_BASE = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;

    event Swapped(address indexed user, address fromToken, address toToken, uint256 amountIn, uint256 amountOut);

    constructor(address _cityToken, address _usdc) {
        cityToken = IERC20(_cityToken);
        usdc = IERC20(_usdc);
        aerodromeRouter = AERODROME_ROUTER_BASE;
    }

    /**
     * @dev Swap exact CITY tokens for USDC
     */
    function swapCityForUSDC(uint256 cityAmount, uint256 minUSDC) external returns (uint256) {
        // Approve router to spend CITY
        cityToken.approve(aerodromeRouter, cityAmount);

        // Call Aerodrome router
        (bool success, bytes memory data) = aerodromeRouter.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                cityAmount,
                minUSDC,
                this.getRoute(_cityToken, _usdc),
                msg.sender,
                block.timestamp + 5 minutes
            )
        );

        require(success && data.length > 0, "Swap failed");

        uint256 usdcAmount = abi.decode(data, (uint256));
        emit Swapped(msg.sender, _cityToken, _usdc, cityAmount, usdcAmount);
        return usdcAmount;
    }

    /**
     * @dev Swap exact USDC for CITY tokens
     */
    function swapUSDCForCity(uint256 usdcAmount, uint256 minCity) external returns (uint256) {
        usdc.approve(aerodromeRouter, usdcAmount);

        (bool success, bytes memory data) = aerodromeRouter.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                usdcAmount,
                minCity,
                this.getRoute(_usdc, _cityToken),
                msg.sender,
                block.timestamp + 5 minutes
            )
        );

        require(success && data.length > 0, "Swap failed");

        uint256 cityAmount = abi.decode(data, (uint256));
        emit Swapped(msg.sender, _usdc, _cityToken, usdcAmount, cityAmount);
        return cityAmount;
    }

    /**
     * @dev Get the two‑hop route (CITY → USDC or USDC → CITY)
     * Both tokens are on Base, so route via native USDC/CITY pool.
     * In production, query Aerodrome’s PoolManager for actual route.
     */
    function getRoute(address from, address to) internal pure returns (address[] memory) {
        address[] memory route = new address[](2);
        route[0] = from;
        route[1] = to;
        return route;
    }

    /**
     * @dev Withdraw any ERC‑20 tokens sent by mistake (owner only)
     */
    function recoverToken(address token, address to) external onlyOwner {
        IERC20(token).transfer(to, IERC20(token).balanceOf(address(this)));
    }
}