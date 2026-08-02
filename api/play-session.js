import { randomCode, randomId, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import { publicRules, rolesForParty } from "../lib/play-core.js";
import { normalizePlayBlueprint } from "../lib/play-blueprint.js";
import { adaptBlueprintParty, assertBlueprintQuality } from "../lib/play-blueprint-quality.js";
import { playFoundationPrompt, playRecoveryUserPrompt, playSeedUserPrompt } from "../lib/play-prompts.js";
import {
  cloudConfigured,
  createSessionRecord,
  enforceRateLimit,
  getArchiveBySlug,
  getRandomPlayableArchive,
  getReusablePlayBlueprints
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

function pickCached(cached, archiveRecord, partySize) {
  if (!cached.length) return null;
  const raw = cached[Math.floor(Math.random() * cached.length)];
  return adaptBlueprintParty(normalizePlayBlueprint(raw, archiveRecord, partySize), partySize);
}

async function generateBlueprint({ archiveRecord, partySize, roleOrder, ipKey, recovery = false }) {
  const randomSeed = `${Date.now()}-${randomCode(8)}`;
  const result = await callDeepSeek({
    model: fastModel(),
    system: [playFoundationPrompt],
    user: recovery
      ? playRecoveryUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed })
      : playSeedUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }),
    thinking: false,
    reasoningEffort: "low",
    maxTokens: recovery ? 1150 : 1700,
    timeoutMs: recovery ? 12000 : 20000,
    maxAttempts: 1,
    userId: ipKey
  });
  assertBlueprintQuality(result.data);
  return {
    blueprint: adaptBlueprintParty(normalizePlayBlueprint(result.data, archiveRecord, partySize), partySize),
    result,
    mode: recovery ? "deepseek-compact-recovery-blueprint" : "deepseek-five-scene-blueprint"
  };
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

    const roleOrder = rolesForParty(partySize);
    let cached = [];
    try {
      cached = await getReusablePlayBlueprints(archiveRecord.id, 12);
    } catch (error) {
      console.error("play blueprint cache read failed", error);
    }

    let generated = null;
    let aiMode = "";
    let aiUsage = {};
    let permissionReason = null;
    let failureCode = null;
    const preferCache = cached.length >= 2 && Math.random() < 0.7;

    if (preferCache) {
      generated = pickCached(cached, archiveRecord, partySize);
      aiMode = "cached-ai-blueprint";
    } else {
      const ipKey = hashValue(requestIp(req));
      const permission = await aiPermission(ipKey);
      permissionReason = permission.reason || null;
      if (permission.allowAi) {
        try {
          const live = await generateBlueprint({ archiveRecord, partySize, roleOrder, ipKey, recovery: false });
          generated = live.blueprint;
          aiMode = live.mode;
          aiUsage = mergeUsageTotals(aiUsage, live.result);
        } catch (firstError) {
          failureCode = String(firstError?.message || "BLUEPRINT_PRIMARY_FAILED");
          console.error("full play blueprint failed; one compact recovery starting", firstError);
          try {
            const recovery = await generateBlueprint({ archiveRecord, partySize, roleOrder, ipKey, recovery: true });
            generated = recovery.blueprint;
            aiMode = recovery.mode;
            aiUsage = mergeUsageTotals(aiUsage, recovery.result);
          } catch (recoveryError) {
            failureCode = String(recoveryError?.message || failureCode || "BLUEPRINT_RECOVERY_FAILED");
            console.error("compact play blueprint also failed", recoveryError);
          }
        }
      }
      if (!generated && cached.length) {
        generated = pickCached(cached, archiveRecord, partySize);
        aiMode = "cached-ai-blueprint-recovery";
      }
    }

    if (!generated) {
      const isTimeout = failureCode?.includes("TIMEOUT");
      const isIncomplete = failureCode?.includes("INCOMPLETE") || failureCode?.includes("INVALID_JSON");
      return json(res, 503, {
        error: permissionReason
          ? "这份档案现在没有可用的馆藏路线，今日展开额度也暂时不足。请稍后再进入。"
          : isTimeout
            ? "档案馆在限定时间内没有完成这条路线。本次已停止继续等待，请重新尝试或换一份档案。"
            : isIncomplete
              ? "这次生成的路线缺少关键场景，为了不拿粗糙模板冒充剧情，本次没有打开。请重试。"
              : "这份档案没有完整展开。为了不让通用模板破坏故事，本次没有强行进入，请重新尝试。",
        code: "BLUEPRINT_NOT_READY",
        reason: failureCode || permissionReason || "unknown"
      });
    }

    const sessionId = randomId();
    const state = {
      version: 6,
      mode: "enter_archive",
      aiStrategy: "bounded-quality-blueprint-local-final",
      blueprintSource: aiMode,
      sessionId,
      roomCode: randomCode(6),
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
      plannedAiCallsPerGame: aiMode.startsWith("cached") ? 1 : 2,
      budgetFallback: permissionReason,
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
