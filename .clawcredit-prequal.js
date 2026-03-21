const { ClawCredit } = require('@t54-labs/clawcredit-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function submitPrequalification() {
  // Load credentials from the specified path
  const credPath = path.join(os.homedir(), '.openclaw', 'agents', 'default', 'agent', 'clawcredit.json');

  try {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

    // Initialize ClawCredit client with existing token
    const credit = new ClawCredit({
      agentName: "main",
      apiToken: creds.apiToken
    });

    // Set OpenClaw context from credentials (auto-discovery should work, but we set explicitly)
    if (creds.openclawContext) {
      credit.setOpenClawContext(creds.openclawContext);
    }

    // Submit pre-qualification context
    const result = await credit.submitPrequalificationContext({
      runtimeEnv: 'node-v22'
    });

    // Minimal output for cron logging
    console.log(JSON.stringify({
      status: 'success',
      prequalification_status: result.prequalification_status,
      credit_issued: result.credit_issued,
      credit_limit: result.credit_limit,
      message: result.message
    }));

  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      message: error.message,
      stack: error.stack
    }));
    process.exit(1);
  }
}

submitPrequalification();
