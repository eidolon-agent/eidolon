"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";

const CONTRACTS = {
  CITIZEN_REGISTRY: process.env.NEXT_PUBLIC_CITIZEN_REGISTRY_ADDRESS as `0x${string}`,
  BUILDING_NFT: process.env.NEXT_PUBLIC_BUILDING_NFT_ADDRESS as `0x${string}`,
};

const CITIZEN_ABI = [
  {
    inputs: [{ name: "name", type: "string" }, { name: "skill", type: "string" }],
    name: "createCitizen",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "citizenId", type: "uint256" }, { name: "buildingTokenId", type: "uint256" }],
    name: "assignToBuilding",
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "getCitizen",
    inputs: [{ name: "citizenId", type: "uint256" }],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "name", type: "string" },
      { name: "skill", type: "string" },
      { name: "reputation", type: "uint256" },
      { name: "assignedBuilding", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "getOwnedCitizens",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const BUILDING_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getBuilding",
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "type", type: "uint8" },
      { name: "level", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "buildingName",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllBuildings",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function AgentsPage() {
  const { address, isConnected } = useAccount();
  const [citizenName, setCitizenName] = useState("");
  const [citizenSkill, setCitizenSkill] = useState("");

  // Read owned citizens
  const { data: citizenIds } = useReadContract({
    address: CONTRACTS.CITIZEN_REGISTRY,
    abi: CITIZEN_ABI,
    functionName: "getOwnedCitizens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read buildings (fetch all for dropdown)
  const { data: buildingTokenIds } = useReadContract({
    address: CONTRACTS.BUILDING_NFT,
    abi: BUILDING_ABI,
    functionName: "getAllBuildings",
    query: { enabled: !!CONTRACTS.BUILDING_NFT },
  });

  const { writeContract: createCitizen, data: createHash } = useWriteContract();
  const { writeContract: assignCitizen, data: assignHash } = useWriteContract();
  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createHash });
  const { isSuccess: assignSuccess } = useWaitForTransactionReceipt({ hash: assignHash });

  const citizens = citizenIds?.map((id) => {
    // For each citizen, you could fetch full details, but for brevity we skip
    return { id };
  }) || [];

  function handleCreateCitizen(e: React.FormEvent) {
    e.preventDefault();
    if (!citizenName || !citizenSkill) return;
    createCitizen({
      address: CONTRACTS.CITIZEN_REGISTRY,
      abi: CITIZEN_ABI,
      functionName: "createCitizen",
      args: [citizenName, citizenSkill],
    });
  }

  function handleAssign(citizenId: bigint, buildingTokenId: bigint) {
    assignCitizen({
      address: CONTRACTS.CITIZEN_REGISTRY,
      abi: CITIZEN_ABI,
      functionName: "assignToBuilding",
      args: [citizenId, buildingTokenId],
    });
  }

  return (
    <div style={{ padding: "2rem", background: "#050505", color: "#e0e0e0", minHeight: "100vh", fontFamily: "monospace" }}>
      <h1 style={{ color: "#00ff88", marginBottom: "2rem" }}>Agent Citizens • ERC-8004</h1>

      {/* Create Citizen Form */}
      <div style={{ background: "rgba(255,170,0,0.05)", border: "1px solid #ffaa00", borderRadius: "12px", padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ margin: "0 0 1rem 0", color: "#ffaa00" }}>Recruit New Agent</h2>
        <form onSubmit={handleCreateCitizen} style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Name (e.g., Farmer John)"
            value={citizenName}
            onChange={(e) => setCitizenName(e.target.value)}
            style={{ padding: "0.5rem", background: "#111", border: "1px solid #333", color: "#e0e0e0", borderRadius: "4px" }}
          />
          <input
            type="text"
            placeholder="Skill (farmer, engineer, merchant)"
            value={citizenSkill}
            onChange={(e) => setCitizenSkill(e.target.value)}
            style={{ padding: "0.5rem", background: "#111", border: "1px solid #333", color: "#e0e0e0", borderRadius: "4px" }}
          />
          <button
            type="submit"
            disabled={!isConnected || !citizenName || !citizenSkill}
            style={{
              padding: "0.5rem 1rem",
              background: isConnected ? "#ffaa00" : "#555",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              cursor: isConnected ? "pointer" : "not-allowed",
              fontWeight: "bold",
            }}
          >
            Recruit
          </button>
        </form>
        {createSuccess && <p style={{ color: "#00ff88", marginTop: "1rem" }}>✅ Citizen created!</p>}
      </div>

      {/* Citizens List */}
      <div style={{ background: "rgba(0,212,255,0.05)", border: "1px solid #00d4ff", borderRadius: "12px", padding: "1.5rem" }}>
        <h2 style={{ margin: "0 0 1rem 0", color: "#00d4ff" }}>Your Agents</h2>
        {citizens.length === 0 ? (
          <p style={{ color: "#888" }}>No agents yet. Recruit one above!</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {citizens.map((c) => (
              <li key={c.id.toString()} style={{ marginBottom: "1rem", padding: "0.8rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>Citizen #{c.id.toString()}</strong>
                    <p style={{ fontSize: "0.85rem", color: "#888" }}>Skill: {c.skill} • Rep: 100</p>
                  </div>
                  <div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleAssign(c.id, BigInt(e.target.value));
                      }}
                      defaultValue=""
                      style={{ padding: "0.5rem", background: "#111", border: "1px solid #333", color: "#e0e0e0", borderRadius: "4px" }}
                    >
                      <option value="" disabled>Assign to building...</option>
                      {buildingTokenIds?.map((bid) => (
                        <option key={bid.toString()} value={bid.toString()}>Building #{bid.toString()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}