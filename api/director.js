import { decryptState, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals, proModel } from "../lib/deepseek.js";
import {
  extractMotifs,
  fallbackAfterFirstChoice,
  fallbackAfterFirstRule,
  fallbackAfterSecondRule,
  fallbackFinalArchive
} from "../lib/fallback.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import {
  advanceSystemPrompt,
  advanceUserPrompt,
  directorFoundationPrompt,
  finalSystemPrompt,
  finalUserPrompt,
  storyContextPrompt
} from "../lib/prompts.js";
import { sanitizeShortText, validateContribution } from "../lib/safety.js";
import {
  cloudConfigured,
  enforceRateLimit,
  getSessionRecord,
  insertContribution,
  saveArchive,
  updateSessionRecord
} from "../lib/storage.js";
import { mergePrivatePatch, validateAdvance, validateArchive } from "../lib/validate.js";
import { DEFAULT_CHOICES_FINAL, DEFAULT_CHOICES_ONE } from "../lib/constants.js";

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

async function persist(state, mode, status = "active") {
  if (mode === "supabase") {
    await updateSessionRecord(state, status);
    return null;
  }
  return encryptState(state);
}

async function maybeRateLimit(req) {
  if (!cloudConfigured()) return;
  const key = hashValue(requestIp(req));
  const minute = await enforceRateLimit({ key, scope: "director-minute", limit: 12, windowMinutes: 1 });
  if (!minute.allowed) throw new Error("RATE_LIMIT_MINUTE");
  const dailyLimit = Math.max(50, Number(process.env.DAILY_AI_LIMIT || 1000));
  const daily = await enforceRateLimit({ key, scope: "director-day", limit: dailyLimit, windowMinutes: 1440 });
  if (!daily.allowed) throw new Error("RATE_LIMIT_DAY");
}

