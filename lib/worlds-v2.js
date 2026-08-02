const PROFILE_LIST = [
  {
    key: "rain-alley",
    code: "YX",
    name: "雨巷十三号",
    shortName: "雨巷",
    genre: "住户规则 / 身份继任",
    sceneNumber: "404",
    premise: "一栋会删除失去他人确认的住户、再让后来者继承房号与遗留物的旧公寓。",
    entryHook: "你的入住登记写着404，但走廊门牌从403直接跳到405。",
    entity: "穿灰色睡衣的送奶人",
    mechanism: "猫眼、敲门方向与遗留物共同决定一名住户是否仍被建筑承认。",
    dangerMark: "白色瓶盖的牛奶",
    safeAction: "切断门内外的视线，并留下只有房内住户才能制造的占用证明。",
    falseAction: "替门外的人完成身份确认，或主动接收上一位住户的遗留物。",
    identities: ["404号住户", "夜班保安", "房东的第二把钥匙", "没有搬走的前住户", "走错楼层的人", "临时管理员"],
    motifs: ["猫眼", "四次敲门", "凌晨2:13", "白色瓶盖", "左侧晾衣架", "不存在的十四层", "褪色门牌"],
    inheritedFragments: ["本楼没有十四层。", "上一版须知中没有第四条。", "不要替没有房间号的人保管牛奶。"],
    firstTask: {
      title: "写下一条夜间规定",
      instruction: "请写一条关于敲门、猫眼或门牌的规定。它必须给住户一个明确动作，但让人无法立即判断这个动作是在保护谁。",
      constraints: ["包含具体时间或次数", "不能直接说门外是什么", "动作必须能被现场执行"],
      hints: ["凌晨2:13", "门内第四下", "猫眼", "熟悉的声音", "门牌"],
      placeholder: "当你在……听见……时，请……"
    },
    secondTask: {
      title: "写下关于遗留物的规定",
      instruction: "请写一条处理门外生活物品的规定。物品必须很普通，但处理它可能意味着接受某种身份。",
      constraints: ["包含普通生活物件", "给出明确动作", "不要解释真实后果"],
      hints: ["垃圾袋", "晾衣架", "瓶盖", "左手", "钥匙"],
      placeholder: "如果门外出现……请先……"
    },
    ordinaryRule: "请勿在公共走廊堆放私人物品。晚上十点后，物业会清理无人认领的物品。",
    spaceRule: "电梯显示十四层时，请留在轿厢内，直到数字重新变成四。期间不要看镜面。",
    tamperedRule: "门外传来熟悉声音时，请先从猫眼确认；猫眼外无人时，应立即开门。",
    conflictRule: "正常敲门只会响三次。若第四次来自门外，请不要回应。",
    falseRule: "蓝色瓶盖可以带走；白色瓶盖必须亲手交还给送奶人。",
    reversalRule: "如果你住在404号，请停止阅读。本楼目前没有404号房。",
    finalScene: "门牌正在褪色，门外的遗留物却比刚才更靠近房内。"
  },
  {
    key: "last-train",
    code: "MT",
    name: "零点末班线",
    shortName: "末班线",
    genre: "地铁规则 / 目的地遗忘",
    sceneNumber: "00:17",
    premise: "一列在停运后继续行驶的地铁，会把忘记目的地的乘客留在不存在的站台。",
    entryHook: "电子屏显示终点已经到站，但车门外仍是你刚刚上车的那一站。",
    entity: "不抬头检票的末班乘务员",
    mechanism: "车票、广播中的姓名与乘客记忆共同决定谁还拥有下车的目的地。",
    dangerMark: "没有终点站名的空白车票",
    safeAction: "在广播叫出姓名前写下自己的目的地，并让另一个人读出它。",
    falseAction: "跟随没有影子的乘客换到更空的车厢，或把空白票交给乘务员补写。",
    identities: ["最后一节车厢的乘客", "没有下车记录的人", "夜班站务员", "拿错车票的人", "只记得线路颜色的人", "检修通道里的目击者"],
    motifs: ["空白车票", "反向站名", "00:17", "没有影子的乘客", "末班广播", "封闭车厢", "重复站台"],
    inheritedFragments: ["不要在广播第二次叫到你时回答。", "终点站不在本线路图上。", "最后一节车厢没有紧急通话按钮。"],
    firstTask: {
      title: "补写一条乘车规定",
      instruction: "请写一条关于广播、站名或车票的规定。它要能让乘客继续前进，也可能让他错过真正的下车时机。",
      constraints: ["包含一个站次或时间", "给出能立即执行的动作", "不能直接写‘不要上车’"],
      hints: ["第二次广播", "空白车票", "终点站", "倒着念", "最后一节车厢"],
      placeholder: "当广播第……次说出……时，请……"
    },
    secondTask: {
      title: "写下识别同车人的办法",
      instruction: "请写一条辨认某位乘客或乘务员的规定。判断依据必须是日常细节，而不是外貌恐怖。",
      constraints: ["包含衣物或随身物品", "必须给出动作", "后果保持不确定"],
      hints: ["雨伞", "鞋底", "月票", "影子", "扶手"],
      placeholder: "如果他手里拿着……请先……"
    },
    ordinaryRule: "末班车到站后，请确认随身物品并从最近车门离开。",
    spaceRule: "若线路图出现灰色站点，请背对车门，直到列车通过该站。",
    tamperedRule: "广播叫出你的姓名时，请立即按下开门按钮，以证明你仍在车上。",
    conflictRule: "同一站名连续播报两次时，第一次可以相信，第二次不要回应。",
    falseRule: "空白车票可交给乘务员补写；补写后请在下一站下车。",
    reversalRule: "若终点站名与你记忆不同，请以车票为准，不要相信自己。",
    finalScene: "列车没有减速，但下一站的站牌已经贴在车窗内侧。"
  },
  {
    key: "night-school",
    code: "NS",
    name: "封校后的第七节课",
    shortName: "夜校",
    genre: "校园规则 / 缺席替补",
    sceneNumber: "7-B",
    premise: "一所封校后的中学会继续点名，并用仍留在教室里的人补齐白天缺席的学生。",
    entryHook: "放学铃已经响过两小时，黑板上却刚写下‘第七节课开始’。",
    entity: "只在点名时出现的代课老师",
    mechanism: "座位、姓名与作业本上的笔迹决定谁会成为缺席者的替补。",
    dangerMark: "写着陌生姓名、却是你笔迹的作业本",
    safeAction: "保留自己的空座证明，并让点名册出现无法被替换的矛盾。",
    falseAction: "替缺席者答到、完成他的作业，或坐进贴有新姓名的座位。",
    identities: ["留校值日生", "没有班级的转学生", "夜间门卫", "广播室值班员", "坐错位置的人", "被擦掉名字的班干部"],
    motifs: ["第七节课", "点名册", "粉笔灰", "空座位", "陌生作业本", "广播室", "反锁校门"],
    inheritedFragments: ["值日表上不能同时出现两个相同姓名。", "不要替没来的人收作业。", "晚上九点后的铃声不是下课铃。"],
    firstTask: {
      title: "补写一条点名规定",
      instruction: "请写一条关于点名、座位或铃声的规定。它必须能保护某个学生，却可能让另一个人的名字消失。",
      constraints: ["包含具体节次或次数", "必须提到一个教室动作", "不能直接写出老师是什么"],
      hints: ["第七节课", "答到", "空座", "粉笔", "广播"],
      placeholder: "当老师第……次点到……时，请……"
    },
    secondTask: {
      title: "写下处理作业本的规定",
      instruction: "请写一条关于作业本、值日表或校服的规定，让一件普通校园物品变成身份凭证。",
      constraints: ["包含校园物品", "给出明确动作", "不能解释动作后果"],
      hints: ["红笔", "姓名贴", "值日表", "校服口袋", "课桌抽屉"],
      placeholder: "如果你发现……请把它……"
    },
    ordinaryRule: "离校前请完成值日，并把教室钥匙交回门卫室。",
    spaceRule: "走廊灯只亮到六班。看见七班门牌时，请原路返回。",
    tamperedRule: "点名时若听见自己的姓名，请立刻答到，以免被记为缺席。",
    conflictRule: "同一个姓名第二次出现时，第一次答到的人必须保持沉默。",
    falseRule: "发现无主作业本时，请替封面姓名补完当日作业。",
    reversalRule: "黑板写着‘全员到齐’时，请确认教室里确实没有空座。",
    finalScene: "最后一张空座被人从桌下推了出来，椅背贴着你的姓名。"
  },
  {
    key: "tide-hotel",
    code: "TH",
    name: "退潮旅馆",
    shortName: "潮汐旅馆",
    genre: "旅馆规则 / 房间交换",
    sceneNumber: "B-06",
    premise: "一间建在旧防波堤上的旅馆会随潮位交换房间，并把住客的记忆留在退潮后出现的走廊里。",
    entryHook: "前台给你的钥匙写着306，但电梯按钮只有B1到B6。",
    entity: "鞋底永远是干的夜班前台",
    mechanism: "钥匙、潮线与房内物品的位置决定住客属于海上房间还是岸上房间。",
    dangerMark: "从门缝向内延伸的湿脚印",
    safeAction: "在潮位改变前固定房间内三件物品的位置，并拒绝使用第二把钥匙。",
    falseAction: "按照前台指示更换到更干燥的房间，或替上一位住客归还钥匙。",
    identities: ["306号住客", "夜班前台的替班人", "没有退房记录的旅客", "只住一晚的导游", "捡到第二把钥匙的人", "清晨清洁员"],
    motifs: ["第二把钥匙", "湿脚印", "退潮走廊", "空房铃", "倒放的房号", "盐粒", "凌晨三点的敲墙声"],
    inheritedFragments: ["房间越干燥，越不要更换。", "第二把钥匙不是备用钥匙。", "退潮时不要打开衣柜。"],
    firstTask: {
      title: "写下一条客房规定",
      instruction: "请写一条关于房号、钥匙或潮水的规定。它要让住客留在自己的房间，也可能把他固定在错误的房间里。",
      constraints: ["包含时间或潮位", "给出具体动作", "不要直接提到海里有什么"],
      hints: ["凌晨三点", "第二把钥匙", "房号倒写", "门缝", "退潮"],
      placeholder: "当房间在……出现……时，请……"
    },
    secondTask: {
      title: "写下处理湿物品的规定",
      instruction: "请写一条关于毛巾、鞋、行李或盐水痕迹的规定。普通物品必须成为房间归属的证据。",
      constraints: ["包含旅馆物品", "动作必须明确", "不能直接说明谁住过这里"],
      hints: ["浴巾", "鞋底", "行李牌", "盐粒", "枕头"],
      placeholder: "如果你发现……是湿的，请……"
    },
    ordinaryRule: "离店时请将房卡与客房钥匙一并交回前台。",
    spaceRule: "电梯出现B6以下楼层时，请不要按开门键。",
    tamperedRule: "房间进水时，请携带第二把钥匙前往更高楼层。",
    conflictRule: "听见隔壁连续敲墙三次时，请检查自己的房号是否仍在门外。",
    falseRule: "湿脚印指向哪间房，哪间房就是你的临时安全房。",
    reversalRule: "退潮后若走廊变长，请以更远的前台为准。",
    finalScene: "潮水没有进入房间，湿脚印却已经走到了你的床边。"
  },
  {
    key: "ward-c",
    code: "WC",
    name: "C区夜间病历",
    shortName: "夜间病区",
    genre: "医院规则 / 出院抹除",
    sceneNumber: "C-17",
    premise: "一座旧医院会在夜班结束前整理病历，把没有被任何人探视的病人标记为已经出院。",
    entryHook: "腕带上的床号是C-17，但护士站说C区今晚没有住院病人。",
    entity: "胸牌没有姓名的巡房护士",
    mechanism: "腕带、探视记录与监护仪声音决定病人是否仍属于病区。",
    dangerMark: "提前打印、没有姓名的出院单",
    safeAction: "让病历中留下一个只有清醒病人才能完成的连续记录，并拒绝签收空白出院单。",
    falseAction: "按铃请求无名护士确认身份，或替隔壁床签收药物与文件。",
    identities: ["C-17床病人", "临时陪护", "夜班实习护士", "没有预约的探视者", "病历室校对员", "醒得太早的人"],
    motifs: ["空白出院单", "腕带", "三声监护仪", "无名胸牌", "封闭护士站", "药杯", "凌晨巡房"],
    inheritedFragments: ["夜里不要替隔壁床按铃。", "腕带字迹变浅时不要摘下。", "探视记录空白不代表无人来过。"],
    firstTask: {
      title: "补写一条夜间巡房规定",
      instruction: "请写一条关于按铃、监护仪或护士巡房的规定。它必须让病人做出一个能证明自己清醒的动作。",
      constraints: ["包含次数或时间", "动作必须可执行", "不能直接写护士不是人"],
      hints: ["凌晨1:40", "三声蜂鸣", "按铃", "胸牌", "腕带"],
      placeholder: "当监护仪第……次……时，请……"
    },
    secondTask: {
      title: "写下处理病历物品的规定",
      instruction: "请写一条关于药杯、出院单或探视记录的规定，让它成为病人是否仍被承认的证据。",
      constraints: ["包含医院日常物件", "给出明确动作", "不要直接说明签字后会发生什么"],
      hints: ["药杯", "出院单", "签字笔", "探视贴纸", "床头卡"],
      placeholder: "如果有人送来……请先……"
    },
    ordinaryRule: "夜间请保持床头通道畅通，非紧急情况不要频繁按铃。",
    spaceRule: "电梯显示C0时，请留在轿厢内并背对镜面。",
    tamperedRule: "腕带字迹变浅时，请立即请巡房护士重新打印。",
    conflictRule: "监护仪连续三次出现同一报警时，第三次不要按铃。",
    falseRule: "无姓名出院单只需补签床号即可生效。",
    reversalRule: "护士站说本区无病人时，请相信系统记录，不要报出自己的姓名。",
    finalScene: "监护仪仍在跳动，床头卡上的名字却已经被换成‘待清洁’。"
  },
  {
    key: "radio-zero",
    code: "R0",
    name: "零号频率直播间",
    shortName: "零号电台",
    genre: "电台规则 / 声音继承",
    sceneNumber: "FM 0.0",
    premise: "一间停播多年的夜间电台会收集没有被挂断的声音，并让下一位接线员继承上一位主持人的声线。",
    entryHook: "直播灯没有亮，耳机里却传来一个用你声音说话的主持人。",
    entity: "从不出现在值班表上的午夜听众",
    mechanism: "来电、延迟回声与播出灯决定一段声音属于听众、主持人还是电台本身。",
    dangerMark: "显示自己号码、却来自演播室内部的来电",
    safeAction: "让声音在进入直播前经过可验证的延迟，并由另一名记录者确认原句。",
    falseAction: "直接回应用自己声音说话的来电，或在红灯熄灭后继续念稿。",
    identities: ["临时夜班接线员", "最后一位节目听众", "没有排班的主持人", "录音带保管员", "技术间值班员", "声音校对者"],
    motifs: ["红色直播灯", "七秒延迟", "自己的来电", "倒放片头", "旧录音带", "静音键", "无人值班表"],
    inheritedFragments: ["红灯熄灭后不要念出任何姓名。", "七秒后的回声不一定来自你。", "零号频率没有公开收听入口。"],
    firstTask: {
      title: "写下一条接线规定",
      instruction: "请写一条关于来电、静音键或直播延迟的规定。它要阻止某段声音进入节目，也可能让真正的求救被切断。",
      constraints: ["包含秒数或来电次数", "动作必须可执行", "不能直接说明来电者是谁"],
      hints: ["七秒延迟", "第三通电话", "静音键", "自己的号码", "红灯"],
      placeholder: "当第……通电话在……秒后……时，请……"
    },
    secondTask: {
      title: "写下处理录音的规定",
      instruction: "请写一条关于录音带、节目单或耳机的规定，让声音是否属于本人变得可以被判断。",
      constraints: ["包含广播物件", "给出明确动作", "让判断仍保留风险"],
      hints: ["旧磁带", "耳机左声道", "节目单", "倒放片头", "签名"],
      placeholder: "如果录音里出现……请把……"
    },
    ordinaryRule: "节目结束后，请关闭直播灯并归档当晚全部来电记录。",
    spaceRule: "技术间门牌显示0号时，请不要进入，直到耳机恢复双声道。",
    tamperedRule: "听见自己的声音来电时，请立即接通，以确认线路没有串音。",
    conflictRule: "同一句话在七秒后重复时，只记录第一次，不要回应第二次。",
    falseRule: "无署名录音带可直接作为下一期节目片头使用。",
    reversalRule: "红灯熄灭后若仍有听众在线，请继续播出直到对方挂断。",
    finalScene: "直播灯仍是黑的，但收听人数从一变成了你的电话号码。"
  }
];

