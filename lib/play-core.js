export const PARTY_ROLES = {
  1: ["现场记录者"],
  2: ["规则保管者", "现场判断者"],
  3: ["规则保管者", "现场判断者", "异议见证人"],
  4: ["规则保管者", "现场判断者", "异议见证人", "最终裁决者"]
};

export function rolesForParty(size) {
  const count = Math.min(4, Math.max(1, Number(size) || 1));
  return PARTY_ROLES[count];
}

export function publicRules(archiveRecord) {
  return (archiveRecord?.final_archive?.rules || []).map((rule, index) => ({
    number: Number(rule.number || index + 1),
    text: String(rule.text || "未能恢复的规则。")
  }));
}

function ruleRef(rules, index) {
  const rule = rules[index % Math.max(1, rules.length)];
  return rule ? rule.number : index + 1;
}

function cleanStrings(value, max = 6) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, max)
    : [];
}

function cleanOptions(value, fallback) {
  const options = Array.isArray(value) ? value : [];
  const cleaned = options.map((option, index) => ({
    id: String(option?.id || `option-${index + 1}`).slice(0, 40),
    label: String(option?.label || `选择 ${index + 1}`).slice(0, 28),
    action: String(option?.action || option?.label || "继续观察").slice(0, 180),
    ruleRefs: Array.isArray(option?.ruleRefs) ? option.ruleRefs.map(Number).filter(Number.isFinite).slice(0, 3) : [],
    approach: ["遵守", "试探", "保护", "调查"].includes(option?.approach) ? option.approach : ["遵守", "试探", "保护", "调查"][index % 4]
  })).slice(0, 4);
  return cleaned.length >= 3 ? cleaned : fallback;
}

export function fallbackSeed(archiveRecord, partySize) {
  const rules = publicRules(archiveRecord);
  const roles = rolesForParty(partySize);
  const title = archiveRecord?.title || archiveRecord?.final_archive?.title || "未命名档案";
  const first = rules[0]?.text || "不要回应走廊尽头传来的第二次呼唤。";
  const second = rules[1]?.text || "看见自己的名字时，先检查日期。";
  return {
    privateBible: {
      actualIdentity: `你是这份《${title}》里被遗漏的当事人之一。`,
      identityConnection: "档案封存时，有一段属于你的记录被错误归到了别人名下。",
      secretNeed: "找回那段被改写的记忆，并确认自己是否仍是原来的那个人。",
      trueRuleNumbers: rules.slice(0, 2).map((r) => r.number),
      conditionalRules: rules[2] ? [{ number: rules[2].number, condition: "只有时间与记录一致时成立" }] : [],
      tamperedRuleNumbers: rules[3] ? [rules[3].number] : [],
      dangerAxis: "每次把错误记录当成自己的记忆，污染都会加深。",
      rescueAxis: "保存能够互相印证的证据，并保持对自己身份的怀疑。",
      endingAxes: ["带着真相离开", "成为档案的新保管人", "被错误身份替代", "让世界暴露在后来者面前"]
    },
    publicOpening: {
      dossierTitle: `进入记录：${title}`,
      publicIdentity: roles[0] === "现场记录者" ? "临时现场记录者" : roles[0],
      startingMemory: `你记得自己来这里是为了核对一份旧记录。可当你翻开第一页时，纸上已经写着你的签名。`,
      mission: "在五个场景内确认哪些规则能够保护你，并带回一份可被后来者验证的证据。",
      warning: "规则可以救你，也可能只是某个人希望你照做。",
      firstScene: {
        sceneNo: 1,
        title: "第一页比你先翻开",
        location: "档案入口",
        time: "闭馆后第十三分钟",
        turnRole: roles[0],
        narration: [
          `门在你身后合上时，桌上的文件已经摊开。第一行抄着：“${first}”`,
          `下一页却用另一种笔迹写着：“${second}” 两句话都标注为今晚。`,
          "走廊深处传来纸张被逐页翻动的声音，但这间房里没有风。"
        ],
        visibleClues: ["两条规则使用了不同日期格式", "你的签名比墨水上的灰尘更旧", "门把手内侧系着一根断线"],
        pressure: "翻页声正在接近，你必须决定先相信哪一种记录方式。",
        options: [
          { id: "obey-first", label: "照第一条做", action: `严格执行第${ruleRef(rules, 0)}条，并把门口的断线缠在手腕上。`, ruleRefs: [ruleRef(rules, 0)], approach: "遵守" },
          { id: "compare-dates", label: "先核对日期", action: `不执行任何动作，先比较第${ruleRef(rules, 0)}条与第${ruleRef(rules, 1)}条的日期和笔迹。`, ruleRefs: [ruleRef(rules, 0), ruleRef(rules, 1)], approach: "调查" },
          { id: "test-sound", label: "试探翻页声", action: "把一张空白纸推到走廊里，观察翻页声是否会停。", ruleRefs: [], approach: "试探" }
        ]
      }
    }
  };
}