async function runAdvance(state, action, fallbackPublic, fallbackChoices) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { public: fallbackPublic, privatePatch: {}, aiMode: "fallback" };
  }
  try {
    const result = await callDeepSeek({
      model: fastModel(),
      system: [directorFoundationPrompt, storyContextPrompt(state), advanceSystemPrompt],
      user: advanceUserPrompt({ phase: action, state }),
      thinking: false,
      reasoningEffort: "low",
      maxTokens: 2800,
      userId: hashValue(state.sessionId)
    });
    const validated = validateAdvance(result.data, fallbackPublic, action, fallbackChoices);
    return { ...validated, aiMode: "deepseek-flash", usageResult: result };
  } catch (error) {
    console.error(`DeepSeek ${action} failed; fallback used`, error);
    return { public: fallbackPublic, privatePatch: {}, aiMode: "fallback" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const body = await readJson(req);
    const action = String(body.action || "");
    if (!expectedPhase(action)) return json(res, 400, { error: "档案阶段无效。" });
    const loaded = await loadState(body);
    let state = loaded.state;
    if (state.phase !== expectedPhase(action)) {
      return json(res, 409, { error: "这份档案已经翻到下一页，请刷新后继续。" });
    }

    await maybeRateLimit(req);
    let publicResult;
    let aiMode = "fallback";
    let shareSlug = null;

    if (action === "after_first_rule") {
      state.firstRule = validateContribution(body.firstRule, { min: 6, max: 120 });
      const fallbackPublic = fallbackAfterFirstRule(state);
      const result = await runAdvance(state, action, fallbackPublic, DEFAULT_CHOICES_ONE);
      state = mergePrivatePatch(state, result.privatePatch);
      if (result.usageResult) state.aiUsage = mergeUsageTotals(state.aiUsage, result.usageResult);
      state.phase = "awaiting_first_choice";
      state.aiCalls += result.aiMode.startsWith("deepseek") ? 1 : 0;
      publicResult = result.public;
      aiMode = result.aiMode;
      if (loaded.mode === "supabase") {
        await insertContribution({
          state,
          phase: action,
          content: state.firstRule,
          contributionType: "sentence",
          ownerIndex: 0,
          motifs: extractMotifs(state.firstRule)
        });
      }
    }

    if (action === "after_first_choice") {
      const allowed = DEFAULT_CHOICES_ONE.map((choice) => choice.id);
      if (!allowed.includes(body.firstChoice)) return json(res, 400, { error: "请选择档案中存在的处理方式。" });
      state.firstChoice = body.firstChoice;
      const fallbackPublic = fallbackAfterFirstChoice(state);
      const result = await runAdvance(state, action, fallbackPublic, []);
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
      state.secondRule = validateContribution(body.secondRule, { min: 6, max: 120 });
      const fallbackPublic = fallbackAfterSecondRule(state);
      const result = await runAdvance(state, action, fallbackPublic, DEFAULT_CHOICES_FINAL);
      state = mergePrivatePatch(state, result.privatePatch);
      if (result.usageResult) state.aiUsage = mergeUsageTotals(state.aiUsage, result.usageResult);
      state.phase = "awaiting_final_choice";
      state.aiCalls += result.aiMode.startsWith("deepseek") ? 1 : 0;
      publicResult = result.public;
      aiMode = result.aiMode;
      if (state.playerCount >= 3 && !publicResult.finalNotePrompt) publicResult.finalNotePrompt = fallbackPublic.finalNotePrompt;
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.secondRule, contributionType: "sentence", ownerIndex: Math.min(1, state.playerCount - 1), motifs: extractMotifs(state.secondRule) });
      }
    }

    if (action === "finalize") {
      const allowed = DEFAULT_CHOICES_FINAL.map((choice) => choice.id);
      if (!allowed.includes(body.finalChoice)) return json(res, 400, { error: "请选择档案中存在的最终行动。" });
      state.finalChoice = body.finalChoice;
      state.finalNote = body.finalNote ? validateContribution(body.finalNote, { min: 6, max: 90 }) : "";
      const fallbackArchive = fallbackFinalArchive(state);
      let archive = fallbackArchive;
      aiMode = "fallback";
      if (process.env.DEEPSEEK_API_KEY) {
        try {
          const result = await callDeepSeek({ model: proModel(), system: [directorFoundationPrompt, storyContextPrompt(state), finalSystemPrompt], user: finalUserPrompt({ state }), thinking: true, reasoningEffort: "high", maxTokens: 7600, userId: hashValue(state.sessionId) });
          archive = validateArchive(result.data, fallbackArchive, state);
          aiMode = "deepseek-pro";
          state.aiCalls += 1;
          state.aiUsage = mergeUsageTotals(state.aiUsage, result);
        } catch (error) { console.error("DeepSeek finalize failed; fallback used", error); }
      }
      state.phase = "sealed";
      state.sealedAt = new Date().toISOString();
      if (loaded.mode === "supabase") {
        await insertContribution({ state, phase: action, content: state.finalChoice, contributionType: "choice", ownerIndex: Math.min(2, state.playerCount - 1) });
        if (state.finalNote) await insertContribution({ state, phase: "final_note", content: state.finalNote, contributionType: "sentence", ownerIndex: Math.min(2, state.playerCount - 1), motifs: extractMotifs(state.finalNote) });
        const saved = await saveArchive(state, archive);
        shareSlug = saved.slug;
      }
      publicResult = { archive };
    }

    const status = state.phase === "sealed" ? "sealed" : "active";
    const stateToken = await persist(state, loaded.mode, status);
    return json(res, 200, { ...publicResult, sessionId: state.sessionId, stateToken, phase: state.phase, aiMode, cloudMode: loaded.mode, shareSlug });
  } catch (error) {
    console.error("director error", error);
    const code = String(error?.message || "");
    if (code === "SESSION_NOT_FOUND" || code.includes("INVALID_STATE_TOKEN")) return json(res, 401, { error: "这份档案的临时通行证已经失效，请重新开局。" });
    if (code === "RATE_LIMIT_MINUTE") return json(res, 429, { error: "档案翻页太快了，请停一会儿再继续。" });
    if (code === "RATE_LIMIT_DAY") return json(res, 429, { error: "今天的档案调用额度已经用完，请明天再来。" });
    if (error instanceof Error && /记录|档案|至少|最多|填写|重复字符/.test(error.message)) return json(res, 400, { error: error.message });
    return json(res, 500, { error: "档案暂时无法继续，但你写下的句子没有丢失。请再试一次。" });
  }
}