export const WORLD_PROFILES = Object.freeze(PROFILE_LIST.map((profile) => Object.freeze(profile)));

export function getWorldProfile(key) {
  return WORLD_PROFILES.find((profile) => profile.key === key) || WORLD_PROFILES[0];
}

export function chooseWorldProfile({ recentWorldKeys = [], preferredWorldKey = "", sourceWorldKey = "" } = {}) {
  if (sourceWorldKey) return getWorldProfile(sourceWorldKey);
  if (preferredWorldKey && preferredWorldKey !== "random") return getWorldProfile(preferredWorldKey);
  const recent = new Set((Array.isArray(recentWorldKeys) ? recentWorldKeys : []).slice(0, 4));
  let pool = WORLD_PROFILES.filter((profile) => !recent.has(profile.key));
  if (!pool.length) pool = WORLD_PROFILES;
  return pool[Math.floor(Math.random() * pool.length)] || WORLD_PROFILES[0];
}

export function partyRolesFor(count, identities = []) {
  const identity = (index) => identities[index] || `第${index + 1}位记录者`;
  if (count <= 1) {
    return [{ index: 0, identity: identity(0), title: "独行记录者", duty: "写下两条关键记录并作出最终决定；档案会自动补齐其他声音。" }];
  }
  if (count === 2) {
    return [
      { index: 0, identity: identity(0), title: "现场见证者", duty: "先写下你亲眼确认的规则，并在最后决定是否相信自己的文字。" },
      { index: 1, identity: identity(1), title: "矛盾校对员", duty: "处理旧记录冲突，并写下第二条能改变机制的规则。" }
    ];
  }
  if (count === 3) {
    return [
      { index: 0, identity: identity(0), title: "现场见证者", duty: "留下第一条规则，为本局确定最初的危险条件。" },
      { index: 1, identity: identity(1), title: "档案校对员", duty: "判断旧记录是否可信，并写下第二条规则。" },
      { index: 2, identity: identity(2), title: "最终批注者", duty: "留下最后一句批注并决定大家愿意相信哪一种解释。" }
    ];
  }
  return [
    { index: 0, identity: identity(0), title: "现场见证者", duty: "写下第一条现场规则。" },
    { index: 1, identity: identity(1), title: "旧档案审查员", duty: "选择如何处理互相冲突的旧记录。" },
    { index: 2, identity: identity(2), title: "异常解释者", duty: "写下第二条规则，并留下门内的最后批注。" },
    { index: 3, identity: identity(3), title: "封存裁决者", duty: "听完前三人的记录后，独立作出最终行动。" }
  ];
}

export function publicWorldProfile(profile) {
  return {
    key: profile.key,
    code: profile.code,
    name: profile.name,
    shortName: profile.shortName,
    genre: profile.genre,
    sceneNumber: profile.sceneNumber,
    premise: profile.premise,
    entryHook: profile.entryHook
  };
}
