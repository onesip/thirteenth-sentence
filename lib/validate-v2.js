import { TRUST_LEVELS } from "./constants.js";
import { sanitizeShortText } from "./safety.js";

function string(value, fallback = "", max = 600) {
  const text = String(value ?? "").trim();
  return (text || fallback || "").slice(0, max);
}

function stringArray(value, fallback = [], maxItems = 8, maxLength = 400) {
  if (!Array.isArray(value)) return (fallback || []).slice(0, maxItems);
  return value.map((item) => string(item, "", maxLength)).filter(Boolean).slice(0, maxItems);
}

function requiredStringArray(value, fallback = [], count = 3, maxLength = 400) {
  const parsed = stringArray(value, [], count, maxLength);
  const merged = [...parsed];
  for (const item of fallback || []) {
    if (merged.length >= count) break;
    const clean = string(item, "", maxLength);
    if (clean && !merged.includes(clean)) merged.push(clean);
  }
  return merged.slice(0, count);
}

function task(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  const safeFallback = fallback || {
    title: "留下新的记录",
    instruction: "写下一条能在现场执行的规则。",
    constraints: ["包含具体细节", "给出明确动作", "不要解释真相"],
    hints: ["时间", "物品", "声音", "方向", "身份"],
    placeholder: "当……发生时，请……"
  };
  return {
    title: string(source.title, safeFallback.title, 100),
    instruction: string(source.instruction, safeFallback.instruction, 360),
    constraints: requiredStringArray(source.constraints, safeFallback.constraints, 3, 100),
    hints: requiredStringArray(source.hints, safeFallback.hints, 5, 40),
    placeholder: string(source.placeholder, safeFallback.placeholder, 120)
  };
}

function cast(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, 6).map((item, index) => ({
    name: string(item?.name, fallback[index]?.name || `角色${index + 1}`, 80),
    role: string(item?.role, fallback[index]?.role || "记录相关者", 100),
    relation: string(item?.relation, fallback[index]?.relation || "关系未确认", 220)
  }));
}

export function validateSeed(payload, fallbackStory, fallbackOpening) {
  const sourceStory = payload?.storyBible || {};
  const story = {
    worldKey: string(sourceStory.worldKey, fallbackStory.worldKey, 60),
    worldName: string(sourceStory.worldName, fallbackStory.worldName, 100),
    chapterTitle: string(sourceStory.chapterTitle, fallbackStory.chapterTitle, 140),
    archiveId: string(sourceStory.archiveId, fallbackStory.archiveId, 30),
    title: string(sourceStory.title, fallbackStory.title, 120),
    identity: string(sourceStory.identity, fallbackStory.identity, 80),
    sceneAnchor: string(sourceStory.sceneAnchor, fallbackStory.sceneAnchor, 40),
    hiddenTruth: string(sourceStory.hiddenTruth, fallbackStory.hiddenTruth, 1200),
    entity: string(sourceStory.entity, fallbackStory.entity, 180),
    mechanism: string(sourceStory.mechanism, fallbackStory.mechanism, 1000),
    dangerMark: string(sourceStory.dangerMark, fallbackStory.dangerMark, 160),
    safeAction: string(sourceStory.safeAction, fallbackStory.safeAction, 600),
    falseAction: string(sourceStory.falseAction, fallbackStory.falseAction, 600),
    coreMotifs: requiredStringArray(sourceStory.coreMotifs, fallbackStory.coreMotifs, 5, 50),
    inheritedFragments: requiredStringArray(sourceStory.inheritedFragments, fallbackStory.inheritedFragments, 3, 220),
    cast: cast(sourceStory.cast, fallbackStory.cast),
    storyBeats: requiredStringArray(sourceStory.storyBeats, fallbackStory.storyBeats, 5, 500),
    ruleLogic: Array.isArray(sourceStory.ruleLogic) && sourceStory.ruleLogic.length >= 6
      ? sourceStory.ruleLogic.slice(0, 8).map((item, index) => ({
          role: string(item?.role, fallbackStory.ruleLogic[index]?.role || "ordinary", 60),
          truth: string(item?.truth, fallbackStory.ruleLogic[index]?.truth || "conditional", 30),
          purpose: string(item?.purpose, fallbackStory.ruleLogic[index]?.purpose || "维持当前机制", 320)
        }))
      : structuredClone(fallbackStory.ruleLogic),
    endings: {
      follow: string(sourceStory.endings?.follow, fallbackStory.endings.follow, 360),
      reverse: string(sourceStory.endings?.reverse, fallbackStory.endings.reverse, 360),
      mark: string(sourceStory.endings?.mark, fallbackStory.endings.mark, 360),
      open: string(sourceStory.endings?.open, fallbackStory.endings.open, 360)
    },
    unresolved: stringArray(sourceStory.unresolved, fallbackStory.unresolved, 3, 360),
    firstTask: fallbackStory.firstTask,
    secondTask: fallbackStory.secondTask,
    profileSnapshot: fallbackStory.profileSnapshot
  };

  const sourceOpening = payload?.opening || {};
  const opening = {
    archiveId: story.archiveId,
    worldKey: story.worldKey,
    worldName: story.worldName,
    chapterTitle: string(sourceOpening.chapterTitle, story.chapterTitle, 140),
    sceneNumber: string(sourceOpening.sceneNumber, story.sceneAnchor, 40),
    title: story.title,
    primaryIdentity: story.identity,
    briefing: string(sourceOpening.briefing, fallbackOpening.briefing, 520),
    inheritedFragment: string(
      sourceOpening.inheritedFragment,
      fallbackOpening.inheritedFragment || story.inheritedFragments[0],
      260
    ),
    firstTask: task(sourceOpening.firstTask, fallbackOpening.firstTask)
  };
  return { storyBible: story, opening };
}

