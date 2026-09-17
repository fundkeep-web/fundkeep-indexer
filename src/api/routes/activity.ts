import { Router } from "express";
import { StrKey } from "@stellar/stellar-sdk";
import { getActivityByOwner, type ActivityRow } from "../../db.js";

export const activityRouter = Router();

function serializeActivity(row: ActivityRow) {
  return {
    id: row.id,
    goalId: row.goal_id,
    owner: row.owner,
    type: row.type,
    amount: row.amount,
    ledger: row.ledger,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  };
}

activityRouter.get("/activity/:owner", (req, res) => {
  const owner = req.params.owner;
  if (!owner || !StrKey.isValidEd25519PublicKey(owner)) {
    return res.status(400).json({ error: "Invalid owner address" });
  }

  let limit = 100;
  if (req.query.limit !== undefined) {
    const rawLimit = Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
      return res.status(400).json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    limit = Math.min(rawLimit, 500);
  }

  const activity = getActivityByOwner(owner, limit).map(serializeActivity);
  res.json({ activity });
});
