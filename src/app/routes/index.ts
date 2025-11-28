import { Router } from "express";

import { analysisRouter } from "./analysis.js";
import { healthRouter } from "./health.js";
import { productsRouter } from "./products.js";

export function buildApiRouter(): Router {
  const router = Router();

  router.use(healthRouter);
  router.use(productsRouter);
  router.use(analysisRouter);

  return router;
}
