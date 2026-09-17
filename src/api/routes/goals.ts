import { Router } from "express";
import { StrKey } from "@stellar/stellar-sdk";
import { getGoalsByOwner, type GoalRow } from "../../db.js";

export const goalsRouter = Router();

function serializeGoal(row: GoalRow) {
  const status = row.withdrawn ? "WITHDRAWN" : row.unlocked ? "UNLOCKED" : "LOCKED";
  return {
    goalId: row.goal_id,
    owner: row.owner,
    token: row.token,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    status,
    createdAtLedger: row.created_at_ledger,
    updatedAtLedger: row.updated_at_ledger,
  };
}

goalsRouter.get("/goals/:owner", (req, res) => {
  const owner = req.params.owner;
  if (!owner || !StrKey.isValidEd25519PublicKey(owner)) {
    return res.status(400).json({ error: "Invalid owner address" });
  }
  const goals = getGoalsByOwner(owner).map(serializeGoal);
  res.json({ goals });
});