export function normalizeSeed(data, archiveRecord, partySize) {
  const fallback = fallbackSeed(archiveRecord, partySize);
  const source = data && typeof data === "object" ? data : {};
  const privateBible = source.privateBible && typeof source.privateBible === "object" ? source.privateBible : {};
  const opening = source.publicOpening && typeof source.publicOpening === "object" ? source.publicOpening : {};
  const scene = opening.firstScene && typeof opening.firstScene === "object" ? opening.firstScene : {};
  return {
    privateBible: {
      ...fallback.privateBible,
      ...privateBible,
      trueRuleNumbers: Array.isArray(privateBible.trueRuleNumbers) ? privateBible.trueRuleNumbers.map(Number).filter(Number.isFinite) : fallback.privateBible.trueRuleNumbers,
      conditionalRules: Array.isArray(privateBible.conditionalRules) ? privateBible.conditionalRules.slice(0, 6) : fallback.privateBible.conditionalRules,
      tamperedRuleNumbers: Array.isArray(privateBible.tamperedRuleNumbers) ? privateBible.tamperedRuleNumbers.map(Number).filter(Number.isFinite) : fallback.privateBible.tamperedRuleNumbers,
      endingAxes: cleanStrings(privateBible.endingAxes, 6).length ? cleanStrings(privateBible.endingAxes, 6) : fallback.privateBible.endingAxes
    },
    publicOpening: {
      ...fallback.publicOpening,
      ...opening,
      startingMemory: String(opening.startingMemory || fallback.publicOpening.startingMemory).slice(0, 500),
      mission: String(opening.mission || fallback.publicOpening.mission).slice(0, 400),
      firstScene: {
        ...fallback.publicOpening.firstScene,
        ...scene,
        sceneNo: 1,
        narration: cleanStrings(scene.narration, 4).length ? cleanStrings(scene.narration, 4) : fallback.publicOpening.firstScene.narration,
        visibleClues: cleanStrings(scene.visibleClues, 5).length ? cleanStrings(scene.visibleClues, 5) : fallback.publicOpening.firstScene.visibleClues,
        options: cleanOptions(scene.options, fallback.publicOpening.firstScene.options)
      }
    }
  };
}

