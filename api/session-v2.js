import { randomCode, randomId, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { loadV2Core } from "../lib/v2-core-loader.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import {
  archiveStats,
  cloudConfigured,
  createSessionRecord,
  enforceRateLimit,
  getLegacyFragment,
  getLegacyFragmentByArchiveSlug
} from "../lib/storage.js";

function pickIdentities(count, sourcePool) {
  const pool = [...(sourcePool || [])];
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  while (picked.length < count) picked.push(`未登记记录者${picked.length + 1}`);
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

async function generateSeed({
  core,
  playerCount,
  identities,
  partyRoles,
  legacyFragment,
  worldProfile,
  recentHistory,
  ipKey
}) {
  const { directorFoundationPrompt, seedSystemPrompt, seedUserPrompt } = core;
  const user = seedUserPrompt({
    playerCount,
    identities,
    partyRoles,
    legacyFragment,
    worldProfile: {
      key: worldProfile.key,
      code: worldProfile.code,
      name: worldProfile.name,
      genre: worldProfile.genre,
      sceneNumber: worldProfile.sceneNumber,
      premise: worldProfile.premise,
      entryHook: worldProfile.entryHook,
      entity: worldProfile.entity,
      mechanism: worldProfile.mechanism,
      dangerMark: worldProfile.dangerMark,
      motifs: worldProfile.motifs,
      firstTask: worldProfile.firstTask,
      secondTask: worldProfile.secondTask
    },
    recentHistory,
    randomSeed: `${Date.now()}-${randomCode(8)}`
  });

  const result = await callDeepSeek({
    model: fastModel(),
    system: [directorFoundationPrompt, seedSystemPrompt],
    user,
    thinking: false,
    reasoningEffort: "low",
    maxTokens: 2500,
    timeoutMs: 11000,
    userId: ipKey
  });

  return { result, aiMode: "deepseek-flash-seed-v2" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const core = await loadV2Core();
    const {
      chooseWorldProfile,
      partyRolesFor,
      publicWorldProfile,
      createFallbackStory,
      fallbackOpening,
      validateSeed
    } = core;
    const body = await readJson(req);
    const playerCount = Math.min(4, Math.max(1, Number(body.playerCount || 1)));
    const reuseAllowed = body.reuseAllowed !== false;
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
          sourceArchiveSlug ? getLegacyFragmentByArchiveSlug(sourceArchiveSlug) : getLegacyFragment(),
          archiveStats()
        ]);
      } catch (error) {
        console.error("legacy lookup failed", error);
      }
    }

    const recentHistory = {
      worldKeys: Array.isArray(body.recentWorldKeys) ? body.recentWorldKeys.slice(0, 5) : [],
      motifs: Array.isArray(body.recentMotifs) ? body.recentMotifs.slice(0, 16) : [],
      titles: Array.isArray(body.recentTitles) ? body.recentTitles.slice(0, 8) : []
    };
    const worldProfile = chooseWorldProfile({
      recentWorldKeys: recentHistory.worldKeys,
      preferredWorldKey: String(body.preferredWorldKey || "random"),
      sourceWorldKey: legacyFragment?.worldKey || ""
    });
    const identities = pickIdentities(playerCount, worldProfile.identities);
    const partyRoles = partyRolesFor(playerCount, identities);

    const fallbackStory = createFallbackStory(legacyFragment, worldProfile);
    const fallbackOpen = fallbackOpening(fallbackStory, identities, legacyFragment);
    let storyBible = fallbackStory;
    let opening = fallbackOpen;
    let aiMode = "fallback-world-v2";
    let aiUsage = {};

    if (aiPermission.allowAi && process.env.DEEPSEEK_API_KEY) {
      try {
        const generated = await generateSeed({
          core,
          playerCount,
          identities,
          partyRoles,
          legacyFragment,
          worldProfile,
          recentHistory,
          ipKey
        });
        const validated = validateSeed(generated.result.data, fallbackStory, fallbackOpen);
        storyBible = validated.storyBible;
        opening = validated.opening;
        aiMode = generated.aiMode;
        aiUsage = mergeUsageTotals(aiUsage, generated.result);
      } catch (error) {
        console.error("DeepSeek V2 seed missed the opening deadline; varied world fallback used", error);
      }
    }

    identities[0] = opening.primaryIdentity || identities[0];
    const resolvedRoles = partyRolesFor(playerCount, identities);
    const state = {
      version: 3,
      sessionId: randomId(),
      roomCode: randomCode(6),
      playerCount,
      identities,
      partyRoles: resolvedRoles,
      worldKey: storyBible.worldKey || worldProfile.key,
      worldName: storyBible.worldName || worldProfile.name,
      chapterTitle: storyBible.chapterTitle || opening.chapterTitle,
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
      motifs: [...new Set(storyBible.coreMotifs || worldProfile.motifs)],
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
      partyRoles: resolvedRoles,
      world: publicWorldProfile(worldProfile),
      worldKey: state.worldKey,
      worldName: state.worldName,
      chapterTitle: state.chapterTitle,
      opening,
      legacyCount,
      aiMode,
      cloudMode,
      budgetFallback: aiPermission.fallbackReason || null,
      disclosure: "本档案可能包含历史记录、档案补录与其他参与者内容；具体来源不会在游戏中公开。"
    });
  } catch (error) {
    console.error("session create error", error);
    return json(res, 500, { error: "档案馆暂时无法打开新的房间。" });
  }
}
