import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPrompt } from "../src/clients/geminiClient.js";
import { ProductSummary } from "../src/domain/product.js";

const baseProduct: ProductSummary = {
  code: "123",
  name: "Testituote",
  brands: "Brand",
  imageThumb: null,
  image: null,
  nutriScore: "e",
  quantity: "100g",
  categories: ["fi:makeiset", "chocolate"],
  nutriments: { energy_100g: 557, carbohydrates_100g: 59, sugars_100g: 59 },
  ingredients: "Sokeri, kaakaovoi, täysmaitojauhe",
  allergens: "maito, soija",
  origins: "Suomi",
  countries: ["Finland", "fi"],
};

test("buildPrompt includes all required sections", () => {
  const prompt = buildPrompt(baseProduct);

  assert.match(prompt, /Yhdellä vilkaisulla/);
  assert.match(prompt, /Kenelle sopii\?/);
  assert.match(prompt, /Terveysnäkökulmat/);
  assert.match(prompt, /Suositellut terveelliset vaihtoehdot/);
});

test("buildPrompt contains product key details", () => {
  const prompt = buildPrompt(baseProduct);

  assert.match(prompt, /Testituote/);
  assert.match(prompt, /Nutri-Score: E/i);
  assert.match(prompt, /makeiset/);
  assert.match(prompt, /maito/);
  assert.match(prompt, /Energia \(100 g:ssa\): 557/);
  assert.match(prompt, /Hiilihydraatit \(100 g:ssa\): 59/);
});
