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
npm run dev           # tsx watch mode
npm run build         # compile to dist/
npm start             # run the compiled build
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run keeper        # run automatic deadline unlock keeper daemon
npm run keeper:once   # run keeper in one-shot execution mode
```

## Keeper Bot (Automated Deadline Unlocks)

The indexer includes an automated keeper script at `scripts/keeper.ts` that monitors goals for expired deadlines and triggers `check_deadline` on-chain:

1. Configure `KEEPER_SECRET_KEY` in your `.env` (a funded Stellar account secret key on Testnet).
2. Start the keeper:
   ```bash
   npm run keeper
   ```
   Or run on a cron job or container schedule with:
   ```bash
   npm run keeper:once
   ```
3. If `KEEPER_SECRET_KEY` is omitted, the script runs in safe **dry-run** inspection mode, identifying overdue goals without submitting on-chain transactions.

## Deploying

Runs as a normal long-running Node service (e.g. Render): build command `npm install && npm run build`, start command `npm start`. Point `DB_PATH` at a persistent disk if the platform doesn't give you one by default — otherwise the SQLite file (and the indexer's sync cursor) resets on every deploy.
