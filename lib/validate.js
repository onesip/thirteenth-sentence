import { DEFAULT_STORY_BIBLE, FIRST_TASK, TRUST_LEVELS } from "./constants.js";
import { sanitizeShortText } from "./safety.js";

function string(value, fallback = "", max = 600) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, max);
}
function stringArray(value, fallback = [], maxItems = 8, maxLength = 400) {
  if (!Array.isArray(value)) return fallback.slice(0, maxItems);
  return value.map((item) => string(item, "", maxLength)).filter(Boolean).slice(0, maxItems);
}
function requiredStringArray(value, fallback = [], count = 3, maxLength = 400) {
  const parsed = stringArray(value, [], count, maxLength);
  if (parsed.length < count) {
    const merged = [...parsed];
    for (const item of fallback) {
      if (merged.length >= count) break;
      const clean = string(item, "", maxLength);
      if (clean && !merged.includes(clean)) merged.push(clean);
    }
    return merged.slice(0, count);
  }
  return parsed.slice(0, count);
}
function task(value, fallback = FIRST_TASK) {
  const source = value && typeof value === "object" ? value : {};
  return {
    title: string(source.title, fallback.title, 80),
    instruction: string(source.instruction, fallback.instruction, 320),
    constraints: requiredStringArray(source.constraints, fallback.constraints, 3, 90),
    hints: requiredStringArray(source.hints, fallback.hints, 5, 30),
    placeholder: string(source.placeholder, fallback.placeholder, 100)
  };
}
export function validateSeed(payload, fallbackStory, fallbackOpening) {
  const sourceStory = payload?.storyBible || {};
  const story = {
    archiveId: string(sourceStory.archiveId, fallbackStory.archiveId, 24),
    title: string(sourceStory.title, fallbackStory.title, 100),
    identity: string(sourceStory.identity, fallbackStory.identity, 60),
    hiddenTruth: string(sourceStory.hiddenTruth, fallbackStory.hiddenTruth, 1000),
    entity: string(sourceStory.entity, fallbackStory.entity, 140),
    mechanism: string(sourceStory.mechanism, fallbackStory.mechanism, 900),
    dangerMark: string(sourceStory.dangerMark, fallbackStory.dangerMark, 120),
    safeAction: string(sourceStory.safeAction, fallbackStory.safeAction, 500),
    falseAction: string(sourceStory.falseAction, fallbackStory.falseAction, 500),
    coreMotifs: stringArray(sourceStory.coreMotifs, fallbackStory.coreMotifs, 8, 40),
    inheritedFragments: stringArray(sourceStory.inheritedFragments, fallbackStory.inheritedFragments, 4, 180),
    ruleLogic: Array.isArray(sourceStory.ruleLogic) && sourceStory.ruleLogic.length === 8
      ? sourceStory.ruleLogic.slice(0, 8).map((item, index) => ({
          role: string(item?.role, fallbackStory.ruleLogic[index]?.role, 60),
          truth: string(item?.truth, fallbackStory.ruleLogic[index]?.truth, 30),
          purpose: string(item?.purpose, fallbackStory.ruleLogic[index]?.purpose, 300)
        }))
      : structuredClone(fallbackStory.ruleLogic),
    endings: {
      follow: string(sourceStory.endings?.follow, fallbackStory.endings.follow, 300),
      reverse: string(sourceStory.endings?.reverse, fallbackStory.endings.reverse, 300),
      mark: string(sourceStory.endings?.mark, fallbackStory.endings.mark, 300),
      open: string(sourceStory.endings?.open, fallbackStory.endings.open, 300)
    },
    unresolved: stringArray(sourceStory.unresolved, fallbackStory.unresolved, 3, 300)
  };
  const sourceOpening = payload?.opening || {};
  const opening = {
    archiveId: story.archiveId,
    title: story.title,
    primaryIdentity: story.identity,
    briefing: string(sourceOpening.briefing, fallbackOpening.briefing, 360),
    inheritedFragment: string(sourceOpening.inheritedFragment, fallbackOpening.inheritedFragment || story.inheritedFragments[0], 220),
    firstTask: task(sourceOpening.firstTask, fallbackOpening.firstTask)
  };
  return { storyBible: story, opening };
}
function choices(value, fallback) {
  if (!Array.isArray(value) || value.length !== 4) return fallback;
  return value.slice(0, 4).map((choice, index) => ({
    id: string(choice?.id, fallback[index]?.id || `choice-${index + 1}`, 30),
    label: string(choice?.label, fallback[index]?.label || "继续", 80),
    consequenceHint: string(choice?.consequenceHint, fallback[index]?.consequenceHint || "", 100)
  }));
}
export function validateAdvance(payload, fallbackPublic, phase, fallbackChoices = []) {
  const source = payload?.public || payload || {};
  const publicResult = {
    eyebrow: string(source.eyebrow, fallbackPublic.eyebrow, 60),
    heading: string(source.heading, fallbackPublic.heading, 120),
    narration: requiredStringArray(source.narration, fallbackPublic.narration, 3, 500)
  };
  if (phase === "after_first_rule") {
    publicResult.recoveredRules = requiredStringArray(source.recoveredRules, fallbackPublic.recoveredRules, 2, 300);
    publicResult.choices = choices(source.choices, fallbackChoices);
  }
  if (phase === "after_first_choice") publicResult.task = task(source.task, fallbackPublic.task);
  if (phase === "after_second_rule") {
    publicResult.choices = choices(source.choices, fallbackChoices);
    const note = source.finalNotePrompt;
    publicResult.finalNotePrompt = note && typeof note === "object" ? {
      title: string(note.title, "留下最后一句", 80),
      instruction: string(note.instruction, "写下一句最后批注。", 300),
      placeholder: string(note.placeholder, "我决定相信……", 100),
      maxLength: Math.min(90, Math.max(30, Number(note.maxLength || 70)))
    } : null;
  }
  return {
    public: publicResult,
    privatePatch: {
      motifs: stringArray(payload?.privatePatch?.motifs, [], 8, 40),
      directorNotes: stringArray(payload?.privatePatch?.directorNotes, [], 8, 500)
    }
  };
}
function sanitizeRule(rule, index, fallbackRule) {
  const trust = TRUST_LEVELS.includes(rule?.trust) ? rule.trust : fallbackRule.trust;
  return {
    number: index + 1,
    text: string(rule?.text, fallbackRule.text, 480),
    trust,
    surface: string(rule?.surface, fallbackRule.surface, 400),
    actual: string(rule?.actual, fallbackRule.actual, 700),
    links: stringArray(rule?.links, fallbackRule.links, 5, 60)
  };
}
export function validateArchive(payload, fallbackArchive, state) {
  const source = payload?.archive || payload || {};
  const sourceRules = Array.isArray(source.rules) && source.rules.length === 8 ? source.rules : fallbackArchive.rules;
  const rules = sourceRules.slice(0, 8).map((rule, index) => sanitizeRule(rule, index, fallbackArchive.rules[index]));
  if (state.firstRule && !rules.some((rule) => rule.text.includes(state.firstRule.slice(0, 12)))) rules[3].text = sanitizeShortText(state.firstRule, 120);
  if (state.secondRule && !rules.some((rule) => rule.text.includes(state.secondRule.slice(0, 12)))) rules[5].text = sanitizeShortText(state.secondRule, 120);
  return {
    archiveId: string(source.archiveId, fallbackArchive.archiveId, 30),
    title: string(source.title, fallbackArchive.title, 120),
    preface: string(source.preface, fallbackArchive.preface, 400),
    rules,
    appendix: requiredStringArray(source.appendix, fallbackArchive.appendix, 3, 600),
    eventSummary: string(source.eventSummary, fallbackArchive.eventSummary, 1200),
    officialTruth: requiredStringArray(source.officialTruth, fallbackArchive.officialTruth, 3, 800),
    conflictReading: requiredStringArray(source.conflictReading, fallbackArchive.conflictReading, 3, 700),
    unresolved: stringArray(source.unresolved, fallbackArchive.unresolved, 3, 500),
    playerImpact: requiredStringArray(source.playerImpact, fallbackArchive.playerImpact, 4, 600),
    endingTitle: string(source.endingTitle, fallbackArchive.endingTitle, 80),
    endingText: string(source.endingText, fallbackArchive.endingText, 900),
    legacySeed: {
      quote: string(source.legacySeed?.quote, fallbackArchive.legacySeed.quote || state.firstRule, 180),
      motifs: stringArray(source.legacySeed?.motifs, fallbackArchive.legacySeed.motifs, 8, 40),
      nextHook: string(source.legacySeed?.nextHook, fallbackArchive.legacySeed.nextHook, 500)
    }
  };
}
export function mergePrivatePatch(state, patch) {
  return {
    ...state,
    motifs: [...new Set([...(state.motifs || []), ...(patch?.motifs || [])])].slice(0, 12),
    directorNotes: [...(state.directorNotes || []), ...(patch?.directorNotes || [])].slice(-20)
  };
}
