import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createServer } from "../src/api/server.js";

describe("API route parameter validation", () => {
  let server: http.Server;
  let port: number;

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

  const validAddress = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

  describe("GET /api/goals/:owner", () => {
    it("returns 400 for malformed owner address", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/goals/invalid-address`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toHaveProperty("error");
      expect(json.error).toMatch(/invalid owner address/i);
    });

    it("returns 400 for SQL injection attempt in owner param", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/goals/'%20OR%201=1--`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid owner address/i);
    });

    it("returns 200 with empty goals array for valid unused owner address", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/goals/${validAddress}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ goals: [] });
    });
  });

  describe("GET /api/activity/:owner", () => {
    it("returns 400 for malformed owner address", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/activity/not-a-stellar-key`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid owner address/i);
    });

    it("returns 400 for non-numeric limit parameter", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/activity/${validAddress}?limit=abc`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid limit parameter/i);
    });

    it("returns 400 for negative limit parameter", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/activity/${validAddress}?limit=-10`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid limit parameter/i);
    });

    it("returns 400 for zero limit parameter", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/activity/${validAddress}?limit=0`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid limit parameter/i);
    });

    it("returns 200 for valid owner and valid limit", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/activity/${validAddress}?limit=50`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ activity: [] });
    });
  });
});
