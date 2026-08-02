import { IDENTITY_POOL } from "../lib/constants.js";
import { randomCode, randomId, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { createFallbackStory, fallbackOpening } from "../lib/fallback.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import { directorFoundationPrompt, seedSystemPrompt, seedUserPrompt } from "../lib/prompts.js";
import { archiveStats, cloudConfigured, createSessionRecord, enforceRateLimit, getLegacyFragment, getLegacyFragmentByArchiveSlug } from "../lib/storage.js";
import { validateSeed } from "../lib/validate.js";

function pickIdentities(count) {
  const pool = [...IDENTITY_POOL];
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

async function getSeedAiPermission(ipKey) {
  if (!process.env.DEEPSEEK_API_KEY) return { allowAi: false };
  if (!cloudConfigured()) return { allowAi: true };

  const deviceDailyLimit = Math.max(20, Number(process.env.DEVICE_DAILY_AI_LIMIT || 80));
  const deviceDaily = await enforceRateLimit({
    key: ipKey,
    scope: "seed-device-day",
    limit: deviceDailyLimit,
    windowMinutes: 1440
  });
  if (!deviceDaily.allowed) return { allowAi: false, fallbackReason: "device-daily-budget" };

  const globalDailyLimit = Math.max(50, Number(process.env.DAILY_AI_LIMIT || 150));
  const globalDaily = await enforceRateLimit({
    key: "__global__",
    scope: "seed-global-day",
    limit: globalDailyLimit,
    windowMinutes: 1440
  });
  if (!globalDaily.allowed) return { allowAi: false, fallbackReason: "global-daily-budget" };

  return { allowAi: true };
}

async function generateSeed({ playerCount, identities, legacyFragment, ipKey }) {
  const user = seedUserPrompt({
    playerCount,
    identities,
    legacyFragment,
    randomSeed: `${Date.now()}-${randomCode(6)}`
  });

  const result = await callDeepSeek({
    model: fastModel(),
    system: [directorFoundationPrompt, seedSystemPrompt],
    user,
    thinking: false,
    reasoningEffort: "low",
    maxTokens: 2300,
    timeoutMs: 10000,
    userId: ipKey
  });

  return { result, aiMode: "deepseek-flash-seed" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const body = await readJson(req);
    const playerCount = Math.min(3, Math.max(1, Number(body.playerCount || 1)));
    const reuseAllowed = body.reuseAllowed !== false;
    const identities = pickIdentities(playerCount);
    const ipKey = hashValue(requestIp(req));

    if (cloudConfigured()) {
      const rate = await enforceRateLimit({
        key: ipKey,
        scope: "create-session",
        limit: 20,
        windowMinutes: 60
      });
      if (!rate.allowed) {
        return json(res, 429, { error: "这台设备今天打开的档案太多了，请稍后再试。" });
      }
    }

    const aiPermission = await getSeedAiPermission(ipKey);
    let legacyFragment = null;
    let legacyCount = 0;
    const sourceArchiveSlug = String(body.sourceArchiveSlug || "").trim();

    if (cloudConfigured()) {
      try {
        [legacyFragment, { legacyCount }] = await Promise.all([
          sourceArchiveSlug
            ? getLegacyFragmentByArchiveSlug(sourceArchiveSlug)
            : getLegacyFragment(),
          archiveStats()
        ]);
      } catch (error) {
        console.error("legacy lookup failed", error);
      }
    }

    const fallbackStory = createFallbackStory(legacyFragment);
    const fallbackOpen = fallbackOpening(fallbackStory, identities, legacyFragment);
    let storyBible = fallbackStory;
    let opening = fallbackOpen;
    let aiMode = "fallback";
    let aiUsage = {};

    if (aiPermission.allowAi && process.env.DEEPSEEK_API_KEY) {
      try {
        const generated = await generateSeed({
          playerCount,
          identities,
          legacyFragment,
          ipKey
        });
        const validated = validateSeed(generated.result.data, fallbackStory, fallbackOpen);
        storyBible = validated.storyBible;
        opening = validated.opening;
        aiMode = generated.aiMode;
        aiUsage = mergeUsageTotals(aiUsage, generated.result);
      } catch (error) {
        console.error("DeepSeek seed failed within the opening deadline; fallback used", error);
      }
    }

    identities[0] = opening.primaryIdentity || identities[0];
    const state = {
      version: 2,
      sessionId: randomId(),
      roomCode: randomCode(6),
      playerCount,
      identities,
      reuseAllowed,
      phase: "awaiting_first_rule",
      storyBible,
      opening,
      legacyFragment,
      sourceArchiveId: legacyFragment?.archiveId || null,
      firstRule: "",
      firstChoice: "",
      secondRule: "",
      finalChoice: "",
      finalNote: "",
      motifs: [...new Set(storyBible.coreMotifs || [])],
      directorNotes: [],
      createdAt: new Date().toISOString(),
      aiCalls: aiMode.startsWith("deepseek") ? 1 : 0,
      aiUsage
    };

    let stateToken = null;
    let cloudMode = "stateless";
    if (cloudConfigured()) {
      try {
        await createSessionRecord(state);
        cloudMode = "supabase";
      } catch (error) {
        console.error("cloud session create failed", error);
        if (canEncryptState()) stateToken = encryptState(state);
        else cloudMode = "local-only";
      }
    } else if (canEncryptState()) {
      stateToken = encryptState(state);
    } else {
      cloudMode = "local-only";
    }

    return json(res, 200, {
      sessionId: state.sessionId,
      stateToken,
      playerCount,
      identities,
      opening,
      legacyCount,
      aiMode,
      cloudMode,
      budgetFallback: aiPermission.fallbackReason || null,
      disclosure: "本档案可能包含系统生成文本、历史记录与其他参与者内容；具体来源在游戏过程中不会公开。"
    });
  } catch (error) {
    console.error("session create error", error);
    return json(res, 500, { error: "档案馆暂时无法打开新的房间。" });
  }
}
