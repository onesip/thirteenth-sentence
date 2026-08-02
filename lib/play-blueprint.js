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

function shorten(value, max = 34) {
  const clean = text(value, "", 200).replace(/[“”]/g, "");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function archiveRules(archiveRecord) {
  return Array.isArray(archiveRecord?.final_archive?.rules) ? archiveRecord.final_archive.rules : [];
}

function findRule(rules, number) {
  return rules.find((rule, index) => Number(rule?.number || index + 1) === Number(number)) || null;
}

function sceneAnchors(scene = {}, fallback = {}) {
  const clues = strings(scene.visibleClues, fallback.visibleClues || [], 4, 160);
  return {
    focusObject: text(scene.focusObject, fallback.focusObject || clues[0] || "那件被反复提到的物品", 100),
    anomaly: text(scene.anomaly, fallback.anomaly || scene.pressure || fallback.pressure || "现场有一处细节不再服从常理", 180),
    witness: text(scene.witness, fallback.witness || clues[1] || "一段来源不明的记录", 120),
    clues,
    location: text(scene.location, fallback.location || "现场", 80),
    pressure: text(scene.pressure, fallback.pressure || "你必须在异常继续扩大前作出判断。", 220)
  };
}

function contextualDefaults(option, sceneNo, scene) {
  const anchors = sceneAnchors(scene);
  const action = option?.action || option?.label || "继续前进";
  const refs = option?.ruleRefs || [];
  const ruleLabel = refs.length ? `第${refs.join("、")}条规则` : "现有规则";
  if (option?.approach === "遵守") {
    return {
      title: "规则接受了你的动作",
      narration: [
        `你在${anchors.location}照着${ruleLabel}处理了“${anchors.focusObject}”。`,
        `${anchors.anomaly}没有消失，只是把反应转移到了${anchors.witness}身上。`
      ],
      omen: `“${anchors.focusObject}”表面出现了一个此前不存在的记号。`,
      echo: `你曾照规则处理“${anchors.focusObject}”，这次现场要求你证明当时执行的是哪一个版本。`
    };
  }
  if (option?.approach === "试探") {
    return {
      title: "试探得到了回应",
      narration: [
        `你只改动了“${anchors.focusObject}”这一处，其他东西保持原样。`,
        `${anchors.witness}立刻作出反应，证明${anchors.anomaly}并非偶然。`
      ],
      omen: `你恢复原状后，“${anchors.focusObject}”仍比周围慢了一拍。`,
      echo: `那次对“${anchors.focusObject}”的试探留下了时间差，后面的场景开始沿着它追来。`
    };
  }
  if (option?.approach === "保护") {
    return {
      title: "你保住了一件证据",
      narration: [
        `你没有立刻靠近异常，而是先把“${anchors.focusObject}”从${anchors.witness}的范围里移开。`,
        `${anchors.anomaly}因此短暂停顿，像是在重新确认你的身份。`
      ],
      omen: `被保护的物件里传出了一声与你记忆不符的呼吸。`,
      echo: `你保住的“${anchors.focusObject}”后来成为唯一没有被改写的参照物。`
    };
  }
  return {
    title: "矛盾露出了边缘",
    narration: [
      `你把现场两条线索并排核对，并追问${anchors.witness}为何出现在${anchors.location}。`,
      `${anchors.anomaly}第一次呈现出明确规律，但也暴露了它正在记录你的判断。`
    ],
    omen: `两条记录重合处浮出一个被擦掉的名字。`,
    echo: `你追查过的矛盾没有消失，它在后幕变成了判断你身份的证词。`
  };
}

function normalizeEffect(value, option, sceneNo, scene) {
  const source = value && typeof value === "object" ? value : {};
  const base = metricsForApproach(option?.approach);
  const delta = source.metricsDelta && typeof source.metricsDelta === "object" ? source.metricsDelta : base;
  const defaults = contextualDefaults(option, sceneNo, scene);
  return {
    metricsDelta: {
      evidence: clamp(delta.evidence ?? base.evidence),
      contamination: clamp(delta.contamination ?? base.contamination),
      identity: clamp(delta.identity ?? base.identity),
      trust: clamp(delta.trust ?? base.trust)
    },
    addFlags: strings(source.addFlags, [`scene-${sceneNo}-${option?.id || "choice"}`], 3, 90),
    consequenceTitle: text(source.consequenceTitle, defaults.title, 60),
    consequenceNarration: strings(source.consequenceNarration, defaults.narration, 2, 240),
    delayedOmen: text(source.delayedOmen, defaults.omen, 180),
    consequenceNote: text(source.consequenceNote, `${option?.label || "这项选择"}改变了${sceneAnchors(scene).focusObject}在后续场景中的状态。`, 220),
    identityFragment: text(source.identityFragment, "", 220),
    echo: text(source.echo, defaults.echo, 220)
  };
}

function contextualOptions(rules, scene, sceneNo) {
  const anchors = sceneAnchors(scene);
  const refs = numbers(scene.ruleRefs, [], 3);
  const firstNo = refs[0] || Number(rules[(sceneNo - 1) % Math.max(1, rules.length)]?.number || 1);
  const secondNo = refs[1] || Number(rules[sceneNo % Math.max(1, rules.length)]?.number || firstNo + 1);
  const firstText = shorten(findRule(rules, firstNo)?.text || `按第${firstNo}条处理现场`, 44);
  const clueA = anchors.clues[0] || anchors.focusObject;
  const clueB = anchors.clues[1] || anchors.witness;
  const thirdApproach = sceneNo % 2 === 0 ? "调查" : "保护";
  const raw = [
    {
      id: `obey-${sceneNo}`,
      label: `执行第${firstNo}条`,
      action: `在${anchors.location}按“${firstText}”处理${anchors.focusObject}。`,
      ruleRefs: [firstNo],
      approach: "遵守"
    },
    {
      id: `test-${sceneNo}`,
      label: "只改动一个细节",
      action: `只移动${anchors.focusObject}，观察“${anchors.anomaly}”是否跟着改变。`,
      ruleRefs: refs.slice(0, 1),
      approach: "试探"
    },
    thirdApproach === "调查" ? {
      id: `investigate-${sceneNo}`,
      label: "核对两份证据",
      action: `把“${clueA}”与“${clueB}”并列，追查${anchors.witness}的来源。`,
      ruleRefs: [firstNo, secondNo],
      approach: "调查"
    } : {
      id: `protect-${sceneNo}`,
      label: "先保住关键物件",
      action: `先隔离${anchors.focusObject}，不让${anchors.witness}继续接触它。`,
      ruleRefs: refs.slice(0, 1),
      approach: "保护"
    }
  ];
  return raw;
}

function normalizeOption(value, fallback, sceneNo, index, scene) {
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
  option.effect = normalizeEffect(source.effect || base.effect, option, sceneNo, scene);
  return option;
}

function fallbackScene({ archiveRecord, partySize, sceneNo }) {
  const archive = archiveRecord?.final_archive || {};
  const title = archive.title || archiveRecord?.title || "未命名档案";
  const rules = archiveRules(archiveRecord);
  const roles = rolesForParty(partySize);
  const rule = rules[(sceneNo - 1) % Math.max(1, rules.length)];
  const focusObject = text(archive?.legacySeed?.motifs?.[0], "一张被折过三次的登记纸", 80);
  const scene = {
    sceneNo,
    title: sceneNo === 5 ? "出口开始核对你的名字" : `《${title}》的第${sceneNo}处断层`,
    location: sceneNo === 5 ? "只在反光中出现的出口" : `${title}留下的封闭区域`,
    time: `进入后的第${sceneNo * 7}分钟`,
    turnRole: roles[(sceneNo - 1) % roles.length],
    narration: [
      `前一处现场留下的痕迹已经先一步出现在这里。`,
      rule ? `第${rule.number || sceneNo}条规则被重新抄写，但其中一个动作换了对象。` : "一条没有编号的规则正等待你补上对象。"
    ],
    visibleClues: [focusObject, "记录上的时间比现场快了十三分钟"],
    identityFragment: sceneNo >= 3 ? "你记起自己曾用另一个名字签收过这里的钥匙。" : "",
    pressure: sceneNo === 5 ? "出口只承认一个版本的你。" : "异常正在等待你替它确认一条规则。",
    focusObject,
    anomaly: "同一段记录在不同表面上显示不同时间",
    witness: "一段使用你声音的值班录音",
    ruleRefs: [Number(rule?.number || sceneNo)]
  };
  scene.options = contextualOptions(rules, scene, sceneNo).map((option, index) => normalizeOption(option, option, sceneNo, index, scene));
  return scene;
}

function normalizeScene(value, fallback, sceneNo, partySize, rules) {
  const source = value && typeof value === "object" ? value : {};
  const roles = rolesForParty(partySize);
  const scene = {
    sceneNo,
    title: text(source.title, fallback.title, 90),
    location: text(source.location, fallback.location, 80),
    time: text(source.time, fallback.time, 80),
    turnRole: text(source.turnRole, roles[(sceneNo - 1) % roles.length], 40),
    narration: strings(source.narration, fallback.narration, 4, 260),
    visibleClues: strings(source.visibleClues, fallback.visibleClues, 5, 180),
    identityFragment: text(source.identityFragment, fallback.identityFragment, 260),
    pressure: text(source.pressure, fallback.pressure, 240),
    focusObject: text(source.focusObject, fallback.focusObject || source.visibleClues?.[0] || fallback.visibleClues?.[0], 100),
    anomaly: text(source.anomaly, fallback.anomaly || source.pressure || fallback.pressure, 180),
    witness: text(source.witness, fallback.witness || source.visibleClues?.[1] || fallback.visibleClues?.[1], 120),
    ruleRefs: numbers(source.ruleRefs, fallback.ruleRefs || [], 3)
  };
  const generatedDefaults = contextualOptions(rules, scene, sceneNo);
  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const optionCount = Math.max(3, Math.min(4, rawOptions.length || 3));
  scene.options = Array.from({ length: optionCount }, (_, index) =>
    normalizeOption(rawOptions[index], generatedDefaults[index % generatedDefaults.length], sceneNo, index, scene)
  );
  return scene;
}

export function fallbackBlueprint(archiveRecord, partySize) {
  const seed = fallbackSeed(archiveRecord, partySize);
  const rules = archiveRules(archiveRecord);
  const firstBase = {
    ...seed.publicOpening.firstScene,
    focusObject: seed.publicOpening.firstScene.visibleClues?.[0] || "门口断掉的细线",
    anomaly: seed.publicOpening.firstScene.pressure,
    witness: "走廊深处的翻页声",
    ruleRefs: seed.publicOpening.firstScene.options?.flatMap((option) => option.ruleRefs || []).slice(0, 2)
  };
  const first = normalizeScene(firstBase, firstBase, 1, partySize, rules);
  return {
    ...seed,
    publicOpening: { ...seed.publicOpening, firstScene: first },
    scenePlan: [2, 3, 4, 5].map((sceneNo) => fallbackScene({ archiveRecord, partySize, sceneNo })),
    endingGuide: {
      coreRevelation: "规则真正筛选的不是最听话的人，而是仍能证明自己是谁的人。",
      identityEvidence: ["签名早于你的记忆出现", "关键物件保留了不同时间", "旧场景反复认出你的声音"],
      ruleKeys: rules.slice(0, 6).map((rule, index) => ({ number: Number(rule.number || index + 1), key: text(rule.actual || rule.surface || rule.text, "条件仍未完全确认", 180) })),
      endingAxes: seed.privateBible.endingAxes
    }
  };
}

export function normalizePlayBlueprint(data, archiveRecord, partySize) {
  const fallback = fallbackBlueprint(archiveRecord, partySize);
  const source = data && typeof data === "object" ? data : {};
  const seed = normalizeSeed(source, archiveRecord, partySize);
  const rules = archiveRules(archiveRecord);
  const rawFirst = source?.publicOpening?.firstScene || {};
  seed.publicOpening.firstScene = normalizeScene(rawFirst, fallback.publicOpening.firstScene, 1, partySize, rules);
  const rawPlan = Array.isArray(source.scenePlan) ? source.scenePlan : [];
  const scenePlan = [2, 3, 4, 5].map((sceneNo, index) => normalizeScene(rawPlan[index], fallback.scenePlan[index], sceneNo, partySize, rules));
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
  const effect = normalizeEffect(selectedOption?.effect, selectedOption, Number(state.sceneIndex || 0) + 1, state.currentScene);
  const fallback = fallbackBlueprint(state.sourceArchiveRecord, state.partySize);
  const planIndex = Number(state.sceneIndex || 0);
  const planned = state.scenePlan?.[planIndex] || fallback.scenePlan[planIndex] || fallback.scenePlan.at(-1);
  const nextScene = JSON.parse(JSON.stringify(planned));
  const older = state.choiceHistory?.length ? state.choiceHistory[Math.max(0, state.choiceHistory.length - 2)] : null;
  const echo = older
    ? `你更早选择「${older.label}」时留下的后果，也在这里完成了第二次出现：${older.consequenceNote || "现场仍记得那次判断"}`
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
