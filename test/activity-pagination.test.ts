import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { createServer } from "../src/api/server.js";
import { db, insertGoal, insertActivity, setSyncState } from "../src/db.js";

describe("Activity endpoint pagination (?limit=N&offset=M)", () => {
  let server: http.Server;
  let port: number;
  const OWNER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

  beforeAll(async () => {
    process.env.CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const app = createServer();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    db.exec("DELETE FROM goals; DELETE FROM activity;");
    setSyncState(null, 0);

    insertGoal({
      goalId: 1,
      owner: OWNER,
      token: "CTOKEN",
      targetAmount: 1000n,
      deadline: 100000n,
      ledger: 10,
    });

    // Insert 5 activity entries with descending ledger numbers
    for (let i = 1; i <= 5; i++) {
      insertActivity({
        goalId: 1,
        owner: OWNER,
        type: "deposit",
        amount: BigInt(i * 10),
        ledger: 10 + i,
        txHash: `hash_${i}`,
      });
    }
  });

  it("returns default pagination for unpaginated query (backwards compatible)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/activity/${OWNER}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("activity");
    expect(body).toHaveProperty("total", 5);
    expect(body).toHaveProperty("hasMore", false);
    expect(body.activity).toHaveLength(5);
    // Newest first (id 5 down to 1)
    expect(body.activity[0].amount).toBe("50");
    expect(body.activity[4].amount).toBe("10");
  });

  it("handles limit parameter correctly with hasMore true", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/activity/${OWNER}?limit=2`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.activity).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.hasMore).toBe(true);
    expect(body.activity[0].amount).toBe("50");
    expect(body.activity[1].amount).toBe("40");
  });

  it("handles offset parameter correctly", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/activity/${OWNER}?limit=2&offset=2`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.activity).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.hasMore).toBe(true);
    expect(body.activity[0].amount).toBe("30");
    expect(body.activity[1].amount).toBe("20");
  });

  it("handles last page with hasMore false", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/activity/${OWNER}?limit=2&offset=4`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.activity).toHaveLength(1);
    expect(body.total).toBe(5);
    expect(body.hasMore).toBe(false);
    expect(body.activity[0].amount).toBe("10");
  });

  it("handles offset beyond total count", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/activity/${OWNER}?offset=10`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.activity).toEqual([]);
    expect(body.total).toBe(5);
    expect(body.hasMore).toBe(false);
  });
});
