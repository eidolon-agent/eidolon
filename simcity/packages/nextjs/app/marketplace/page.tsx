"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useState } from "react";

const CONTRACTS = {
  CITY_TOKEN: process.env.NEXT_PUBLIC_CITY_TOKEN_ADDRESS as `0x${string}`,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  MARKETPLACE: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}`,
};

// Minimal ABI for marketplace
const MARKETPLACE_ABI = [
  {
    inputs: [{ name: "cityAmount", type: "uint256" }, { name: "minUSDC", type: "uint256" }],
    name: "swapCityForUSDC",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "usdcAmount", type: "uint256" }, { name: "minCity", type: "uint256" }],
    name: "swapUSDCForCity",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"city2usdc" | "usdc2city">("city2usdc");

  const { data: cityBalance } = useBalance({ address, token: CONTRACTS.CITY_TOKEN });
  const { data: usdcBalance } = useBalance({ address, token: CONTRACTS.USDC });

  const { writeContract: swap, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleSwap() {
    if (!address || !amount) return;
    const parsed = parseUnits(amount, direction === "city2usdc" ? 18 : 6); // CITY 18, USDC 6

    if (direction === "city2usdc") {
      swap({
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "swapCityForUSDC",
        args: [parsed, 0n], // minUSDC 0 for MVP
      });
    } else {
      swap({
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "swapUSDCForCity",
        args: [parsed, 0n],
      });
    }
  }

  return (
    <div style={{ padding: "2rem", background: "#050505", color: "#e0e0e0", minHeight: "100vh", fontFamily: "monospace" }}>
      <h1 style={{ color: "#00d4ff", marginBottom: "2rem" }}>Marketplace • Aerodrome DEX</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Balances */}
        <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid #00ff88", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#00ff88" }}>Your Balances</h2>
          <p>CITY: {cityBalance ? formatUnits(cityBalance.value, 18).slice(0, 8) : "0"} <span style={{color:"#888"}}>(18 decimals)</span></p>
          <p>USDC: {usdcBalance ? formatUnits(usdcBalance.value, 6).slice(0, 8) : "0"} <span style={{color:"#888"}}>(6 decimals)</span></p>
        </div>

        {/* Swap Form */}
        <div style={{ background: "rgba(255,170,0,0.05)", border: "1px solid #ffaa00", borderRadius: "12px", padding: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#ffaa00" }}>Swap Tokens</h2>

          <div style={{ marginBottom: "1rem" }}>
            <button
              onClick={() => setDirection("city2usdc")}
              style={{
                background: direction === "city2usdc" ? "#00ff88" : "transparent",
                color: direction === "city2usdc" ? "#000" : "#00ff88",
                border: "1px solid #00ff88",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                marginRight: "0.5rem",
              }}
            >
              CITY → USDC
            </button>
            <button
              onClick={() => setDirection("usdc2city")}
              style={{
                background: direction === "usdc2city" ? "#00ff88" : "transparent",
                color: direction === "usdc2city" ? "#000" : "#00ff88",
                border: "1px solid #00ff88",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              USDC → CITY
            </button>
          </div>

          <input
            type="number"
            placeholder={direction === "city2usdc" ? "CITY amount" : "USDC amount"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%",
              padding: "0.8rem",
              marginBottom: "1rem",
              background: "#111",
              border: "1px solid #333",
              color: "#e0e0e0",
              borderRadius: "6px",
              fontFamily: "monospace",
            }}
          />

          <button
            onClick={handleSwap}
            disabled={isPending || !amount || !isConnected}
            style={{
              width: "100%",
              padding: "1rem",
              background: isPending ? "#555" : "#00ff88",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Swapping..." : "Swap"}
          </button>

          {error && <p style={{ color: "#ff4444", marginTop: "1rem" }}>{error.message}</p>}
          {isSuccess && <p style={{ color: "#00ff88", marginTop: "1rem" }}>✅ Swap confirmed!</p>}
        </div>
      </div>

      {/* Info */}
      <div style={{ marginTop: "2rem", color: "#888", fontSize: "0.85rem" }}>
        <p>Powered by <strong style={{ color: "#00d4ff" }}>Aerodrome</strong> DEX on Base. Trades execute via Universal Router with MEV protection.</p>
      </div>
    </div>
  );
}