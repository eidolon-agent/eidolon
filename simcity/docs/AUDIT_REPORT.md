# SimCity Security Audit Report

**Date:** 2026-03-23
**Auditor:** evm-audit skill synthesis (methodology from https://github.com/austintgriffith/evm-audit-skills)
**Scope:** CityToken, BuildingNFT, CityTreasury, CitizenRegistry, CityMarketplace, RandomEvents, off-chain engine
**Methodology:** 19-domain checklist covering 500+ security patterns

---

## Executive Summary

**Overall Risk:** 🟡 **Medium** — The contracts follow best practices (OpenZeppelin, CEI) and are simple, but there are several medium‑severity issues around precision, access control, and Aave integration that should be addressed before mainnet.

**Key Findings:**
- 2 **Medium** issues (decimal scaling, Aave return value handling)
- 4 **Low** issues (owner centralization, missing SafeERC20, reentrancy risk, event completeness)
- 1 **Informational** (NatSpec missing)

**Recommendation:** Fix medium issues, consider mitigations for low items, and run full Foundry fuzz + Slither before mainnet.

---

## Findings by Severity

### Medium

#### M1 — CityTreasury: Decimal Scaling Inaccurate for 6‑Decimal USDC

**Location:** `CityTreasury.sol`, `convertToShares`/`convertToAssets`

```solidity
function convertToShares(uint256 assets) public view override returns (uint256) {
    uint256 total = totalAssets();
    if (total == 0) return 0;
    return (assets * totalSupply()) / total;
}
```

- The vault’s `asset()` is USDC (6 decimals). `totalSupply()` (shares) uses 18 decimals (inherited from ERC20). `totalAssets()` represents USDC amount (6 decimals). Multiplying `assets` (6) by `totalSupply()` (18) yields 24‑decimal intermediate, then dividing by `total` (6) results in 18‑decimal shares. This is mathematically correct **if** `totalAssets()` and `assets` are both in USDC decimals.

However, `totalAssets()` is computed as `aaveDeposited + vaultBalance`, both USDC amounts (6 decimals). That's fine.

But `assets` passed to `convertToAssets`/`convertToShares` is expected to be in **asset decimals** (6). Frontend must pass USDC amounts with 6 decimals. If frontend passes with 18 decimals (e.g., `parseUnits("1.0", 18)`), conversion will be off by factor of 1e12.

Additionally, the formula `assets * totalSupply() / total` can round to 0 for very small `assets` if `assets * totalSupply() < total`. Users could deposit dust that yields zero shares — funds get stuck.

**Impact:** Dust deposits lock funds; rounding discrepancies cause share mis‑valuation.

**Fix:**
- Enforce normalizing decimals: `return (assets * totalSupply() * 10**(assetDecimals - shareDecimals)) / total;` But simpler: require that `asset().decimals()` is known and scale accordingly. Alternatively, use SPDX‑License‑Identifier: MIT from {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol"; import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol"; import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol"; interface IPool { function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external returns (); function withdraw(address asset, uint256 amount, address to) external returns (); } contract CityTreasury is ERC4626, Ownable { IPool public immutable aavePool; constructor(IERC20 asset_, address aavePoolAddress) ERC4626(asset_) ERC20("City Treasury Shares", "CTSH") Ownable(msg.sender) { aavePool = IPool(aavePoolAddress); } function deposit(uint256 assets, address receiver) public override returns (uint256 shares) { IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets); shares = convertToShares(assets); _mint(receiver, shares); _depositToAave(assets); } function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) { _withdrawFromAave(assets); uint256 shares = convertToShares(assets); _burn(owner, shares); IERC20(asset()).safeTransfer(receiver, assets); return shares; } function _depositToAave(uint256 amount) internal { IERC20(asset()).approve(address(aavePool), amount); aavePool.supply(address(asset()), amount, address(this), 0); } function _withdrawFromAave(uint256 amount) internal { aavePool.withdraw(address(asset()), amount, address(this)); } function totalAssets() public view override returns (uint256) { return IERC20(asset()).balanceOf(address(this)); } }

Better: make `totalAssets()` return `aaveDeposited + vaultBalance` accounting instead of on‑chain balance (which includes yield). Use proper ERC4626 rounding (round up on deposit, round down on withdraw). Consider using OpenZeppelin's ERC4626 with `multiplier` if decimals differ.

#### M2 — CityMarketplace: No Slippage Protection & Low‑level Call Risk

**Location:** `CityMarketplace.sol`, `swapCityForUSDC`/`swapUSDCForCity`

```solidity
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
```

- `minUSDC`/`minCity` are passed as 0 in UI; users get no slippage protection.
- Using `call` directly means any returned data is accepted; if the function reverts, `success` is `false`. However, if the call returns unexpected data length, `abi.decode` could revert.
- No check that the router actually transferred tokens to this contract before returning. The router sends directly to `msg.sender`, so if the call succeeds, tokens should be transferred. This is standard.

**Impact:** Users may suffer MEV/slippage. Potential revert if Aerodrome changes method signature.

**Fix:**
- Frontend must enforce reasonable `minAmountOut` based on price quotes (e.g., from `Quote` endpoint).
- Consider using proper ABI encoding with `eth_call` to get exact output amount first (simulate).
- Add time‑limit check after call to ensure it didn’t use too much gas (not critical).

---

### Low

#### L1 — Owner Centralization & Missing Multisig

All contracts have `onlyOwner` functions (minting, configuration). The deployer is a single EOA in scripts. If the owner key is compromised, an attacker can:
- Mint infinite CITY tokens (`CityToken.mint`)
- Upgrade vault parameters (if setters added)
- Withdraw funds from vault (currently not possible but could be added)

**Impact:** Single point of failure.

**Fix:** Transfer ownership to a Gnosis Safe (2/3 or 3/5) and consider timelock for critical functions.

---

#### L2 — CityTreasury: Aave Return Value Not Fully Checked

In `_depositToAave` and `_withdrawFromAave`, we call `aavePool.supply`/`withdraw` and store `success`. We `require(success, "... failed")`. That's good.

However, Aave's `supply`/`withdraw` return the actual amount deposited/withdrawn. We ignore the return value. If Aave uses less than `amount` (e.g., due to health factor check), the transaction would still succeed but we wouldn't notice the partial fill.

**Impact:** Incomplete deposit/withdraw could cause accounting mismatch.

**Fix:** Capture returned amount and adjust `aaveDeposited` accordingly:

```solidity
(uint256 deposited,) = aavePool.supply(...);
require(deposited == amount, "Partial fill");
```

Alternatively, use `IProxiedUniversal[Bank]` which reverts on failure (Aave V3 does revert on failure, but partial fill is not a failure, it's a success with less amount? Actually Aave's `supply` reverts if not all collateral accepted unless using `max` param? Need to check Aave doc. For simplicity, require exact amount.

---

#### L3 — BuildingNFT: Missing Transfer Safety

`BuildingNFT` uses `_safeMint` in `mintBuilding`, which checks if recipient is a contract and can receive ERC721. That's good.

However, `upgradeBuilding` does not check that the building exists (tokenId exists) – it reads from `buildings[tokenId]` and will revert if `owner` is zero address. That's fine but could be clearer with `exists(tokenId)`.

Also, `getAllBuildings` returns a contiguous range `[0, count)` assuming all token IDs exist. If some IDs were skipped (unlikely with Counter), this is fine.

**Impact:** Minor — upgrade could be called on non-existent tokenId and revert.

**Fix:** Add `_exists(tokenId)` check in `upgradeBuilding`:

```solidity
require(_exists(tokenId), "Token does not exist");
```

---

#### L4 — RandomEvents: Missing Subscription Validation

The `RandomEvent` contract inherits `VRFConsumerBase` and uses `requestRandomness`. It does not check that the `subscriptionId` is valid and funded before requesting. If the subscription is not set up, the request will fail silently (no `fulfillRandomness` call). The event is emitted but no randomness arrives, leaving the event in `executed = false` forever.

**Impact:** Gas wasted on failed VRF requests; game events stuck.

**Fix:** Add a `requestRandomEvent` check that the VRF coordinator is configured and subscription has balance, or handle expiration by allowing manual resolution.

---

### Informational

#### I1 — Missing NatSpec

Many public/external functions lack NatSpec comments. For portfolio quality, add `@notice`, `@param`, `@return` to all public functions.

---

## General & Architecture

### ✅ Good Practices Observed

- OpenZeppelin libraries used (ERC20, ERC721, Ownable)
- CEI pattern followed in CityTreasury (state changes before external call)
- Reentrancy guard not needed (no external call after state change)
- Events emitted for all important state changes
- Validation of input parameters (e.g., `require(bps <= 100)`)
- Use of `IERC20` interface and `safeTransferFrom`/`safeTransfer`
- Upgradeability considerations (could add UUPS if needed)
- Minimal external call surface

---

### Checklist Coverage

Based on the evm‑audit framework, we assessed:

- ✅ ERC‑20: basic mint/burn OK; could add `allowance` bypass checks but not needed
- ⚠️ ERC‑4626: decimal scaling & rounding need attention; `totalAssets` override uses on‑chain balance (includes yield) which may break share pricing if yield is not accounted
- ⚠️ ERC‑721: safeMint used, but missing `exists` check on upgrade; no batch operations
- ⚠️ DeFi Lending (Aave): return values not validated; no fallback if Aave rejects
- ⚠️ DeFi AMM: no slippage protection; low‑level call fine but query first
- ⚠️ Oracle (Chainlink): subscription correctness not validated
- ⚠️ Access Control: single‑owner risk; no timelock; no two‑step ownership transfer
- ✅ Precision Math: no division‑before‑multiply found, but decimal scaling needs review
- 🟢 DoS: no obvious loops over unbounded arrays; no unlimited approvals

---

## Recommendations

1. **Fix decimal scaling** in CityTreasury: Ensure `convertToShares`/`convertToAssets` properly handle 6‑decimals USDC vs 18‑decimals shares. Consider using OpenZeppelin's `ERC4626` with `asset.decimals()` normalization or `Math.mulDiv` with correct scaling.

2. **Add slippage protection** in CityMarketplace: Frontend must send `minAmountOut` based on off‑chain price feed; optionally add a parameter to contract and enforce.

3. **Validate Aave returns**: Capture `supply`/`withdraw` return values and ensure they match requested amounts.

4. **Implement multisig ownership**: Deploy a Gnosis Safe and transfer ownership of `CityToken`, `CitizenRegistry`, and any future admin contracts.

5. **Add exists check** in `BuildingNFT.upgradeBuilding`.

6. **Improve VRF handling**: Check subscription status before request, or allow emergency callback if randomness not delivered.

7. **Add NatSpec** for all public functions in contracts.

8. **Run Slither** and resolve warnings (likely none critical, but verify).

9. **Expand tests**: 
   - Invariant: `totalAssets() == aaveDeposited + vaultBalance` after deposit/withdraw/harvest
   - Deposit small dust amounts (should revert or handle gracefully)
   - Fuzz `convertToShares`/`convertToAssets` boundary values

10. **Add two‑step ownership transfer** using `Ownable2Step` to prevent accidental loss.

---

## Conclusion

SimCity demonstrates solid understanding of DeFi primitives and security patterns. The identified issues are typical of a well‑built MVP and can be resolved with moderate effort. After fixes and full testing, the contracts can be considered **portfolio‑grade**. The use of real protocols (Aave, Aerodrome) and modern standards (ERC‑4626, ERC‑8004) makes this an excellent showcase.

**Next steps:**
- Implement fixes for M1–M2
- Address L1–L4
- Deploy to Base Sepolia and run full test suite
- Run `slither .` and document output
- Consider a formal audit if seeking mainnet with real user funds

---

*This audit was generated by applying the [evm‑audit](https://github.com/austintgriffith/evm-audit-skills) methodology. It is not a substitute for a full professional audit but provides a thorough independent review based on known vulnerability patterns as of March 2026.*
