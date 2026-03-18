import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { EidolonOrchestrator } from '../src/orchestrator/EidolonOrchestrator';
import { BankrClient } from '../src/core/bankr-client';
import { TokenCopilot } from '../src/services/token-copilot';

dotenv.config();

async function setup() {
  console.log('Eidolon Setup Script');
  console.log('====================\n');

  // Load config similar to orchestrator
  const config = {
    bankr: {
      llmApiKey: process.env.BANKR_LLM_API_KEY!,
      agentApiKey: process.env.BANKR_AGENT_API_KEY!,
    },
    treasury: {
      walletAddress: process.env.TREASURY_WALLET!,
    },
    erc8004: {
      identityRegistry: process.env.IDENTITY_REGISTRY!,
      reputationRegistry: process.env.REPUTATION_REGISTRY!,
      validationRegistry: process.env.VALIDATION_REGISTRY!,
      operatorWallet: process.env.OPERATOR_WALLET!,
    },
    network: {
      rpcUrl: process.env.NETWORK_RPC_URL!,
      chainId: parseInt(process.env.CHAIN_ID || '84532'),
    },
    agent: {
      name: process.env.AGENT_NAME || 'Eidolon',
      description: process.env.AGENT_DESCRIPTION || 'Autonomous agent',
      capabilities: ['trading', 'token-launch', 'research', 'x402', 'erc8004'],
    },
  };

  const bankr = new BankrClient({
    llmApiKey: config.bankr.llmApiKey,
    agentApiKey: config.bankr.agentApiKey,
  });

  // Step 1: Register ERC-8004 identity
  if (!process.env.AGENT_ID) {
    console.log('Registering ERC-8004 identity...');
    const provider = new ethers.providers.JsonRpcProvider(config.network.rpcUrl);
    const identityRegistry = new ethers.Contract(
      config.erc8004.identityRegistry,
      [
        'function registerAgent(string memory name, string memory description, bytes32[] memory capabilities) external returns (uint256 agentId)',
      ],
      provider.getSigner(config.erc8004.operatorWallet)
    );

    const capabilities = config.agent.capabilities.map(cap => ethers.utils.id(cap));
    try {
      const tx = await identityRegistry.registerAgent(
        config.agent.name,
        config.agent.description,
        capabilities
      );
      console.log('Registration transaction sent:', tx.hash);
      const receipt = await tx.wait();
      const event = receipt.events?.find((e: any) => e.event === 'AgentRegistered');
      if (event) {
        const agentId = event.args.agentId.toString();
        console.log('✅ Agent registered with ID:', agentId);
        console.log('Save this as AGENT_ID in your .env file:', agentId);
      }
    } catch (err: any) {
      console.error('Registration failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('AGENT_ID already set in .env, skipping registration.');
  }

  // Step 2: Launch token (if desired)
  if (process.env.LAUNCH_TOKEN === 'true') {
    console.log('\nLaunching EIDO token via Bankr...');
    const tokenCopilot = new TokenCopilot(bankr);
    try {
      const token = await tokenCopilot.launchToken({
        name: config.agent.name,
        symbol: 'EIDO',
        feeRecipient: config.treasury.walletAddress,
      });
      console.log('✅ Token launched:', token);
      console.log('Token address:', token.address);
    } catch (err: any) {
      console.error('Token launch failed:', err.message);
    }
  } else {
    console.log('\nSkipping token launch. Set LAUNCH_TOKEN=true to launch.');
  }

  // Step 3: Print next steps
  console.log('\n====================');
  console.log('Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start the agent: npm start (in agent directory)');
  console.log('2. Fund the Bankr wallet with USDC for LLM credits and trading');
  console.log('3. Test x402 endpoints: curl http://localhost:3000/health');
  console.log('4. Monitor logs and adjust config as needed');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
