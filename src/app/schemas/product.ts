import { z } from "zod";

export const ProductSchema = z.object({
  code: z.string(),
  name: z.string(),
  brands: z.string(),
  imageThumb: z.string().nullable(),
  image: z.string().nullable(),
  nutriScore: z.union([z.literal("a"), z.literal("b"), z.literal("c"), z.literal("d"), z.literal("e"), z.null()]),
  quantity: z.string().nullable(),
  categories: z.array(z.string()),
  nutriments: z.record(z.union([z.string(), z.number()])),
  ingredients: z.string().nullable(),
  allergens: z.string().nullable(),
  origins: z.string().nullable(),
  countries: z.array(z.string()),
});
