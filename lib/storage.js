const SUPABASE_URL = () => (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supabaseAuthHeaders() {
  const key = SUPABASE_KEY();
  const headers = { apikey: key };
  // New sb_secret_* keys must be sent only in the apikey header.
  // Legacy service_role JWT keys can also be sent as Bearer tokens.
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function cloudConfigured() {
  return Boolean(SUPABASE_URL() && SUPABASE_KEY());
}

async function supabaseCount(path) {
  if (!cloudConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
    method: "HEAD",
    headers: {
      ...supabaseAuthHeaders(),
      Prefer: "count=exact",
      Range: "0-0"
    }
  });
  if (!response.ok) throw new Error(`SUPABASE_${response.status}`);
  const range = response.headers.get("content-range") || "*/0";
  const count = Number(range.split("/")[1] || 0);
  return Number.isFinite(count) ? count : 0;
}

async function supabase(path, options = {}) {
  if (!cloudConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...supabaseAuthHeaders(),
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = raw; }
  }
  if (!response.ok) {
    const error = new Error(`SUPABASE_${response.status}`);
    error.details = data;
    throw error;
  }
  return data;
}

export async function createSessionRecord(state) {
  const rows = await supabase("game_sessions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      public_id: state.sessionId,
      archive_code: state.storyBible.archiveId,
      status: "active",
      player_count: state.playerCount,
      phase: state.phase,
      identities: state.identities,
      private_state: state,
      source_archive_id: state.sourceArchiveId || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
  });
  return rows?.[0] || null;
}

export async function getSessionRecord(sessionId) {
  const rows = await supabase(
    `game_sessions?public_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`,
    { method: "GET" }
  );
  return rows?.[0] || null;
}

export async function updateSessionRecord(state, status = "active") {
  const rows = await supabase(`game_sessions?public_id=eq.${encodeURIComponent(state.sessionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status,
      phase: state.phase,
      private_state: state,
      sealed_at: status === "sealed" ? new Date().toISOString() : null
    })
  });
  return rows?.[0] || null;
}

export async function insertContribution({ state, phase, content, contributionType, ownerIndex = 0, motifs = [] }) {
  const participantIdentity = state.identities?.[ownerIndex] || state.identities?.[0] || "未登记参与者";
  await supabase("contributions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      session_public_id: state.sessionId,
      phase,
      contribution_type: contributionType,
      content,
      display_identity: participantIdentity,
      source_class: "registered",
      motifs,
      is_sealed: false
    })
  });
}

export async function getLegacyFragment() {
  const rows = await supabase(
    "legacy_fragments?safety_status=eq.approved&select=id,archive_id,quote,motifs,next_hook,reuse_count&order=reuse_count.asc,created_at.asc&limit=12",
    { method: "GET" }
  );
  if (!rows?.length) return null;
  const pick = rows[Math.floor(Math.random() * Math.min(rows.length, 6))];
  await supabase(`legacy_fragments?id=eq.${pick.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ reuse_count: Number(pick.reuse_count || 0) + 1 })
  });
  return {
    id: pick.id,
    archiveId: pick.archive_id,
    quote: pick.quote,
    motifs: pick.motifs || [],
    nextHook: pick.next_hook
  };
}

export async function saveArchive(state, archive) {
  const slug = `${String(archive.archiveId || "archive").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.sessionId.slice(0, 8)}`;
  const archiveRows = await supabase("archives", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_public_id: state.sessionId,
      archive_code: archive.archiveId,
      title: archive.title,
      final_archive: archive,
      share_slug: slug,
      reuse_allowed: state.reuseAllowed !== false
    })
  });
  const record = archiveRows?.[0];
  if (record && archive.legacySeed && state.reuseAllowed !== false) {
    await supabase("legacy_fragments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        archive_id: record.id,
        quote: archive.legacySeed.quote,
        motifs: archive.legacySeed.motifs || [],
        next_hook: archive.legacySeed.nextHook,
        reuse_count: 0,
        safety_status: "approved"
      })
    });
  }
  return { id: record?.id || null, slug };
}

