import { randomCode, randomId, encryptState, canEncryptState, hashValue } from "../lib/crypto-state.js";
import { callDeepSeek, fastModel, mergeUsageTotals } from "../lib/deepseek.js";
import { json, methodNotAllowed, readJson, requestIp } from "../lib/http.js";
import { publicRules, rolesForParty } from "../lib/play-core.js";
import { normalizePlayBlueprint } from "../lib/play-blueprint.js";
import { adaptBlueprintParty } from "../lib/play-blueprint-quality.js";
import {
  cloudConfigured,
  createSessionRecord,
  enforceRateLimit,
  getArchiveBySlug,
  getRandomPlayableArchive,
  getReusablePlayBlueprints
} from "../lib/storage.js";

const MICRO_SPINE_SYSTEM = `《第十三句》实时开局协议。你是规则怪谈导演。只输出合法JSON。使用简体中文。必须使用输入档案已有的规则、人物、物件与世界机制；不得写通用走廊、身份牌或无关怪物。场景具体、易读、有连续因果。`;

function clean(value, fallback = "", max = 220) {
  return String(value ?? fallback).trim().slice(0, max);
}

function asText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return clean(value.name || value.title || value.text || value.quote || JSON.stringify(value), "", 180);
  }
  return clean(value, "", 180);
}

function compactArchive(record) {
  const archive = record?.final_archive || {};
  const rules = Array.isArray(archive.rules) ? archive.rules : [];
  const chars = Array.isArray(archive.characters || archive.characterRelations)
    ? (archive.characters || archive.characterRelations)
    : [];
  return {
    title: clean(archive.title || record?.title, "未命名档案", 80),
    preface: clean(archive.preface, "", 180),
    rules: rules.slice(0, 8).map((rule, index) => ({
      n: Number(rule?.number || index + 1),
      t: clean(rule?.text, "", 150),
      a: clean(rule?.actual || rule?.surface, "", 120)
    })),
    truth: (archive.officialTruth || []).slice(0, 4).map(asText).filter(Boolean),
    characters: chars.slice(0, 5).map(asText).filter(Boolean),
    unresolved: (archive.unresolved || []).slice(0, 4).map(asText).filter(Boolean),
    motifs: (archive.legacySeed?.motifs || []).slice(0, 6).map(asText).filter(Boolean),
    world: clean(archive.worldState || archive.worldChange || archive.worldConsequence, "", 220)
  };
}

function spinePrompt({ archiveRecord, partySize, roleOrder, recovery = false }) {
  const archive = compactArchive(archiveRecord);
  return JSON.stringify({
    task: recovery
      ? "给出3个最关键场景锚点。程序会扩展成5幕。优先保证具体，不要解释。"
      : "给出5个连续场景锚点，构成同一个规则怪谈。不要写完整小说或玩家选项。",
    archive,
    party: { size: partySize, roles: roleOrder },
    output: {
      title: "本次进入标题",
      publicIdentity: "玩家以为自己是谁",
      actualIdentity: "玩家真正是谁",
      connection: "为什么与该世界有关",
      need: "必须找回或保护什么",
      memory: "两句具体开场记忆",
      mission: "明确任务",
      warning: "一句克制提示",
      truth: "一句核心真相",
      scenes: [{
        title: "短标题",
        location: "具体地点",
        object: "具体关键物件",
        anomaly: "该物件或地点发生的具体异常",
        witness: "具体人物、声音或记录来源",
        clue: "可直接观察的线索",
        rules: [1, 2]
      }]
    },
    limits: recovery
      ? "scenes正好3项；每个字符串不超过24个汉字；总输出尽量低于450 tokens"
      : "scenes正好5项；每个字符串不超过30个汉字；总输出尽量低于800 tokens"
  });
}

function validAnchor(scene) {
  return scene && typeof scene === "object"
    && clean(scene.location).length >= 2
    && clean(scene.object || scene.focusObject).length >= 2
    && clean(scene.anomaly).length >= 2;
}

