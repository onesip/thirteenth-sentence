import { DEFAULT_CHOICES_FINAL, DEFAULT_CHOICES_ONE } from "./constants.js";
import { getWorldProfile } from "./worlds-v2.js";

const MOTIF_WORDS = [
  "猫眼", "敲门", "邻居", "电梯", "镜子", "牛奶", "垃圾袋", "晾衣架", "雨伞", "钥匙",
  "灯", "楼梯", "电话", "窗帘", "鞋", "影子", "凌晨", "四次", "红色", "灰色", "白色",
  "车票", "广播", "站台", "车厢", "作业本", "点名", "课桌", "铃声", "潮水", "房卡", "脚印",
  "腕带", "出院单", "监护仪", "药杯", "录音带", "耳机", "直播灯", "延迟", "姓名", "门牌"
];

export function cleanText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

export function extractMotifs(text = "") {
  return [...new Set(MOTIF_WORDS.filter((word) => String(text || "").includes(word)))].slice(0, 8);
}

function archiveId(profile) {
  return `${profile.code}-${String(Math.floor(100 + Math.random() * 900))}`;
}

function buildRuleLogic() {
  return [
    { role: "ordinary", truth: "conditional", purpose: "用日常管理规定掩盖真正的筛选机制。" },
    { role: "space", truth: "likely", purpose: "揭示异常空间只在特定条件下出现。" },
    { role: "tampered", truth: "tampered", purpose: "用看似安全的动作诱导玩家完成危险确认。" },
    { role: "player_anchor_one", truth: "conditional", purpose: "吸收玩家第一句话，并规定它只在特定方向或时机成立。" },
    { role: "apparent_conflict", truth: "likely", purpose: "与第一条玩家规则形成可以解释的表面冲突。" },
    { role: "player_anchor_two", truth: "suspicious", purpose: "吸收玩家第二句话，让普通物品成为身份或归属凭证。" },
    { role: "false_rule", truth: "suspicious", purpose: "把玩家意象连接成一条危险的伪规则。" },
    { role: "reversal", truth: "likely", purpose: "揭示玩家以为不存在的对象其实曾经存在。" }
  ];
}

export function createFallbackStory(legacyFragment = null, worldProfile = null) {
  const profile = worldProfile || getWorldProfile("rain-alley");
  const inherited = legacyFragment?.quote
    ? [legacyFragment.quote, ...profile.inheritedFragments].slice(0, 4)
    : profile.inheritedFragments.slice(0, 4);
  return {
    worldKey: profile.key,
    worldName: profile.name,
    chapterTitle: `《${profile.name}：${profile.genre.split("/")[0].trim()}档案》`,
    archiveId: archiveId(profile),
    title: `《${profile.name}临时须知》`,
    identity: profile.identities[0],
    sceneAnchor: profile.sceneNumber,
    hiddenTruth: profile.premise,
    entity: profile.entity,
    mechanism: profile.mechanism,
    dangerMark: profile.dangerMark,
    safeAction: profile.safeAction,
    falseAction: profile.falseAction,
    coreMotifs: profile.motifs.slice(0, 8),
    inheritedFragments: inherited,
    ruleLogic: buildRuleLogic(),
    endings: {
      follow: "玩家执行自己写下的规则，成为机制的新参与者或继承者。",
      reverse: "玩家逆向行动，打断当前程序，却让异常转移到别处。",
      mark: "玩家只留下存在证明，暂时保存自己，却没有解决源头。",
      open: "玩家主动完成身份确认，真相被看见，但代价立即生效。"
    },
    unresolved: [
      "最早写下这些规则的人是否仍在世界里？",
      "档案管理员是在保护后来者，还是维持异常机制？",
      "本局留下的证据会不会在下一次被改写？"
    ],
    cast: [
      { name: profile.entity, role: "异常执行者", relation: "负责推动机制完成确认" },
      { name: "上一位记录者", role: "缺席者", relation: "通过旧碎片影响本局" },
      { name: profile.identities[0], role: "当前参与者", relation: "必须决定是否接受既有规则" }
    ],
    storyBeats: [
      profile.entryHook,
      `一份旧记录被恢复，其中提到了“${inherited[0] || profile.motifs[0]}”。`,
      `玩家写下的第一句话改变了${profile.mechanism}`,
      `${profile.dangerMark}出现在现场，迫使第二条规则开始生效。`,
      profile.finalScene
    ],
    firstTask: profile.firstTask,
    secondTask: profile.secondTask,
    profileSnapshot: profile
  };
}

