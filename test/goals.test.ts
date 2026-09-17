import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createServer } from "../src/api/server.js";
import { db, insertGoal, getGoalByOwnerAndId } from "../src/db.js";

const OWNER = "GOWNER00000000000000000000000000000000000000000000000";
const OTHER_OWNER = "GOTHER00000000000000000000000000000000000000000000000";
const TOKEN = "CTOKEN000000000000000000000000000000000000000000000000";

describe("GET /api/goals/:owner/:goalId", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createServer();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    db.exec("DELETE FROM goals; DELETE FROM activity;");
  });

  it("returns 200 and single goal when goal exists for owner", async () => {
    insertGoal({
      goalId: 42,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 500_000_000n,
      deadline: 1_900_000_000n,
      ledger: 100,
    });

    const res = await fetch(`${baseUrl}/api/goals/${OWNER}/42`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      goalId: 42,
      owner: OWNER,
      token: TOKEN,
      targetAmount: "500000000",
      currentAmount: "0",
      deadline: 1_900_000_000,
      status: "LOCKED",
      createdAtLedger: 100,
      updatedAtLedger: 100,
    });
  });

  it("returns 404 when goalId does not exist for the owner", async () => {
    insertGoal({
      goalId: 42,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 500_000_000n,
      deadline: 1_900_000_000n,
      ledger: 100,
    });

    const res = await fetch(`${baseUrl}/api/goals/${OTHER_OWNER}/42`);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data).toEqual({ error: "Goal not found" });
  });

  it("returns 404 when goalId is non-numeric or missing", async () => {
    const res = await fetch(`${baseUrl}/api/goals/${OWNER}/notanumber`);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data).toEqual({ error: "Goal not found" });
  });

  it("db helper getGoalByOwnerAndId works directly", () => {
    insertGoal({
      goalId: 1,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100n,
      deadline: 2000n,
      ledger: 5,
    });

    const found = getGoalByOwnerAndId(OWNER, 1);
    expect(found?.goal_id).toBe(1);

    const notFound = getGoalByOwnerAndId(OTHER_OWNER, 1);
    expect(notFound).toBeUndefined();
  });
});