function validSpine(data, minimumScenes) {
  return data && typeof data === "object"
    && clean(data.actualIdentity).length >= 2
    && Array.isArray(data.scenes)
    && data.scenes.filter(validAnchor).length >= minimumScenes;
}

function archiveDetailPool(record) {
  const archive = record?.final_archive || {};
  const values = [
    ...(archive.legacySeed?.motifs || []),
    ...(archive.characters || archive.characterRelations || []),
    ...(archive.unresolved || []),
    ...(archive.officialTruth || []),
    archive.preface,
    archive.worldState || archive.worldChange || archive.worldConsequence
  ].map(asText).filter(Boolean);
  return [...new Set(values)];
}

function ruleNumber(rule, index) {
  return Number(rule?.number || index + 1);
}

function expandSpine(raw, archiveRecord, partySize, roleOrder) {
  const archive = archiveRecord?.final_archive || {};
  const rules = Array.isArray(archive.rules) ? archive.rules : [];
  const details = archiveDetailPool(archiveRecord);
  const supplied = (raw.scenes || []).filter(validAnchor).slice(0, 5);
  const scenes = [];

  for (let index = 0; index < 5; index += 1) {
    const source = supplied[index] || supplied[index % Math.max(1, supplied.length)] || {};
    const rule = rules[index % Math.max(1, rules.length)] || {};
    const nextRule = rules[(index + 1) % Math.max(1, rules.length)] || rule;
    const detail = details[index % Math.max(1, details.length)] || clean(rule.text, `第${index + 1}条规则留下的记录`, 80);
    const previous = scenes[index - 1];
    const location = clean(source.location, `${clean(archive.title || archiveRecord.title, "档案世界", 40)}的${index + 1}号封存区`, 80);
    const focusObject = clean(source.object || source.focusObject, detail, 90);
    const anomaly = clean(source.anomaly, `${focusObject}每次被触碰都会改写一处时间`, 150);
    const witness = clean(source.witness, details[(index + 2) % Math.max(1, details.length)] || "一段带有明确日期的值班记录", 110);
    const refs = Array.isArray(source.rules)
      ? source.rules.map(Number).filter(Number.isFinite).slice(0, 3)
      : [ruleNumber(rule, index), ruleNumber(nextRule, index + 1)];
    const clue = clean(source.clue, `${focusObject}上的痕迹与第${refs[0] || index + 1}条规则所写不一致`, 150);
    const previousEcho = previous
      ? `上一幕的“${previous.focusObject}”已经出现在${location}，但状态被改写。`
      : `你刚进入${location}，${focusObject}已经像被人提前使用过。`;

    scenes.push({
      sceneNo: index + 1,
      title: clean(source.title, index === 4 ? `${focusObject}守在出口前` : `${focusObject}拒绝保持原样`, 80),
      location,
      time: `进入后的第${4 + index * 7}分钟`,
      turnRole: roleOrder[index % roleOrder.length],
      narration: [
        previousEcho,
        `${witness}证明：${anomaly}。这与第${refs[0] || index + 1}条规则并不完全一致。`
      ],
      visibleClues: [clue, `${witness}提到的时间比现场${index % 2 ? "慢" : "快"}了十三分钟`],
      identityFragment: index >= 2
        ? `你记起自己曾以另一个身份处理过“${focusObject}”，但记录里的结果与你记忆相反。`
        : "",
      pressure: index === 4
        ? `出口已经出现，但它只承认能解释“${focusObject}”异常的人。`
        : `在${anomaly}扩大之前，你必须判断第${refs[0] || index + 1}条规则是否适用于你。`,
      focusObject,
      anomaly,
      witness,
      ruleRefs: refs
    });
  }

  const publicIdentity = clean(raw.publicIdentity, roleOrder[0] || "临时调查者", 80);
  const actualIdentity = clean(raw.actualIdentity, `你是《${clean(archive.title || archiveRecord.title, "这份档案", 50)}》中被抹去记录的当事人`, 120);
  const full = {
    privateBible: {
      actualIdentity,
      identityConnection: clean(raw.connection, `你的名字曾出现在这份档案的原始记录中。`, 180),
      secretNeed: clean(raw.need, `找回一件能证明真实身份的物品。`, 160),
      trueRuleNumbers: scenes.slice(0, 2).flatMap((scene) => scene.ruleRefs.slice(0, 1)),
      conditionalRules: [{ number: scenes[2].ruleRefs[0] || 3, condition: `只有${scenes[2].focusObject}未被改写时成立` }],
      tamperedRuleNumbers: [scenes[3].ruleRefs[0] || 4],
      dangerAxis: `每次误认${scenes[0].focusObject}的状态，异常都会更接近玩家身份。`,
      rescueAxis: `保留能让${scenes[1].witness}与现场互相印证的证据。`,
      endingAxes: ["带着真实身份离开", "成为新规则的保管者", "被档案中的旧身份替代", "公开整个异常机制"]
    },
    publicOpening: {
      dossierTitle: clean(raw.title, `进入记录：${clean(archive.title || archiveRecord.title, "未命名档案", 60)}`, 90),
      publicIdentity,
      startingMemory: clean(raw.memory, `你记得自己是来核对一份规则的。可第一件关键物品上已经留着你的指纹。`, 260),
      mission: clean(raw.mission, `在五个场景内判断哪些规则适用于你，并带回一件未被改写的证据。`, 220),
      warning: clean(raw.warning, `规则不一定在说谎，但它可能并不是写给你的。`, 140),
      firstScene: scenes[0]
    },
    scenePlan: scenes.slice(1),
    endingGuide: {
      coreRevelation: clean(raw.truth, `规则真正筛选的是仍能证明自己身份的人。`, 260),
      identityEvidence: scenes.slice(0, 4).map((scene) => `${scene.focusObject}与${scene.witness}留下了相互矛盾的身份记录`),
      ruleKeys: rules.slice(0, 8).map((item, index) => ({
        number: ruleNumber(item, index),
        key: clean(item.actual || item.surface || item.text, `适用条件与玩家身份有关`, 180)
      })),
      endingAxes: ["证据是否足以互证", "污染是否超过身份稳定", "玩家是否盲从或主动核验规则"]
    }
  };
  return normalizePlayBlueprint(full, archiveRecord, partySize);
}

