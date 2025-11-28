# SnackBar – Open Food Facts x AI Demo

Small but production-ready reference that:

- fetches products from Open Food Facts
- surfaces key nutrition and ingredient data
- asks AI to write a pragmatic review (incl. health angles and healthier swaps)
- shows allergy-friendly alternatives bound to the same country/language with images and links
- lets you adjust the shown nutrition values by changing the product amount (per 100 g/ml or per serving) directly in the nutrition popup

## Usage

1. Install deps (Node 18+):

    ```bash
    npm install
    ```

2. Copy `.env.example` -> `.env` and add your `GEMINI_API_KEY`.

3. Start the dev server:

```bash
npm run dev
```

The app serves at `http://localhost:5173` by default.

> Note: the dev command uses `tsx watch` for the ESM stack. If you still have an old `ts-node-dev` running, stop it first.

### UI tips

- Click "Ravitsemus" on a product card to open the nutrition popup.
- If the product has per 100 g/ml or per serving values, use the amount input or quick-pick buttons (100/250/500 g, or the product’s own pack size) to see calories/macros scale instantly.
- AI analysis ("AI-analyysi") opens a modal with tabs for the insight and healthier alternatives.

## Connecting to Open Food Facts

- Outbound network access to `world.openfoodfacts.org` is required. If you see 504/timeouts, check firewall/VPN.
- Configure timeout via `.env`: `OFF_TIMEOUT_MS=30000` (default 20000 ms).
- To use another endpoint/mirror, set `OFF_BASE_URL`.

## AI model

- Default in `.env.example`: `GEMINI_MODEL=gemini-2.5-flash` (v1beta). Switch to any model you can access (e.g. `gemini-2.0-flash`, `gemini-1.5-flash-8b`), but ensure it supports `generateContent` in the v1beta API.
- If responses hit max tokens, raise `.env`: `GEMINI_MAX_OUTPUT_TOKENS` (default 3072).

## Project structure

- `src/app/app.ts` – Express app factory (middleware, static assets, `/api` router).
- `src/app/routes/` – `health.ts`, `products.ts`, `analysis.ts` split by responsibility; `routes/index.ts` wires them.
- `src/app/middleware/errorHandler.ts` – shared API error formatting.
- `src/app/schemas/product.ts` – Zod schema for inbound product payloads to the AI endpoint.
- `src/clients/openFoodFactsClient.ts` and `src/clients/geminiClient.ts` – HTTP clients for OFF and Gemini.
- `src/config/env.ts` – Zod-based env validation (remember GEMINI_MODEL and GEMINI_MAX_OUTPUT_TOKENS).
- `src/lib/` – small utilities (`http.ts` for fetch with timeout, `cache.ts` for MemoryCache).
- `src/domain/product.ts` – core product/domain types.
- `src/server.ts` – server bootstrap calling `createApp()`.
- `public/` – lightweight HTML/CSS/JS without a build chain, skeleton loaders, modern analysis listing. Search overlay loading keeps previous results visible and cancels overlapping searches.

## Why this way

- Clear API keeps keys on the backend.
- Zod validation blocks bad params and keeps responses predictable.
- No heavy build tools: run the demo directly without a bundler.
- UI favors quick search and transparent analysis (no hype).
- Allergens and Nutri-Score are considered in alternative suggestions (country scoping first).

## Future enhancements

- More caching for popular searches.
- Broader unit tests for HTTP calls (mocked fetch) and lint check in CI.
- PWA/offline mode and browser localStorage for the last search.

## Testing

```bash
npm test
```

Tests use Node 20+ `node:test` with `tsx` for ESM. In restricted environments `tsx` IPC may need extra permissions; run locally in a normal dev setup if you hit EPERM.
