import { randomCode, randomId, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import { publicRules, rolesForParty } from "../lib/play-core.js";
import { fallbackBlueprint, normalizePlayBlueprint } from "../lib/play-blueprint.js";
import { playFoundationPrompt, playSeedUserPrompt } from "../lib/play-prompts.js";
import {
  cloudConfigured,
  createSessionRecord,
  enforceRateLimit,
  getArchiveBySlug,
  getRandomPlayableArchive
} from "../lib/storage.js";

async function aiPermission(ipKey) {
  if (!process.env.DEEPSEEK_API_KEY) return { allowAi: false, reason: "no-key" };
  if (!cloudConfigured()) return { allowAi: true };
  const minute = await enforceRateLimit({ key: ipKey, scope: "play-blueprint-minute", limit: 4, windowMinutes: 1 });
  if (!minute.allowed) return { allowAi: false, reason: "minute-limit" };
  const device = await enforceRateLimit({
    key: ipKey,
    scope: "play-blueprint-device-day",
    limit: Math.max(8, Number(process.env.DEVICE_DAILY_AI_LIMIT || 40)),
    windowMinutes: 1440
  });
  if (!device.allowed) return { allowAi: false, reason: "device-budget" };
  const global = await enforceRateLimit({
    key: "__global__",
    scope: "play-blueprint-global-day",
    limit: Math.max(24, Number(process.env.DAILY_AI_LIMIT || 60)),
    windowMinutes: 1440
  });
  return global.allowed ? { allowAi: true } : { allowAi: false, reason: "global-budget" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    if (!cloudConfigured()) return json(res, 503, { error: "档案馆尚未连接，暂时无法进入已封存世界。" });
    const body = await readJson(req);
    const partySize = Math.min(4, Math.max(1, Number(body.partySize || 1)));
    const excludedSlugs = Array.isArray(body.excludedSlugs) ? body.excludedSlugs.slice(0, 12) : [];
    const requestedSlug = String(body.slug || "").trim();
    const archiveRecord = requestedSlug
      ? await getArchiveBySlug(requestedSlug)
      : await getRandomPlayableArchive(excludedSlugs);
    if (!archiveRecord) return json(res, 404, { error: "还没有可进入的封存档案。先完成一局共创，让规则真正诞生。" });

    const ipKey = hashValue(requestIp(req));
    const permission = await aiPermission(ipKey);
    const roleOrder = rolesForParty(partySize);
    const fallback = fallbackBlueprint(archiveRecord, partySize);
    let generated = fallback;
    let aiMode = "fallback-blueprint-v2";
    let aiUsage = {};

    if (permission.allowAi) {
      try {
        const result = await callDeepSeek({
          model: fastModel(),
          system: [playFoundationPrompt],
          user: playSeedUserPrompt({
            archiveRecord,
            partySize,
            roleOrder,
            randomSeed: `${Date.now()}-${randomCode(8)}`
          }),
          thinking: false,
          reasoningEffort: "high",
          maxTokens: 3600,
          timeoutMs: 18000,
          userId: ipKey
        });
        generated = normalizePlayBlueprint(result.data, archiveRecord, partySize);
        aiMode = "deepseek-five-scene-blueprint";
        aiUsage = mergeUsageTotals(aiUsage, result);
      } catch (error) {
        console.error("play blueprint missed deadline; complete local blueprint used", error);
      }
    }

    const sessionId = randomId();
    const state = {
      version: 4,
      mode: "enter_archive",
      aiStrategy: "blueprint-local-final",
      sessionId,
      roomCode: randomCode(6),
      // Existing database constraint supports 1-3. partySize preserves the real 1-4 same-screen group size.
      playerCount: Math.min(3, partySize),
      partySize,
      identities: roleOrder,
      roleOrder,
      storyBible: {
        archiveId: `RUN-${archiveRecord.archive_code || "ARCHIVE"}`,
        title: generated.publicOpening.dossierTitle,
        coreMotifs: archiveRecord.final_archive?.legacySeed?.motifs || []
      },
      sourceArchiveId: archiveRecord.id,
      sourceArchiveSlug: archiveRecord.share_slug,
      sourceArchiveRecord: archiveRecord,
      ruleHandbook: publicRules(archiveRecord),
      privateBible: generated.privateBible,
      endingGuide: generated.endingGuide,
      scenePlan: generated.scenePlan,
      publicOpening: generated.publicOpening,
      currentScene: generated.publicOpening.firstScene,
      phase: "play_scene",
      sceneIndex: 0,
      totalScenes: 5,
      metrics: { evidence: 10, contamination: 5, identity: 75, trust: 50 },
      routeFlags: [],
      choiceHistory: [],
      createdAt: new Date().toISOString(),
      aiCalls: aiMode.startsWith("deepseek") ? 1 : 0,
      aiUsage
    };

    let stateToken = null;
    let cloudMode = "supabase";
    try {
      await createSessionRecord(state);
    } catch (error) {
      console.error("play cloud session create failed", error);
      if (canEncryptState()) {
        stateToken = encryptState(state);
        cloudMode = "stateless";
      } else {
        return json(res, 500, { error: "档案已经打开，但临时通行证没有保存成功。请重试。" });
      }
    }

    return json(res, 200, {
      ok: true,
      sessionId,
      stateToken,
      cloudMode,
      aiMode,
      aiStrategy: state.aiStrategy,
      plannedAiCallsPerGame: 2,
      budgetFallback: permission.reason || null,
      archive: {
        slug: archiveRecord.share_slug,
        code: archiveRecord.archive_code,
        title: archiveRecord.final_archive?.title || archiveRecord.title,
        rules: state.ruleHandbook
      },
      partySize,
      roleOrder,
      opening: generated.publicOpening,
      metricsView: {
        evidence: "尚少",
        contamination: "轻微",
        identity: "基本稳定",
        trust: "未定"
      }
    });
  } catch (error) {
    console.error("play session error", error);
    return json(res, 500, { error: "进入档案时发生了中断。" });
  }
}
