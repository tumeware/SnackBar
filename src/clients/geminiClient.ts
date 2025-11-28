import { config } from "../config/env.js";
import { ProductSummary } from "../domain/product.js";
import { fetchJson } from "../lib/http.js";

const model = encodeURIComponent(config.GEMINI_MODEL);
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const NUTRIMENT_LABELS: Record<string, string> = {
  alcohol: "Alkoholi",
  caffeine: "Kofeiini",
  calcium: "Kalsium",
  carbohydrates: "Hiilihydraatit",
  casein: "Kaseiini",
  chloride: "Kloridi",
  cholesterol: "Kolesteroli",
  cocoa: "Kaakaopitoisuus",
  energy: "Energia",
  "energy-kcal": "Energia (kcal)",
  "energy-kj": "Energia (kJ)",
  fat: "Rasva",
  fiber: "Ravintokuitu",
  "folates": "Folaatti",
  fructose: "Fruktoosi",
  "fruits-vegetables-nuts-estimate-from-ingredients": "Hedelmä-, vihannes- ja pähkinäpitoisuus (arvio)",
  galactose: "Galaktoosi",
  glucose: "Glukoosi",
  iron: "Rauta",
  iodine: "Jodi",
  lactose: "Laktoosi",
  magnesium: "Magnesium",
  maltose: "Maltoosi",
  "monounsaturated-fat": "Kertatyydyttymätön rasva",
  "nucleotides": "Nukleotidit",
  "omega-3-fat": "Omega-3",
  "omega-6-fat": "Omega-6",
  "omega-9-fat": "Omega-9",
  phosphorus: "Fosfori",
  polyols: "Sokerialkoholit",
  "polyunsaturated-fat": "Monityydyttymätön rasva",
  potassium: "Kalium",
  proteins: "Proteiini",
  salt: "Suola",
  sodium: "Natrium",
  starch: "Tärkkelys",
  sugars: "Sokerit",
  taurine: "Tauriini",
  "trans-fat": "Transrasva",
  "vitamin-a": "A-vitamiini",
  "vitamin-b1": "Tiamiini (B1)",
  "vitamin-b12": "B12-vitamiini",
  "vitamin-b2": "Riboflaviini (B2)",
  "vitamin-b6": "B6-vitamiini",
  "vitamin-b9": "B9-vitamiini",
  "vitamin-c": "C-vitamiini",
  "vitamin-d": "D-vitamiini",
  "vitamin-e": "E-vitamiini",
  "vitamin-k": "K-vitamiini",
  "vitamin-pp": "Niasiini (PP/B3)",
  zinc: "Sinkki",
};

const NUTRIMENT_SUFFIX_LABELS: Record<string, string> = {
  "100g": "100 g:ssa",
  serving: "annoksessa",
  unit: "yksikkö",
  value: "arvo",
};

