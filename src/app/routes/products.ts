import { Router } from "express";
import { z } from "zod";

import { getProduct, searchProducts } from "../../clients/openFoodFactsClient.js";

const searchQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters"),
});

const productParamsSchema = z.object({
  code: z.string().min(5),
});

export const productsRouter = Router();

productsRouter.get("/search", async (req, res, next) => {
  try {
    const { q } = searchQuerySchema.parse(req.query);
    const products = await searchProducts(q);
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/products/:code", async (req, res, next) => {
  try {
    const { code } = productParamsSchema.parse(req.params);
    const product = await getProduct(code);

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});
