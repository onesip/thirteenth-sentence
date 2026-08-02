const STYLE = `你是《第十三句》的规则怪谈导演。使用简体中文，场景必须具体、易读、有日常物件与延迟后果。不得提及AI或生成。规则真假、适用身份和篡改情况只在结局揭露。只输出合法JSON。`;

const LOGIC = `五幕必须是同一条因果链：至少3条现有规则实际触发；至少1条有条件成立；至少1条被篡改或误读。身份与异常机制直接相关。后幕必须回收前幕留下的物件、声音、人物或记录。`;

export const playFoundationPrompt = `《第十三句》进入档案协议 V5\n${STYLE}\n${LOGIC}`;

function compactRules(archive) {
  return (archive.rules || []).slice(0, 8).map((rule, index) => ({
    n: Number(rule.number || index + 1),
    t: String(rule.text || ""),
    v: String(rule.trust || ""),
    a: String(rule.actual || rule.surface || "")
  }));
}

function compactArchive(record) {
  const archive = record.final_archive || {};
  return {
    code: record.archive_code,
    title: archive.title || record.title,
    preface: archive.preface || "",
    rules: compactRules(archive),
    truth: (archive.officialTruth || []).slice(0, 3),
    characters: (archive.characters || archive.characterRelations || []).slice(0, 3),
    world: archive.worldState || archive.worldChange || archive.worldConsequence || "",
    unresolved: (archive.unresolved || []).slice(0, 2)
  };
}

const SCENE_SPINE = {
  sceneNo: 2,
  title: "场景标题",
  location: "具体地点",
  time: "具体时间",
  turnRole: "同屏职责",
  narration: ["具体事件短段1", "具体事件短段2"],
  visibleClues: ["可观察线索1", "可观察线索2"],
  identityFragment: "可为空的身份记忆",
  pressure: "此刻必须解决的问题",
  focusObject: "本幕关键物件",
  anomaly: "本幕具体异常",
  witness: "本幕出现的人、声音或记录来源",
  ruleRefs: [1, 2]
};

function blueprintOutput() {
  return {
    privateBible: {
      actualIdentity: "真实身份",
      identityConnection: "与世界关系",
      secretNeed: "真正需求",
      trueRuleNumbers: [1],
      conditionalRules: [{ number: 2, condition: "条件" }],
      tamperedRuleNumbers: [3],
      dangerAxis: "危险逻辑",
      rescueAxis: "生路逻辑",
      endingAxes: ["至少3种结局方向"]
    },
    publicOpening: {
      dossierTitle: "进入标题",
      publicIdentity: "表面身份",
      startingMemory: "两句具体记忆",
      mission: "明确任务",
      warning: "一句提示",
      firstScene: { ...SCENE_SPINE, sceneNo: 1 }
    },
    scenePlan: [
      { ...SCENE_SPINE, sceneNo: 2 },
      { ...SCENE_SPINE, sceneNo: 3 },
      { ...SCENE_SPINE, sceneNo: 4 },
      { ...SCENE_SPINE, sceneNo: 5 }
    ],
    endingGuide: {
      coreRevelation: "核心真相",
      identityEvidence: ["3条会在五幕中出现的身份证据"],
      ruleKeys: [{ number: 1, key: "规则真正保护或筛选什么" }],
      endingAxes: ["与玩家判断对应的结局方向"]
    }
  };
}

export function playSeedUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "生成完整5幕故事骨架。只写场景、关键物件、异常、人物/声音、线索和规则引用；玩家行动与数值由程序根据这些内容生成。必须具体使用该档案已有的人物、物品、地点和规则。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: randomSeed,
    output: blueprintOutput(),
    limits: {
      narration: "每幕正好2段，每段25至50字",
      clues: "每幕正好2条具体线索",
      anchors: "focusObject、anomaly、witness必须具体，不能写某物、某人、异常现象",
      continuity: "第2至5幕各回收一个前幕的focusObject、witness或线索",
      total: "整个JSON控制在1200输出tokens左右，不要输出options或effect"
    }
  });
}

export function playRecoveryUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "紧凑生成完整5幕故事骨架。上一次输出没有完成；这次只保留五幕具体事件和关键锚点，绝不能缺幕。不要输出玩家选项或数值。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: `${randomSeed}-recovery`,
    output: blueprintOutput(),
    limits: {
      narration: "每幕2句，每句不超过32字",
      clues: "每幕2条短线索",
      anchors: "每幕必须有具体focusObject、anomaly、witness和ruleRefs",
      priority: "五幕完整优先，整个JSON控制在900输出tokens左右"
    }
  });
}

function compactHistory(state, finalOption) {
  return [
    ...(state.choiceHistory || []).map((item) => ({ s: item.sceneNo, c: item.label, a: item.action, r: item.ruleRefs, n: item.consequenceNote })),
    { s: Number(state.sceneIndex || 0) + 1, c: finalOption.label, a: finalOption.action, r: finalOption.ruleRefs || [], n: finalOption.effect?.consequenceNote || "" }
  ];
}

export function playFinalUserPrompt({ state, selectedOption }) {
  return JSON.stringify({
    task: "根据五幕完整选择链写最终结局。先讲完整故事，再解释身份、规则和蝴蝶效应。只能引用实际出现的信息。",
    archive: {
      title: state.sourceArchiveRecord?.final_archive?.title || state.sourceArchiveRecord?.title,
      rules: compactRules(state.sourceArchiveRecord?.final_archive || {}),
      truth: (state.sourceArchiveRecord?.final_archive?.officialTruth || []).slice(0, 4),
      world: state.sourceArchiveRecord?.final_archive?.worldState || state.sourceArchiveRecord?.final_archive?.worldChange || ""
    },
    bible: state.privateBible,
    guide: state.endingGuide,
    metrics: state.metrics,
    flags: (state.routeFlags || []).slice(-12),
    history: compactHistory(state, selectedOption),
    output: {
      privatePatch: { metricsDelta: { evidence: 0, contamination: 0, identity: 0, trust: 0 }, addFlags: ["final"] },
      ending: {
        endingTitle: "结局名",
        endingTier: "幸存|失踪|替代|共存|真相暴露|其他",
        openingLine: "一句先显示的结局句",
        story: ["按时间顺序5段短故事"],
        oneLineTruth: "一句话真相",
        identityReveal: { believed: "开场身份", actual: "真实身份", evidence: ["3条已出现证据"], meaning: "身份与机制关系" },
        choiceTimeline: [{ sceneNo: 1, choice: "当时动作", immediate: "即时结果", delayed: "延迟影响", verdict: "保护或伤害了什么" }],
        ruleReadings: [{ number: 1, text: "原文", verdict: "真实|条件成立|被篡改|误读", condition: "条件", playerUse: "如何使用", consequence: "后果" }],
        causalChain: ["原因 → 行动 → 延迟后果"],
        missedClues: ["最多4条实际出现的线索"],
        turningPoint: { sceneNo: 2, choice: "关键选择", alternate: "换选项最可能改变什么" },
        worldConsequence: "世界永久变化",
        fieldNote: "留给后来者的一条短记录",
        nextHook: "具体后续入口"
      }
    },
    limits: { story: "总计350至600字", ruleReadings: "覆盖实际触发的重要规则", concise: true }
  });
}

export function playAdvanceUserPrompt({ state, selectedOption }) {
  return playFinalUserPrompt({ state, selectedOption });
}
