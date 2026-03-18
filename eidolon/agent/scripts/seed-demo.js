#!/usr/bin/env node

/**
 * Demo mode seeder for Eidolon x402 server.
 * Credits a demo client with initial balance to showcase the dashboard.
 *
 * Usage:
 *   DEMO_MODE=true npm start   (auto-seeds on startup)
 *   OR
 *   node scripts/seed-demo.js  (manual)
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.DEMO_CLIENT_ID || 'demo-user';
const AMOUNT = parseFloat(process.env.DEMO_AMOUNT) || 10;

async function seed() {
  console.log(`[Demo] Seeding client "${CLIENT_ID}" with ${AMOUNT} USDC...`);
  const res = await fetch(`${BASE_URL}/webhook/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, amount: AMOUNT }),
  });
  if (res.ok) {
    const data = await res.json();
    console.log('[Demo] Seeded successfully:', data);
  } else {
    console.error('[Demo] Failed:', res.status, await res.text());
  }
}

seed();
