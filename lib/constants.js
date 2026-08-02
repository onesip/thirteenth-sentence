export const IDENTITY_POOL = ["404号住户","未登记访客","临时管理员","夜班保安","房东的第二把钥匙","没有搬走的前住户","走错楼层的人","07号住户","只在雨天值班的人","钥匙登记簿的保管者"];
export const TRUST_LEVELS = ["可能可信", "高度可疑", "已被篡改", "条件成立"];
export const DEFAULT_STORY_BIBLE = {
  archiveId: "YX-013", title: "《雨巷十三号住户须知》", identity: "404号住户",
  hiddenTruth: "雨巷十三号会把失去‘被他人确认’的住户从建筑记录中删除，再让下一位住户继承其房间号与遗留物。",
  entity: "穿灰色睡衣的送奶人", mechanism: "猫眼与敲门次数用于确认房间内是否仍有人；白色瓶盖与左侧晾衣架是清除程序的标记。",
  dangerMark: "白色瓶盖的牛奶", safeAction: "遮住猫眼，并从门内敲四下，以证明房间仍被占用；不能通过猫眼与门外建立视线。",
  falseAction: "从猫眼确认门外无人后立即开门，或亲手把白色瓶盖交给送奶人。",
  coreMotifs: ["猫眼", "四次敲门", "凌晨2:13", "白色瓶盖", "左侧晾衣架"],
  inheritedFragments: ["本楼没有十四层。", "上一版须知中没有第四条。", "不要替没有房间号的人保管牛奶。"],
  ruleLogic: [
    { role: "ordinary", truth: "conditional", purpose: "用普通物业规定隐藏‘无人认领的住户也会被清理’。" },
    { role: "space", truth: "likely", purpose: "建立十四层与被删除住户的暂存空间。" },
    { role: "tampered", truth: "tampered", purpose: "诱导住户通过猫眼和开门完成身份确认。" },
    { role: "player_anchor_one", truth: "conditional", purpose: "吸收玩家第一句话，并解释其在何种条件下有效。" },
    { role: "apparent_conflict", truth: "likely", purpose: "与玩家规则形成可解释的表面矛盾。" },
    { role: "player_anchor_two", truth: "suspicious", purpose: "吸收玩家第二句话，使普通物品成为交接凭证。" },
    { role: "false_rule", truth: "suspicious", purpose: "把玩家元素连接成一个看似完整、实际危险的伪规则。" },
    { role: "reversal", truth: "likely", purpose: "揭示404号曾存在，只是上一位住户已被删除。" }
  ],
  endings: { follow: "玩家执行自己写的规则，完成或部分完成住户继任。", reverse: "玩家逆向行动，打断清除但把异常留在建筑里。", mark: "玩家不接受交接，只证明房间仍有人，暂时中止清除。", open: "玩家主动开门，完成房间内外的身份确认。" },
  unresolved: ["从门内敲四下究竟是在保护住户，还是只会延迟清除？", "上一位404住户是否已经成为新的‘熟悉邻居声音’？", "档案管理员是在修复逻辑，还是帮助公寓完成清除？"]
};
export const FIRST_TASK = { title: "写下一条夜间规定", instruction: "请写一条关于夜间敲门声的规定。它表面上应该保护住户，但最好让人无法确定究竟该开门，还是绝对不能开门。", constraints: ["包含一个具体时间或次数", "不要直接写明门外是什么", "给住户一个明确动作"], hints: ["凌晨2:13", "猫眼", "邻居的声音", "四次敲门", "门内"], placeholder: "当你在……听见……时，请……" };
export const DEFAULT_CHOICES_ONE = [
  { id: "keep", label: "保留自己的规则", consequenceHint: "让矛盾继续存在" },
  { id: "trust-old", label: "暂时相信旧记录", consequenceHint: "你的规则会被标记为存疑" },
  { id: "split", label: "认为它们适用于不同情况", consequenceHint: "要求档案解释差异" },
  { id: "observe", label: "不处理，继续观察", consequenceHint: "不执行任何已知规则" }
];
export const DEFAULT_CHOICES_FINAL = [
  { id: "follow", label: "严格执行自己刚写的规则", consequenceHint: "相信自己的文字" },
  { id: "reverse", label: "做完全相反的事", consequenceHint: "把自己的规则视为诱导" },
  { id: "mark", label: "只留下一个记号，不碰任何东西", consequenceHint: "证明你仍在这里" },
  { id: "open", label: "直接打开门询问她", consequenceHint: "主动确认彼此身份" }
];
export const SECOND_TASK = { title: "写下关于她的规定", instruction: "请写一条教住户辨认或应对这名送奶人的规定。不要直接说明她是什么。", constraints: ["包含一个正常生活细节", "给出一个明确动作", "让动作的后果保持不确定"], hints: ["垃圾袋", "晾衣架", "瓶盖", "左手", "早上六点"], placeholder: "例如：如果她把……请先……" };
