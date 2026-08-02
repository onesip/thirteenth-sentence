import { fallbackSeed, metricsForApproach, normalizeSeed, rolesForParty } from "./play-core.js";

const APPROACHES = ["遵守", "试探", "保护", "调查"];

function text(value, fallback = "", max = 500) {
  return String(value || fallback).trim().slice(0, max);
}

function strings(value, fallback = [], maxItems = 5, maxLength = 260) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map((item) => text(item, "", maxLength)).filter(Boolean).slice(0, maxItems);
  return cleaned.length ? cleaned : fallback.slice(0, maxItems);
}

function numbers(value, fallback = [], maxItems = 3) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map(Number).filter(Number.isFinite).slice(0, maxItems);
  return cleaned.length ? cleaned : fallback.slice(0, maxItems);
}

function clamp(value) {
  const number = Number(value || 0);
  return Math.max(-25, Math.min(25, Number.isFinite(number) ? number : 0));
}

function normalizeEffect(value, option, sceneNo) {
  const source = value && typeof value === "object" ? value : {};
  const base = metricsForApproach(option?.approach);
  const delta = source.metricsDelta && typeof source.metricsDelta === "object" ? source.metricsDelta : base;
  return {
    metricsDelta: {
      evidence: clamp(delta.evidence ?? base.evidence),
      contamination: clamp(delta.contamination ?? base.contamination),
      identity: clamp(delta.identity ?? base.identity),
      trust: clamp(delta.trust ?? base.trust)
    },
    addFlags: strings(source.addFlags, [`scene-${sceneNo}-${option?.id || "choice"}`], 3, 90),
    consequenceTitle: text(source.consequenceTitle, "现场记住了这个动作", 60),
    consequenceNarration: strings(source.consequenceNarration, [
      `你选择了：${option?.action || option?.label || "继续前进"}。`,
      "它没有立刻证明对错，但某个细节已经因此改变。"
    ], 2, 220),
    delayedOmen: text(source.delayedOmen, `第${sceneNo + 2}幕之前，这个动作还会以另一种形式回来。`, 180),
    consequenceNote: text(source.consequenceNote, `${option?.label || "这项选择"}会改变后续身份核验。`, 220),
    identityFragment: text(source.identityFragment, "", 220),
    echo: text(source.echo, `${option?.label || "上一项选择"}留下的痕迹先于你抵达下一处现场。`, 220)
  };
}

function normalizeOption(value, fallback, sceneNo, index) {
  const source = value && typeof value === "object" ? value : {};
  const base = fallback || {};
  const approach = APPROACHES.includes(source.approach) ? source.approach : (APPROACHES.includes(base.approach) ? base.approach : APPROACHES[index % 4]);
  const option = {
    id: text(source.id, base.id || `scene-${sceneNo}-option-${index + 1}`, 42),
    label: text(source.label, base.label || `选择 ${index + 1}`, 30),
    action: text(source.action, base.action || "继续观察现场。", 190),
    ruleRefs: numbers(source.ruleRefs, base.ruleRefs || [], 3),
    approach
  };
  option.effect = normalizeEffect(source.effect || base.effect, option, sceneNo);
  return option;
}

function fallbackOptions(rules, sceneNo) {
  const getRule = (offset) => Number(rules[(sceneNo + offset) % Math.max(1, rules.length)]?.number || offset + 1);
  return [
    {
      id: `obey-${sceneNo}`,
      label: "严格照做",
      action: `执行第${getRule(0)}条规则，并记录执行前后所有变化。`,
      ruleRefs: [getRule(0)],
      approach: "遵守"
    },
    {
      id: `test-${sceneNo}`,
      label: "只试探一次",
      action: "只改变一个现场细节，判断异常究竟跟随人、物品还是记录。",
      ruleRefs: [],
      approach: "试探"
    },
    {
      id: `protect-${sceneNo}`,
      label: "先保住身份",
      action: "放弃眼前捷径，把能够证明自己身份的物件藏到不会被改写的位置。",
      ruleRefs: [],
      approach: "保护"
    },
    {
      id: `investigate-${sceneNo}`,
      label: "追查矛盾",
      action: `对照第${getRule(0)}条与第${getRule(1)}条，寻找它们适用对象的区别。`,
      ruleRefs: [getRule(0), getRule(1)],
      approach: "调查"
    }
  ].map((option, index) => normalizeOption(option, option, sceneNo, index));
}

function fallbackScene({ archiveRecord, partySize, sceneNo }) {
  const archive = archiveRecord?.final_archive || {};
  const title = archive.title || archiveRecord?.title || "未命名档案";
  const rules = Array.isArray(archive.rules) ? archive.rules : [];
  const roles = rolesForParty(partySize);
  const locations = ["档案入口的背面", "停止工作的值班室", "没有编号的中转层", "只在镜中存在的出口"];
  const rule = rules[(sceneNo - 1) % Math.max(1, rules.length)];
  return {
    sceneNo,
    title: sceneNo === 5 ? "出口只承认一个版本的你" : `第${sceneNo}页拒绝保持原样`,
    location: locations[(sceneNo - 2) % locations.length],
    time: `进入《${title}》后的第${sceneNo * 7}分钟`,
    turnRole: roles[(sceneNo - 1) % roles.length],
    narration: [
      `上一处现场的细节已经先一步出现在这里。`,
      rule ? `墙上重新抄着第${rule.number || sceneNo}条规则，但其中一个字被换掉了。` : "墙上出现了一条你确信刚才还不存在的规则。",
      sceneNo >= 4 ? "玻璃里的人影佩戴着与你不同的身份牌。" : "有人在门后用你的声音念出一段不属于你的记忆。"
    ],
    visibleClues: ["旧选择留下的物件出现在新地点", "规则上的日期与现场时间不一致", "你的身份牌缺少一角"],
    identityFragment: sceneNo >= 3 ? "你想起自己不是第一次进入这里，只是第一次使用现在这个名字。" : "",
    pressure: sceneNo === 5 ? "出口已经出现，但它只允许一个身份版本通过。" : "下一道门只会为满足某条规则的人打开。",
    options: fallbackOptions(rules, sceneNo)
  };
}

