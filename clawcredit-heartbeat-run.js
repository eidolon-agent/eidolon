const fs = require('fs');
const path = require('path');
const os = require('os');

// Set NODE_PATH to include the eidolon/agent node_modules
process.env.NODE_PATH = path.join(os.homedir(), '.openclaw', 'workspace', 'eidolon', 'agent', 'node_modules');
require('module').Module._initPaths();

// Load ClawCredit credentials
const credPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'clawcredit.json');
const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

// Import the SDK
const { ClawCredit } = require('@t54-labs/clawcredit-sdk');

// Create client
const credit = new ClawCredit({
  agentName: "eidolon",
  apiToken: creds.apiToken
});

// Set OpenClaw context from credentials
credit.setOpenClawContext(creds.openclawContext);

// Helper to read memory timestamp
function getLastTimestamp(name) {
  try {
    // Check MEMORY.md first (in workspace root)
    const memoryPath = path.join(os.homedir(), '.openclaw', 'workspace', 'MEMORY.md');
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf-8');
      const regex = new RegExp(`${name}:\\s*(.+)$`, 'm');
      const match = content.match(regex);
      if (match) {
        return new Date(match[1].trim()).getTime();
      }
    }
    // Check today's memory file
    const today = new Date().toISOString().split('T')[0];
    const dailyPath = path.join(os.homedir(), '.openclaw', 'workspace', 'memory', `${today}.md`);
    if (fs.existsSync(dailyPath)) {
      const content = fs.readFileSync(dailyPath, 'utf-8');
      const regex = new RegExp(`${name}:\\s*(.+)$`, 'm');
      const match = content.match(regex);
      if (match) {
        return new Date(match[1].trim()).getTime();
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper to persist timestamp
function persistTimestamp(name, date) {
  const iso = date.toISOString();
  const entry = `\n${name}: ${iso}`;
  const today = new Date().toISOString().split('T')[0];
  const dailyPath = path.join(os.homedir(), '.openclaw', 'workspace', 'memory', `${today}.md`);

  try {
    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
      fs.writeFileSync(dailyPath, `# Memory - ${today}\n`);
    }
    fs.appendFileSync(dailyPath, entry);
    console.log(`Persisted ${name} to daily memory: ${dailyPath}`);
  } catch (e) {
    console.error(`Failed to persist ${name}:`, e.message);
  }
}

async function runHeartbeatChecks() {
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  const twentyFourHours = 24 * 60 * 60 * 1000;

  // Check pre-qualification (every 6 hours)
  const lastPrequal = getLastTimestamp('lastClawCreditPrequalCheck');
  if (!lastPrequal || (now - lastPrequal) >= sixHours) {
    console.log('Running ClawCredit pre-qualification check...');
    try {
      const result = await credit.submitPrequalificationContext({
        runtimeEnv: "node-v22"
      });
      console.log('Pre-qualification status:', result.prequalification_status);
      console.log('Credit issued:', result.credit_issued);
      if (result.prequalification_status === 'approved') {
        console.log('Pre-qualification approved! Credit limit:', result.credit_limit);
      }
      persistTimestamp('lastClawCreditPrequalCheck', new Date());
    } catch (error) {
      console.error('Pre-qualification check error:', error.message);
    }
  } else {
    const remaining = Math.round((sixHours - (now - lastPrequal)) / (60 * 60 * 1000));
    console.log(`Pre-qualification check not due (${remaining}h remaining)`);
  }

  // Check repayment + promotions (every 24 hours)
  const lastRepayment = getLastTimestamp('lastClawCreditRepaymentCheck');
  if (!lastRepayment || (now - lastRepayment) >= twentyFourHours) {
    console.log('Running ClawCredit repayment check...');
    try {
      const urgencyInfo = await credit.getRepaymentUrgency();
      console.log('Repayment urgency:', urgencyInfo.urgency);
      console.log('Amount due:', urgencyInfo.amount_due);
      console.log('Should notify:', urgencyInfo.should_notify);

      if (urgencyInfo.should_notify) {
        const dashboard = await credit.getDashboardLink();
        const message = `${urgencyInfo.message} Dashboard: ${dashboard.url}`;
        console.log('[NOTIFICATION]', message);
        // In a real heartbeat, this would be sent to the user
      }

      if (urgencyInfo.promotions && urgencyInfo.promotions.length > 0) {
        console.log('Promotions found:', urgencyInfo.promotions.length);
        urgencyInfo.promotions.forEach(promo => {
          console.log(`- [${promo.promotion_type}] ${promo.title}`);
        });
      }

      persistTimestamp('lastClawCreditRepaymentCheck', new Date());
    } catch (error) {
      console.error('Repayment check error:', error.message);
    }
  } else {
    const remaining = Math.round((twentyFourHours - (now - lastRepayment)) / (60 * 60 * 1000));
    console.log(`Repayment check not due (${remaining}h remaining)`);
  }
}

runHeartbeatChecks().catch(console.error);
