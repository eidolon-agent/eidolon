"use client";

import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useEffect, useState } from "react";

//合约地址 (运行部署脚本后更新)
const CONTRACTS = {
  CITY_TOKEN: process.env.NEXT_PUBLIC_CITY_TOKEN_ADDRESS as `0x${string}`,
  BUILDING_NFT: process.env.NEXT_PUBLIC_BUILDING_NFT_ADDRESS as `0x${string}`,
  TREASURY: process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: usdcBalance } = useBalance({ address, token: CONTRACTS.USDC });
  const [buildings, setBuildings] = useState<any[]>([]);

  // x402 payment fetch demo
  const [weather, setWeather] = useState<string>("Loading...");

  async function buyBuilding() {
    // 1. Ensure x402 payment via API (server-side)
    const res = await fetch("/api/buy-building", { method: "POST" });
    if (!res.ok) {
      alert("Payment failed or not authorized");
      return;
    }
    // 2. After payment, mint building (would be contract call)
    alert("Building purchased! (tx pending)");
  }

  async function fetchWeather() {
    const res = await fetch("/api/weather");
    const data = await res.json();
    setWeather(data.forecast || " Sunny");
  }

  useEffect(() => {
    if (isConnected) fetchWeather();
  }, [isConnected]);

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", background: "#050505", color: "#e0e0e0", minHeight: "100vh" }}>
      <header style={{ borderBottom: "2px solid #00ff88", marginBottom: "2rem", paddingBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#00ff88" }}>Agentic SimCity</h1>
        <div>
          {isConnected ? (
            <span style={{ color: "#00ff88" }}>● Connected: {address?.slice(0, 8)}...</span>
          ) : (
            <span style={{ color: "#ff4444" }}>● Disconnected</span>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {/* Treasury Card */}
        <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid #00ff88", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00ff88" }}>Treasury (x402)</h2>
          {usdcBalance ? (
            <p style={{ fontSize: "2rem", margin: 0 }}>${parseFloat(formatEther(usdcBalance.value)).toFixed(2)} USDC</p>
          ) : (
            <p>Connect wallet to see balance</p>
          )}
          <p style={{ color: "#888", fontSize: "0.9rem" }}>Earn yield via Aave & game revenue</p>
        </div>

        {/* Buildings Card */}
        <div style={{ background: "rgba(0,212,255,0.05)", border: "1px solid #00d4ff", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00d4ff" }}>Your Buildings</h2>
          {buildings.length === 0 ? (
            <p>No buildings yet. Build one!</p>
          ) : (
            <ul style={{ paddingLeft: "1rem" }}>
              {buildings.map((b) => (
                <li key={b.tokenId}>Building #{b.tokenId} — {b.type} (Lvl {b.level})</li>
              ))}
            </ul>
          )}
        </div>

        {/* x402 Actions */}
        <div style={{ background: "rgba(255,170,0,0.05)", border: "1px solid #ffaa00", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#ffaa00" }}>Actions (x402)</h2>
          <button onClick={buyBuilding} style={{ background: "#ffaa00", color: "#000", border: "none", padding: "0.8rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>
            Build House ($0.10)
          </button>
          <p style={{ fontSize: "0.8rem", color: "#888" }}>Pays via USDC x402</p>
        </div>

        {/* Weather Event */}
        <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid #00ff88", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00ff88" }}>Weather Forecast</h2>
          <p style={{ fontSize: "1.5rem", margin: 0 }}>{weather}</p>
          <button onClick={fetchWeather} style={{ background: "transparent", border: "1px solid #00ff88", color: "#00ff88", padding: "0.5rem", borderRadius: "4px", cursor: "pointer", marginTop: "0.5rem" }}>
            Refresh ($0.05)
          </button>
        </div>
      </div>

      <footer style={{ marginTop: "3rem", borderTop: "1px solid #333", paddingTop: "1rem", color: "#666", fontSize: "0.8rem" }}>
        Built with Scaffold-ETH 2, x402, ERC-4626, ERC-721, and ERC-8004 (coming soon).
      </footer>
    </div>
  );
}