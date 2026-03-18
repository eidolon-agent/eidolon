#!/usr/bin/env ts-node

/**
 * Eidolon Setup Script
 *
 * This script performs initial setup and registration on-chain via Bankr Agent API.
 *
 * Steps:
 * 1. Validate environment configuration
 * 2. Register ERC-8004 agent identity (if not already registered)
 * 3. Optionally launch the EIDO token (deferrable)
 * 4. Configure x402 server settings
 * 5. Output ready-to-run commands
 *
 * Usage:
 *   npx ts-node scripts/setup.ts
 *
 * Requires:
 * - .env file with all required variables (see .env.example)
 * - Bankr Agent API key with appropriate permissions
 * - Operator wallet with funds for on-chain transactions (Base Sepolia)
 */

import * as dotenv from 'dotenv';
import { BankrClient } from '../src/core/bankr-client';
import { ethers } from 'ethers';

dotenv.config();

interface SetupConfig {
  bankr: {
    agentApiKey: string;
    llmApiKey: string;
  };
  treasury: {
    walletAddress: string;
  };
  erc8004: {
    identityRegistry: string;
    reputationRegistry: string;
    validationRegistry: string;
    operatorWallet: string;
    agentId?: string;
  };
  agent: {
    name: string;
    description: string;
  };
  network: {
    rpcUrl: string;
    chainId: number;
  };
}

