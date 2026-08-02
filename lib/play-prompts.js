const STYLE = `你是《第十三句》的规则怪谈导演。使用简体中文，短段落、具体动作、日常细节和延迟后果。不得提及AI或生成。规则真假、适用身份和篡改情况只在结局揭露。只输出合法JSON。`;

const LOGIC = `五幕必须是同一条因果链：至少3条现有规则实际触发；至少1条有条件成立；至少1条被篡改或误读。身份与异常机制直接相关。选择不标对错，后幕必须回收前幕留下的物件、声音、身份或记录。`;

export const playFoundationPrompt = `《第十三句》进入档案协议 V3\n${STYLE}\n${LOGIC}`;

function compactRules(archive) {
  return (archive.rules || []).slice(0, 10).map((rule, index) => ({
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
    truth: (archive.officialTruth || []).slice(0, 4),
    characters: (archive.characters || archive.characterRelations || []).slice(0, 4),
    world: archive.worldState || archive.worldChange || archive.worldConsequence || "",
    unresolved: (archive.unresolved || []).slice(0, 3),
    legacy: archive.legacySeed || null
  };
}

const OPTION = {
  id: "short-id",
  label: "短按钮",
  action: "现场中的具体动作",
  ruleRefs: [1],
  approach: "遵守|试探|保护|调查",
  effect: {
    metricsDelta: { evidence: 0, contamination: 0, identity: 0, trust: 0 },
    consequenceNarration: ["动作后立刻发生的具体结果"],
    delayedOmen: "稍后才会解释的征兆",
    echo: "下一幕回收该选择的一句话"
  }
};

const SCENE = {
  sceneNo: 2,
  title: "场景标题",
  location: "地点",
  time: "时间",
  turnRole: "同屏职责",
  narration: ["2段短叙事"],
  visibleClues: ["2至3条线索"],
  identityFragment: "可为空",
  pressure: "迫近的问题",
  options: [OPTION, OPTION, OPTION]
};

function blueprintOutput() {
  return {
    privateBible: {
      actualIdentity: "真实身份",
      identityConnection: "与世界的关系",
      secretNeed: "真正需求",
      trueRuleNumbers: [1],
      conditionalRules: [{ number: 2, condition: "成立条件" }],
      tamperedRuleNumbers: [3],
      dangerAxis: "污染逻辑",
      rescueAxis: "生路逻辑",
      endingAxes: ["4种结局方向"]
    },
    publicOpening: {
      dossierTitle: "进入标题",
      publicIdentity: "玩家相信的身份",
      startingMemory: "2句具体记忆",
      mission: "明确任务",
      warning: "克制提示",
      firstScene: { ...SCENE, sceneNo: 1 }
    },
    scenePlan: [
      { ...SCENE, sceneNo: 2 },
      { ...SCENE, sceneNo: 3 },
      { ...SCENE, sceneNo: 4 },
      { ...SCENE, sceneNo: 5 }
    ],
    endingGuide: {
      coreRevelation: "一句核心真相",
      identityEvidence: ["3至5条会在五幕出现的证据"],
      ruleKeys: [{ number: 1, key: "规则真正保护或筛选什么" }],
      endingAxes: ["与选择指标对应的结局方向"]
    }
  };
}

export function playSeedUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "一次生成完整5幕蓝图。重点写具体场景、选择和延迟后果；数值与格式由程序处理，不要写额外分析。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: randomSeed,
    output: blueprintOutput(),
    limits: {
      sceneNarration: "每幕2段，每段不超过55字",
      options: "每幕固定3个，动作必须具体且有不同代价",
      effect: "每个选项只需1句即时结果、1句延迟征兆、1句后幕回声",
      continuity: "第2至5幕至少各回收一个更早选择留下的具体细节",
      total: "整个JSON尽量控制在2200输出tokens内"
    }
  });
}

export function playRecoveryUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "紧凑重建一份可玩的5幕规则怪谈蓝图。上一次输出未完成；这次优先保证5幕、每幕3个具体选项、身份真相和连续因果全部存在。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: `${randomSeed}-recovery`,
    output: blueprintOutput(),
    limits: {
      sceneNarration: "每幕2段，每段不超过40字",
      visibleClues: "每幕2条",
      options: "每幕3个；effect只写consequenceNarration、delayedOmen、echo，其他字段可省略",
      total: "整个JSON控制在1600输出tokens内",
      priority: "宁可文字短，也不能缺少任何一幕或任何选项"
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
