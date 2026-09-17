import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createServer } from "../src/api/server.js";

describe("CORS allowlist middleware", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    process.env.CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const app = createServer(["https://fundkeep.app", "http://localhost:3000"]);
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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("permits approved origin in CORS allowlist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: {
        Origin: "https://fundkeep.app",
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://fundkeep.app");
  });

  it("permits local dev origin in CORS allowlist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: {
        Origin: "http://localhost:3000",
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("safely rejects unapproved origins without access-control-allow-origin header", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: {
        Origin: "https://malicious-site.com",
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("permits non-browser requests without Origin header", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