export function fallbackOpening(story, identities, legacyFragment) {
  const profile = story.profileSnapshot || getWorldProfile(story.worldKey);
  return {
    archiveId: story.archiveId,
    worldKey: story.worldKey,
    worldName: story.worldName,
    chapterTitle: story.chapterTitle,
    sceneNumber: story.sceneAnchor || profile.sceneNumber,
    title: story.title,
    primaryIdentity: identities[0],
    briefing: profile.entryHook,
    inheritedFragment: legacyFragment?.quote || story.inheritedFragments[0],
    firstTask: story.firstTask || profile.firstTask
  };
}

export function fallbackAfterFirstRule(state) {
  const profile = state.storyBible.profileSnapshot || getWorldProfile(state.storyBible.worldKey);
  const motifs = extractMotifs(state.firstRule);
  const key = motifs[0] || profile.motifs[0];
  return {
    eyebrow: "旧记录被重新排序",
    heading: "你的句子让两条旧规定同时生效",
    narration: [
      `档案把“${motifs.join("、") || key}”标记为本局的新条件。`,
      `原本互不相干的两条记录突然指向同一个动作：${profile.mechanism}`,
      `边缘批注只剩半句：不要让“${key}”同时证明两种身份。`
    ],
    recoveredRules: [profile.tamperedRule, profile.conflictRule],
    choices: DEFAULT_CHOICES_ONE
  };
}

export function fallbackAfterFirstChoice(state) {
  const profile = state.storyBible.profileSnapshot || getWorldProfile(state.storyBible.worldKey);
  const map = {
    keep: "档案保留了你的版本，并把旧规则标成‘需要重新验证’。",
    "trust-old": "你的句子没有被删除，只是被压在旧记录下面等待下一次触发。",
    split: "系统接受了你的判断：相同动作在不同方向、时间或身份下会产生相反结果。",
    observe: "你没有执行任何规定。几秒后，现场出现了一件本不该属于你的东西。"
  };
  return {
    eyebrow: "第二处现场出现",
    heading: "一件普通物品开始替你作证",
    narration: [
      map[state.firstChoice] || map.observe,
      `${profile.dangerMark}出现在${profile.sceneNumber}附近，${profile.entity}没有解释它为什么属于你。`,
      `你第一次意识到：${profile.mechanism}`
    ],
    task: state.storyBible.secondTask || profile.secondTask
  };
}

export function fallbackAfterSecondRule(state) {
  const profile = state.storyBible.profileSnapshot || getWorldProfile(state.storyBible.worldKey);
  const motifs = extractMotifs(state.secondRule);
  const object = motifs[0] || profile.motifs[1] || "那件物品";
  return {
    eyebrow: "规则开始反向验证",
    heading: "你写下的动作已经在现场发生",
    narration: [
      `第二句话写完后，与“${object}”有关的细节真的出现了。`,
      `${profile.entity}退到你无法确认的位置，只留下${profile.dangerMark}。`,
      profile.finalScene
    ],
    choices: DEFAULT_CHOICES_FINAL,
    finalNotePrompt: state.playerCount >= 3 ? {
      title: "留下最后一句不署名批注",
      instruction: "这句话不必解释真相，但必须说明你最终愿意相信谁、哪条规则，或哪一种记忆。",
      placeholder: "我决定相信……",
      maxLength: 80
    } : null
  };
}

