import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(5173),
  GEMINI_API_KEY: z.string().optional(),
  OFF_BASE_URL: z.string().default("https://world.openfoodfacts.org"),
  OFF_TIMEOUT_MS: z.coerce.number().default(20000),
  OFF_CACHE_TTL_MS: z.coerce.number().default(5 * 60 * 1000),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().default(3072),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.errors.map((e) => e.message).join(", ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

if (!parsed.data.GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn("Warning: GEMINI_API_KEY is not set. AI analysis endpoint will return 503.");
}

export const config = parsed.data;