async function aiPermission(ipKey) {
  if (!process.env.DEEPSEEK_API_KEY) return { allowAi: false, reason: "no-key" };
  if (!cloudConfigured()) return { allowAi: true };
  const minute = await enforceRateLimit({ key: ipKey, scope: "micro-spine-minute", limit: 4, windowMinutes: 1 });
  if (!minute.allowed) return { allowAi: false, reason: "minute-limit" };
  const device = await enforceRateLimit({
    key: ipKey,
    scope: "micro-spine-device-day",
    limit: Math.max(8, Number(process.env.DEVICE_DAILY_AI_LIMIT || 40)),
    windowMinutes: 1440
  });
  if (!device.allowed) return { allowAi: false, reason: "device-budget" };
  const global = await enforceRateLimit({
    key: "__global__",
    scope: "micro-spine-global-day",
    limit: Math.max(24, Number(process.env.DAILY_AI_LIMIT || 60)),
    windowMinutes: 1440
  });
  return global.allowed ? { allowAi: true } : { allowAi: false, reason: "global-budget" };
}

function cacheLooksSpecific(raw) {
  const scenes = [raw?.publicOpening?.firstScene, ...(raw?.scenePlan || [])];
  const banned = ["档案入口的背面", "旧选择留下", "现场有一处", "那件被反复提到"];
  return scenes.length === 5 && scenes.every((scene) => {
    const joined = JSON.stringify(scene || {});
    return clean(scene?.focusObject).length >= 2
      && clean(scene?.anomaly).length >= 2
      && !banned.some((phrase) => joined.includes(phrase));
  });
}

function pickCached(cached, archiveRecord, partySize) {
  const usable = cached.filter(cacheLooksSpecific);
  if (!usable.length) return null;
  const raw = usable[Math.floor(Math.random() * usable.length)];
  return adaptBlueprintParty(normalizePlayBlueprint(raw, archiveRecord, partySize), partySize);
}

