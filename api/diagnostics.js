import { json, methodNotAllowed } from "../lib/http.js";

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function safeError(raw) {
  const text = String(raw || "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]");
  return text.slice(0, 500);
}

async function probeDeepSeek() {
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
  const [deepseek, supabase] = await Promise.all([probeDeepSeek(), probeSupabase()]);
  return json(res, 200, {
    ok: deepseek.ok && supabase.ok,
    deepseek,
    supabase,
    note: "This endpoint validates real upstream connectivity and never returns secret values."
  });
}
