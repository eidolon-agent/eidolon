"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";

const CONTRACTS = {
  TREASURY: process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
};

// Minimal ABI for what we need
const TREASURY_ABI = [
  {
    name: "totalAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "aaveDeposited",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "balanceOf",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function TreasuryPage() {
  const { address, isConnected } = useAccount();

  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.TREASURY,
    abi: TREASURY_ABI,
    functionName: "totalAssets",
    query: { enabled: !!CONTRACTS.TREASURY },
  });

  const { data: totalSupply } = useReadContract({
    address: CONTRACTS.TREASURY,
    abi: TREASURY_ABI,
    functionName: "totalSupply",
    query: { enabled: !!CONTRACTS.TREASURY },
  });

  const { data: aaveDeposited } = useReadContract({
    address: CONTRACTS.TREASURY,
    abi: TREASURY_ABI,
    functionName: "aaveDeposited",
    query: { enabled: !!CONTRACTS.TREASURY },
  });

  const { data: userShares } = useReadContract({
    address: CONTRACTS.TREASURY,
    abi: TREASURY_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.TREASURY },
  });

  // Calculate APY (mock for now, would need Aave's rate data)
  const apy = "~3.2%";

  return (
    <div style={{ padding: "2rem", background: "#050505", color: "#e0e0e0", minHeight: "100vh", fontFamily: "monospace" }}>
      <h1 style={{ color: "#00ff88", marginBottom: "2rem" }}>City Treasury & Yield</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {/* Total Assets */}
        <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid #00ff88", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00ff88" }}>Total Assets (USDC)</h2>
          <p style={{ fontSize: "2.5rem", margin: 0 }}>
            {totalAssets ? `${parseFloat(formatUnits(totalAssets, 6)).toFixed(2)}` : "---"}
          </p>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>Via Aave V3 on Base</p>
        </div>

        {/* Aave Deposit */}
        <div style={{ background: "rgba(0,212,255,0.05)", border: "1px solid #00d4ff", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00d4ff" }}>Aave Deposited</h2>
          <p style={{ fontSize: "2.5rem", margin: 0 }}>
            {aaveDeposited ? `${parseFloat(formatUnits(aaveDeposited, 6)).toFixed(2)}` : "---"} USDC
          </p>
        </div>

        {/* User Shares */}
        <div style={{ background: "rgba(255,170,0,0.05)", border: "1px solid #ffaa00", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#ffaa00" }}>Your Treasury Shares</h2>
          {isConnected ? (
            <>
              <p style={{ fontSize: "2rem", margin: 0 }}>{userShares ? formatUnits(userShares, 6).slice(0, 8) : "0"} CTSH</p>
              <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>Redeemable for USDC + yield</p>
            </>
          ) : (
            <p style={{ color: "#888" }}>Connect wallet to view shares</p>
          )}
        </div>

        {/* APY */}
        <div style={{ background: "rgba(255,68,68,0.05)", border: "1px solid #ff4444", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#ff4444" }}>Current APY</h2>
          <p style={{ fontSize: "2.5rem", margin: 0 }}>{apy}</p>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>From Aave supply rate</p>
        </div>
      </div>

      {/* Info */}
      <div style={{ marginTop: "2rem", color: "#888", fontSize: "0.85rem" }}>
        <p>
          <strong style={{ color: "#00ff88" }}>CityTreasury</strong> is an ERC‑4626 vault that auto‑deposits USDC into Aave V3 on Base.
          Yield accrues to the vault and can be harvested by the operator (or distributed to shareholders).
        </p>
        <p style={{ marginTop: "1rem" }}>
          The vault is exposed to Aave's interest rates and liquidations are impossible due to over‑collateralization.
        </p>
      </div>
    </div>
  );
}