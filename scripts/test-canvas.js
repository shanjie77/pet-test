/**
 * Canvas 渲染冒烟测试
 * 用最小可用的 2D 上下文替身，把 canvas.js 的 paint() 完整跑一遍，
 * 检查是否有运行时错误、测量结果是否合理、长图高度是否正常。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', 'public', 'js');

/* ---- 极简 2D 上下文替身 ---- */
function makeCtx(w, h) {
  const calls = {};
  const bump = function (k) { calls[k] = (calls[k] || 0) + 1; };
  const ctx = {
    canvas: { width: w, height: h, __h: h },
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    calls: calls,
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
    fillRect: function () { bump('fillRect'); },
    beginPath: function () { bump('beginPath'); },
    moveTo: function () { bump('moveTo'); },
    lineTo: function () { bump('lineTo'); },
    arcTo: function () { bump('arcTo'); },
    arc: function () { bump('arc'); },
    closePath: function () { bump('closePath'); },
    fill: function () { bump('fill'); },
    stroke: function () { bump('stroke'); },
    fillText: function (t, x, y) {
      bump('fillText');
      if (typeof t !== 'string') throw new Error('fillText 收到非字符串：' + typeof t);
      if (!isFinite(x) || !isFinite(y)) throw new Error('fillText 坐标非法：' + t + ' @ ' + x + ',' + y);
      (ctx._texts = ctx._texts || []).push(t);
    },
    measureText: function (t) {
      // 中文按 1em 估算，ASCII 按 0.55em
      const size = parseInt(String(ctx.font).match(/(\d+)px/)[1], 10);
      let wpx = 0;
      for (let i = 0; i < String(t).length; i++) {
        wpx += String(t).charCodeAt(i) > 255 ? size : size * 0.55;
      }
      return { width: wpx };
    },
    save: function () {}, restore: function () {}, scale: function () {}
  };
  return ctx;
}

const ctx = { console: console, btoa: btoa, atob: atob, escape: escape, unescape: unescape };
ctx.document = {
  createElement: function () {
    return {
      width: 0, height: 0,
      getContext: function () {
        return makeCtx(this.width, this.height);
      },
      toDataURL: function () { return 'data:image/png;base64,AAAA'; }
    };
  }
};
vm.createContext(ctx);

['results.js', 'questions.js', 'scoring.js', 'canvas.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(PUB, f), 'utf8'), ctx, { filename: f });
});

/* ---- 构造一份典型卡片数据 ---- */
const card = {
  date: '2026.10.12',
  title: '人间值得的温柔共居者',
  species: '布偶猫 / 橘猫',
  emoji: '🐱',
  signature: '我不需要你多厉害，我只需要你回来。',
  pct: 92,
  isCloud: false,
  dims: { qin: 4, lv: 3, kong: 2, she: 2, xu: 3, yang: 3.3, ren: 4 },
  why: '你在依恋类型上属于安全偏焦虑型——高亲密需求，但有能力经营长期关系。你需要一个"会回应你"的存在，而不是一个需要你驯服的对象。',
  ledger: ['月均 300–600 元', '每天互动 ≥30 分钟', '至少一个 1.5 米以上的猫爬架', '长毛猫每周梳毛 4 次'],
  avoid: '如果你经常出差超过 3 天，请先安排好上门喂养。猫的高冷不是不爱，是"我不说但我在"。',
  legal: '个人在中国可合法饲养的鹦鹉种类非常有限——目前明确可饲养的只有虎皮鹦鹉、鸡尾鹦鹉（玄凤）及人工繁育的桃脸牡丹鹦鹉等少数几种。',
  quote: '我等你回来。',
  knowledge: '猫的缓慢眨眼（slow blink）被证实是猫科动物的友好信号。2020 年发表于 Scientific Reports 的研究显示，人对猫缓慢眨眼，猫更愿意主动靠近。',
  nick: '麻薯',
  nickList: ['汤圆', '麻薯', '包子', '烧麦', '年糕'],
  moment: { text: '又是被投喂的一天。', sub: '配图：一碗吃了一半的饭' },
  sub: { species: '金毛 / 拉布拉多', title: '人间小太阳', pct: 88 },
  bad: { species: '仓鼠 / 金丝熊', reason: '你其实不太需要被黏着。' },
  resultId: 1
};

console.log('=== Canvas 冒烟测试 ===');
let h = 0;
try {
  const probe = makeCtx(750, 100);
  h = vm.runInContext('paint', ctx)(probe, card);
  console.log('  ✓ paint() 第一遍（测量）通过，内容总高 = ' + Math.round(h) + ' px');
  console.log('    绘制调用统计：fillText=' + probe.calls.fillText +
    '  fillRect=' + probe.calls.fillRect +
    '  roundRect相关=' + (probe.calls.arcTo || 0));

  const real = makeCtx(750, h);
  vm.runInContext('paint', ctx)(real, card);
  console.log('  ✓ paint() 第二遍（真实绘制）通过');
  console.log('    输出画布尺寸：750 × ' + Math.round(h) + '（导出倍率 2 → 1500 × ' + Math.round(h * 2) + '）');

  console.log('\n  长图中包含的段落：');
  const wanted = ['宠物人格测评', '人间值得的温柔共居者', '匹配度 92%', '你的七个维度', '为什么是你',
    '现实账本（先看这个再做决定）', '避坑提示', '合法来源提示', '它想对你说的一句话', 'TA 的朋友圈',
    '你会学到的一个冷知识', '给它取个名字吧', '反向提示', '你的第二顺位', '千万别碰：法律红线', '测你适合养什么宠物'];
  wanted.forEach(function (t) {
    const ok = real._texts.some(function (x) { return x.indexOf(t) >= 0; });
    console.log('    ' + (ok ? '✓' : '✗') + ' ' + t);
  });
} catch (e) {
  console.log('  ✗ paint() 抛出异常：' + e.message);
  console.log(e.stack);
  process.exit(1);
}

/* ---- 云吸结果（无画像、无匹配度）也要能出图 ---- */
try {
  const cloudCard = Object.assign({}, card, {
    title: '高段位的云养玩家', species: '暂不推荐实体养宠', emoji: '☁️', isCloud: true, pct: 0,
    sub: null, bad: null, legal: ''
  });
  const c2 = makeCtx(750, 100);
  const h2 = vm.runInContext('paint', ctx)(c2, cloudCard);
  console.log('\n  ✓ 云吸结果也能正常出图（高度 ' + Math.round(h2) + ' px）');
} catch (e) {
  console.log('\n  ✗ 云吸结果出图失败：' + e.message);
  process.exit(1);
}

/* ---- 分享链接编解码 ---- */
try {
  const payload = { r: 13, p: 88, s: 3, sp: 81, b: 6, br: '你其实不太需要被黏着。', d: [40, 30, 20, 20, 30, 30, 40], e: 'C', n: 'B', f: 'D', c: 0, t: Date.now() };
  const enc = vm.runInContext('encodePayload', ctx)(payload);
  const dec = vm.runInContext('decodePayload', ctx)(enc);
  const same = JSON.stringify(dec) === JSON.stringify(payload);
  console.log('\n=== 分享链接编解码 ===');
  console.log('  ' + (same ? '✓' : '✗') + ' 往返一致，URL 参数长度 = ' + enc.length + ' 字符');
  if (!same) { console.log('    原始：' + JSON.stringify(payload)); console.log('    解析：' + JSON.stringify(dec)); }
} catch (e) {
  console.log('  ✗ 编解码失败：' + e.message);
}

console.log('\n全部冒烟测试完成。');