export function fallbackAdvance(state, selectedOption) {
  const nextNo = Number(state.sceneIndex || 0) + 2;
  const roles = state.roleOrder || rolesForParty(state.partySize);
  const rules = state.ruleHandbook || [];
  const oldChoice = state.choiceHistory?.[0]?.label || "你最初的判断";
  const locations = ["封闭走廊", "失效的值班室", "没有编号的中转层", "档案中心的背面"];
  const chosen = selectedOption?.action || selectedOption?.label || "继续观察";
  const options = [
    { id: `obey-${nextNo}`, label: "按规则处理", action: `执行第${ruleRef(rules, nextNo - 1)}条规则，并保留执行前后的证据。`, ruleRefs: [ruleRef(rules, nextNo - 1)], approach: "遵守" },
    { id: `test-${nextNo}`, label: "制造小规模试探", action: "只改变现场中的一个细节，观察异常究竟跟随人、物品还是记录。", ruleRefs: [], approach: "试探" },
    { id: `protect-${nextNo}`, label: "保护身份线索", action: "放弃眼前捷径，把能够证明自己身份的物件藏到不会被改写的位置。", ruleRefs: [], approach: "保护" },
    { id: `investigate-${nextNo}`, label: "追查矛盾来源", action: `对照第${ruleRef(rules, 0)}条和第${ruleRef(rules, Math.max(1, nextNo - 2))}条，寻找它们适用对象的区别。`, ruleRefs: [ruleRef(rules, 0), ruleRef(rules, Math.max(1, nextNo - 2))], approach: "调查" }
  ];
  return {
    privatePatch: {
      metricsDelta: metricsForApproach(selectedOption?.approach),
      addFlags: [`第${nextNo - 1}幕选择：${selectedOption?.id || "unknown"}`],
      consequenceNote: `${chosen}将在后续身份核验时再次出现。`,
      identityFragment: nextNo >= 3 ? "你想起自己曾经在这份档案上签过一次不同的名字。" : ""
    },
    public: {
      consequence: {
        title: "记录接受了你的动作",
        narration: [
          `你选择了：${chosen}`,
          `现场没有立刻证明你是否正确，但一处原本静止的细节发生了变化。`
        ],
        delayedOmen: `墙上的页码短暂变成了“${nextNo + 7}”，随后又恢复正常。`
      },
      nextScene: {
        sceneNo: nextNo,
        title: nextNo === 5 ? "最后一页没有结尾" : `第${nextNo}页：旧选择重新出现`,
        location: locations[(nextNo - 2) % locations.length],
        time: `进入后的第${nextNo * 7}分钟`,
        turnRole: roles[(nextNo - 1) % roles.length],
        narration: [
          `${oldChoice}留下的后果比你更早抵达这里。`,
          `你刚才的动作让一条规则变得更可信，却也让另一条规则开始针对你。`,
          nextNo >= 4 ? "玻璃里的人影佩戴着与你不同的身份牌。" : "有人在门后用你的声音念出一条没有写在纸上的规则。"
        ],
        visibleClues: ["旧选择留下的物件出现在新地点", "一条规则的适用对象被涂改", "你的身份牌缺少一角"],
        identityFragment: nextNo >= 3 ? "记忆片段：你不是第一次进入这里，只是第一次以现在的名字进入。" : "",
        pressure: nextNo === 5 ? "出口已经出现，但它只承认一个版本的你。" : "下一扇门只会为完成某条规则的人打开。",
        options
      }
    }
  };
}

export function metricsForApproach(approach) {
  return {
    遵守: { evidence: 3, contamination: 1, identity: 2, trust: 10 },
    试探: { evidence: 11, contamination: 10, identity: -5, trust: -3 },
    保护: { evidence: 4, contamination: -3, identity: 10, trust: 1 },
    调查: { evidence: 10, contamination: 4, identity: 1, trust: 3 }
  }[approach] || { evidence: 4, contamination: 3, identity: 0, trust: 0 };
}

function clampDelta(value) {
  const number = Number(value || 0);
  return Math.max(-25, Math.min(25, Number.isFinite(number) ? number : 0));
}

export function normalizePrivatePatch(value, selectedOption) {
  const patch = value && typeof value === "object" ? value : {};
  const fallback = metricsForApproach(selectedOption?.approach);
  const delta = patch.metricsDelta && typeof patch.metricsDelta === "object" ? patch.metricsDelta : fallback;
  return {
    metricsDelta: {
      evidence: clampDelta(delta.evidence ?? fallback.evidence),
      contamination: clampDelta(delta.contamination ?? fallback.contamination),
      identity: clampDelta(delta.identity ?? fallback.identity),
      trust: clampDelta(delta.trust ?? fallback.trust)
    },
    addFlags: cleanStrings(patch.addFlags, 5),
    consequenceNote: String(patch.consequenceNote || "").slice(0, 400),
    identityFragment: String(patch.identityFragment || "").slice(0, 300)
  };
}

