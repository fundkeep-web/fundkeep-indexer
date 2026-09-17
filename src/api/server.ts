import cors from "cors";
import express from "express";
import { config } from "../config.js";
import { activityRouter } from "./routes/activity.js";
import { goalsRouter } from "./routes/goals.js";
import { healthRouter } from "./routes/health.js";

export function createServer(customCorsOrigins?: string[]) {
  const app = express();

  const rawOrigins = customCorsOrigins ?? config.corsOrigins;
  const allowedOrigins = Array.isArray(rawOrigins)
    ? rawOrigins
    : [rawOrigins];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Reject unapproved origins safely by denying CORS header
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(healthRouter);
  app.use("/api", goalsRouter);
  app.use("/api", activityRouter);

  return app;
}
