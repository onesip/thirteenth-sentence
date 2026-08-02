import { decryptState, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { loadV2Core } from "../lib/v2-core-loader.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import { validateContribution } from "../lib/safety.js";
import {
  cloudConfigured,
  enforceRateLimit,
  getSessionRecord,
  insertContribution,
  saveArchive,
  updateSessionRecord
} from "../lib/storage.js";
import { DEFAULT_CHOICES_FINAL, DEFAULT_CHOICES_ONE } from "../lib/constants.js";

const corePromise = loadV2Core();

async function loadState(body) {
  if (cloudConfigured() && body.sessionId) {
    const record = await getSessionRecord(body.sessionId);
    if (record?.private_state) return { state: record.private_state, mode: "supabase" };
  }
  if (body.stateToken && canEncryptState()) {
    return { state: decryptState(body.stateToken), mode: "stateless" };
  }
  throw new Error("SESSION_NOT_FOUND");
}

function expectedPhase(action) {
  return {
    after_first_rule: "awaiting_first_rule",
    after_first_choice: "awaiting_first_choice",
    after_second_rule: "awaiting_second_rule",
    finalize: "awaiting_final_choice"
  }[action];
}

function secondRuleOwner(state) {
  return state.playerCount >= 4 ? 2 : Math.min(1, state.playerCount - 1);
}

function finalNoteOwner(state) {
  return Math.min(2, state.playerCount - 1);
}

function finalChoiceOwner(state) {
  return state.playerCount >= 4 ? 3 : Math.min(2, state.playerCount - 1);
}

async function persist(state, mode, status = "active") {
  if (mode === "supabase") {
    await updateSessionRecord(state, status);
    return null;
  }
  return encryptState(state);
}

async function getAiPermission(req) {
  if (!process.env.DEEPSEEK_API_KEY) return { allowAi: false };
  if (!cloudConfigured()) return { allowAi: true };
  const key = hashValue(requestIp(req));
  const minute = await enforceRateLimit({ key, scope: "director-v2-minute", limit: 12, windowMinutes: 1 });
  if (!minute.allowed) throw new Error("RATE_LIMIT_MINUTE");
  const deviceDailyLimit = Math.max(20, Number(process.env.DEVICE_DAILY_AI_LIMIT || 80));
  const deviceDaily = await enforceRateLimit({ key, scope: "director-v2-device-day", limit: deviceDailyLimit, windowMinutes: 1440 });
  if (!deviceDaily.allowed) return { allowAi: false, fallbackReason: "device-daily-budget" };
  const globalDailyLimit = Math.max(50, Number(process.env.DAILY_AI_LIMIT || 150));
  const globalDaily = await enforceRateLimit({ key: "__global__", scope: "director-v2-global-day", limit: globalDailyLimit, windowMinutes: 1440 });
  if (!globalDaily.allowed) return { allowAi: false, fallbackReason: "global-daily-budget" };
  return { allowAi: true };
}

async function runAdvance(state, action, fallbackPublic, fallbackChoices, allowAi) {
  const { directorFoundationPrompt, storyContextPrompt, advanceSystemPrompt, advanceUserPrompt, validateAdvance } = await corePromise;
  if (!allowAi || !process.env.DEEPSEEK_API_KEY) {
    return { public: fallbackPublic, privatePatch: {}, aiMode: "fallback-world-v2" };
  }
  try {
    const result = await callDeepSeek({
      model: fastModel(),
      system: [directorFoundationPrompt, storyContextPrompt(state), advanceSystemPrompt],
      user: advanceUserPrompt({ phase: action, state }),
      thinking: false,
      reasoningEffort: "low",
      maxTokens: 2000,
      timeoutMs: 11000,
      userId: hashValue(state.sessionId)
    });
    const validated = validateAdvance(result.data, fallbackPublic, action, fallbackChoices);
    return { ...validated, aiMode: "deepseek-flash-v2", usageResult: result };
  } catch (error) {
    console.error(`DeepSeek V2 ${action} missed the live deadline; world fallback used`, error);
    return { public: fallbackPublic, privatePatch: {}, aiMode: "fallback-world-v2" };
  }
}

async function generateFinalArchive(state, fallbackArchive) {
  const { directorFoundationPrompt, storyContextPrompt, finalSystemPrompt, finalUserPrompt, validateArchive } = await corePromise;
  const result = await callDeepSeek({
    model: fastModel(),
    system: [directorFoundationPrompt, storyContextPrompt(state), finalSystemPrompt],
    user: finalUserPrompt({ state }),
    thinking: false,
    reasoningEffort: "high",
    maxTokens: 4800,
    timeoutMs: 19000,
    userId: hashValue(state.sessionId)
  });
  return {
    archive: validateArchive(result.data, fallbackArchive, state),
    result,
    aiMode: "deepseek-flash-final-v2"
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const core = await corePromise;
    const {
      extractMotifs,
      fallbackAfterFirstChoice,
      fallbackAfterFirstRule,
      fallbackAfterSecondRule,
      fallbackFinalArchive,
      mergePrivatePatch
    } = core;
    const body = await readJson(req);
    const action = String(body.action || "");
    if (!expectedPhase(action)) return json(res, 400, { error: "档案阶段无效。" });

    const loaded = await loadState(body);
    let state = loaded.state;
    if (state.phase !== expectedPhase(action)) {
      return json(res, 409, { error: "这份档案已经翻到下一页，请刷新后继续。" });
    }

    const aiPermission = await getAiPermission(req);
    let publicResult;
    let aiMode = "fallback-world-v2";
    let shareSlug = null;

    if (action === "after_first_rule") {
      state.firstRule = validateContribution(body.firstRule, { min: 6, max: 140 });
      const fallbackPublic = fallbackAfterFirstRule(state);
      const result = await runAdvance(state, action, fallbackPublic, DEFAULT_CHOICES_ONE, aiPermission.allowAi);
      state = mergePrivatePatch(state, result.privatePatch);
      if (result.usageResult) state.aiUsage = mergeUsageTotals(state.aiUsage, result.usageResult);
      state.phase = "awaiting_first_choice";
      state.aiCalls += result.aiMode.startsWith("deepseek") ? 1 : 0;
      publicResult = result.public;
      aiMode = result.aiMode;
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.firstRule, contributionType: "sentence", ownerIndex: 0, motifs: extractMotifs(state.firstRule) });
      }
    }

    if (action === "after_first_choice") {
      const allowed = DEFAULT_CHOICES_ONE.map((choice) => choice.id);
      if (!allowed.includes(body.firstChoice)) return json(res, 400, { error: "请选择档案中存在的处理方式。" });
      state.firstChoice = body.firstChoice;
      const fallbackPublic = fallbackAfterFirstChoice(state);
      const result = await runAdvance(state, action, fallbackPublic, [], aiPermission.allowAi);
      state = mergePrivatePatch(state, result.privatePatch);
      if (result.usageResult) state.aiUsage = mergeUsageTotals(state.aiUsage, result.usageResult);
      state.phase = "awaiting_second_rule";
      state.aiCalls += result.aiMode.startsWith("deepseek") ? 1 : 0;
      publicResult = result.public;
      aiMode = result.aiMode;
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.firstChoice, contributionType: "choice", ownerIndex: Math.min(1, state.playerCount - 1) });
      }
    }

    if (action === "after_second_rule") {
      state.secondRule = validateContribution(body.secondRule, { min: 6, max: 140 });
      const fallbackPublic = fallbackAfterSecondRule(state);
      const result = await runAdvance(state, action, fallbackPublic, DEFAULT_CHOICES_FINAL, aiPermission.allowAi);
      state = mergePrivatePatch(state, result.privatePatch);
      if (result.usageResult) state.aiUsage = mergeUsageTotals(state.aiUsage, result.usageResult);
      state.phase = "awaiting_final_choice";
      state.aiCalls += result.aiMode.startsWith("deepseek") ? 1 : 0;
      publicResult = result.public;
      aiMode = result.aiMode;
      if (state.playerCount >= 3 && !publicResult.finalNotePrompt) publicResult.finalNotePrompt = fallbackPublic.finalNotePrompt;
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.secondRule, contributionType: "sentence", ownerIndex: secondRuleOwner(state), motifs: extractMotifs(state.secondRule) });
      }
    }

    if (action === "finalize") {
      const allowed = DEFAULT_CHOICES_FINAL.map((choice) => choice.id);
      if (!allowed.includes(body.finalChoice)) return json(res, 400, { error: "请选择档案中存在的最终行动。" });
      state.finalChoice = body.finalChoice;
      state.finalNote = body.finalNote ? validateContribution(body.finalNote, { min: 6, max: 100 }) : "";
      const fallbackArchive = fallbackFinalArchive(state);
      let archive = fallbackArchive;
      aiMode = "fallback-world-v2";

      if (aiPermission.allowAi && process.env.DEEPSEEK_API_KEY) {
        try {
          const generated = await generateFinalArchive(state, fallbackArchive);
          archive = generated.archive;
          aiMode = generated.aiMode;
          state.aiCalls += 1;
          state.aiUsage = mergeUsageTotals(state.aiUsage, generated.result);
        } catch (error) {
          console.error("DeepSeek V2 final missed the live deadline; complete world fallback used", error);
        }
      }

      state.phase = "sealed";
      state.sealedAt = new Date().toISOString();
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.finalChoice, contributionType: "choice", ownerIndex: finalChoiceOwner(state) });
        if (state.finalNote) {
          await insertContribution({ state, phase: "final_note", content: state.finalNote, contributionType: "sentence", ownerIndex: finalNoteOwner(state), motifs: extractMotifs(state.finalNote) });
        }
        const saved = await saveArchive(state, archive);
        shareSlug = saved.slug;
      }
      publicResult = { archive };
    }

    const status = state.phase === "sealed" ? "sealed" : "active";
    const stateToken = await persist(state, loaded.mode, status);
    return json(res, 200, {
      ...publicResult,
      sessionId: state.sessionId,
      stateToken,
      phase: state.phase,
      aiMode,
      cloudMode: loaded.mode,
      shareSlug,
      budgetFallback: aiPermission.fallbackReason || null
    });
  } catch (error) {
    console.error("director V2 error", error);
    const code = String(error?.message || "");
    if (code === "SESSION_NOT_FOUND" || code.includes("INVALID_STATE_TOKEN")) return json(res, 401, { error: "这份档案的临时通行证已经失效，请重新开局。" });
    if (code === "RATE_LIMIT_MINUTE") return json(res, 429, { error: "档案翻页太快了，请停一会儿再继续。" });
    if (error instanceof Error && /记录|档案|至少|最多|填写|重复字符/.test(error.message)) return json(res, 400, { error: error.message });
    return json(res, 500, { error: "档案暂时无法继续，但你写下的句子没有丢失。请再试一次。" });
  }
}