function choices(value, fallback) {
  if (!Array.isArray(value) || value.length !== 4) return fallback;
  return value.slice(0, 4).map((choice, index) => ({
    id: string(choice?.id, fallback[index]?.id || `choice-${index + 1}`, 30),
    label: string(choice?.label, fallback[index]?.label || "继续", 90),
    consequenceHint: string(choice?.consequenceHint, fallback[index]?.consequenceHint || "", 120)
  }));
}

export function validateAdvance(payload, fallbackPublic, phase, fallbackChoices = []) {
  const source = payload?.public || payload || {};
  const publicResult = {
    eyebrow: string(source.eyebrow, fallbackPublic.eyebrow, 70),
    heading: string(source.heading, fallbackPublic.heading, 140),
    narration: requiredStringArray(source.narration, fallbackPublic.narration, 3, 520),
    sensoryCue: string(source.sensoryCue, fallbackPublic.sensoryCue || "", 240)
  };
  if (phase === "after_first_rule") {
    publicResult.recoveredRules = requiredStringArray(source.recoveredRules, fallbackPublic.recoveredRules, 2, 340);
    publicResult.choices = choices(source.choices, fallbackChoices);
  }
  if (phase === "after_first_choice") {
    publicResult.task = task(source.task, fallbackPublic.task);
  }
  if (phase === "after_second_rule") {
    publicResult.choices = choices(source.choices, fallbackChoices);
    const note = source.finalNotePrompt;
    publicResult.finalNotePrompt = note && typeof note === "object"
      ? {
          title: string(note.title, "留下最后一句", 90),
          instruction: string(note.instruction, "写下一句最后批注。", 320),
          placeholder: string(note.placeholder, "我决定相信……", 120),
          maxLength: Math.min(100, Math.max(30, Number(note.maxLength || 80)))
        }
      : null;
  }
  const privatePatch = {
    motifs: stringArray(payload?.privatePatch?.motifs, [], 8, 50),
    directorNotes: stringArray(payload?.privatePatch?.directorNotes, [], 8, 600)
  };
  return { public: publicResult, privatePatch };
}

function sanitizeRule(rule, index, fallbackRule) {
  const fallback = fallbackRule || {
    text: "这条规则在恢复时损坏。",
    trust: "高度可疑",
    surface: "无法确认表面用途。",
    actual: "它可能只用于补齐档案结构。",
    links: []
  };
  const trust = TRUST_LEVELS.includes(rule?.trust) ? rule.trust : fallback.trust;
  return {
    number: index + 1,
    text: string(rule?.text, fallback.text, 520),
    trust,
    surface: string(rule?.surface, fallback.surface, 460),
    actual: string(rule?.actual, fallback.actual, 760),
    links: stringArray(rule?.links, fallback.links, 5, 80)
  };
}

function storyChapters(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  const merged = [...source];
  while (merged.length < 5 && fallback[merged.length]) merged.push(fallback[merged.length]);
  return merged.slice(0, 5).map((item, index) => {
    const fb = fallback[index] || {};
    return {
      title: string(item?.title, fb.title || `第${index + 1}章`, 80),
      scene: string(item?.scene, fb.scene || "这段记录没有完整恢复。", 900),
      clue: string(item?.clue, fb.clue || "线索缺失", 300),
      playerEcho: string(item?.playerEcho, fb.playerEcho || "玩家行为改变了本章。", 360)
    };
  });
}

function relationshipMap(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  const items = source.slice(0, 6).map((item, index) => {
    const fb = fallback[index] || {};
    return {
      from: string(item?.from, fb.from || "当前记录者", 100),
      to: string(item?.to, fb.to || "档案", 100),
      relation: string(item?.relation, fb.relation || "关系未确认", 260),
      certainty: string(item?.certainty, fb.certainty || "未确认", 40)
    };
  });
  return items.length >= 3 ? items : relationshipMap(fallback, []);
}

