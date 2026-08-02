import { callDeepSeek, fastModel } from "../lib/deepseek.js";
import { createFallbackStory, fallbackOpening } from "../lib/fallback.js";
import { json, methodNotAllowed } from "../lib/http.js";
import { directorFoundationPrompt, seedSystemPrompt, seedUserPrompt } from "../lib/prompts.js";
import { validateSeed } from "../lib/validate.js";

function safeError(error) {
  return String(error?.message || error || "UNKNOWN")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 240);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const identities = ["404号住户"];
  const fallbackStory = createFallbackStory(null);
  const fallbackOpen = fallbackOpening(fallbackStory, identities, null);
  const user = seedUserPrompt({
    playerCount: 1,
    identities,
    legacyFragment: null,
    randomSeed: `diagnostics-${Date.now()}`
  });

  const started = Date.now();
  try {
    const response = await callDeepSeek({
      model: fastModel(),
      system: [directorFoundationPrompt, seedSystemPrompt],
      user,
      thinking: false,
      reasoningEffort: "low",
      maxTokens: 2300,
      timeoutMs: 10000,
      userId: "seed-diagnostics-v2"
    });
    const validated = validateSeed(response.data, fallbackStory, fallbackOpen);
    return json(res, 200, {
      version: "seed-diagnostics-v2",
      ok: true,
      selected: "flash-seed",
      model: response.model || fastModel(),
      elapsedMs: Date.now() - started,
      validated: Boolean(validated?.storyBible?.hiddenTruth && validated?.opening?.firstTask),
      usage: response.cache
    });
  } catch (error) {
    return json(res, 200, {
      version: "seed-diagnostics-v2",
      ok: false,
      selected: "fallback-after-deadline",
      elapsedMs: Date.now() - started,
      error: safeError(error)
    });
  }
}
