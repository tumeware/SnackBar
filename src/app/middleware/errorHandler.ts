import { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { GeminiRequestError } from "../../clients/geminiClient.js";

// Centralized error handling to keep route handlers lean
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Request failed:", message);

  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  if (err instanceof Error && err.message.includes("AI API key")) {
    res.status(503).json({ error: "AI API key puuttuu. Lisää GEMINI_API_KEY .env-tiedostoon." });
    return;
  }

  if (err instanceof GeminiRequestError) {
    res.status(502).json({ error: "AI-analyysi epäonnistui.", detail: message });
    return;
  }

  if (err instanceof Error && err.message.includes("Request timed out")) {
    res.status(504).json({ error: "Rajapintapyyntö aikakatkaistiin. Kokeile uudelleen." });
    return;
  }

  if (err instanceof Error && (err.message.includes("fetch failed") || err.message.includes("ENOTFOUND"))) {
    res.status(502).json({ error: "Yhteys Open Food Facts -rajapintaan epäonnistui.", detail: message });
    return;
  }

  res.status(500).json({ error: "Unexpected server error", detail: message });
}
