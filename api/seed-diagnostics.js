import { callDeepSeek, fastModel, proModel } from "../lib/deepseek.js";
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

  const attempts = [
    {
      name: "pro-fast",
      model: proModel(),
      thinking: false,
      maxTokens: 3200,
      timeoutMs: 14000
    },
    {
      name: "flash-recovery",
      model: fastModel(),
      thinking: false,
      maxTokens: 3000,
      timeoutMs: 10000
    }
  ];

  const results = [];
  for (const attempt of attempts) {
    const started = Date.now();
    try {
      const response = await callDeepSeek({
        model: attempt.model,
        system: [directorFoundationPrompt, seedSystemPrompt],
        user,
        thinking: attempt.thinking,
        reasoningEffort: "high",
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        userId: "seed-diagnostics"
      });
      const validated = validateSeed(response.data, fallbackStory, fallbackOpen);
      return json(res, 200, {
        version: "seed-diagnostics-v1",
        ok: true,
        selected: attempt.name,
        model: response.model || attempt.model,
        elapsedMs: Date.now() - started,
        validated: Boolean(validated?.storyBible?.hiddenTruth && validated?.opening?.firstTask),
        usage: response.cache,
        previousAttempts: results
      });
    } catch (error) {
      results.push({
        attempt: attempt.name,
        model: attempt.model,
        elapsedMs: Date.now() - started,
        error: safeError(error)
      });
    }
  }

  return json(res, 200, {
    version: "seed-diagnostics-v1",
    ok: false,
    attempts: results
  });
}
