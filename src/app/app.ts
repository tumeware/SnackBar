import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "../config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { buildApiRouter } from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...cspDirectives,
          "img-src": ["'self'", "data:", "https:"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    morgan("tiny", {
      skip: (_req, res) => res.statusCode < 400,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  const publicDir = path.join(__dirname, "..", "..", "public");
  app.use(express.static(publicDir));

  app.use("/api", buildApiRouter());

  app.use(errorHandler);

  app.set("port", config.PORT);

  return app;
}
