import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

export interface GoalRow {
  goal_id: number;
  owner: string;
  token: string;
  target_amount: string;
  current_amount: string;
  deadline: number;
  unlocked: number;
  withdrawn: number;
  created_at_ledger: number;
  updated_at_ledger: number;
}

export type ActivityType = "create" | "deposit" | "unlock" | "withdraw";

export interface ActivityRow {
  id: number;
  goal_id: number;
  owner: string;
  type: ActivityType;
  amount: string | null;
  ledger: number;
  tx_hash: string | null;
  created_at: string;
}

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 3000");

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    goal_id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    token TEXT NOT NULL,
    target_amount TEXT NOT NULL,
    current_amount TEXT NOT NULL,
    deadline INTEGER NOT NULL,
    unlocked INTEGER NOT NULL DEFAULT 0,
    withdrawn INTEGER NOT NULL DEFAULT 0,
    created_at_ledger INTEGER NOT NULL,
    updated_at_ledger INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner);

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    owner TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('create','deposit','unlock','withdraw')),
    amount TEXT,
    ledger INTEGER NOT NULL,
    tx_hash TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_activity_owner ON activity(owner, id DESC);

  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cursor TEXT,
    last_ledger INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO sync_state (id, cursor, last_ledger) VALUES (1, NULL, 0);
`);

export function getSyncState(): { cursor: string | null; lastLedger: number } {
  const row = db
    .prepare("SELECT cursor, last_ledger AS lastLedger FROM sync_state WHERE id = 1")
    .get() as { cursor: string | null; lastLedger: number };
  return row;
}

export function setSyncState(cursor: string | null, lastLedger: number): void {
  db.prepare("UPDATE sync_state SET cursor = ?, last_ledger = ? WHERE id = 1").run(
    cursor,
    lastLedger
  );
}

export function insertGoal(goal: {
  goalId: number;
  owner: string;
  token: string;
  targetAmount: bigint;
  deadline: bigint;
  ledger: number;
}): void {
  db.prepare(
    `INSERT INTO goals
       (goal_id, owner, token, target_amount, current_amount, deadline, unlocked, withdrawn, created_at_ledger, updated_at_ledger)
     VALUES (?, ?, ?, ?, '0', ?, 0, 0, ?, ?)
     ON CONFLICT(goal_id) DO NOTHING`
  ).run(
    goal.goalId,
    goal.owner,
    goal.token,
    goal.targetAmount.toString(),
    Number(goal.deadline),
    goal.ledger,
    goal.ledger
  );
}

export function applyDeposit(params: {
  goalId: number;
  currentAmount: bigint;
  unlocked: boolean;
  ledger: number;
}): void {
  db.prepare(
    `UPDATE goals SET current_amount = ?, unlocked = ?, updated_at_ledger = ?
     WHERE goal_id = ?`
  ).run(
    params.currentAmount.toString(),
    params.unlocked ? 1 : 0,
    params.ledger,
    params.goalId
  );
}

export function applyUnlock(params: { goalId: number; ledger: number }): void {
  db.prepare(
    `UPDATE goals SET unlocked = 1, updated_at_ledger = ? WHERE goal_id = ?`
  ).run(params.ledger, params.goalId);
}

export function applyWithdrawal(params: { goalId: number; ledger: number }): void {
  db.prepare(
    `UPDATE goals SET current_amount = '0', withdrawn = 1, updated_at_ledger = ? WHERE goal_id = ?`
  ).run(params.ledger, params.goalId);
}

export function getGoal(goalId: number): GoalRow | undefined {
  return db.prepare("SELECT * FROM goals WHERE goal_id = ?").get(goalId) as
    | GoalRow
    | undefined;
}

export function getGoalsByOwner(owner: string): GoalRow[] {
  return db
    .prepare("SELECT * FROM goals WHERE owner = ? ORDER BY goal_id ASC")
    .all(owner) as GoalRow[];
}

export function insertActivity(entry: {
  goalId: number;
  owner: string;
  type: ActivityType;
  amount: bigint | null;
  ledger: number;
  txHash: string | null;
}): void {
  db.prepare(
    `INSERT INTO activity (goal_id, owner, type, amount, ledger, tx_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.goalId,
    entry.owner,
    entry.type,
    entry.amount !== null ? entry.amount.toString() : null,
    entry.ledger,
    entry.txHash,
    new Date().toISOString()
  );
}

export function getActivityByOwner(owner: string, limit = 100): ActivityRow[] {
  return db
    .prepare(
      "SELECT * FROM activity WHERE owner = ? ORDER BY id DESC LIMIT ?"
    )
    .all(owner, limit) as ActivityRow[];
}
