import { Router } from "express";
import { getSyncState } from "../../db.js";
import { rpcServer } from "../../rpc.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const { lastLedger: lastIndexedLedger } = getSyncState();
  let currentLedger = lastIndexedLedger;

  try {
    const latest = await rpcServer.getLatestLedger();
    currentLedger = latest.sequence;
  } catch {
    // If RPC call fails, fallback to lastIndexedLedger
  }

  const lagLedgers = Math.max(0, currentLedger - lastIndexedLedger);
  const status = lagLedgers > 100 ? "degraded" : "ok";

  res.json({
    status,
    lastIndexedLedger,
    currentLedger,
    lagLedgers,
  });
});

