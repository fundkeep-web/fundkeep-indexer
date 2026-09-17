import { beforeEach, describe, expect, it } from "vitest";
import {
  applyDeposit,
  applyUnlock,
  applyWithdrawal,
  db,
  getActivityByOwner,
  getGoal,
  getGoalsByOwner,
  getOverdueLockedGoals,
  getSyncState,
  insertActivity,
  insertGoal,
  setSyncState,
} from "../src/db.js";

const OWNER = "GOWNER00000000000000000000000000000000000000000000000";
const TOKEN = "CTOKEN000000000000000000000000000000000000000000000000";

beforeEach(() => {
  db.exec("DELETE FROM goals; DELETE FROM activity;");
  setSyncState(null, 0);
});

describe("goals", () => {
  it("inserts and reads back a goal", () => {
    insertGoal({
      goalId: 0,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_800_000_000n,
      ledger: 10,
    });

    const goal = getGoal(0);
    expect(goal).toMatchObject({
      goal_id: 0,
      owner: OWNER,
      token: TOKEN,
      target_amount: "100000000",
      current_amount: "0",
      deadline: 1_800_000_000,
      unlocked: 0,
      withdrawn: 0,
    });
  });

  it("does not overwrite an existing goal on a duplicate insert", () => {
    insertGoal({
      goalId: 0,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_800_000_000n,
      ledger: 10,
    });
    insertGoal({
      goalId: 0,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 999n,
      deadline: 1n,
      ledger: 99,
    });

    expect(getGoal(0)?.target_amount).toBe("100000000");
  });

  it("applyDeposit updates current_amount and unlocked", () => {
    insertGoal({
      goalId: 1,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_800_000_000n,
      ledger: 10,
    });

    applyDeposit({
      goalId: 1,
      currentAmount: 100_000_000n,
      unlocked: true,
      ledger: 11,
    });

    const goal = getGoal(1);
    expect(goal?.current_amount).toBe("100000000");
    expect(goal?.unlocked).toBe(1);
  });

  it("applyUnlock and applyWithdrawal flip the right flags", () => {
    insertGoal({
      goalId: 2,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_800_000_000n,
      ledger: 10,
    });

    applyUnlock({ goalId: 2, ledger: 12 });
    expect(getGoal(2)?.unlocked).toBe(1);

    applyWithdrawal({ goalId: 2, ledger: 13 });
    const goal = getGoal(2);
    expect(goal?.withdrawn).toBe(1);
    expect(goal?.current_amount).toBe("0");
  });

  it("filters overdue locked goals correctly", () => {
    // Goal 1: Overdue & Locked (should match)
    insertGoal({
      goalId: 1,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_000n,
      ledger: 10,
    });

    // Goal 2: Future & Locked (should NOT match)
    insertGoal({
      goalId: 2,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 5_000n,
      ledger: 10,
    });

    // Goal 3: Overdue but Unlocked (should NOT match)
    insertGoal({
      goalId: 3,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 800n,
      ledger: 10,
    });
    applyUnlock({ goalId: 3, ledger: 11 });

    const overdue = getOverdueLockedGoals(2_000n);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].goal_id).toBe(1);
  });

  it("getGoalsByOwner returns only that owner's goals, ordered by id", () => {
    insertGoal({
      goalId: 5,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 1n,
      deadline: 1n,
      ledger: 1,
    });
    insertGoal({
      goalId: 4,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 1n,
      deadline: 1n,
      ledger: 1,
    });
    insertGoal({
      goalId: 6,
      owner: "GSOMEONEELSE0000000000000000000000000000000000000000000",
      token: TOKEN,
      targetAmount: 1n,
      deadline: 1n,
      ledger: 1,
    });

    const ids = getGoalsByOwner(OWNER).map((g) => g.goal_id);
    expect(ids).toEqual([4, 5]);
  });
});

describe("activity", () => {
  it("inserts and lists activity newest-first", () => {
    insertActivity({
      goalId: 0,
      owner: OWNER,
      type: "create",
      amount: null,
      ledger: 1,
      txHash: "tx1",
    });
    insertActivity({
      goalId: 0,
      owner: OWNER,
      type: "deposit",
      amount: 5_000_000n,
      ledger: 2,
      txHash: "tx2",
    });

    const activity = getActivityByOwner(OWNER);
    expect(activity).toHaveLength(2);
    expect(activity[0].type).toBe("deposit");
    expect(activity[1].type).toBe("create");
  });

  it("respects the limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      insertActivity({
        goalId: 0,
        owner: OWNER,
        type: "deposit",
        amount: 1n,
        ledger: i,
        txHash: `tx${i}`,
      });
    }

    expect(getActivityByOwner(OWNER, 2)).toHaveLength(2);
  });
});

describe("sync_state", () => {
  it("defaults to a null cursor and ledger 0", () => {
    expect(getSyncState()).toEqual({ cursor: null, lastLedger: 0 });
  });

  it("persists updates", () => {
    setSyncState("some-cursor", 42);
    expect(getSyncState()).toEqual({ cursor: "some-cursor", lastLedger: 42 });
  });
});
