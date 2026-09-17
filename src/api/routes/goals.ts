import express, { Router } from "express";
import {
  getGoalByOwnerAndId,
  getGoalMetadata,
  getGoalsByOwner,
  setGoalMetadata,
  type GoalRow,
} from "../../db.js";

export const goalsRouter = Router();
goalsRouter.use(express.json());

function serializeGoal(row: GoalRow) {
  const status = row.withdrawn ? "WITHDRAWN" : row.unlocked ? "UNLOCKED" : "LOCKED";
  const meta = getGoalMetadata(row.owner, row.goal_id);
  return {
    goalId: row.goal_id,
    owner: row.owner,
    token: row.token,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    status,
    title: meta?.title ?? null,
    category: meta?.category ?? null,
    createdAtLedger: row.created_at_ledger,
    updatedAtLedger: row.updated_at_ledger,
  };
}

goalsRouter.get("/goals/:owner", (req, res) => {
  const goals = getGoalsByOwner(req.params.owner).map(serializeGoal);
  res.json({ goals });
});

goalsRouter.get("/goals/:owner/:goalId", (req, res) => {
  const goalId = Number(req.params.goalId);
  if (isNaN(goalId)) {
    return res.status(404).json({ error: "Goal not found" });
  }

  const goal = getGoalByOwnerAndId(req.params.owner, goalId);
  if (!goal) {
    return res.status(404).json({ error: "Goal not found" });
  }

  res.json(serializeGoal(goal));
});

goalsRouter.post("/goals/:owner/:goalId/metadata", (req, res) => {
  const goalId = Number(req.params.goalId);
  if (isNaN(goalId)) {
    return res.status(400).json({ error: "Invalid goalId" });
  }

  const { title, category } = (req.body || {}) as {
    title?: string;
    category?: string;
  };

  setGoalMetadata({
    goalId,
    owner: req.params.owner,
    title: typeof title === "string" ? title.trim() : null,
    category: typeof category === "string" ? category.trim() : null,
  });

  res.json({
    ok: true,
    goalId,
    owner: req.params.owner,
    title: typeof title === "string" ? title.trim() : null,
    category: typeof category === "string" ? category.trim() : null,
  });
});
