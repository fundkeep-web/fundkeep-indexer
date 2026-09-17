import "dotenv/config";
import { Networks } from "@stellar/stellar-sdk";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  contractId: required("CONTRACT_ID"),
  rpcUrl: process.env.RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET,
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? "./data/fundkeep.db",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  eventsBackfillLedgers: Number(process.env.EVENTS_BACKFILL_LEDGERS ?? 1000),
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ],
};
