import { z } from "zod";

import { config } from "../config/env.js";
import { NutritionScore, ProductSummary } from "../domain/product.js";
import { MemoryCache } from "../lib/cache.js";
import { fetchJson } from "../lib/http.js";

const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "brands",
  "image_small_url",
  "image_url",
  "nutriscore_grade",
  "quantity",
  "categories_tags",
  "nutriments",
  "ingredients_text",
  "allergens",
  "origins",
  "countries_tags",
].join(",");

const NutriScoreSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    const lower = value.toLowerCase();
    return ["a", "b", "c", "d", "e"].includes(lower) ? (lower as NutritionScore) : null;
  });

const ProductSchema = z.object({
  code: z.string(),
  product_name: z.string().optional().default("Unknown product"),
  brands: z.string().optional().default(""),
  image_small_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  nutriscore_grade: NutriScoreSchema,
  quantity: z.string().optional().nullable(),
  categories_tags: z.array(z.string()).optional().default([]),
  nutriments: z.record(z.union([z.string(), z.number()])).optional().default({}),
  ingredients_text: z.string().optional().nullable(),
  allergens: z.string().optional().nullable(),
  origins: z.string().optional().nullable(),
  countries_tags: z.array(z.string()).optional().default([]),
});

type RawProduct = z.infer<typeof ProductSchema>;

const SearchResponseSchema = z.object({
  count: z.coerce.number(),
  page: z.coerce.number(),
  page_size: z.coerce.number(),
  products: z.array(ProductSchema),
});

const ProductResponseSchema = z.object({
  status: z.number(),
  product: ProductSchema.optional(),
});

const OFF_BASE = config.OFF_BASE_URL;
const searchCache = new MemoryCache<ProductSummary[]>(config.OFF_CACHE_TTL_MS);

function mapProduct(raw: RawProduct): ProductSummary {
  return {
    code: raw.code,
    name: raw.product_name || "Unnamed product",
    brands: raw.brands || "Unknown brand",
    imageThumb: raw.image_small_url ? raw.image_small_url.replace("http://", "https://") : null,
    image: raw.image_url ? raw.image_url.replace("http://", "https://") : null,
    nutriScore: raw.nutriscore_grade ?? null,
    quantity: raw.quantity ?? null,
    categories: raw.categories_tags || [],
    nutriments: raw.nutriments || {},
    ingredients: raw.ingredients_text ?? null,
    allergens: raw.allergens ?? null,
    origins: raw.origins ?? null,
    countries: raw.countries_tags || [],
  };
}

export async function searchProducts(query: string, pageSize = 12): Promise<ProductSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const cacheKey = `${trimmed.toLowerCase()}::${pageSize}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const fetchSearch = async (term: string, size: number, timeoutMs: number) => {
    const params = new URLSearchParams({
      search_terms: term,
      action: "process",
      search_simple: "1",
      json: "1",
      page_size: String(size),
      page: "1",
      sort_by: "unique_scans_n",
      fields: PRODUCT_FIELDS,
    });

    const url = `${OFF_BASE}/cgi/search.pl?${params.toString()}`;
    const json = await fetchJson(url, {}, timeoutMs);
    const parsed = SearchResponseSchema.parse(json);
    return parsed.products.map(mapProduct);
  };

  const safeSearch = async (term: string, size: number, timeoutMs: number) => {
    try {
      return await fetchSearch(term, size, timeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Request timed out") || message.includes("fetch failed")) {
        console.warn(`OpenFoodFacts search timeout for "${term}"`);
        return [];
      }
      throw error;
    }
  };

  // Primary full-query search with a capped timeout to avoid long hangs
  const primaryTimeout = Math.min(config.OFF_TIMEOUT_MS, 20000);
  const primary = await safeSearch(trimmed, pageSize, primaryTimeout);
  if (primary.length > 0) {
    searchCache.set(cacheKey, primary);
    return primary;
  }

  // Fallback: try individual tokens for multi-word queries and merge results
  const terms = trimmed
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 4);

  if (terms.length === 0) return [];

  const fallbackTimeout = Math.min(config.OFF_TIMEOUT_MS, 12000);
  const fallbackSize = Math.min(pageSize, 8);
  const batches = await Promise.all(terms.map((term) => safeSearch(term, fallbackSize, fallbackTimeout)));
  const merged = new Map<string, ProductSummary>();
  batches.flat().forEach((product) => {
    if (!merged.has(product.code)) merged.set(product.code, product);
  });

  const result = Array.from(merged.values()).slice(0, pageSize);
  searchCache.set(cacheKey, result);
  return result;
}

export async function findAlternatives(product: ProductSummary, limit = 4): Promise<ProductSummary[]> {
  // Try the most specific term first (category without locale prefix), then product name chunks, then brand.
  const primaryCategory = product.categories.map((c) => c.replace(/^[a-z]{2}:/, "")).find((c) => c.length > 3);
  const nameChunk = product.name.split(/\s+/).slice(0, 3).join(" ");
  const searchTerm = primaryCategory || nameChunk || product.brands || "tuote";
  const countrySet = new Set(product.countries.map((c) => c.toLowerCase()));

  const candidates = await searchProducts(searchTerm, 28);
  const countryMatched = candidates.filter(
    (p) => p.code !== product.code && p.countries.some((c) => countrySet.has(c.toLowerCase())),
  );
  const filtered = countryMatched.length ? countryMatched : candidates.filter((p) => p.code !== product.code);

  const scoreNutri = (nutri: NutritionScore | null) => {
    if (!nutri) return 3;
    return { a: 0, b: 1, c: 2, d: 3, e: 4 }[nutri];
  };

  const allergenFriendly = filtered.filter((p) => !p.allergens || p.allergens.trim() === "");
  const others = filtered.filter((p) => p.allergens && p.allergens.trim() !== "");
  const ranked = [...allergenFriendly, ...others].sort((a, b) => scoreNutri(a.nutriScore) - scoreNutri(b.nutriScore));

  return ranked.slice(0, limit);
}

export async function getProduct(code: string): Promise<ProductSummary | null> {
  const params = new URLSearchParams({
    code,
    json: "1",
    fields: PRODUCT_FIELDS,
  });

  const url = `${OFF_BASE}/api/v0/product/${code}.json?${params.toString()}`;
  const json = await fetchJson(url, {}, config.OFF_TIMEOUT_MS);
  const parsed = ProductResponseSchema.parse(json);

  if (parsed.status !== 1 || !parsed.product) {
    return null;
  }

  return mapProduct(parsed.product);
}