export function validateArchive(payload, fallbackArchive, state) {
  const source = payload?.archive || payload || {};
  const validSourceRules = Array.isArray(source.rules) && source.rules.length >= 6 && source.rules.length <= 8;
  const sourceRules = validSourceRules ? source.rules : fallbackArchive.rules;
  const ruleCount = Math.min(8, Math.max(6, sourceRules.length));
  const rules = sourceRules.slice(0, ruleCount).map((rule, index) =>
    sanitizeRule(rule, index, fallbackArchive.rules[index])
  );

  const hasFirst = state.firstRule && rules.some((rule) => rule.text.includes(state.firstRule.slice(0, 10)));
  const hasSecond = state.secondRule && rules.some((rule) => rule.text.includes(state.secondRule.slice(0, 10)));
  if (state.firstRule && !hasFirst) rules[Math.min(2, rules.length - 1)].text = sanitizeShortText(state.firstRule, 140);
  if (state.secondRule && !hasSecond) rules[Math.min(4, rules.length - 1)].text = sanitizeShortText(state.secondRule, 140);

  const chapters = storyChapters(source.storyChapters, fallbackArchive.storyChapters);
  if (state.firstRule && !chapters.some((chapter) => chapter.scene.includes(state.firstRule.slice(0, 10)))) {
    chapters[1].scene = `你写下：“${sanitizeShortText(state.firstRule, 140)}” ${chapters[1].scene}`;
  }
  if (state.secondRule && !chapters.some((chapter) => chapter.scene.includes(state.secondRule.slice(0, 10)))) {
    chapters[3].scene = `你又写下：“${sanitizeShortText(state.secondRule, 140)}” ${chapters[3].scene}`;
  }

  return {
    worldKey: string(source.worldKey, fallbackArchive.worldKey || state.worldKey, 60),
    worldName: string(source.worldName, fallbackArchive.worldName || state.worldName, 100),
    chapterTitle: string(source.chapterTitle, fallbackArchive.chapterTitle, 160),
    archiveId: string(source.archiveId, fallbackArchive.archiveId, 30),
    title: string(source.title, fallbackArchive.title, 140),
    preface: string(source.preface, fallbackArchive.preface, 460),
    storyChapters: chapters,
    readingGuide: {
      oneSentenceTruth: string(source.readingGuide?.oneSentenceTruth, fallbackArchive.readingGuide?.oneSentenceTruth || fallbackArchive.eventSummary, 500),
      recommendedOrder: requiredStringArray(source.readingGuide?.recommendedOrder, fallbackArchive.readingGuide?.recommendedOrder || ["故事回放", "规则解读", "人物关系", "世界延伸"], 4, 40)
    },
    rules,
    appendix: requiredStringArray(source.appendix, fallbackArchive.appendix, 3, 620),
    eventSummary: string(source.eventSummary, fallbackArchive.eventSummary, 1400),
    officialTruth: requiredStringArray(source.officialTruth, fallbackArchive.officialTruth, 3, 900),
    conflictReading: requiredStringArray(source.conflictReading, fallbackArchive.conflictReading, 3, 780),
    unresolved: stringArray(source.unresolved, fallbackArchive.unresolved, 3, 560),
    relationshipMap: relationshipMap(source.relationshipMap, fallbackArchive.relationshipMap),
    playerImpact: requiredStringArray(source.playerImpact, fallbackArchive.playerImpact, 4, 700),
    worldExpansion: {
      unlockedPlace: string(source.worldExpansion?.unlockedPlace, fallbackArchive.worldExpansion?.unlockedPlace, 220),
      persistentChange: string(source.worldExpansion?.persistentChange, fallbackArchive.worldExpansion?.persistentChange, 520),
      recurringClue: string(source.worldExpansion?.recurringClue, fallbackArchive.worldExpansion?.recurringClue, 160),
      nextHooks: requiredStringArray(source.worldExpansion?.nextHooks, fallbackArchive.worldExpansion?.nextHooks, 2, 420)
    },
    endingTitle: string(source.endingTitle, fallbackArchive.endingTitle, 100),
    endingText: string(source.endingText, fallbackArchive.endingText, 1000),
    legacySeed: {
      quote: string(source.legacySeed?.quote, fallbackArchive.legacySeed.quote || state.firstRule, 200),
      motifs: stringArray(source.legacySeed?.motifs, fallbackArchive.legacySeed.motifs, 8, 50),
      nextHook: string(source.legacySeed?.nextHook, fallbackArchive.legacySeed.nextHook, 560)
    }
  };
}

export function mergePrivatePatch(state, patch) {
  const motifs = [...new Set([...(state.motifs || []), ...(patch?.motifs || [])])].slice(0, 16);
  const directorNotes = [...(state.directorNotes || []), ...(patch?.directorNotes || [])].slice(-24);
  return { ...state, motifs, directorNotes };
}
