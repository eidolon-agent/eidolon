#!/usr/bin/env node

/**
 * Eidolon x402 Server Test
 *
 * Run this after starting the agent to verify endpoints.
 *
 * Usage:
 *   node scripts/test-x402.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_CLIENT_ID = 'eidolon-test-client';

async function request(method, path, headers = {}, body = null) {
  const url = new URL(path, BASE_URL);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: {
      ...headers,
      ...(body && { 'Content-Type': 'application/json' }),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testHealth() {
  console.log('\n🔍 Testing /health...');
  const res = await request('GET', '/health');
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Health check OK');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function testPriceSignal() {
  console.log('\n🔍 Testing /signals/price/ETH (should require payment)...');
  const res = await request('GET', '/signals/price/ETH', {
    'X-Client-ID': TEST_CLIENT_ID,
  });
  console.log(`   Status: ${res.status}`);
  console.log(`   X-402-Payment-Required: ${res.headers['x-402-payment-required']}`);
  console.log(`   X-402-Payment-Address: ${res.headers['x-402-payment-address']}`);
  if (res.status === 402) {
    console.log('   ✅ Payment required as expected');
    try {
      const json = JSON.parse(res.body);
      console.log(`   Body: ${JSON.stringify(json, null, 2)}`);
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 402, got ${res.status}`);
  }
}

async function testCreditWebhook() {
  console.log('\n🔍 Crediting test client $10 via /webhook/credit...');
  const res = await request('POST', '/webhook/credit', {}, {
    clientId: TEST_CLIENT_ID,
    amount: 10,
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Credit successful');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function testPriceSignalAfterCredit() {
  console.log('\n🔍 Testing /signals/price/ETH again (should succeed)...');
  const res = await request('GET', '/signals/price/ETH', {
    'X-Client-ID': TEST_CLIENT_ID,
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Signal delivered');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function testDailyReport() {
  console.log('\n🔍 Testing /reports/daily...');
  const res = await request('GET', '/reports/daily', {
    'X-Client-ID': TEST_CLIENT_ID,
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Report delivered');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function testCopilotChat() {
  console.log('\n🔍 Testing /copilot/chat...');
  const res = await request('POST', '/copilot/chat', {
    'X-Client-ID': TEST_CLIENT_ID,
  }, {
    message: 'Hello, Eidolon!',
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Chat response received');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function testTrustScoreUpdate() {
  console.log('\n🔍 Testing /admin/trust-score...');
  const res = await request('POST', '/admin/trust-score', {}, {
    score: 750,
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(res.body);
      console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      console.log('   ✅ Trust score updated');
    } catch (e) {
      console.log(`   Body: ${res.body}`);
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
  }
}

async function main() {
  console.log('━'.repeat(50));
  console.log(' Eidolon x402 Server Test Suite');
  console.log(` Base URL: ${BASE_URL}`);
  console.log('━'.repeat(50));

  try {
    await testHealth();
    await testPriceSignal();
    await testCreditWebhook();
    await testPriceSignalAfterCredit();
    await testDailyReport();
    await testCopilotChat();
    await testTrustScoreUpdate();

    console.log('\n' + '━'.repeat(50));
    console.log(' All tests completed');
    console.log('━'.repeat(50));
  } catch (err) {
    console.error('\n❌ Test suite failed:', err.message);
    process.exit(1);
  }
}

main();