async function generateSpine({ archiveRecord, partySize, roleOrder, ipKey, recovery }) {
  const result = await callDeepSeek({
    model: fastModel(),
    system: [MICRO_SPINE_SYSTEM],
    user: spinePrompt({ archiveRecord, partySize, roleOrder, recovery }),
    thinking: false,
    reasoningEffort: "low",
    maxTokens: recovery ? 500 : 900,
    timeoutMs: recovery ? 7000 : 14000,
    maxAttempts: 1,
    userId: ipKey
  });
  if (!validSpine(result.data, recovery ? 2 : 3)) {
    const error = new Error("MICRO_SPINE_INCOMPLETE");
    error.retryable = false;
    throw error;
  }
  return {
    blueprint: expandSpine(result.data, archiveRecord, partySize, roleOrder),
    result,
    mode: recovery ? "deepseek-micro-spine-recovery" : "deepseek-micro-spine"
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    if (!cloudConfigured()) return json(res, 503, { error: "档案馆尚未连接，暂时无法进入已封存世界。" });
    const body = await readJson(req);
    const partySize = Math.min(4, Math.max(1, Number(body.partySize || 1)));
    const excludedSlugs = Array.isArray(body.excludedSlugs) ? body.excludedSlugs.slice(0, 12) : [];
    const requestedSlug = clean(body.slug);
    const archiveRecord = requestedSlug
      ? await getArchiveBySlug(requestedSlug)
      : await getRandomPlayableArchive(excludedSlugs);
    if (!archiveRecord) return json(res, 404, { error: "还没有可进入的封存档案。先完成一局共创，让规则真正诞生。" });

    const roleOrder = rolesForParty(partySize);
    let cached = [];
    try { cached = await getReusablePlayBlueprints(archiveRecord.id, 12); }
    catch (error) { console.error("play blueprint cache read failed", error); }

    let generated = cached.length >= 2 && Math.random() < 0.55
      ? pickCached(cached, archiveRecord, partySize)
      : null;
    let aiMode = generated ? "cached-specific-blueprint" : "";
    let aiUsage = {};
    let permissionReason = null;
    let failureCode = null;

    if (!generated) {
      const ipKey = hashValue(requestIp(req));
      const permission = await aiPermission(ipKey);
      permissionReason = permission.reason || null;
      if (permission.allowAi) {
        try {
          const live = await generateSpine({ archiveRecord, partySize, roleOrder, ipKey, recovery: false });
          generated = live.blueprint;
          aiMode = live.mode;
          aiUsage = mergeUsageTotals(aiUsage, live.result);
        } catch (firstError) {
          failureCode = clean(firstError?.message, "MICRO_SPINE_PRIMARY_FAILED", 80);
          console.error("micro spine failed; short recovery starting", firstError);
          try {
            const recovery = await generateSpine({ archiveRecord, partySize, roleOrder, ipKey, recovery: true });
            generated = recovery.blueprint;
            aiMode = recovery.mode;
            aiUsage = mergeUsageTotals(aiUsage, recovery.result);
          } catch (secondError) {
            failureCode = clean(secondError?.message, failureCode || "MICRO_SPINE_RECOVERY_FAILED", 80);
            console.error("micro spine recovery failed", secondError);
          }
        }
      }
      if (!generated) {
        generated = pickCached(cached, archiveRecord, partySize);
        if (generated) aiMode = "cached-specific-blueprint-recovery";
      }
    }

    if (!generated) {
      return json(res, 503, {
        error: permissionReason
          ? "这份档案当前没有可用馆藏路线，今日展开额度也暂时不足。请稍后再进入。"
          : "这次连最短的故事脊柱也没有完整返回。请求已经停止，没有使用通用模板。请重新尝试或换一份档案。",
        code: "MICRO_SPINE_NOT_READY",
        reason: failureCode || permissionReason || "unknown"
      });
    }

    const sessionId = randomId();
    const state = {
      version: 8,
      mode: "enter_archive",
      aiStrategy: "micro-spine-local-final",
      blueprintVersion: "micro-spine-v1",
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
      blueprintVersion: state.blueprintVersion,
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
