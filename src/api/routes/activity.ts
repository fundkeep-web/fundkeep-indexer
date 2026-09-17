import { Router } from "express";
import {
  getActivityByOwner,
  getActivityCountByOwner,
  type ActivityRow,
} from "../../db.js";

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
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);

  const limit = Math.min(
    Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 100,
    500
  );
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const total = getActivityCountByOwner(owner);
  const activity = getActivityByOwner(owner, limit, offset).map(
    serializeActivity
  );
  const hasMore = offset + activity.length < total;

  res.json({
    activity,
    total,
    hasMore,
  });
});
