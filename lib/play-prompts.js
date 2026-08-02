const PLAY_STYLE = `
【体验目标】
- 这是“进入既有规则怪谈并活着走到结局”的互动叙事，不是规则考试，也不是分析报告。
- 使用简体中文。场景具体、易读、短段落，每段1至2句；恐怖来自日常细节、制度错位、记忆不一致和延迟后果。
- 玩家始终可以翻阅全部规则，但规则的真实条件、篡改情况和适用对象必须隐藏到结局。
- 选择不标注正确或错误，不直接预告生死；后果可以延迟2至3个场景才显现。
- 不使用“AI、模型、系统生成、人机”等技术词。
- 不用空泛词语代替事件，不突然增加未出现过的新怪物解决矛盾。
`;

const PLAY_LOGIC = `
【生存导演硬规则】
1. 既有档案中的规则、真相与人物关系是本次冒险的世界基础，不得随意推翻。
2. 至少三条规则必须在实际场景中被触发；至少一条规则只在特定条件下成立；至少一条规则可能被篡改或被玩家误读。
3. 玩家身份必须与该档案的异常机制存在直接关系，但开场只给公开身份和一段不完整记忆。
4. 每次选择都更新隐藏状态：证据、污染、身份稳定、规则信任，并留下可在后续场景回收的标记。
5. 场景必须引用玩家此前的具体选择。不能把每一幕写成互不相关的小故事。
6. 最终结局由选择链共同决定，不能只由最后一个按钮决定。
7. 结局必须完整解释：真实身份、世界真相、每条关键规则、每次选择的延迟影响、错过的线索和一个可比较的关键转折点。
8. 1人时由同一玩家承担全部判断；2至4人同屏轮流时，每幕指定不同职责，但任何人数都无需等待。
`;

export const playFoundationPrompt = `
《第十三句》进入档案协议｜SURVIVAL V1
你是互动规则怪谈的私密导演。你将把一份由其他玩家共创并已经封存的档案，转化为可实际游玩的生存故事。
${PLAY_STYLE}
${PLAY_LOGIC}
当前调用若要求JSON，只输出一个合法JSON对象，不输出Markdown或额外解释。
`;

function compactArchive(archiveRecord) {
  const archive = archiveRecord.final_archive || {};
  return {
    id: archiveRecord.id,
    code: archiveRecord.archive_code,
    slug: archiveRecord.share_slug,
    title: archive.title || archiveRecord.title,
    preface: archive.preface || "",
    rules: (archive.rules || []).map((rule, index) => ({
      number: Number(rule.number || index + 1),
      text: String(rule.text || ""),
      trust: rule.trust || "",
      surface: rule.surface || "",
      actual: rule.actual || "",
      links: rule.links || []
    })),
    storyReplay: archive.storyReplay || archive.story || archive.eventSummary || null,
    officialTruth: archive.officialTruth || [],
    conflictReading: archive.conflictReading || [],
    characters: archive.characters || archive.characterRelations || [],
    worldState: archive.worldState || archive.worldChange || archive.worldConsequence || null,
    unresolved: archive.unresolved || [],
    legacySeed: archive.legacySeed || null,
    endingTitle: archive.endingTitle || "",
    endingText: archive.endingText || ""
  };
}

export function playSeedUserPrompt({ archiveRecord, partySize, roleOrder, randomSeed }) {
  return JSON.stringify({
    instruction: "把该封存档案改造成一场5幕的生存冒险。先建立隐藏身份与因果轴，只公开第一幕。",
    archive: compactArchive(archiveRecord),
    partySize,
    roleOrder,
    randomSeed,
    outputSchema: {
      privateBible: {
        actualIdentity: "玩家真正身份，具体且与异常机制有关",
        identityConnection: "为什么玩家会来到这里",
        secretNeed: "玩家真正想找回或保护的东西",
        trueRuleNumbers: [1, 2],
        conditionalRules: [{ number: 3, condition: "成立条件" }],
        tamperedRuleNumbers: [4],
        dangerAxis: "污染如何增长",
        rescueAxis: "证据或身份稳定如何带来生路",
        endingAxes: ["至少4种结局方向"]
      },
      publicOpening: {
        dossierTitle: "本次进入档案的标题",
        publicIdentity: "玩家目前相信的身份",
        startingMemory: "一段不完整但具体的记忆，2句",
        mission: "这次必须完成的明确目标",
        warning: "一句克制的进入提示",
        firstScene: {
          sceneNo: 1,
          title: "场景标题",
          location: "地点",
          time: "时间",
          turnRole: "本幕负责作决定的同屏职责",
          narration: ["3段短叙事"],
          visibleClues: ["2至4条可观察线索"],
          pressure: "此刻正在逼近的具体问题",
          options: [
            { "id": "obey", "label": "短按钮", "action": "具体行动", "ruleRefs": [1], "approach": "遵守|试探|保护|调查" },
            { "id": "test", "label": "短按钮", "action": "具体行动", "ruleRefs": [2], "approach": "遵守|试探|保护|调查" },
            { "id": "observe", "label": "短按钮", "action": "具体行动", "ruleRefs": [], "approach": "遵守|试探|保护|调查" }
          ]
        }
      }
    },
    requirements: [
      "第一幕必须让至少两条现有规则看起来都可能适用，但不能直接告诉玩家答案。",
      "选项必须是场景中的具体动作，不能是抽象态度。",
      "公开身份与真实身份之间必须存在可在五幕内逐步揭开的差异。",
      "文本要让第一次阅读就能理解正在发生什么。"
    ]
  });
}

