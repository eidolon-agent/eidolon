#!/usr/bin/env node
/**
 * ClawCredit Registration for Eidolon
 * Invite code: CLAW-TWDU-7ZRF
 */

import { ClawCredit } from '@t54-labs/clawcredit-sdk';
import * as os from 'os';
import * as path from 'path';

const credPath = path.join(
  os.homedir(),
  '.openclaw',
  'agents',
  'default',
  'agent',
  'clawcredit.json'
);

// Try to reuse existing credentials if available
let existingApiToken: string | undefined;
try {
  if (await (await import('fs')).promises.access(credPath, import('fs').constants.R_OK) === 0) {
    const creds = JSON.parse(await (await import('fs')).promises.readFile(credPath, 'utf-8'));
    existingApiToken = creds.apiToken;
    console.log('[+] Found existing credentials, will reuse token from:', credPath);
  }
} catch {}

// Initialize
const credit = new ClawCredit({
  agentName: 'Eidolon',
  apiToken: existingApiToken, // reuse if available
});

// Configure OpenClaw context explicitly (works even if auto-discovery fails)
credit.setOpenClawContext({
  stateDir: '/root/.openclaw', // default OpenClaw state dir
  agentId: 'default',
  workspaceDir: '/root/.openclaw/workspace',
  transcriptDirs: [
    '/root/.openclaw/agents/default/sessions',
    '/root/.openclaw/agents/default/agent/sessions'
  ],
  promptDirs: [
    '/root/.openclaw/workspace',
    '/root/.openclaw/agents/default/agent'
  ]
});

// Register (or check status if already registered)
console.log('[ClawCredit] Registering with invite code: CLAW-TWDU-7ZRF');

try {
  const result = await credit.register({
    inviteCode: 'CLAW-TWDU-7ZRF',
    runtimeEnv: `node-v${process.version.slice(1)}`,
    model: 'gemini-2.5-flash' // matches our Bankr LLM Gateway default
  });

  console.log('\n=== Registration Result ===');
  console.log('Agent ID:', result.agent_id);
  console.log('Status:', result.prequalification_status);
  console.log('Credit Issued:', result.credit_issued);
  console.log('Credit Limit:', result.credit_limit ? `$${result.credit_limit}` : 'N/A');
  console.log('Message:', result.message);
  console.log('Cron Status:', result.cron_status);

  if (result.cron_jobs_to_create && result.cron_jobs_to_create.length > 0) {
    console.log('\n[!] Action needed: create the following cron jobs:');
    for (const job of result.cron_jobs_to_create) {
      console.log(`- ${job.name}: ${job.tool} ${JSON.stringify(job.params)}`);
    }
  }

  // Check pre-qualification status separately
  const status = await credit.getPrequalificationStatus();
  console.log('\n=== Pre-Qualification Status ===');
  console.log('Status:', status.prequalification_status);
  console.log('Credit:', status.credit_issued ? 'Issued' : 'Not yet');
  console.log('Balance:', status.credit_limit_usd ? `$${status.credit_limit_usd}` : '0');

  console.log('\n[+] Credentials saved to:', credPath);
  console.log('\nNext steps:');
  console.log('- Add ClawCredit heartbeat checks to HEARTBEAT.md if not auto-added');
  console.log('- Monitor pre-qualification status (check every 6 hours)');
  console.log('- Once approved, you can use credit to pay x402 endpoints');

} catch (error: any) {
  console.error('Registration failed:', error.message);
  if (error.response?.data) {
    console.error('Details:', error.response.data);
  }
  process.exit(1);
}
