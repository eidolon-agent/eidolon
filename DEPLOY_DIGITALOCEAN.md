# Deploying Eidolon to DigitalOcean App Platform

DigitalOcean App Platform provides always-on Docker containers with persistent storage and easy configuration.

## Prerequisites

- GitHub account (repo: https://github.com/eidolon-agent/eidolon)
- DigitalOcean account (https://cloud.digitalocean.com)
- Bankr API keys and wallet address configured in `.env`

---

## Step-by-Step

### 1. Prepare Docker Image (Optional: Build on DO)

DigitalOcean can build directly from GitHub using the Dockerfile. No need to push to registry.

### 2. Create New App in DigitalOcean

1. Go to **Apps** in DigitalOcean Control Panel
2. Click **"Create App"**
3. Choose **"GitHub"** as source
4. Select repository `eidolon-agent/eidolon`
5. Branch: `master` (or `main`)
6. Autodetect should find Dockerfile — ensure **Docker** is selected

### 3. Configure Build & Run

**Build Settings:**
- Builder: Docker
- Dockerfile path: `/Dockerfile`
- Build command: (leave blank)
- No extra build args needed

**Run Settings:**
- **Start Command:** `node dist/index.js`
- **HTTP Port:** `3000` (should be auto-detected)
- **Health Check:** `/health` (path)
- **Instance Size:** 
  - Free tier: 512 MB RAM, 1 vCPU (may be limited)
  - Basic: $5/mo (1 GB RAM) — recommended for reliability
- **Regions:** Choose closest to your users (e.g., NYC, SFO, AMS)

### 4. Add Environment Variables

In **"Environment Variables"** section, add all from your `.env`:

| Key | Value | Note |
|-----|-------|------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | |
| `BANKR_AGENT_API_KEY` | `bk_...` | from Bankr |
| `BANKR_LLM_API_KEY` | `bk_...` | from Bankr |
| `TREASURY_WALLET` | `0x...` | Safe or Bankr wallet |
| `NETWORK_RPC_URL` | `https://sepolia.base.org` | or mainnet |
| `AGENT_NAME` | `εἴδωλον` | or plain `Eidolon` |
| `AGENT_DESCRIPTION` | `Enabling fully autonomous economic agents...` | short |
| `OPERATOR_WALLET` | `0x...` | wallet for signing |
| `DATA_DIR` | `/data` | **Important** for persistence |
| `DEMO_MODE` | `false` (or `true` for demo) | |
| *(Optional)* `IDENTITY_REGISTRY` | `0x...` | if using ERC-8004 |
| *(Optional)* `REPUTATION_REGISTRY` | `0x...` | if using ERC-8004 |
| *(Optional)* `VALIDATION_REGISTRY` | `0x...` | if using ERC-8004 |

**Important:** `DATA_DIR=/data` — this is where the x402 ledger persists. DigitalOcean will mount a volume there.

### 5. Add Persistent Volume

1. Go to **"Settings"** → **"Volumes"**
2. Click **"Add Volume"**
3. Path: `/data`
4. Size: 1 GB (free tier includes 1 GB)
5. Attach to your app instance

This ensures the x402 credit ledger survives restarts and deploys.

### 6. Deploy

1. Click **"Deploy to Staging"** first
2. Wait for build (Docker build may take 5-10 min)
3. Check logs if it fails (common issues: typo in env vars)
4. Once staging is healthy (check `/health`), promote to production

### 7. Access Your Agent

- **Public URL:** Provided by DigitalOcean (e.g., `https://eidolon-agent-abc123.oscr.app`)
- **Dashboard:** `https://your-url/health` → click link to `/dashboard`
- **Test endpoints:**
  ```bash
  curl https://your-url/health
  curl -i -H "X-Client-ID: test" https://your-url/signals/price/ETH
  ```

### 8. Update Synthesis

If you want, set `deployedURL` in your Synthesis project to this public URL.

---

## Cost Estimate

| Resource | Cost |
|----------|------|
| App (Basic, 1 GB) | $5/mo |
| Volume (1 GB) | Free (included) |
| Outbound transfer (first 1 TB) | Free |
| **Total** | **$5/month** |

---

## Tips

- **Sleep behavior:** DO doesn't sleep containers by default. Good for always-on agent.
- **Logs:** Check in App → "Logs" tab for runtime errors.
- **Restarting:** Use "Restart" button in App dashboard.
- **Scaling:** You can add more instances (but not needed for demo).
- **Domain:** Add custom domain in Settings → Domains if you want.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails (`npm install` errors) | Check Node version compatibility; maybe need Node 20. Update Dockerfile `FROM node:20-alpine`. |
| `/health` returns 500 missing env var | Double-check env var names; Bankr keys must be correct. |
| Ledger resets on deploy | Ensure volume is mounted at `/data`. Check "Volumes" tab. |
| Agent crashes after start | Check logs; likely Bankr API auth failure. Ensure keys have access. |
| Cannot reach port 3000 | DigitalOcean auto-detects `PORT` env var; it's already set. Should work. |

---

*Ready to deploy. Just click a few buttons and your agent will be live! 🚀*
