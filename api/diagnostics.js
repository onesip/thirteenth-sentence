import { json, methodNotAllowed } from "../lib/http.js";
import { callDeepSeek, fastModel } from "../lib/deepseek.js";

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function safeError(raw) {
  const text = String(raw || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]");
  return text.slice(0, 700);
}

async function probeDeepSeekModels() {
  const key = process.env.DEEPSEEK_API_KEY || "";
  if (!key) return { ok: false, status: 0, error: "DEEPSEEK_API_KEY_MISSING" };
  const timer = timeoutSignal(12000);
  try {
    const response = await fetch("https://api.deepseek.com/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: timer.signal
    });
    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    return {
      ok: response.ok,
      status: response.status,
      models: response.ok ? (payload?.data || []).map((item) => item.id).filter(Boolean) : [],
      error: response.ok ? null : safeError(payload?.error?.message || raw)
    };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === "AbortError" ? "DEEPSEEK_TIMEOUT" : safeError(error?.message) };
  } finally {
    timer.clear();
  }
}

async function probeDeepSeekGeneration() {
  try {
    const result = await callDeepSeek({
      model: fastModel(),
      system: "你是API连通性检测器。只输出合法JSON。",
      user: "只返回 {\"ok\":true}，不要添加其他文字。",
      thinking: false,
      reasoningEffort: "low",
      maxTokens: 64,
      userId: "diagnostics"
    });
    return {
      ok: result?.data?.ok === true,
      model: result?.model || fastModel(),
      usage: {
        promptTokens: result?.cache?.promptTokens || 0,
        completionTokens: result?.cache?.completionTokens || 0,
        cacheHitTokens: result?.cache?.cacheHitTokens || 0,
        cacheMissTokens: result?.cache?.cacheMissTokens || 0
      },
      error: result?.data?.ok === true ? null : "UNEXPECTED_GENERATION_OUTPUT"
    };
  } catch (error) {
    return {
      ok: false,
      model: fastModel(),
      usage: null,
      error: safeError(error?.details || error?.message)
    };
  }
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const headers = { apikey: key, Prefer: "count=exact", Range: "0-0" };
  if (key && !key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function probeSupabase() {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) return { ok: false, status: 0, error: "SUPABASE_ENV_MISSING" };
  const timer = timeoutSignal(12000);
  try {
    const response = await fetch(`${base}/rest/v1/game_sessions?select=id&limit=1`, {
      method: "GET",
      headers: supabaseHeaders(),
      signal: timer.signal
    });
    const raw = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : safeError(raw)
    };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === "AbortError" ? "SUPABASE_TIMEOUT" : safeError(error?.message) };
  } finally {
    timer.clear();
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const [deepseek, supabase] = await Promise.all([
    probeDeepSeekModels(),
    probeSupabase()
  ]);
  const generation = deepseek.ok ? await probeDeepSeekGeneration() : null;
  return json(res, 200, {
    version: "diagnostics-v3",
    ok: deepseek.ok && supabase.ok && generation?.ok,
    deepseek,
    generation,
    supabase,
    note: "This endpoint always validates the same DeepSeek generation path used by the game."
  });
}
