/* ============================================================
 * 题库：门槛 6 题 + 计分 21 题 + 彩蛋 3 题 + 条件触发 1 题
 * dim: 计分维度键（qin/lv/kong/she/xu/yang/ren）
 * ============================================================ */

const QUESTIONS = [
  /* ---------------- 第一部分 · 门槛筛查（不计分） ---------------- */
  {
    id: 'A1',
    part: 'gate',
    text: '你现在住的地方，是你能做主的地方吗？',
    options: [
      { label: '自己整租 / 有房，一居室以上，怎么布置我说了算', code: 'own' },
      { label: '合租，室友和房东都还算好说话', code: 'share' },
      { label: '和父母 / 长辈同住，他们的态度是"别养，又脏又吵"', code: 'parents' },
      { label: '单间 / 宿舍，不到 15㎡，转身都要跟室友打报告', code: 'tiny' }
    ]
  },
  {
    id: 'A2',
    part: 'gate',
    text: '工作日，你有多少时间不在家？',
    options: [
      { label: '8 小时以内（弹性办公 / 中午能回）', code: 'le8' },
      { label: '8–10 小时，标准的打工人作息', code: 'b8_10' },
      { label: '10–12 小时，早高峰出门，晚高峰回家', code: 'b10_12' },
      { label: '12 小时以上。我家要是养了，它可能以为我出差了', code: 'gt12' }
    ]
  },
  {
    id: 'A3',
    part: 'gate',
    text: '你对动物毛发 / 皮屑过敏吗？',
    options: [
      { label: '不过敏，撸一整天都可以', code: 'none' },
      { label: '轻微，忍一忍就过去了', code: 'mild' },
      { label: '一靠近就打喷嚏、眼睛痒，这是生理层面的拒绝', code: 'allergy' },
      { label: '我没测过，但家里确实有人过敏', code: 'family' }
    ]
  },
  {
    id: 'A4',
    part: 'gate',
    text: '每个月你愿意为它花多少钱？（口粮、用品、医疗摊销全算上）',
    options: [
      { label: '200 元以内，能省则省', code: 'le200' },
      { label: '200–500 元，正常水平', code: 'b200_500' },
      { label: '500–1000 元，愿意为它花钱', code: 'b500_1000' },
      { label: '1000 元以上，该花就花，它值得', code: 'gt1000' }
    ]
  },
  {
    id: 'A5',
    part: 'gate',
    text: '出差、回老家过年、长假的时候，TA 怎么办？',
    options: [
      { label: '有信得过的家人朋友愿意帮忙', code: 'help' },
      { label: '花钱送寄养 / 请人上门', code: 'boarding' },
      { label: '只能一起带走', code: 'together' },
      { label: '说实话，没想过这个问题', code: 'none' }
    ]
  },
  {
    id: 'A6',
    part: 'gate',
    text: '你打算从哪里把它带回家？',
    options: [
      { label: '正规猫舍 / 犬舍 / 持证繁育者，能提供来源与检疫证明', code: 'breeder' },
      { label: '朋友家生的，或从救助机构领养', code: 'friend' },
      { label: '网上找的便宜货，或花鸟市场的"野生货"', code: 'cheap' },
      { label: '我在外面看到一只（楼下的刺猬、公园的鸟、河边的龟），想带回家养', code: 'wild' }
    ]
  },

  /* ---------------- 第二部分 · 生活情境题（计分） ---------------- */

  /* D1 亲密浓度 */
  {
    id: 'Q1', part: 'score', dim: 'qin',
    text: '加班到晚上十点，你站在自家门前掏钥匙，此刻你心里最期待的画面是？',
    options: [
      { label: '门刚开一条缝，一团毛球就撞上来，尾巴摇得像要起飞', score: 4 },
      { label: '它从沙发靠枕上抬眼看你一眼，翻个身继续睡，仿佛你只是来送外卖的', score: 1 },
      { label: '它蹲在门口轻轻叫一声，等你走过去抱它，像一个等待签收的快递', score: 3 },
      { label: '屋里安安静静，安静到你怀疑自己是不是走错了门', score: 1 }
    ]
  },
  {
    id: 'Q2', part: 'score', dim: 'qin',
    text: '周末你瘫在沙发上追剧，它第 8 次用脑袋拱你的手要摸摸，你会？',
    options: [
      { label: '剧明天再看吧，先摸它，摸到手抽筋也行', score: 4 },
      { label: '摸三下，然后悄悄把抱枕堆在两人中间，垒成一堵墙', score: 2 },
      { label: '起身去另一个房间把门关上，我需要一点物理距离', score: 1 },
      { label: '一边摸一边举手机，这个角度能拍到它的毛茸茸下巴', score: 3 }
    ]
  },
  {
    id: 'Q3', part: 'score', dim: 'qin',
    text: '你发现它跟你对象（或室友）更亲，见到你只是打了个哈欠，你会？',
    options: [
      { label: '心里发酸，开始偷偷加餐投喂，暗中和对方"抢人"', score: 4 },
      { label: '有点小失落，但都是成年人了，忍一忍', score: 2 },
      { label: '很好，谁对它好它就亲谁，逻辑完全闭环', score: 1 },
      { label: '太好了，终于有人分担，我可以安心去洗澡了', score: 1 }
    ]
  },

  /* D2 节律弹性 */
  {
    id: 'Q4', part: 'score', dim: 'lv',
    text: '说句实话，你现在的作息是？',
    options: [
      { label: '十一点睡六点起，生物钟比闹钟还准', score: 1 },
      { label: '基本规律，周末追个剧到一两点，属于可控范围内', score: 2 },
      { label: '凌晨一点是我的黄金时段，上午属于时差区', score: 3 },
      { label: '我的作息取决于项目进度、外卖和最后一局游戏', score: 4 }
    ]
  },
  {
    id: 'Q5', part: 'score', dim: 'lv',
    text: '你理想中的周末早晨是？',
    options: [
      { label: '六点半，一双"该遛我了"的眼睛直勾勾盯着你，出门，回家吃早饭', score: 1 },
      { label: '睡到自然醒，先躺床上刷半小时手机，谁也不许打扰', score: 3 },
      { label: '被毛爪子踩脸踩醒，翻个身继续睡，它自己玩自己的', score: 4 },
      { label: '自然醒，安安静静，家里不能有任何响动', score: 2 }
    ]
  },
  {
    id: 'Q6', part: 'score', dim: 'lv',
    text: '以下哪件事最容易让你当场破防？',
    options: [
      { label: '凌晨三点，它开始在家办马拉松，撞翻垃圾桶还不忘回头看你一眼', score: 3 },
      { label: '早上六点整，它准时在门口开嗓，全年无休', score: 3 },
      { label: '我加班到胃疼，想找它摸两下，它扭头就走', score: 1 },
      { label: '上面这些我都不会破防，闹腾本来就是它活着的样子', score: 4 }
    ]
  },

  /* D3 掌控倾向 */
  {
    id: 'Q7', part: 'score', dim: 'kong',
    text: '你更期待你们之间是哪种关系？（这题很重要，请诚实作答）',
    options: [
      { label: '我是主人，它听我的——说"坐下"，它就坐下，那种成就感堪比升职', score: 4 },
      { label: '室友模式，谁也别管谁，同住一个屋檐下，各自安好', score: 1 },
      { label: '它是主子，我心甘情愿当铲屎官——这是它的家，我只是付房租的', score: 1 },
      { label: '它是我孩子，我要把它养得白白胖胖、体面过人', score: 3 }
    ]
  },
  {
    id: 'Q8', part: 'score', dim: 'kong',
    text: '它咬坏了你刚买三天的耳机，你的第一反应是？',
    options: [
      { label: '立刻抓现行、当场立规矩，"不可以"三个字必须说清楚', score: 4 },
      { label: '深呼吸，忍住，转头去搜"如何科学纠正宠物咬东西"', score: 3 },
      { label: '算了吧它又不懂，是我没收好东西，下次放高一点', score: 1 },
      { label: '先拍照发朋友圈："家人们，我耳机没了，凶手就是它"', score: 2 }
    ]
  },
  {
    id: 'Q9', part: 'score', dim: 'kong',
    text: '你更享受"教会它一个技能"，还是"它自己突然会了"？',
    options: [
      { label: '当然是我教，训练的过程才是最好玩的部分', score: 4 },
      { label: '都行，看它愿不愿意配合', score: 2 },
      { label: '它自己冒出来的小聪明，最让人惊喜', score: 1 },
      { label: '从来没想过，它健康活着就行', score: 1 }
    ]
  },

  /* D4 社交外扩 */
  {
    id: 'Q10', part: 'score', dim: 'she',
    text: '楼下遛弯时遇到另一位养宠人，对方一直在看你家这位，你会？',
    options: [
      { label: '主动开口："它多大了呀？"三分钟后你们已经加上微信了', score: 4 },
      { label: '点头微笑，礼貌但克制，脚步不停', score: 2 },
      { label: '内心疯狂希望对方先说话，表面假装在看手机', score: 2 },
      { label: '果断绕路，我可不想在楼下寒暄十五分钟', score: 1 }
    ]
  },
  {
    id: 'Q11', part: 'score', dim: 'she',
    text: '如果它能给你带来一种"社交加成"，你最想要哪种？',
    options: [
      { label: '每天有个正当理由出门，顺便认识了整栋楼的邻居', score: 4 },
      { label: '拍出好看的照片，发出去就有人点赞问"这是你家吗"', score: 3 },
      { label: '不需要加成，我们俩的世界就够了', score: 1 },
      { label: '朋友来家里，它能把所有人逗笑，气氛担当', score: 3 }
    ]
  },
  {
    id: 'Q12', part: 'score', dim: 'she',
    text: '你会在社交平台晒它吗？',
    options: [
      { label: '天天发。朋友说我的主页已经快变成一个宠物账号了', score: 4 },
      { label: '偶尔发，拍得足够好看才发，不能拉低我的审美', score: 3 },
      { label: '只发在家人群里，让爸妈看看它今天吃了什么', score: 2 },
      { label: '从不。它是我的私事，不接受围观', score: 1 }
    ]
  },

  /* D5 秩序容忍 */
  {
    id: 'Q13', part: 'score', dim: 'xu',
    text: '早上起床发现猫砂（或垫料）撒了一地，你的第一反应是？',
    options: [
      { label: '一边骂一边扫，扫完当天就下单升级设备，绝不允许第二次', score: 2 },
      { label: '扫了，习惯了，养它就是要扫地的', score: 4 },
      { label: '拍照发给朋友吐槽，然后默默把它扫掉', score: 3 },
      { label: '说实话，这种画面真的会让我怀疑人生，甚至怀疑当初的决定', score: 1 }
    ]
  },
  {
    id: 'Q14', part: 'score', dim: 'xu',
    text: '掉毛这件事，你的底线在哪？',
    options: [
      { label: '黑裤子上看到一根毛，我会当场精神内耗', score: 1 },
      { label: '少量可以接受，勤吸地就是了', score: 2 },
      { label: '满屋子毛我也认了，我早就和它和解了', score: 4 },
      { label: '毛我能忍，但我特别怕味道和噪音', score: 3 }
    ]
  },
  {
    id: 'Q15', part: 'score', dim: 'xu',
    text: '家里有"宠物的味道"，你怎么看？',
    options: [
      { label: '必须除味。净化器常开，客人来了不能被闻出来', score: 1 },
      { label: '有一点点可以接受，那是活着的痕迹', score: 2 },
      { label: '基本闻不到，那是我家的味道', score: 4 },
      { label: '我对气味极度敏感，一点异味我就睡不好', score: 1 }
    ]
  },

  /* D6 照料成就感 */
  {
    id: 'Q16', part: 'score', dim: 'yang',
    text: '以下哪个瞬间会让你觉得"这宠我养得值"？',
    options: [
      { label: '它学会了坐下、握手、叫名字就跑过来，简直像拿了奖', score: 3 },
      { label: '它第一次主动钻进我怀里，把最脆弱的肚子翻给我', score: 3 },
      { label: '体检报告全项正常，医生说了句"养得真好"', score: 4 },
      { label: '我成功养活了一整缸水草，长得比我的人生还旺', score: 4 }
    ]
  },
  {
    id: 'Q17', part: 'score', dim: 'yang',
    text: '半夜两点，你发现它拉肚子、精神萎靡，你会？',
    options: [
      { label: '立刻查资料、翻出 24 小时宠物医院地址，穿好衣服就走', score: 4 },
      { label: '先观察到早上，不行就去医院', score: 3 },
      { label: '先慌，然后疯狂给养过宠物的朋友发微信', score: 2 },
      { label: '手足无措，可能会拖到很严重才发现', score: 1 }
    ]
  },
  {
    id: 'Q18', part: 'score', dim: 'yang',
    text: '你最愿意为它花时间在哪件事上？',
    options: [
      { label: '训练、互动、带它出门，这些时间我觉得值得', score: 3 },
      { label: '打扫、布置窝、买买买，家里好看我心情就好', score: 2 },
      { label: '研究吃什么更健康、查成分表、翻资料', score: 4 },
      { label: '说实话，我希望尽量省心', score: 1 }
    ]
  },

  /* D7 资源弹性 */
  {
    id: 'Q19', part: 'score', dim: 'ren',
    text: '如果它一次性需要 5000 元医药费，你会？',
    options: [
      { label: '立刻付，救命要紧，钱可以再赚', score: 4 },
      { label: '咬牙付，接下来几个月我吃食堂', score: 3 },
      { label: '会犹豫很久，可能得先找人借', score: 2 },
      { label: '大概率付不起，光是想到这一点我就很痛苦', score: 1 }
    ]
  },
  {
    id: 'Q20', part: 'score', dim: 'ren',
    text: '你的时间弹性是？',
    options: [
      { label: '上下班准时，周末基本属于自己', score: 4 },
      { label: '偶尔加班，但能提前协调', score: 3 },
      { label: '常年加班 / 项目制，时间不完全属于我', score: 2 },
      { label: '随时可能出差、调动，我自己都说不准', score: 1 }
    ]
  },
  {
    id: 'Q21', part: 'score', dim: 'ren',
    text: '三年后如果要搬家、换城市甚至出国，它怎么办？',
    options: [
      { label: '一定带走，它是我家人，我看房子先看能不能养宠', score: 4 },
      { label: '尽量带走，真不行也一定给它找个靠谱的人', score: 3 },
      { label: '看情况吧，实在不方便可能会送人', score: 2 },
      { label: '我没想过那么远', score: 1 }
    ]
  },

  /* ---------------- 第三部分 · 彩蛋题组（不计分） ---------------- */
  {
    id: 'Q22', part: 'egg', key: 'mood',
    text: '如果 TA 能开口对你说一句话，你最想听到哪句？',
    options: [
      { label: '"我等你回来。"', value: 'A' },
      { label: '"别管我，我自己挺好的。"', value: 'B' },
      { label: '"你已经做得很好了。"', value: 'C' },
      { label: '"陪我玩一会儿好不好？"', value: 'D' }
    ]
  },
  {
    id: 'Q23', part: 'egg', key: 'nick',
    text: '你想给它取什么风格的名字？',
    options: [
      { label: '正经人名型：豆豆、团子、旺财、来福', value: 'A' },
      { label: '反差型：给一只手掌大的仓鼠取名叫"将军"', value: 'B' },
      { label: '食物型：汤圆、麻薯、包子、烧麦', value: 'C' },
      { label: '洋气型：Luna、Coco、奥利奥、布丁', value: 'D' }
    ]
  },
  {
    id: 'Q24', part: 'egg', key: 'moment',
    text: '如果 TA 有自己的朋友圈，你觉得它会发什么？',
    options: [
      { label: '晒饭："又是被投喂的一天（图）"', value: 'A' },
      { label: '抱怨："铲屎的今天加班了，我饿了，差评。"', value: 'B' },
      { label: '深夜哲学："猫生短暂，何必内耗。"', value: 'C' },
      { label: '炫耀："今天被 3 个人夸了，本宠心情不错。"', value: 'D' }
    ]
  },

  /* ---------------- 第四部分 · 条件触发题 ---------------- */
  {
    id: 'Q25', part: 'conditional',
    cond: function (answers) { return gateCode(answers, 'A1') === 'parents'; },
    text: '父母说"养宠物又脏又费钱"，你准备怎么接？',
    options: [
      { label: '我已经想好了：所有花费我自己出，卫生我全包，写保证书都行', dim: 'ren', score: 4, flag: 'resolve' },
      { label: '打算先斩后奏，养都养了还能扔了？', dim: null, flag: 'rush' },
      { label: '打算慢慢说服，先给他们看视频培养好感', dim: 'she', score: 4, flag: 'persuade' },
      { label: '说实话我可能说服不了，会选择放弃', dim: null, flag: 'giveup' }
    ]
  }
];
