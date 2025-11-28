import { Router } from "express";
import { z } from "zod";

import { generateProductInsight } from "../../clients/geminiClient.js";
import { findAlternatives } from "../../clients/openFoodFactsClient.js";
import { ProductSummary } from "../../domain/product.js";
import { ProductSchema } from "../schemas/product.js";

const analyzeRequestSchema = z.object({
  product: ProductSchema,
});

export const analysisRouter = Router();

analysisRouter.post("/analyze", async (req, res, next) => {
  try {
    const { product } = analyzeRequestSchema.parse(req.body);
    const productSummary = product as ProductSummary;
    const [insight, alternatives] = await Promise.all([
      generateProductInsight(productSummary),
      findAlternatives(productSummary, 4),
    ]);
    res.json({ data: { insight, alternatives } });
  } catch (error) {
    next(error);
  }
});
