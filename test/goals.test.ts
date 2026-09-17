import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createServer } from "../src/api/server.js";
import { db, insertGoal, getGoalByOwnerAndId, setGoalMetadata, getGoalMetadata } from "../src/db.js";

const OWNER = "GOWNER00000000000000000000000000000000000000000000000";
const OTHER_OWNER = "GOTHER00000000000000000000000000000000000000000000000";
const TOKEN = "CTOKEN000000000000000000000000000000000000000000000000";

describe("Goals & Metadata API", () => {
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
    db.exec("DELETE FROM goals; DELETE FROM activity; DELETE FROM goal_metadata;");
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
      title: null,
      category: null,
      createdAtLedger: 100,
      updatedAtLedger: 100,
    });
  });

  it("saves and retrieves metadata via POST and GET", async () => {
    insertGoal({
      goalId: 10,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100_000_000n,
      deadline: 1_900_000_000n,
      ledger: 100,
    });

    const postRes = await fetch(`${baseUrl}/api/goals/${OWNER}/10/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Japan Vacation Fund",
        category: "travel",
      }),
    });
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    expect(postData.title).toBe("Japan Vacation Fund");
    expect(postData.category).toBe("travel");

    // Retrieve single goal
    const getRes = await fetch(`${baseUrl}/api/goals/${OWNER}/10`);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.title).toBe("Japan Vacation Fund");
    expect(getData.category).toBe("travel");

    // Retrieve list of goals
    const listRes = await fetch(`${baseUrl}/api/goals/${OWNER}`);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.goals[0].title).toBe("Japan Vacation Fund");
    expect(listData.goals[0].category).toBe("travel");
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

  it("db helper getGoalByOwnerAndId and setGoalMetadata work directly", () => {
    insertGoal({
      goalId: 1,
      owner: OWNER,
      token: TOKEN,
      targetAmount: 100n,
      deadline: 2000n,
      ledger: 5,
    });

    setGoalMetadata({
      goalId: 1,
      owner: OWNER,
      title: "Direct Test",
      category: "savings",
    });

    const meta = getGoalMetadata(OWNER, 1);
    expect(meta?.title).toBe("Direct Test");
    expect(meta?.category).toBe("savings");

    const found = getGoalByOwnerAndId(OWNER, 1);
    expect(found?.goal_id).toBe(1);

    const notFound = getGoalByOwnerAndId(OTHER_OWNER, 1);
    expect(notFound).toBeUndefined();
  });
});