function prettifyNutrimentKey(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateNutrimentKey(key: string): string {
  const match = key.match(/(.+)_((?:100g)|serving|unit|value)$/i);
  const baseKey = match ? match[1] : key;
  const suffix = match ? match[2].toLowerCase() : null;
  const baseLabel = NUTRIMENT_LABELS[baseKey.toLowerCase()] || prettifyNutrimentKey(baseKey);

  if (!suffix) return baseLabel;

  const suffixLabel = NUTRIMENT_SUFFIX_LABELS[suffix] || suffix;
  if (baseLabel.endsWith(")") && baseLabel.includes("(")) {
    return `${baseLabel.slice(0, -1)}, ${suffixLabel})`;
  }
  return `${baseLabel} (${suffixLabel})`;
}

function normalizeNutriments(
  nutriments: Record<string, number | string>,
): Array<{ label: string; value: string }> {
  const grouped = new Map<
    string,
    { unit?: string | number; base?: string | number; per100g?: string | number; serving?: string | number; value?: string | number }
  >();

  Object.entries(nutriments || {})
    .filter(([key]) => !key.toLowerCase().includes("prepared"))
    .forEach(([key, value]) => {
      const match = key.match(/(.+)_((?:100g)|serving|unit|value)$/i);
      const baseKey = match ? match[1] : key;
      const suffix = match ? match[2].toLowerCase() : "base";
      const entry =
        grouped.get(baseKey) ||
        { unit: undefined, base: undefined, per100g: undefined, serving: undefined, value: undefined };

      if (suffix === "unit") entry.unit = value;
      else if (suffix === "100g") entry.per100g = value;
      else if (suffix === "serving") entry.serving = value;
      else if (suffix === "value") entry.value = value;
      else entry.base = value;

      grouped.set(baseKey, entry);
    });

  const entries: Array<{ label: string; value: string }> = [];

  grouped.forEach((entry, baseKey) => {
    const unit = entry.unit ? ` ${entry.unit}` : "";
    const appendUnit = (val?: string | number) => (val === undefined || val === null || val === "" ? null : `${val}${unit}`);
    const addEntry = (suffix: string | null, val?: string | number) => {
      const formatted = appendUnit(val);
      if (!formatted) return;
      const labelKey = suffix ? `${baseKey}_${suffix}` : baseKey;
      entries.push({ label: translateNutrimentKey(labelKey), value: formatted });
    };

    const mainValue = entry.base ?? entry.value;
    addEntry(null, mainValue);
    addEntry("100g", entry.per100g);
    addEntry("serving", entry.serving);
  });

  return entries;
}

export function buildPrompt(product: ProductSummary): string {
  const categories = product.categories.slice(0, 5);
  const countries = product.countries.slice(0, 4);
  const nutrimentsEntries = normalizeNutriments(product.nutriments || {}).slice(0, 12);
  const nutrimentsText = nutrimentsEntries
    .map(({ label, value }) => `${label}: ${value}`)
    .join(", ");

  const ingredients = product.ingredients ? product.ingredients.slice(0, 320) : null;
  const allergens = product.allergens ? product.allergens.slice(0, 160) : null;

  const lines = [
    `Product: ${product.name} (${product.brands || "Unknown brand"})`,
    `Nutri-Score: ${product.nutriScore ? product.nutriScore.toUpperCase() : "Unavailable"}`,
    `Quantity: ${product.quantity || "Unknown"}`,
    `Categories: ${categories.join(", ") || "Unspecified"}`,
    `Allergens: ${allergens || "Not listed"}`,
    `Origins: ${product.origins || "Not listed"}`,
    `Countries: ${countries.join(", ") || "Not listed"}`,
    `Ingredients: ${ingredients || "Not listed"}`,
    `Nutriments: ${nutrimentsText}`,
  ];

  return `
You are a senior dietitian helping a consumer understand a packaged food.
Respond in Finnish.
Write a concise appraisal with four short sections (keep total output under 170 words):
1) "Yhdellä vilkaisulla" — 3 bulletia (ravitsemuslaatu, ainesosien laatu, huomiot).
2) "Kenelle sopii?" — 2 bulletia (sopiva / ei-sopiva).
3) "Terveysnäkökulmat" — 2 bulletia (mahdolliset riskit, allergeenit tai runsaasti sokeria/suolaa/rasvaa).
4) "Suositellut terveelliset vaihtoehdot" — 3 bulletia, konkreettiset elintarvikeryhmät/tuotekategoriat (vähäsokeriset, vähäsuolaiset, korkeakuituiset tms.).
Keep tone pragmatic and evidence-based. Avoid hallucinating nutrients that are not present.
Base your answer strictly on the data below. If data is missing, say it succinctly.

Product data:
${lines.join("\n")}
  `.trim();
}

export async function generateProductInsight(product: ProductSummary): Promise<string> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("AI API key missing");
  }

  const prompt = buildPrompt(product);
  const url = `${GEMINI_BASE}?key=${config.GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: config.GEMINI_MAX_OUTPUT_TOKENS,
    },
  };

  try {
    const result = await fetchJson<{
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    }>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts
      ?.map((part) => part.text?.trim())
      .filter(Boolean) as string[] | undefined;
    const text = parts?.join("\n\n");

    if (!text) {
      const summary = JSON.stringify(result).slice(0, 300);
      const reason = candidate?.finishReason === "MAX_TOKENS" ? "AI cut off response (max tokens)." : "Empty response from AI model.";
      throw new GeminiRequestError(`${reason} Raw: ${summary}`);
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    throw new GeminiRequestError(`${message} (model: ${model})`);
  }
}

export class GeminiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRequestError";
  }
}