function endingFor(profile, choice, finalNote = "") {
  const endings = {
    follow: {
      title: "被规则承认的人",
      text: `你严格执行了自己写下的动作。${profile.entity}停止继续确认，但${profile.dangerMark}被留在了你这一侧。`,
      consequence: "你保住了当前身份，却成为机制下一次运行时必须被询问的人。"
    },
    reverse: {
      title: "程序被打断",
      text: `你做了与规则相反的事。现场恢复了正常，但一个原本只属于${profile.name}的异常出口出现在别处。`,
      consequence: "你没有接受既定身份，却让异常失去了边界。"
    },
    mark: {
      title: "仍然在场",
      text: `你没有触碰${profile.dangerMark}，只留下一个只有当前参与者才能制造的证明。异常暂时停止。`,
      consequence: "你证明自己仍在场，但没有查清最早的缺席者去了哪里。"
    },
    open: {
      title: "身份确认完成",
      text: `你主动面对${profile.entity}。对方没有回答，只把一份已经写好你身份的记录交给了你。`,
      consequence: "真相被确认的同时，你也被写进了机制。"
    }
  };
  const ending = endings[choice] || endings.mark;
  if (finalNote) ending.text += ` 现场还留着一句没有署名的批注：“${cleanText(finalNote)}”`;
  return ending;
}

function rule(number, text, trust, surface, actual, links = []) {
  return { number, text, trust, surface, actual, links };
}

