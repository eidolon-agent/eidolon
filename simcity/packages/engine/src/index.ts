import { createPublicClient, http, parseEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const chain = process.env.CHAIN === 'mainnet' ? base : baseSepolia;
const rpcUrl = process.env.RPC_URL || `https://${chain.id}.rpc.thirdweb.com}`;

const client = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

// Contract addresses (to be set after deployment)
const CONTRACTS = {
  CITY_TOKEN: process.env.CITY_TOKEN_ADDRESS as `0x${string}`,
  BUILDING_NFT: process.env.BUILDING_NFT_ADDRESS as `0x${string}`,
  TREASURY: process.env.TREASURY_ADDRESS as `0x${string}`,
  CITIZEN_REGISTRY: process.env.CITIZEN_REGISTRY_ADDRESS as `0x${string}`,
};

// Production rates per building type (per 5-min tick)
const PRODUCTION_RATES: Record<string, { food: number; energy: number; data: number }> = {
  HOUSE: { food: 0, energy: -1, data: 0 }, // consumes energy
  FACTORY: { food: 0, energy: -2, data: 5 },
  FARM: { food: 10, energy: -1, data: 0 },
  SOLAR_FARM: { food: 0, energy: 5, data: 0 },
  DATA_CENTER: { food: 0, energy: -3, data: 15 },
};

interface Building {
  tokenId: bigint;
  type: number;
  level: number;
  owner: `0x${string}`;
}

interface Citizen {
  citizenId: bigint;
  skill: string;
  reputation: number;
  assignedBuilding: bigint;
}

class SimulationEngine {
  app: express.Application;
  tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  async start() {
    // Run simulation every 5 minutes
    this.tickInterval = setInterval(() => this.runTick(), 5 * 60 * 1000);
    console.log('[SimEngine] Started — tick every 5min');
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  async runTick() {
    try {
      console.log('[SimEngine] Tick starting...');
      const buildings = await this.fetchBuildings();
      const citizens = await this.fetchCitizens();

      // Calculate total production
      let totalFood = 0, totalEnergy = 0, totalData = 0;
      for (const b of buildings) {
        const typeName = this.buildingTypeName(b.type);
        const rates = PRODUCTION_RATES[typeName] || { food: 0, energy: 0, data: 0 };
        const levelMultiplier = 1 + (b.level - 1) * 0.5; // +50% per level

        // Boost from assigned citizens
        const assignedCitizens = citizens.filter(c => c.assignedBuilding === b.tokenId);
        const avgRep = assignedCitizens.length > 0
          ? assignedCitizens.reduce((sum, c) => sum + c.reputation, 0) / assignedCitizens.length / 1000
          : 1; // 1 = no bonus

        totalFood += rates.food * levelMultiplier * avgRep;
        totalEnergy += rates.energy * levelMultiplier * avgRep;
        totalData += rates.data * levelMultiplier * avgRep;
      }

      // Convert to token amounts (1 CITY = 1 unit, decimals 6)
      const foodAmount = Math.floor(totalFood * 1e6);
      const energyAmount = Math.floor(totalEnergy * 1e6);
      const dataAmount = Math.floor(totalData * 1e6);

      console.log(`[SimEngine] Produced — Food: ${foodAmount/1e6}, Energy: ${energyAmount/1e6}, Data: ${dataAmount/1e6}`);

      // In production: mint CITY tokens to treasury or distribute to building owners
      // For MVP, we just log
    } catch (err) {
      console.error('[SimEngine] Tick failed:', err);
    }
  }

  async fetchBuildings(): Promise<Building[]> {
    // For MVP, return sample data. Replace with actual onchain reads.
    return [
      { tokenId: 0n, type: 2, level: 1, owner: '0xdummy' as `0x${string}` }, // FARM
      { tokenId: 1n, type: 3, level: 2, owner: '0xdummy' as `0x${string}` }, // SOLAR_FARM
    ];
  }

  async fetchCitizens(): Promise<Citizen[]> {
    // For MVP, return sample data
    return [
      { citizenId: 0n, skill: 'farmer', reputation: 850, assignedBuilding: 0n },
      { citizenId: 1n, skill: 'engineer', reputation: 720, assignedBuilding: 1n },
    ];
  }

  buildingTypeName(type: number): string {
    const types = ['HOUSE', 'FACTORY', 'FARM', 'SOLAR_FARM', 'DATA_CENTER'];
    return types[type] || 'UNKNOWN';
  }

  setupRoutes() {
    this.app.get('/api/sim/status', (req, res) => {
      res.json({ status: 'running', nextTick: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
    });

    this.app.get('/api/sim/buildings', async (req, res) => {
      const buildings = await this.fetchBuildings();
      res.json({ buildings });
    });

    this.app.get('/api/sim/citizens', async (req, res) => {
      const citizens = await this.fetchCitizens();
      res.json({ citizens });
    });
  }
}

// Start if run directly
if (require.main === module) {
  const engine = new SimulationEngine();
  engine.start();
  const PORT = process.env.PORT || 3001;
  engine.app.listen(PORT, () => console.log(`[SimEngine] API listening on ${PORT}`));
}

export { SimulationEngine, client };