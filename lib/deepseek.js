const BASE_URL = () => process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions";

function parseJsonLoose(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const candidates = [
    value,
    value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
    value.includes("{") && value.includes("}")
      ? value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1)
      : ""
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch { }
  }
  return null;
}

async function fetchWithTimeout(url, options, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("DEEPSEEK_TIMEOUT");
      timeoutError.retryable = false;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function asSystemMessages(system) {
  return (Array.isArray(system) ? system : [system])
    .filter((part) => String(part || "").trim())
    .map((content) => ({ role: "system", content: String(content) }));
}

function cacheStats(usage) {
  const hit = Number(usage?.prompt_cache_hit_tokens || 0);
  const miss = Number(usage?.prompt_cache_miss_tokens || 0);
  const prompt = Number(usage?.prompt_tokens || hit + miss || 0);
  const completion = Number(usage?.completion_tokens || 0);
  return {
    promptTokens: prompt,
    completionTokens: completion,
    cacheHitTokens: hit,
    cacheMissTokens: miss,
    cacheHitRate: hit + miss > 0 ? hit / (hit + miss) : 0
  };
}

async function oneCall({
  model,
  system,
  user,
  thinking,
  reasoningEffort,
  maxTokens,
  userId,
  timeoutMs = 18000
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_NOT_CONFIGURED");

  const response = await fetchWithTimeout(
    BASE_URL(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [...asSystemMessages(system), { role: "user", content: user }],
        response_format: { type: "json_object" },
        thinking: { type: thinking ? "enabled" : "disabled" },
        reasoning_effort: reasoningEffort,
        max_tokens: maxTokens,
        user_id: userId || undefined,
        stream: false
      })
    },
    timeoutMs
  );

  const raw = await response.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch { payload = null; }

  if (!response.ok) {
    const error = new Error(`DEEPSEEK_${response.status}`);
    error.details = payload || raw;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }

  const text = payload?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonLoose(text);
  if (!parsed) {
    const error = new Error("DEEPSEEK_INVALID_JSON");
    error.details = text.slice(0, 1000);
    error.retryable = true;
    throw error;
  }

  const usage = payload?.usage || null;
  const cache = cacheStats(usage);
  if (process.env.DEEPSEEK_CACHE_DEBUG === "true") {
    console.info("DeepSeek usage", {
      model: payload?.model || model,
      promptTokens: cache.promptTokens,
      completionTokens: cache.completionTokens,
      cacheHitTokens: cache.cacheHitTokens,
      cacheMissTokens: cache.cacheMissTokens,
      cacheHitRate: Number(cache.cacheHitRate.toFixed(3))
    });
  }

  return { data: parsed, usage, cache, model: payload?.model || model };
}

export async function callDeepSeek(options) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await oneCall(options);
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function fastModel() {
  return process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash";
}

export function proModel() {
  return process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro";
}

export function mergeUsageTotals(current = {}, result = {}) {
  const cache = result?.cache || cacheStats(result?.usage);
  return {
    calls: Number(current.calls || 0) + 1,
    promptTokens: Number(current.promptTokens || 0) + cache.promptTokens,
    completionTokens: Number(current.completionTokens || 0) + cache.completionTokens,
    cacheHitTokens: Number(current.cacheHitTokens || 0) + cache.cacheHitTokens,
    cacheMissTokens: Number(current.cacheMissTokens || 0) + cache.cacheMissTokens
  };
}