export async function getArchiveBySlug(slug) {
  const rows = await supabase(
    `archives?share_slug=eq.${encodeURIComponent(slug)}&select=id,archive_code,title,final_archive,share_slug,created_at&limit=1`,
    { method: "GET" }
  );
  return rows?.[0] || null;
}

export async function listPlayableArchives(limit = 12) {
  const safeLimit = Math.min(40, Math.max(1, Number(limit) || 12));
  const rows = await supabase(
    `archives?select=id,archive_code,title,final_archive,share_slug,created_at&order=created_at.desc&limit=${safeLimit}`,
    { method: "GET" }
  );
  return (rows || []).filter((row) => Array.isArray(row?.final_archive?.rules) && row.final_archive.rules.length >= 4);
}

export async function getRandomPlayableArchive(excludedSlugs = []) {
  const excluded = new Set((excludedSlugs || []).map(String));
  const rows = await listPlayableArchives(40);
  if (!rows.length) return null;
  const fresh = rows.filter((row) => !excluded.has(row.share_slug));
  const pool = fresh.length ? fresh : rows;
  // Keep recent community work visible while retaining enough randomness to avoid repetition.
  const weightedPool = pool.slice(0, Math.min(pool.length, 18));
  return weightedPool[Math.floor(Math.random() * weightedPool.length)] || pool[0];
}

export async function getReusablePlayBlueprints(archiveId, limit = 12) {
  if (!archiveId) return [];
  const safeLimit = Math.min(24, Math.max(1, Number(limit) || 12));
  const rows = await supabase(
    `game_sessions?source_archive_id=eq.${encodeURIComponent(archiveId)}&select=private_state,created_at&order=created_at.desc&limit=${safeLimit}`,
    { method: "GET" }
  );
  const seen = new Set();
  const blueprints = [];
  for (const row of rows || []) {
    const state = row?.private_state;
    if (!state || state.mode !== "enter_archive" || Number(state.aiCalls || 0) < 1) continue;
    if (!Array.isArray(state.scenePlan) || state.scenePlan.length !== 4 || !state.publicOpening?.firstScene) continue;
    const fingerprint = JSON.stringify([
      state.publicOpening?.dossierTitle,
      state.privateBible?.actualIdentity,
      state.scenePlan?.map((scene) => scene?.title)
    ]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    blueprints.push({
      privateBible: state.privateBible,
      endingGuide: state.endingGuide,
      scenePlan: state.scenePlan,
      publicOpening: state.publicOpening
    });
    if (blueprints.length >= 6) break;
  }
  return blueprints;
}

export async function savePlayFieldNote({ archiveId, quote, motifs = [], nextHook }) {
  if (!archiveId || !quote || !nextHook) return null;
  const rows = await supabase("legacy_fragments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      archive_id: archiveId,
      quote: String(quote).slice(0, 500),
      motifs: Array.isArray(motifs) ? motifs.slice(0, 12) : [],
      next_hook: String(nextHook).slice(0, 500),
      reuse_count: 0,
      safety_status: "approved"
    })
  });
  return rows?.[0] || null;
}

export async function archiveStats() {
  const count = await supabaseCount("legacy_fragments?safety_status=eq.approved&select=id");
  return { legacyCount: count };
}

export async function enforceRateLimit({ key, scope, limit, windowMinutes }) {
  if (!cloudConfigured()) return { allowed: true, remaining: limit };
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const used = await supabaseCount(
    `rate_limit_events?client_key=eq.${encodeURIComponent(key)}&scope=eq.${encodeURIComponent(scope)}&created_at=gte.${encodeURIComponent(since)}&select=id`
  );
  if (used >= limit) return { allowed: false, remaining: 0 };
  await supabase("rate_limit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ client_key: key, scope })
  });
  return { allowed: true, remaining: Math.max(0, limit - used - 1) };
}

export async function getLegacyFragmentByArchiveSlug(slug) {
  const archive = await getArchiveBySlug(slug);
  if (!archive?.final_archive?.legacySeed) return null;
  return {
    archiveId: archive.id || null,
    quote: archive.final_archive.legacySeed.quote,
    motifs: archive.final_archive.legacySeed.motifs || [],
    nextHook: archive.final_archive.legacySeed.nextHook || "",
    sourceTitle: archive.title
  };
}
