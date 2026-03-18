# Deploying Eidolon to Railway

Railway is the recommended platform for always-on Docker containers with a simple free tier.

## Prerequisites

- GitHub account (repo already at https://github.com/eidolon-agent/eidolon)
- Railway account (sign up at https://railway.app)
- Bankr API keys and wallet address ready
- `.env` configuration filled

## Steps

1. **Log into Railway** and go to your dashboard.

2. **New Project** → "Deploy from GitHub repo"

3. **Select repository:** `eidolon-agent/eidolon`

4. **Configuration:**
   - Railway will auto-detect `Dockerfile`
   - Root directory: `/`
   - Build command: (auto-filled)
   - Start command: `node dist/index.js`
   - Health check path: `/health`
   - Environment:
     - `NODE_ENV=production`
     - `PORT=3000`
     - Plus all variables from your `.env`:
       - `BANKR_AGENT_API_KEY`
       - `BANKR_LLM_API_KEY`
       - `TREASURY_WALLET`
       - `IDENTITY_REGISTRY` (optional)
       - `REPUTATION_REGISTRY` (optional)
       - `VALIDATION_REGISTRY` (optional)
       - `OPERATOR_WALLET`
       - `AGENT_NAME`
       - `AGENT_DESCRIPTION`
       - `NETWORK_RPC_URL`
       - `DATA_DIR=/app/data`
       - `DEMO_MODE` (optional, set `true` for demo)
   - **Important:** Set `DATA_DIR=/app/data` for persistence.

5. **Deploy:**
   - Click "Deploy"
   - Railway will build the Docker image and start the container
   - Wait for build to complete

6. **Access:**
   - Railway will provide a public URL (e.g., `https://eidolon-agent.up.railway.app`)
   - Visit `/dashboard` for live stats
   - Test: `curl https://your-url.up.railway.app/health`

7. **Persistent storage:**
   - The `data/` directory persists across restarts (Railway mounts a volume automatically if you add a volume plugin; otherwise ledger will not persist. For demo, it's fine. For production, add a Railway Volume plugin to `/app/data`.)

## Notes

- Free tier includes $5/month credit; a small container (~100MB) fits comfortably.
- The agent runs continuously. If you enable "Sleep on idle", it will pause after 15min of no requests — disable sleep for always-on.
- Domain: use Railway's subdomain or add a custom domain.

## Troubleshooting

- If build fails, check Dockerfile syntax and dependencies.
- If `/health` returns 500, check logs in Railway for errors about missing env vars.
- Ledger persistence: without volume, data resets on redeploy. Add volume for production.

---

**After deployment**, update your Synthesis project with the public URL as `deployedURL`.

---

*Happy autonomous agenting! 🚀*
