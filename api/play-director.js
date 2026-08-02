import { decryptState, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import {
  applyMetrics,
  fallbackAdvance,
  fallbackEnding,
  normalizeAdvance,
  normalizeEnding
} from "../lib/play-core.js";
import { playAdvanceUserPrompt, playFoundationPrompt } from "../lib/play-prompts.js";
import {
  cloudConfigured,
  enforceRateLimit,
  getSessionRecord,
  insertContribution,
  savePlayFieldNote,
  updateSessionRecord
} from "../lib/storage.js";

async function loadState(body) {
  if (cloudConfigured() && body.sessionId) {
    const record = await getSessionRecord(body.sessionId);
    if (record?.private_state) return { state: record.private_state, mode: "supabase" };
  }
  if (body.stateToken && canEncryptState()) return { state: decryptState(body.stateToken), mode: "stateless" };
  throw new Error("SESSION_NOT_FOUND");
}

async function persist(state, mode, status = "active") {
  if (mode === "supabase") {
    await updateSessionRecord(state, status);
    return null;
  }
  return encryptState(state);
}

async function aiPermission(req) {
  if (!process.env.DEEPSEEK_API_KEY) return { allowAi: false, reason: "no-key" };
  if (!cloudConfigured()) return { allowAi: true };
  const key = hashValue(requestIp(req));
  const minute = await enforceRateLimit({ key, scope: "play-director-minute", limit: 10, windowMinutes: 1 });
  if (!minute.allowed) throw new Error("RATE_LIMIT_MINUTE");
  const device = await enforceRateLimit({
    key,
    scope: "play-director-device-day",
    limit: Math.max(20, Number(process.env.DEVICE_DAILY_AI_LIMIT || 40)),
    windowMinutes: 1440
  });
  if (!device.allowed) return { allowAi: false, reason: "device-budget" };
  const global = await enforceRateLimit({
    key: "__global__",
    scope: "play-director-global-day",
    limit: Math.max(50, Number(process.env.DAILY_AI_LIMIT || 60)),
    windowMinutes: 1440
  });
  return global.allowed ? { allowAi: true } : { allowAi: false, reason: "global-budget" };
}

function metricBand(key, value) {
  if (key === "contamination") {
    if (value < 20) return "轻微";
    if (value < 45) return "正在渗入";
    if (value < 70) return "明显异常";
    return "接近失控";
  }
  if (key === "identity") {
    if (value >= 75) return "基本稳定";
    if (value >= 50) return "出现裂缝";
    if (value >= 25) return "正在被替换";
    return "几乎无法确认";
  }
  if (key === "evidence") {
    if (value < 25) return "尚少";
    if (value < 50) return "可以互证";
    if (value < 75) return "接近真相";
    return "足以推翻记录";
  }
  if (value < 25) return "几乎不信";
  if (value < 50) return "保持怀疑";
  if (value < 75) return "倾向相信";
  return "高度服从";
}

function metricsView(metrics) {
  return {
    evidence: metricBand("evidence", metrics.evidence),
    contamination: metricBand("contamination", metrics.contamination),
    identity: metricBand("identity", metrics.identity),
    trust: metricBand("trust", metrics.trust)
  };
}

async function generateStep(state, selectedOption, isFinal) {
  const result = await callDeepSeek({
    model: fastModel(),
    system: [playFoundationPrompt],
    user: playAdvanceUserPrompt({ state, selectedOption }),
    thinking: false,
    reasoningEffort: isFinal ? "high" : "medium",
    maxTokens: isFinal ? 4200 : 2400,
    timeoutMs: isFinal ? 17000 : 11000,
    userId: hashValue(state.sessionId)
  });
  return { result, data: result.data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const body = await readJson(req);
    const loaded = await loadState(body);
    let state = loaded.state;
    if (state.mode !== "enter_archive" || state.phase !== "play_scene") {
      return json(res, 409, { error: "这次进入已经结束，或档案不在可行动的页面。" });
    }

    const optionId = String(body.optionId || "");
    const options = Array.isArray(state.currentScene?.options) ? state.currentScene.options : [];
    const selectedOption = options.find((option) => String(option.id) === optionId);
    if (!selectedOption) return json(res, 400, { error: "请选择当前场景中存在的行动。" });

    const permission = await aiPermission(req);
    const isFinal = Number(state.sceneIndex || 0) >= Number(state.totalScenes || 5) - 1;
    let output = isFinal ? fallbackEnding(state, selectedOption) : fallbackAdvance(state, selectedOption);
    let aiMode = "fallback-survival";
    let usageResult = null;

    if (permission.allowAi) {
      try {
        const generated = await generateStep(state, selectedOption, isFinal);
        output = isFinal
          ? normalizeEnding(generated.data, state, selectedOption)
          : normalizeAdvance(generated.data, state, selectedOption);
        usageResult = generated.result;
        aiMode = isFinal ? "deepseek-survival-final" : "deepseek-survival-scene";
      } catch (error) {
        console.error("play director missed live deadline; fallback used", error);
      }
    }

    const delta = output.privatePatch?.metricsDelta || {};
    state.metrics = applyMetrics(state.metrics, delta);
    state.routeFlags = [...new Set([...(state.routeFlags || []), ...(output.privatePatch?.addFlags || [])])].slice(-30);
    const historyItem = {
      sceneNo: Number(state.sceneIndex || 0) + 1,
      sceneTitle: state.currentScene?.title || `第${Number(state.sceneIndex || 0) + 1}幕`,
      optionId: selectedOption.id,
      label: selectedOption.label,
      action: selectedOption.action,
      approach: selectedOption.approach,
      ruleRefs: selectedOption.ruleRefs || [],
      consequenceNote: output.privatePatch?.consequenceNote || "",
      metricsAfter: state.metrics
    };
    state.choiceHistory = [...(state.choiceHistory || []), historyItem];
    if (usageResult) {
      state.aiCalls = Number(state.aiCalls || 0) + 1;
      state.aiUsage = mergeUsageTotals(state.aiUsage || {}, usageResult);
    }

    if (loaded.mode === "supabase") {
      try {
        await insertContribution({
          state,
          phase: `play_scene_${historyItem.sceneNo}`,
          content: `${selectedOption.label}：${selectedOption.action}`,
          contributionType: "choice",
          ownerIndex: (historyItem.sceneNo - 1) % Math.max(1, state.identities?.length || 1),
          motifs: selectedOption.ruleRefs || []
        });
      } catch (error) {
        console.error("play contribution save failed", error);
      }
    }

    let publicPayload;
    let status = "active";
    if (isFinal) {
      state.phase = "play_sealed";
      state.ending = output.ending;
      state.sealedAt = new Date().toISOString();
      status = "sealed";
      publicPayload = { ending: output.ending };
      if (loaded.mode === "supabase" && output.ending?.fieldNote && output.ending?.nextHook) {
        try {
          await savePlayFieldNote({
            archiveId: state.sourceArchiveId,
            quote: output.ending.fieldNote,
            motifs: state.storyBible?.coreMotifs || [],
            nextHook: output.ending.nextHook
          });
        } catch (error) {
          console.error("play field note save failed", error);
        }
      }
    } else {
      state.sceneIndex = Number(state.sceneIndex || 0) + 1;
      state.currentScene = output.public.nextScene;
      publicPayload = {
        consequence: output.public.consequence,
        scene: output.public.nextScene,
        identityFragment: output.public.nextScene?.identityFragment || output.privatePatch?.identityFragment || ""
      };
    }

    const stateToken = await persist(state, loaded.mode, status);
    return json(res, 200, {
      ok: true,
      ...publicPayload,
      sessionId: state.sessionId,
      stateToken,
      phase: state.phase,
      sceneIndex: state.sceneIndex,
      totalScenes: state.totalScenes,
      metricsView: metricsView(state.metrics),
      aiMode,
      budgetFallback: permission.reason || null,
      sourceArchiveSlug: state.sourceArchiveSlug
    });
  } catch (error) {
    console.error("play director error", error);
    const code = String(error?.message || "");
    if (code === "SESSION_NOT_FOUND" || code.includes("INVALID_STATE_TOKEN")) {
      return json(res, 401, { error: "这次进入的临时记录已经失效，请重新进入档案。" });
    }
    if (code === "RATE_LIMIT_MINUTE") return json(res, 429, { error: "判断太快了。停几秒，再翻下一页。" });
    return json(res, 500, { error: "场景暂时没有继续展开。你的上一项选择仍然保留。" });
  }
}