export function normalizeAdvance(data, state, selectedOption) {
  const fallback = fallbackAdvance(state, selectedOption);
  const source = data && typeof data === "object" ? data : {};
  const publicPart = source.public && typeof source.public === "object" ? source.public : {};
  const consequence = publicPart.consequence && typeof publicPart.consequence === "object" ? publicPart.consequence : {};
  const scene = publicPart.nextScene && typeof publicPart.nextScene === "object" ? publicPart.nextScene : {};
  return {
    privatePatch: normalizePrivatePatch(source.privatePatch, selectedOption),
    public: {
      consequence: {
        ...fallback.public.consequence,
        ...consequence,
        narration: cleanStrings(consequence.narration, 4).length ? cleanStrings(consequence.narration, 4) : fallback.public.consequence.narration
      },
      nextScene: {
        ...fallback.public.nextScene,
        ...scene,
        sceneNo: Number(state.sceneIndex || 0) + 2,
        narration: cleanStrings(scene.narration, 4).length ? cleanStrings(scene.narration, 4) : fallback.public.nextScene.narration,
        visibleClues: cleanStrings(scene.visibleClues, 5).length ? cleanStrings(scene.visibleClues, 5) : fallback.public.nextScene.visibleClues,
        options: cleanOptions(scene.options, fallback.public.nextScene.options)
      }
    }
  };
}

export function applyMetrics(metrics, delta) {
  const current = metrics || { evidence: 10, contamination: 5, identity: 75, trust: 50 };
  const output = {};
  for (const key of ["evidence", "contamination", "identity", "trust"]) {
    output[key] = Math.max(0, Math.min(100, Number(current[key] || 0) + Number(delta?.[key] || 0)));
  }
  return output;
}

export function fallbackEnding(state, selectedOption) {
  const metrics = applyMetrics(state.metrics, metricsForApproach(selectedOption?.approach));
  const survived = metrics.identity + metrics.evidence > metrics.contamination + 55;
  const title = survived ? "你带回了一个仍然属于自己的名字" : "档案接受了一个更方便的你";
  const rules = state.sourceArchiveRecord?.final_archive?.rules || [];
  const history = [...(state.choiceHistory || []), {
    sceneNo: Number(state.sceneIndex || 0) + 1,
    label: selectedOption?.label || "最终选择",
    action: selectedOption?.action || "",
    approach: selectedOption?.approach || ""
  }];
  return {
    privatePatch: {
      metricsDelta: metricsForApproach(selectedOption?.approach),
      addFlags: [survived ? "保留原身份" : "身份被档案接管"]
    },
    ending: {
      endingTitle: title,
      endingTier: survived ? "幸存" : "替代",
      openingLine: survived ? "出口记住了你的脚步，而不是档案替你写下的脚步。" : "你走出了门，但门外的人叫出了另一个名字。",
      story: [
        "你回头看见五个场景像五张叠在一起的纸，每一次判断都在下一张纸上留下了压痕。",
        `你收集到的证据让${survived ? "部分真实记录重新浮现" : "错误记录显得更加完整"}。`,
        `污染没有立刻伤害你，它只是慢慢替换了你对“自己为何来到这里”的解释。`,
        survived ? "最后，你用两个能够互相印证的细节证明了自己的身份。" : "最后，你选择了一个能够离开的身份，却没有证明那是不是你。",
        `这份档案没有结束。它只新增了一行关于你的现场记录。`
      ],
      oneLineTruth: state.sourceArchiveRecord?.final_archive?.officialTruth?.[0] || state.privateBible?.identityConnection || "这套规则真正筛选的不是听话的人，而是仍能证明自己是谁的人。",
      identityReveal: {
        believed: state.publicOpening?.publicIdentity || "临时进入者",
        actual: state.privateBible?.actualIdentity || "被档案遗漏的当事人",
        evidence: ["开场已经存在的签名", "不同规则使用的日期格式", "后续场景反复出现的身份缺口"],
        meaning: state.privateBible?.identityConnection || "你的身份本身就是这份档案缺失的因果环节。"
      },
      choiceTimeline: history.map((choice, index) => ({
        sceneNo: choice.sceneNo || index + 1,
        choice: choice.action || choice.label,
        immediate: index === 0 ? "现场接受了这个动作，但没有给出对错提示。" : "旧选择改变了下一幕可以看到的线索。",
        delayed: index < history.length - 1 ? "它在后续身份核验中改变了规则的适用对象。" : "它决定出口承认哪一个版本的你。",
        verdict: choice.approach === "调查" ? "增加了可验证证据" : choice.approach === "保护" ? "保住了身份稳定" : choice.approach === "试探" ? "换来证据，也加深了污染" : "提高了规则信任，但可能服从了错误条件"
      })),
      ruleReadings: rules.slice(0, 8).map((rule, index) => ({
        number: Number(rule.number || index + 1),
        text: String(rule.text || ""),
        verdict: rule.trust || (index === 3 ? "被篡改" : index === 2 ? "条件成立" : "真实"),
        condition: rule.actual || rule.surface || "它只在记录、时间与身份一致时成立。",
        playerUse: history.some((choice) => choice.ruleRefs?.includes?.(Number(rule.number))) ? "你曾直接依据这条规则行动。" : "你没有直接验证这条规则。",
        consequence: rule.actual || "它改变了异常判断你身份的方式。"
      })),
      causalChain: ["接受进入身份 → 规则开始针对该身份", "前期选择留下标记 → 标记改变后续场景", "证据与污染累积 → 出口选择承认哪一个你"],
      missedClues: ["第一幕两种日期格式并不属于同一套记录", "身份牌缺角的位置与档案缺页位置相同", "翻页声只在你相信某条记录时接近"],
      turningPoint: {
        sceneNo: Math.min(3, history.length),
        choice: history[Math.min(2, history.length - 1)]?.label || "中段选择",
        alternate: survived ? "若当时只追求快速离开，出口可能会接受错误身份。" : "若当时优先保存身份证据，你仍可能带着原来的名字离开。"
      },
      worldConsequence: survived ? "后来者会在档案边缘看到一组可以互相验证的日期。" : "后来者会先读到你留下的错误名字，并把它当成新的进入身份。",
      fieldNote: survived ? "不要只问哪条规则是真的，先确认它在保护谁。" : "出口可以打开，但打开它的人未必还是进入时的人。",
      nextHook: "后来者可以从身份牌缺失的一角继续调查规则究竟在筛选什么。"
    }
  };
}

