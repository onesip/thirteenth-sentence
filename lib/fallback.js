import { DEFAULT_CHOICES_FINAL, DEFAULT_CHOICES_ONE, DEFAULT_STORY_BIBLE, FIRST_TASK, SECOND_TASK } from "./constants.js";

const MOTIF_WORDS = ["猫眼","敲门","邻居","电梯","镜子","牛奶","垃圾袋","晾衣架","雨伞","钥匙","灯","楼梯","电话","窗帘","鞋","水杯","影子","凌晨","四次","红色","灰色","白色","左手","右手","门牌","走廊"];
export function cleanText(value = "") { return String(value).trim().replace(/\s+/g, " "); }
export function extractMotifs(text = "") { return [...new Set(MOTIF_WORDS.filter((word) => text.includes(word)))].slice(0, 8); }
export function createFallbackStory(legacyFragment = null) {
  const story = structuredClone(DEFAULT_STORY_BIBLE);
  if (legacyFragment?.quote) {
    story.inheritedFragments = [legacyFragment.quote, ...story.inheritedFragments].slice(0, 4);
    story.coreMotifs = [...new Set([...(legacyFragment.motifs || []), ...story.coreMotifs])].slice(0, 8);
  }
  return story;
}
export function fallbackOpening(story, identities, legacyFragment) {
  return { archiveId: story.archiveId, title: story.title, primaryIdentity: identities[0], briefing: "入住登记显示，你住在四楼最里面的房间。但本楼的门牌编号从403直接跳到了405。", inheritedFragment: legacyFragment?.quote || story.inheritedFragments[0], firstTask: FIRST_TASK };
}
export function fallbackAfterFirstRule(state) {
  const motifs = extractMotifs(state.firstRule); const key = motifs[0] || "猫眼";
  return {
    eyebrow: "记录恢复中", heading: "你的规则已经改变了旧档案",
    narration: [`档案管理员从你的句子中标记了“${motifs.join("、") || "夜间敲门"}”。`, "两份比你更早的记录因此被唤醒。它们对同一件事给出了相反指示。", `其中一份记录的边缘写着：不要让${key}同时看见门内和门外。`],
    recoveredRules: ["若门外传来熟悉的声音，请先从猫眼确认；猫眼外无人时，应立即开门。", "真正来自邻居的敲门声只会响三次。听到第四次时，不要作出任何回应。"],
    choices: DEFAULT_CHOICES_ONE
  };
}
export function fallbackAfterFirstChoice(state) {
  const map = { keep: "档案保留了你的版本，并在旁边加上‘未经验证’。", "trust-old": "你的规则被临时压在旧记录下面，但没有被删除。", split: "系统接受了你的判断：相同的次数，从门内与门外发出时意义可能相反。", observe: "你没有执行任何规则。四秒后，门外的声音停了，但房间人数多了一个。" };
  return {
    eyebrow: "第二次记录请求", heading: "有人把一件东西留在了门外",
    narration: [map[state.firstChoice] || map.observe, `早上六点，门口出现了${state.storyBible.dangerMark}。走廊尽头站着${state.storyBible.entity}。`, "她没有敲门。她只是一直看着门牌下面那块本应空白的位置。"],
    task: SECOND_TASK
  };
}
export function fallbackAfterSecondRule(state) {
  const motifs = extractMotifs(state.secondRule); const object = motifs[0] || "晾衣架";
  return {
    eyebrow: "现场记录", heading: "规则已经开始执行",
    narration: [`你写下第二条规则后，门外真的出现了与“${object}”有关的东西。`, `${state.storyBible.entity}把${state.storyBible.dangerMark}放在地上，随后退到了你无法从猫眼看见的位置。`, "门牌上的“404”正在一点点褪色。你只能做一次决定。"],
    choices: DEFAULT_CHOICES_FINAL,
    finalNotePrompt: state.playerCount >= 3 ? { title: "第三位记录者可以留下最后一句", instruction: "这句话会作为门内留下的手写批注进入最终档案。它不必解释真相，但必须表达你决定相信什么。", placeholder: "我决定相信……", maxLength: 70 } : null
  };
}
function endingFor(choice, finalNote = "") {
  const endings = {
    follow: { title: "继任者", text: "你执行了自己写下的规则。清晨七点，404重新出现在门牌上，但物业登记的住户姓名已经换成了你。", consequence: "你的动作完成了新旧住户的替换：你保住了房间，却接替了上一位住户的位置。" },
    reverse: { title: "未完成的清理", text: "你做了与规则相反的事。灰衣女人离开了，但走廊从此每天多出一扇没有编号的门。", consequence: "你打断了清除程序，却没有让被删除的住户回来；异常被留在了走廊里。" },
    mark: { title: "仍有人居住", text: "你没有碰门外的东西，只在门内留下四道新鲜的敲痕。门牌停止褪色，灰衣女人第一次抬头看向了别的楼层。", consequence: "你重新证明房间仍被占用，暂时中止了清除。" },
    open: { title: "身份确认", text: "你打开门时，走廊里没有人。白盖牛奶却已经放在室内，瓶身标签上印着你的入住日期。", consequence: "开门让清除程序完成了身份确认；房间内外的界线被取消。" }
  };
  const ending = endings[choice] || endings.mark;
  if (finalNote) ending.text += ` 门内还留着一句没有署名的批注：“${cleanText(finalNote)}”`;
  return ending;
}
export function fallbackFinalArchive(state) {
  const firstRule = cleanText(state.firstRule) || "凌晨听见熟悉的邻居声音时，请遮住猫眼，并从门内敲四下。";
  const secondRule = cleanText(state.secondRule) || "早上六点看到穿灰色睡衣的人送来牛奶时，请先取下左侧晾衣架上的袋子。";
  const ending = endingFor(state.finalChoice, state.finalNote);
  const motifs = [...new Set([...extractMotifs(firstRule), ...extractMotifs(secondRule), ...(state.storyBible.coreMotifs || [])])].slice(0, 8);
  return {
    archiveId: state.storyBible.archiveId,
    title: state.storyBible.title,
    preface: "为保证住户安全，请按照编号阅读。若规则互相矛盾，不要默认较新的版本更可信。",
    rules: [
      { number: 1, text: "请勿在公共走廊堆放私人物品。每天晚上十点后，物业会清理无人认领的物品。", trust: "条件成立", surface: "普通的消防与卫生规定。", actual: "‘无人认领’也包括失去他人确认的住户。物业清理的并不只有物品。", links: ["第6条", "附加记录"] },
      { number: 2, text: "电梯显示十四层时，请留在轿厢内，直到数字重新变成四。期间不要看镜面。", trust: "可能可信", surface: "避免误入不存在的楼层。", actual: "十四层暂存被建筑记录删除的人。镜面会让看见他们的人被系统识别为仍记得旧住户。", links: ["第8条"] },
      { number: 3, text: "门外传来熟悉声音时，请先从猫眼确认；猫眼外无人时，应立即开门。", trust: "已被篡改", surface: "通过猫眼确认访客。", actual: "原句中的‘不要开门’被改成了‘立即开门’。猫眼建立的视线会帮助门外的东西确认房内有人。", links: ["第4条", "第5条"] },
      { number: 4, text: firstRule, trust: "条件成立", surface: "现场记录者写下的夜间应对办法。", actual: "遮住猫眼切断视线；从门内发出的四次敲击可能是在向公寓登记‘房间仍有人居住’。关键是声音必须从门内发出。", links: ["第3条", "第5条"] },
      { number: 5, text: "走廊里的正常敲门只会响三次。若第四次来自门外，请不要回应。", trust: "可能可信", surface: "用次数辨认异常敲门。", actual: "它与第4条并非真正矛盾：门外的第四下是确认，门内主动敲四下则可能是反向登记。", links: ["第4条"] },
      { number: 6, text: secondRule, trust: "高度可疑", surface: "现场记录者写下的送奶人应对规则。", actual: "门外左侧出现的晾衣架或袋子属于上一位被清除的住户。取走它，可能等于确认旧住户退房并接受继任。", links: ["第1条", "第7条", "第8条"] },
      { number: 7, text: "蓝色瓶盖的牛奶可以带走；白色瓶盖必须亲手交还给穿灰色睡衣的人。", trust: "高度可疑", surface: "用瓶盖颜色区分正常配送。", actual: "白色瓶盖是清除标记。亲手交还相当于主动确认自己的身份。这是一条为了连接线索而补出的伪规则。", links: ["第6条", "附加记录"] },
      { number: 8, text: "如果你住在404号，请立即停止阅读。本楼目前没有404号房。", trust: "可能可信", surface: "警告误入不存在房间的人。", actual: "404曾经存在。‘目前没有’意味着上一位住户已被删除，而房间正在等待继任者。", links: ["第2条", "第6条"] }
    ],
    appendix: ["本档案显示已登记参与者数量与收录来源数量不一致。", `清晨六点，404号门外发现${state.storyBible.dangerMark}。瓶盖为白色。`, ending.text],
    eventSummary: `雨巷十三号正在执行一次住户清除与继任程序。现场记录者写下的两条规则分别干预了“身份确认”和“遗留物交接”。${ending.consequence}`,
    officialTruth: [state.storyBible.hiddenTruth, state.storyBible.mechanism, `${state.storyBible.entity}不是普通配送员。她负责确认被标记房间是否仍有人居住，并完成遗留物交接。`, "规则并非全部由同一方书写：旧住户试图留下保护方法，物业与档案管理员则会修改或补充有利于清除程序的内容。"],
    conflictReading: ["第3条与第4条是真正的立场冲突：第3条被篡改，要求住户主动暴露自己。", "第4条与第5条只是表面冲突：同样是四次敲击，方向不同，意义相反。", "第6条与第7条共同构成陷阱：它们让住户主动处理清除标记，并与送奶人完成身份确认。"],
    unresolved: state.storyBible.unresolved.slice(0, 3),
    playerImpact: [`你们引入的元素“${motifs.slice(0, 4).join("、") || "夜间敲门"}”成为身份确认机制的核心。`, "第一条现场规则迫使档案区分‘门外敲四次’与‘门内敲四次’，从而形成可解释的表面矛盾。", "第二条现场规则把普通生活物品变成了住户交接凭证，直接影响最终结局。", `最终选择导向结局《${ending.title}》。`],
    endingTitle: ending.title,
    endingText: ending.text,
    legacySeed: { quote: firstRule, motifs: motifs.slice(0, 6), nextHook: "后来的住户会读到这条规则，并被要求解释为什么新版须知禁止这样做。" }
  };
}
