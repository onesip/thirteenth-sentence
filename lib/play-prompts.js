const STYLE = `你是《第十三句》的规则怪谈导演。使用简体中文，短段落、具体动作、日常细节和延迟后果。不得提及AI或生成。规则真假、适用身份和篡改情况只在结局揭露。只输出合法JSON。`;

const LOGIC = `五幕必须是同一条因果链：至少3条现有规则实际触发；至少1条有条件成立；至少1条被篡改或误读。身份与异常机制直接相关。选择不标对错，后幕必须回收前幕留下的物件、声音、身份或记录。`;

export const playFoundationPrompt = `《第十三句》进入档案协议 V4\n${STYLE}\n${LOGIC}`;

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

const OPTION = {
  id: "id",
  label: "短按钮",
  action: "具体动作",
  ruleRefs: [1],
  approach: "遵守|试探|保护|调查",
  effect: {
    consequenceNarration: ["该动作立刻造成的具体变化"],
    echo: "后幕怎样回收这个变化"
  }
};

const SCENE = {
  sceneNo: 2,
  title: "标题",
  location: "地点",
  time: "时间",
  turnRole: "职责",
  narration: ["短叙事1", "短叙事2"],
  visibleClues: ["线索1", "线索2"],
  identityFragment: "可为空",
  pressure: "迫近问题",
  options: [OPTION, OPTION, OPTION]
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
      endingAxes: ["结局方向"]
    },
    publicOpening: {
      dossierTitle: "进入标题",
      publicIdentity: "表面身份",
      startingMemory: "两句具体记忆",
      mission: "明确任务",
      warning: "一句提示",
      firstScene: { ...SCENE, sceneNo: 1 }
    },
    scenePlan: [
      { ...SCENE, sceneNo: 2 },
      { ...SCENE, sceneNo: 3 },
      { ...SCENE, sceneNo: 4 },
      { ...SCENE, sceneNo: 5 }
    ],
    endingGuide: {
      coreRevelation: "核心真相",
      identityEvidence: ["3条身份证据"],
      ruleKeys: [{ number: 1, key: "规则真正作用" }],
      endingAxes: ["结局方向"]
    }
  };
}

export function playSeedUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "生成完整5幕可执行蓝图。必须具体使用这份档案的人物、物品、地点和规则。不要写分析，不要增加输出字段。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: randomSeed,
    output: blueprintOutput(),
    limits: {
      narration: "每幕正好2段，每段25至45字",
      clues: "每幕正好2条",
      options: "每幕正好3个，每个action不超过36字",
      effect: "每个选项只写1句即时变化和1句后幕回声",
      continuity: "第2至5幕各回收一个前幕具体细节",
      total: "整个JSON不超过1500输出tokens"
    }
  });
}

export function playRecoveryUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    task: "生成极紧凑但完整的5幕蓝图。必须保留具体世界细节；绝不缺幕、缺选项或改成通用走廊模板。",
    archive: compactArchive(archiveRecord),
    party: { size: partySize, roles: roleOrder },
    seed: `${randomSeed}-recovery`,
    output: blueprintOutput(),
    limits: {
      narration: "每幕2句，每句不超过28字",
      clues: "每幕2条短线索",
      options: "每幕3个，action不超过24字",
      effect: "每个选项只写consequenceNarration一项；echo可省略",
      priority: "完整五幕优先，整个JSON不超过1000输出tokens"
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
