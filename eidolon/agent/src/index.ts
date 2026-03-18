import dotenv from 'dotenv';
import { EidolonOrchestrator } from './orchestrator/EidolonOrchestrator';
import { EidolonConfig } from './orchestrator/EidolonOrchestrator';
import winston from 'winston';

dotenv.config();

// Basic logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

function validateConfig(): EidolonConfig {
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
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Build capabilities array from env (comma-separated) or default
  const capabilitiesStr = process.env.AGENT_CAPABILITIES || 'trading,token-launch,research,x402,erc8004';
  const capabilities = capabilitiesStr.split(',').map(s => s.trim());

  return {
    bankr: {
      llmApiKey: process.env.BANKR_LLM_API_KEY!,
      agentApiKey: process.env.BANKR_AGENT_API_KEY!,
    },
    treasury: {
      walletAddress: process.env.TREASURY_WALLET!,
      autoRefillThreshold: parseInt(process.env.AUTO_REFILL_THRESHOLD || '10'),
      autoRefillAmount: parseFloat(process.env.AUTO_REFILL_AMOUNT || '25'),
      minUSDCBalance: parseFloat(process.env.MIN_USDC_BALANCE || '5'),
    },
    erc8004: {
      identityRegistry: process.env.IDENTITY_REGISTRY!,
      reputationRegistry: process.env.REPUTATION_REGISTRY!,
      validationRegistry: process.env.VALIDATION_REGISTRY!,
      operatorWallet: process.env.OPERATOR_WALLET!,
      agentId: process.env.AGENT_ID,
    },
    x402: {
      port: parseInt(process.env.PORT || '3000'),
      paymentAddress: process.env.X402_PAYMENT_ADDRESS || process.env.TREASURY_WALLET!,
      pricing: {
        '/signals/price/:token': {
          priceUSD: parseFloat(process.env.PRICE_SIGNAL_PRICE || '1'),
          description: 'Price signal for a token',
        },
        '/reports/daily': {
          priceUSD: parseFloat(process.env.DAILY_REPORT_PRICE || '5'),
          description: 'Daily on-chain analytics report',
        },
        '/copilot/chat': {
          priceUSD: parseFloat(process.env.COPILOT_CHAT_PRICE || '0.10'),
          description: 'Per-message copilot assistance',
        },
      },
      maxDebt: parseFloat(process.env.MAX_DEBT || '50'),
    },
    network: {
      rpcUrl: process.env.NETWORK_RPC_URL!,
      chainId: parseInt(process.env.CHAIN_ID || '8453'), // Base Mainnet; sepolia is 84532
    },
    agent: {
      name: process.env.AGENT_NAME!,
      description: process.env.AGENT_DESCRIPTION!,
      capabilities,
      llmModel: process.env.AGENT_LLM_MODEL || 'claude-sonnet-4-6',
    },
  };
}

async function main() {
  logger.info('Starting Eidolon Autonomous Agent');
  let orchestrator: EidolonOrchestrator | null = null;

  try {
    const config = validateConfig();
    logger.info('Configuration validated');

    orchestrator = new EidolonOrchestrator(config);

    // Attach logger to orchestrator events
    orchestrator.on('log', (msg: string) => logger.info(msg.replace(/\[Eidolon\]\s?/, '')));
    orchestrator.on('alert', (msg: string) => logger.warn(msg));
    orchestrator.on('error', (msg: string) => logger.error(msg));
    orchestrator.on('trade', (data: any) => logger.info(`Trade: ${JSON.stringify(data)}`));
    orchestrator.on('payment', (data: any) => logger.info(`Payment received from ${data.clientId}: $${data.amount}`));
    orchestrator.on('launched', (data: any) => logger.info(`Token launched: ${data.symbol} at ${data.address}`));

    // Start the system
    await orchestrator.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      if (orchestrator) {
        orchestrator.stop();
      }
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      logger.info('Termination signal received');
      if (orchestrator) {
        orchestrator.stop();
      }
      process.exit(0);
    });

    logger.info('Eidolon is now running');
  } catch (error: any) {
    logger.error(`Failed to start: ${error.message}`);
    process.exit(1);
  }
}

main();