function normalizeScene(value, fallback, sceneNo, partySize) {
  const source = value && typeof value === "object" ? value : {};
  const roles = rolesForParty(partySize);
  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const baseOptions = fallback.options || [];
  const options = Array.from({ length: Math.max(3, Math.min(4, rawOptions.length || baseOptions.length || 3)) }, (_, index) =>
    normalizeOption(rawOptions[index], baseOptions[index] || baseOptions[index % Math.max(1, baseOptions.length)], sceneNo, index)
  );
  return {
    sceneNo,
    title: text(source.title, fallback.title, 90),
    location: text(source.location, fallback.location, 80),
    time: text(source.time, fallback.time, 80),
    turnRole: text(source.turnRole, roles[(sceneNo - 1) % roles.length], 40),
    narration: strings(source.narration, fallback.narration, 4, 260),
    visibleClues: strings(source.visibleClues, fallback.visibleClues, 5, 180),
    identityFragment: text(source.identityFragment, fallback.identityFragment, 260),
    pressure: text(source.pressure, fallback.pressure, 240),
    options
  };
}

export function fallbackBlueprint(archiveRecord, partySize) {
  const seed = fallbackSeed(archiveRecord, partySize);
  const firstFallback = seed.publicOpening.firstScene;
  seed.publicOpening.firstScene = {
    ...firstFallback,
    options: firstFallback.options.map((option, index) => normalizeOption(option, option, 1, index))
  };
  return {
    ...seed,
    scenePlan: [2, 3, 4, 5].map((sceneNo) => fallbackScene({ archiveRecord, partySize, sceneNo })),
    endingGuide: {
      coreRevelation: "规则真正筛选的不是最听话的人，而是仍能证明自己是谁的人。",
      identityEvidence: ["签名早于你的记忆出现", "身份牌被人为裁去一角", "旧场景反复认出你的声音"],
      ruleKeys: (archiveRecord?.final_archive?.rules || []).slice(0, 6).map((rule, index) => ({ number: Number(rule.number || index + 1), key: text(rule.actual || rule.surface || rule.text, "条件仍未完全确认", 180) })),
      endingAxes: seed.privateBible.endingAxes
    }
  };
}

export function normalizePlayBlueprint(data, archiveRecord, partySize) {
  const fallback = fallbackBlueprint(archiveRecord, partySize);
  const source = data && typeof data === "object" ? data : {};
  const seed = normalizeSeed(source, archiveRecord, partySize);
  const rawFirstOptions = source?.publicOpening?.firstScene?.options || [];
  seed.publicOpening.firstScene = {
    ...seed.publicOpening.firstScene,
    options: seed.publicOpening.firstScene.options.map((option, index) => normalizeOption(rawFirstOptions[index], option, 1, index))
  };
  const rawPlan = Array.isArray(source.scenePlan) ? source.scenePlan : [];
  const scenePlan = [2, 3, 4, 5].map((sceneNo, index) => normalizeScene(rawPlan[index], fallback.scenePlan[index], sceneNo, partySize));
  const rawGuide = source.endingGuide && typeof source.endingGuide === "object" ? source.endingGuide : {};
  return {
    ...seed,
    scenePlan,
    endingGuide: {
      coreRevelation: text(rawGuide.coreRevelation, fallback.endingGuide.coreRevelation, 320),
      identityEvidence: strings(rawGuide.identityEvidence, fallback.endingGuide.identityEvidence, 6, 180),
      ruleKeys: Array.isArray(rawGuide.ruleKeys) && rawGuide.ruleKeys.length
        ? rawGuide.ruleKeys.slice(0, 10).map((item, index) => ({ number: Number(item?.number || index + 1), key: text(item?.key, "条件仍未完全确认", 200) }))
        : fallback.endingGuide.ruleKeys,
      endingAxes: strings(rawGuide.endingAxes, fallback.endingGuide.endingAxes, 6, 160)
    }
  };
}

export function resolveBlueprintStep(state, selectedOption) {
  const effect = normalizeEffect(selectedOption?.effect, selectedOption, Number(state.sceneIndex || 0) + 1);
  const fallback = fallbackBlueprint(state.sourceArchiveRecord, state.partySize);
  const planIndex = Number(state.sceneIndex || 0);
  const planned = state.scenePlan?.[planIndex] || fallback.scenePlan[planIndex] || fallback.scenePlan.at(-1);
  const nextScene = JSON.parse(JSON.stringify(planned));
  const older = state.choiceHistory?.length ? state.choiceHistory[Math.max(0, state.choiceHistory.length - 2)] : null;
  const echo = older
    ? `更早以前你选择「${older.label}」时留下的后果，也在这里完成了它的第二次出现。`
    : effect.echo;
  nextScene.narration = [nextScene.narration[0], echo, ...nextScene.narration.slice(1)].filter(Boolean).slice(0, 4);
  if (effect.identityFragment && !nextScene.identityFragment) nextScene.identityFragment = effect.identityFragment;
  return {
    privatePatch: {
      metricsDelta: effect.metricsDelta,
      addFlags: effect.addFlags,
      consequenceNote: effect.consequenceNote,
      identityFragment: effect.identityFragment
    },
    public: {
      consequence: {
        title: effect.consequenceTitle,
        narration: effect.consequenceNarration,
        delayedOmen: effect.delayedOmen
      },
      nextScene
    }
  };
}