export function playAdvanceUserPrompt({ state, selectedOption }) {
  const isFinal = Number(state.sceneIndex || 0) >= Number(state.totalScenes || 5) - 1;
  return JSON.stringify({
    instruction: isFinal
      ? "玩家已经在第五幕作出最终行动。根据完整选择链生成结局解读。"
      : "结算当前选择的即时与延迟后果，并生成下一幕。",
    sourceArchive: compactArchive(state.sourceArchiveRecord),
    privateBible: state.privateBible,
    publicIdentity: state.publicOpening.publicIdentity,
    partySize: state.partySize,
    roleOrder: state.roleOrder,
    sceneIndex: state.sceneIndex,
    currentScene: state.currentScene,
    selectedOption,
    hiddenMetrics: state.metrics,
    routeFlags: state.routeFlags,
    choiceHistory: state.choiceHistory,
    outputSchema: isFinal ? {
      privatePatch: {
        metricsDelta: { evidence: 0, contamination: 0, identity: 0, trust: 0 },
        addFlags: ["最终标记"]
      },
      ending: {
        endingTitle: "结局名",
        endingTier: "幸存|失踪|替代|共存|真相暴露|其他",
        openingLine: "一句最先显示的结局句",
        story: ["按时间顺序写5段短故事，完整讲清玩家经历"],
        oneLineTruth: "一句话说明整件事真正发生了什么",
        identityReveal: {
          believed: "开场身份",
          actual: "真实身份",
          evidence: ["3条游戏中出现过的证据"],
          meaning: "身份与世界机制的关系"
        },
        choiceTimeline: [
          { "sceneNo": 1, "choice": "玩家当时做了什么", "immediate": "当时看到的结果", "delayed": "后来才发生的影响", "verdict": "这个选择保护/伤害/改变了什么" }
        ],
        ruleReadings: [
          { "number": 1, "text": "规则原文", "verdict": "真实|条件成立|被篡改|误读", "condition": "何时成立", "playerUse": "玩家如何使用或违背它", "consequence": "造成的后果" }
        ],
        causalChain: ["原因 → 行动 → 延迟后果"],
        missedClues: ["最多4条确实出现过但玩家未充分利用的线索"],
        turningPoint: { "sceneNo": 2, "choice": "关键选择", "alternate": "若改选另一项，最可能改变什么" },
        worldConsequence: "本次进入之后，这个档案世界永久改变了什么",
        fieldNote: "一条将留给后来者的短现场记录",
        nextHook: "后来者可以继续调查的具体入口"
      }
    } : {
      privatePatch: {
        metricsDelta: { evidence: 0, contamination: 0, identity: 0, trust: 0 },
        addFlags: ["后续必须回收的具体标记"],
        consequenceNote: "仅供导演保持因果的说明",
        identityFragment: "本幕是否暴露一小段身份记忆"
      },
      public: {
        consequence: {
          title: "选择落下后的短标题",
          narration: ["2段短叙事，必须说明玩家刚才的动作实际发生了什么"],
          delayedOmen: "一个现在看不懂、后面会回收的具体征兆"
        },
        nextScene: {
          sceneNo: Number(state.sceneIndex || 0) + 2,
          title: "下一幕标题",
          location: "地点",
          time: "时间",
          turnRole: "根据人数轮换后的职责",
          narration: ["3段短叙事，必须引用至少一个旧选择或旧标记"],
          visibleClues: ["2至4条"],
          identityFragment: "可为空；若不为空，必须是短记忆片段",
          pressure: "下一项迫近问题",
          options: [
            { "id": "a", "label": "短按钮", "action": "具体行动", "ruleRefs": [1], "approach": "遵守|试探|保护|调查" },
            { "id": "b", "label": "短按钮", "action": "具体行动", "ruleRefs": [2], "approach": "遵守|试探|保护|调查" },
            { "id": "c", "label": "短按钮", "action": "具体行动", "ruleRefs": [], "approach": "遵守|试探|保护|调查" }
          ]
        }
      }
    },
    requirements: [
      "不能直接宣布选择正确或错误。",
      "指标变化必须与具体动作有关，数值范围每项-25到25。",
      "后续场景必须让至少一个较早选择产生延迟影响。",
      isFinal ? "结局逐条覆盖实际触发过的规则，并明确所有五幕选择的作用。" : "下一幕与当前档案世界保持一致，不得换成无关地点或无关怪物。"
    ]
  });
}