function validateConfig(): SetupConfig {
  const required = [
    'BANKR_AGENT_API_KEY',
    'BANKR_LLM_API_KEY',
    'TREASURY_WALLET',
    'IDENTITY_REGISTRY',
    'REPUTATION_REGISTRY',
    'VALIDATION_REGISTRY',
    'OPERATOR_WALLET',
    'NETWORK_RPC_URL',
    'AGENT_NAME',
    'AGENT_DESCRIPTION',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}\n\nPlease fill in .env file with your values.`);
  }

  return {
    bankr: {
      agentApiKey: process.env.BANKR_AGENT_API_KEY!,
      llmApiKey: process.env.BANKR_LLM_API_KEY!,
    },
    treasury: {
      walletAddress: process.env.TREASURY_WALLET!,
    },
    erc8004: {
      identityRegistry: process.env.IDENTITY_REGISTRY!,
      reputationRegistry: process.env.REPUTATION_REGISTRY!,
      validationRegistry: process.env.VALIDATION_REGISTRY!,
      operatorWallet: process.env.OPERATOR_WALLET!,
      agentId: process.env.AGENT_ID,
    },
    agent: {
      name: process.env.AGENT_NAME!,
      description: process.env.AGENT_DESCRIPTION!,
    },
    network: {
      rpcUrl: process.env.NETWORK_RPC_URL!,
      chainId: parseInt(process.env.CHAIN_ID || (process.env.NETWORK === 'base-sepolia' ? '84532' : '8453')),
    },
  };
}

async function checkBankrConnection(bankr: BankrClient): Promise<void> {
  console.log('[Setup] Checking Bankr connection...');
  try {
    const info = await bankr.getAccountInfo();
    console.log(`  ✓ Bankr account accessible (wallet: ${info.walletAddress || 'unknown'})`);
  } catch (err: any) {
    throw new Error(`Bankr connection failed: ${err.message}. Check your API keys.`);
  }
}

async function registerERC8004Identity(bankr: BankrClient, config: SetupConfig): Promise<string> {
  const { identityRegistry, operatorWallet, agentId } = config.erc8004;
  const agentName = config.agent.name;
  const agentDescription = config.agent.description;

  // If agentId already set, assume registered
  if (agentId) {
    console.log(`[Setup] Agent ID already set: ${agentId}. Skipping registration.`);
    return agentId;
  }

  console.log('[Setup] Registering ERC-8004 agent identity...');

  // Construct the registration prompt for Bankr
  const prompt = `
Register an ERC-8004 agent identity with the following details:

Registry: ${identityRegistry}
Operator: ${operatorWallet}
Name: ${agentName}
Description: ${agentDescription}

Perform the registration on chain (Base Sepolia). Return the agent ID (address) and transaction hash.
`.trim();

  try {
    // Submit via Bankr Agent API
    const job = await bankr.submitPrompt(prompt);
    console.log(`  - Job submitted: ${job.jobId}`);

    const result = await bankr.waitForJob(job.jobId, 2000, 120000); // 2min timeout
    if (result.status !== 'completed') {
      throw new Error(`Registration job ended with status: ${result.status}`);
    }

    const response = result.response || '';
    console.log(`  - Registration response: ${response.substring(0, 200)}...`);

    // Parse agent ID (address) from response
    const addressMatch = response.match(/agent id:? (0x[a-fA-F0-9]{40})/i);
    const txMatch = response.match(/transaction hash:? (0x[a-fA-F0-9]+)/i);

    if (!addressMatch) {
      throw new Error('Could not parse agent ID from registration response');
    }

    const agentId = addressMatch[1];
    const txHash = txMatch ? txMatch[1] : 'unknown';

    console.log(`  ✓ Agent registered! ID: ${agentId}`);
    console.log(`    TX: ${txHash}`);
    console.log(`\n  IMPORTANT: Save this agent ID to your .env file:`);
    console.log(`    AGENT_ID=${agentId}\n`);

    return agentId;
  } catch (err: any) {
    throw new Error(`ERC-8004 registration failed: ${err.message}`);
  }
}

async function launchToken(bankr: BankrClient, config: SetupConfig, agentId: string): Promise<string | null> {
  console.log('\n[Setup] Token launch (optional)');
  console.log('  Skipping token launch for now. You can launch later via Bankr CLI:');
  console.log('    npx @bankr/cli token launch --name "Eidolon" --symbol "EIDO" --recipient ' + config.treasury.walletAddress);
  console.log('  Or run this script with --launch-token flag (future).');
  return null;
}

async function configureX402(bankr: BankrClient, config: SetupConfig): Promise<void> {
  console.log('\n[Setup] x402 server configuration');
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const paymentAddress = process.env.X402_PAYMENT_ADDRESS || config.treasury.walletAddress;
  console.log(`  - Port: ${port}`);
  console.log(`  - Payment address: ${paymentAddress}`);
  console.log(`  - Pricing (USD):`);
  console.log(`      /signals/price/:token → $${process.env.PRICE_SIGNAL_PRICE || '1'}`);
  console.log(`      /reports/daily        → $${process.env.DAILY_REPORT_PRICE || '5'}`);
  console.log(`      /copilot/chat         → $${process.env.COPILOT_CHAT_PRICE || '0.10'}`);
  console.log(`  - Max debt per client: $${process.env.MAX_DEBT || '50'}`);
  console.log('  ✓ x402 server ready to start');
}

function printNextSteps(config: SetupConfig, agentId: string): void {
  console.log('\n=== SETUP COMPLETE ===\n');
  console.log('Next steps:');
  console.log('1. Fund your Bankr wallet with:');
  console.log('   - USDC (for LLM credits & payments)');
  console.log('   - ETH (for gas on Base Sepolia)');
  console.log('2. If not already done, register ERC-8004 identity on-chain (see above).');
  console.log('3. Start the agent:');
  console.log(`   cd eidolon/agent && npm start`);
  console.log(`   (or: npm run dev for development)`);
  console.log('4. Test x402 endpoints:');
  console.log(`   curl http://localhost:${process.env.PORT || '3000'}/health`);
  console.log(`   curl -H "X-Client-ID: test" http://localhost:${process.env.PORT || '3000'}/signals/price/ETH`);
  console.log('5. Monitor logs and adjust strategies.');
  console.log('\nHappy autonomous trading! 🚀');
}

async function main() {
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│ Eidolon Agent Setup                        │');
  console.log('└─────────────────────────────────────────────┘\n');

  try {
    const config = validateConfig();
    console.log('[Config] Validated environment variables.');

    const bankr = new BankrClient({
      llmApiKey: config.bankr.llmApiKey,
      agentApiKey: config.bankr.agentApiKey,
    });

    await checkBankrConnection(bankr);
    const agentId = await registerERC8004Identity(bankr, config);
    await launchToken(bankr, config, agentId);
    await configureX402(bankr, config);
    printNextSteps(config, agentId);
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