export function fallbackFinalArchive(state) {
  const profile = state.storyBible.profileSnapshot || getWorldProfile(state.storyBible.worldKey);
  const firstRule = cleanText(state.firstRule) || profile.firstTask.placeholder;
  const secondRule = cleanText(state.secondRule) || profile.secondTask.placeholder;
  const ending = endingFor(profile, state.finalChoice, state.finalNote);
  const motifs = [...new Set([
    ...extractMotifs(firstRule),
    ...extractMotifs(secondRule),
    ...(state.storyBible.coreMotifs || profile.motifs)
  ])].slice(0, 8);

  const rules = [
    rule(1, profile.ordinaryRule, "条件成立", "一条普通的管理规定。", `它真正筛选的是谁仍被${profile.name}承认为“在场者”。`, ["第4条"]),
    rule(2, profile.spaceRule, "可能可信", "避免进入异常空间。", `异常空间用来暂存被当前机制排除的人或记录。`, ["第6条"]),
    rule(3, firstRule, "条件成立", "第一位记录者写下的现场办法。", `这条规则只有在动作方向、执行时机和身份都正确时才有效；它直接改变了${profile.mechanism}`, ["第1条", "第4条"]),
    rule(4, profile.conflictRule, "可能可信", "与玩家规则互相矛盾的旧规定。", "它不是简单否定玩家，而是在说明同一动作从不同方向发生时意义相反。", ["第3条"]),
    rule(5, secondRule, "高度可疑", "第二位记录者写下的物品处理办法。", `普通物品已经成为归属凭证；处理${profile.dangerMark}可能等于接受某种身份。`, ["第1条", "第6条"]),
    rule(6, profile.falseRule, "已被篡改", "看似最具体、最容易执行的安全办法。", `它诱导参与者完成${profile.falseAction}`, ["第2条", "第5条"])
  ];

  const chapters = [
    { title: "进入", scene: profile.entryHook, clue: state.storyBible.inheritedFragments?.[0] || profile.inheritedFragments[0], playerEcho: "你还没有写下任何东西，但档案已经提前认识了你的身份。" },
    { title: "第一句话", scene: `你写下：“${firstRule}” 档案随即恢复了两条互相冲突的旧记录。`, clue: profile.tamperedRule, playerEcho: "你的句子第一次改变了旧规则的成立条件。" },
    { title: "冲突", scene: `你选择了“${state.firstChoice || "继续观察"}”。${profile.dangerMark}随后出现在现场。`, clue: profile.mechanism, playerEcho: "选择没有揭开真相，却决定了第二个现场如何出现。" },
    { title: "第二句话", scene: `你又写下：“${secondRule}” 这一次，普通物品开始替某个身份作证。`, clue: profile.entity, playerEcho: "第二句话把世界观里的抽象机制变成了可触碰的物件。" },
    { title: ending.title, scene: ending.text, clue: ending.consequence, playerEcho: `最终行动“${state.finalChoice || "mark"}”决定了谁被规则承认。` }
  ];

  return {
    worldKey: profile.key,
    worldName: profile.name,
    chapterTitle: state.storyBible.chapterTitle || `《${profile.name}临时档案》`,
    archiveId: state.storyBible.archiveId,
    title: state.storyBible.title,
    preface: "请先阅读‘故事回放’，再展开规则解读。较新的记录不一定更可信。",
    storyChapters: chapters,
    readingGuide: {
      oneSentenceTruth: `${profile.name}正在利用${profile.mechanism}，把参与者区分为仍在场的人与可以被替换的人。`,
      recommendedOrder: ["故事回放", "规则解读", "人物关系", "世界延伸"]
    },
    rules,
    appendix: [
      `本局身份数量为${state.playerCount}，但档案中的声音来源仍多于现场人数。`,
      `${profile.dangerMark}在封存后没有消失。`,
      ending.text
    ],
    eventSummary: `${profile.premise}${ending.consequence}`,
    officialTruth: [
      profile.premise,
      profile.mechanism,
      `${profile.entity}不是随机出现的人物，而是当前机制的执行者或校验者。`,
      "规则来自不同立场：有人试图保护后来者，有人只想让程序继续完成。"
    ],
    conflictReading: [
      "第一条玩家规则与旧记录的冲突来自执行条件不同，而不是两者必有一条毫无意义。",
      "第二条玩家规则把普通物品变成身份凭证，因此它既可能保护人，也可能完成交接。",
      "最具体、最像官方说明的规则往往最危险，因为它最容易让人主动配合。"
    ],
    unresolved: state.storyBible.unresolved?.slice(0, 3) || [],
    relationshipMap: [
      { from: state.identities?.[0] || "当前记录者", to: profile.entity, relation: "被确认 / 反向观察", certainty: "已确认" },
      { from: "上一位记录者", to: state.identities?.[0] || "当前记录者", relation: "通过旧碎片留下条件", certainty: "部分确认" },
      { from: "档案管理员", to: profile.mechanism, relation: "可能维护，也可能篡改", certainty: "未确认" }
    ],
    playerImpact: [
      `第一句话“${firstRule}”成为规则核心，并强迫档案解释它何时有效。`,
      `第二句话“${secondRule}”让${motifs.slice(0, 3).join("、") || profile.dangerMark}成为身份凭证。`,
      `中途选择“${state.firstChoice || "继续观察"}”决定异常以何种方式回应。`,
      `最终选择导向结局《${ending.title}》。`
    ],
    worldExpansion: {
      unlockedPlace: `${profile.name}·${profile.sceneNumber}之外的封闭区域`,
      persistentChange: ending.consequence,
      recurringClue: motifs[0] || profile.motifs[0],
      nextHooks: [
        `下一位记录者会在另一个地点看见“${motifs[0] || profile.dangerMark}”。`,
        `同一世界仍有一份与${profile.entity}立场相反的旧档案没有恢复。`
      ]
    },
    endingTitle: ending.title,
    endingText: ending.text,
    legacySeed: {
      quote: firstRule,
      motifs: motifs.slice(0, 6),
      nextHook: `后来者会读到这句话，并发现${profile.name}的新版本明确禁止这样做。`
    }
  };
}