export function normalizeEnding(data, state, selectedOption) {
  const fallback = fallbackEnding(state, selectedOption);
  const source = data && typeof data === "object" ? data : {};
  const ending = source.ending && typeof source.ending === "object" ? source.ending : {};
  const identityReveal = ending.identityReveal && typeof ending.identityReveal === "object" ? ending.identityReveal : {};
  const turningPoint = ending.turningPoint && typeof ending.turningPoint === "object" ? ending.turningPoint : {};
  const timeline = Array.isArray(ending.choiceTimeline) ? ending.choiceTimeline.slice(0, 8) : fallback.ending.choiceTimeline;
  const readings = Array.isArray(ending.ruleReadings) ? ending.ruleReadings.slice(0, 12) : fallback.ending.ruleReadings;
  return {
    privatePatch: normalizePrivatePatch(source.privatePatch, selectedOption),
    ending: {
      ...fallback.ending,
      ...ending,
      story: cleanStrings(ending.story, 7).length >= 3 ? cleanStrings(ending.story, 7) : fallback.ending.story,
      identityReveal: {
        ...fallback.ending.identityReveal,
        ...identityReveal,
        evidence: cleanStrings(identityReveal.evidence, 5).length ? cleanStrings(identityReveal.evidence, 5) : fallback.ending.identityReveal.evidence
      },
      choiceTimeline: timeline,
      ruleReadings: readings,
      causalChain: cleanStrings(ending.causalChain, 8).length ? cleanStrings(ending.causalChain, 8) : fallback.ending.causalChain,
      missedClues: cleanStrings(ending.missedClues, 5),
      turningPoint: { ...fallback.ending.turningPoint, ...turningPoint },
      fieldNote: String(ending.fieldNote || fallback.ending.fieldNote).slice(0, 500),
      nextHook: String(ending.nextHook || fallback.ending.nextHook).slice(0, 500)
    }
  };
}
