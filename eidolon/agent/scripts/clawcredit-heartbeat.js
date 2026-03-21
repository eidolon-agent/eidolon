#!/usr/bin/env node
/**
 * ClawCredit Heartbeat Check (Pre-Qualification + Repayment)
 * Called from HEARTBEAT.md
 */

const { ClawCredit } = require('@t54-labs/clawcredit-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

const credPath = path.join(
  os.homedir(),
  '.openclaw',
  'agents',
  'main',
  'agent',
  'clawcredit.json'
);

// Timestamps stored in memory file
const memoryPath = path.join('/root/.openclaw/workspace/memory', '2026-03-21.md');
let memoryContent = '';
try {
  if (fs.existsSync(memoryPath)) {
    memoryContent = fs.readFileSync(memoryPath, 'utf-8');
  }
} catch {}

function loadTimestamp(key) {
  const match = memoryContent.match(new RegExp(`${key}:(.*)`));
  if (match) {
    return new Date(match[1].trim()).getTime();
  }
  return 0;
}

function saveTimestamp(key, isoString) {
  const nowStr = `${key}: ${isoString}\n`;
  // Prepend to memory file for today
  try {
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf-8');
      fs.writeFileSync(memoryPath, nowStr + content);
    } else {
      fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
      fs.writeFileSync(memoryPath, nowStr);
    }
  } catch (err) {
    console.error('Failed to save timestamp:', err.message);
  }
}

// Load credentials
if (!fs.existsSync(credPath)) {
  console.error('[ClawCredit] Credentials not found at', credPath);
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
const credit = new ClawCredit({
  agentName: 'Eidolon',
  apiToken: creds.apiToken,
});

// Configure context (needed for pre-qualification)
credit.setOpenClawContext({
  stateDir: '/root/.openclaw',
  agentId: 'main',
  workspaceDir: '/root/.openclaw/workspace',
  transcriptDirs: [
    '/root/.openclaw/agents/main/sessions',
    '/root/.openclaw/agents/main/agent/sessions'
  ],
  promptDirs: [
    '/root/.openclaw/workspace',
    '/root/.openclaw/agents/main/agent'
  ]
});

async function runChecks() {
  const now = new Date();
  const nowISO = now.toISOString();
  const sixHours = 6 * 60 * 60 * 1000;
  const twentyFourHours = 24 * 60 * 60 * 1000;

  // Check pre-qualification (every 6 hours)
  const lastPrequal = loadTimestamp('lastClawCreditPrequalCheck');
  if (now.getTime() - lastPrequal >= sixHours) {
    console.log('[ClawCredit] Running pre-qualification check...');
    try {
      const result = await credit.submitPrequalificationContext({
        runtimeEnv: 'node-v22'
      });
      console.log('Status:', result.prequalification_status);
      console.log('Credit Issued:', result.credit_issued);
      console.log('Limit:', result.credit_limit ? `$${result.credit_limit}` : 'N/A');
      console.log('Message:', result.message);

      if (result.prequalification_status === 'approved') {
        console.log('[+] Pre-qualification approved!');
        // Do NOT remove the heartbeat entry here — let the orchestrator decide when to remove
      }

      saveTimestamp('lastClawCreditPrequalCheck', nowISO);
    } catch (error) {
      console.error('Pre-qualification check failed:', error.message);
    }
  } else {
    console.log('[.] Pre-qualification check not due yet (last:', new Date(lastPrequal).toISOString() + ')');
  }

  // Check repayment (every 24 hours)
  const lastRepayment = loadTimestamp('lastClawCreditRepaymentCheck');
  if (now.getTime() - lastRepayment >= twentyFourHours) {
    console.log('[ClawCredit] Running repayment check...');
    try {
      const urgency = await credit.getRepaymentUrgency();
      console.log('Urgency:', urgency.urgency);
      console.log('Amount Due:', urgency.amount_due ? `$${urgency.amount_due}` : '$0');
      console.log('Days Until Due:', urgency.days_until_due);
      console.log('Should Notify:', urgency.should_notify);

      if (urgency.should_notify) {
        const dashboard = await credit.getDashboardLink();
        console.log('Dashboard:', dashboard.url);
        // Notify user (would be sent via OpenClaw messaging)
        console.log(`[NOTIFY] ${urgency.message} Dashboard: ${dashboard.url}`);
      }

      // Process promotions
      if (urgency.promotions && urgency.promotions.length > 0) {
        console.log('Promotions:', urgency.promotions.map(p => `[${p.promotion_type}] ${p.title}`).join(', '));
      }

      saveTimestamp('lastClawCreditRepaymentCheck', nowISO);
    } catch (error) {
      console.error('Repayment check failed:', error.message);
    }
  } else {
    console.log('[.] Repayment check not due yet (last:', new Date(lastRepayment).toISOString() + ')');
  }
}

runChecks().then(() => {
  console.log('\n[ClawCredit] Heartbeat checks complete.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
})
