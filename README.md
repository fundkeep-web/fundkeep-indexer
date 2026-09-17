# fundkeep-indexer

Indexes events from the [fundkeep-contract](https://github.com/Michealshodipo56/fundkeep-contract) Soroban contract into SQLite, and serves them over a small REST API for [fundkeep-app](https://github.com/Michealshodipo56/fundkeep-app)'s dashboard and activity feed.

This is the read side of the topology: the frontend writes directly to the chain via RPC (see `@fundkeep/sdk`), and reads goal/activity history from here instead of re-deriving it from raw events client-side.

## How it works

A poller calls the Soroban RPC's `getEvents` on an interval, starting from a saved cursor (or a recent ledger window on first run), decodes the four event types `fundkeep-contract` publishes (`goal_created`, `deposit`, `unlock`, `withdraw`), and upserts them into two SQLite tables: `goals` (current state per goal) and `activity` (an append-only log). A small Express API reads from those tables.

## Requirements

- Node.js v22.12+

## Setup

```bash
npm install
cp .env.example .env   # fill in CONTRACT_ID at minimum
npm run dev
```

## API

| Endpoint | Description |
|---|---|
| `GET /health` | `{ ok, lastLedger }` |
| `GET /api/goals/:owner` | All indexed goals for a Stellar address |
| `GET /api/activity/:owner?limit=100` | Activity log for a Stellar address, newest first |

## Environment Variables

See [`.env.example`](.env.example). `CONTRACT_ID` is the only required one; everything else has a sane default for testnet.

## Scripts

```bash
npm run dev        # tsx watch mode
npm run build       # compile to dist/
npm start            # run the compiled build
npm test              # vitest
npm run typecheck      # tsc --noEmit
```

## Deploying to Render

The indexer runs as a background web service on [Render](https://render.com). Because SQLite stores both historical event state and the latest synced ledger cursor, a **Persistent Disk** is recommended to preserve data between deploys and container restarts.

### 1. Web Service Setup
- **Environment**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

### 2. Required Environment Variables
Configure the following in the Render Dashboard under **Environment**:

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `CONTRACT_ID` | **Required**. Address of deployed FundKeep contract on Soroban | `CDLZFC3SYJYDVR72W5SCVNVV45XMCHZDBNDVLYZ2G7SFKNEPFBYSYTRU` |
| `RPC_URL` | Soroban RPC endpoint for Stellar Testnet | `https://soroban-testnet.stellar.org` |
| `NETWORK_PASSPHRASE` | Stellar Network Passphrase | `Test SDF Network ; September 2015` |
| `PORT` | HTTP port exposed by Render | `4000` (or leave default assigned by Render) |
| `DB_PATH` | Path to SQLite database file | `/var/data/fundkeep.db` (mount point of disk) |
| `POLL_INTERVAL_MS` | Polling frequency in milliseconds | `5000` |
| `EVENTS_BACKFILL_LEDGERS` | Ledger range to scan backwards on first sync | `1000` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `https://your-fundkeep-app.vercel.app,http://localhost:3000` |

### 3. Persistent Disk Configuration
1. In your Render Web Service settings, navigate to **Disks** -> **Add Disk**.
2. **Name**: `fundkeep-data`
3. **Mount Path**: `/var/data`
4. **Size**: `1 GB` (sufficient for hundreds of thousands of events).
5. Set `DB_PATH=/var/data/fundkeep.db` in your environment variables.

### 4. Post-Deploy Verification & Health Check
Verify the service has started and connected to the Stellar network:

```bash
# Verify health and syncing status
curl -i https://<your-render-app>.onrender.com/health

# Expected response (HTTP 200):
# {"ok":true,"lastLedger":1234567}
```

### 5. Wiring into the Frontend (`fundkeep-app`)
Once your indexer is live on Render, copy its public URL and update your frontend environment:
1. In `fundkeep-app/.env.local` (and in Vercel / Netlify environment settings):
   ```env
   NEXT_PUBLIC_INDEXER_URL=https://<your-render-app>.onrender.com
   ```
2. Re-deploy the frontend application. The dashboard and activity feed will now read events and goal states directly from your Render indexer.
