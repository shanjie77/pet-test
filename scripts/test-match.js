/**
 * 离线自测：把前端三个数据/算法文件放进同一个 vm 上下文，
 * 模拟几组典型答卷，检查匹配结果是否合理、是否有报错。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', 'public', 'js');
const ctx = { console: console, document: undefined };
vm.createContext(ctx);

['results.js', 'questions.js', 'scoring.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(PUB, f), 'utf8'), ctx, { filename: f });
});

/* 按 选项偏好 生成一份答卷：pref 越小越靠前 */
function makeAnswers(pickFn) {
  const a = {};
  vm.runInContext('QUESTIONS', ctx).forEach(function (q) {
    const i = pickFn(q);
    a[q.id] = Math.max(0, Math.min(q.options.length - 1, i));
  });
  return a;
}

const scenarios = [
  {
    name: 'A. 高亲密 + 规律 + 想训练 + 外向 + 能忍毛 + 钻研 + 有钱有闲',
    pick: function (q) { return 0; }
  },
  {
    name: 'B. 全部选最后一项（低亲密 / 不规律 / 被动 / 内向 / 高容忍 / 不钻研）',
    pick: function (q) { return 3; }
  },
  {
    name: 'C. 全部选第二项',
    pick: function (q) { return 1; }
  },
  {
    name: 'D. 过敏 + 小空间 + 低预算 + 常出差（触发云吸）',
    profile: function (answers) {
      answers.A1 = 3; answers.A2 = 3; answers.A3 = 2; answers.A4 = 0; answers.A5 = 3; answers.A6 = 0;
    }
  },
  {
    name: 'E. 从外面捡了一只想带回家（A6=D，一票否决）',
    profile: function (answers) {
      answers.A6 = 3;
    }
  },
  {
    name: 'F. 和父母同住（触发条件题 Q25）',
    profile: function (answers) {
      answers.A1 = 2;
    }
  }
];

scenarios.forEach(function (s) {
  const answers = makeAnswers(s.pick || function () { return 0; });
  if (s.profile) s.profile(answers);

  const dims = vm.runInContext('computeDims(' + JSON.stringify(answers) + ')', ctx);
  const m = vm.runInContext('runMatch(' + JSON.stringify(dims) + ',' + JSON.stringify(answers) + ')', ctx);

  console.log('\n=== ' + s.name + ' ===');
  console.log('维度：' + Object.keys(dims).map(function (k) { return k + '=' + dims[k]; }).join(' '));
  console.log('主结果：#' + m.main.id + ' ' + m.main.title + '（' + m.mainPct + '%）');
  if (m.sub) console.log('第二顺位：#' + m.sub.id + ' ' + m.sub.title + '（' + m.subPct + '%）');
  if (m.futurePlan) console.log('未来准备清单：#' + m.futurePlan.result.id + ' ' + m.futurePlan.result.title + '（' + m.futurePlan.pct + '%）');
  if (m.bad) console.log('最不适合：#' + m.bad.id + ' ' + m.bad.species + ' — ' + m.badReason);
  if (m.clusterTip) console.log('同簇裁决：' + m.clusterTip);
  if (m.gate.forceCloud) console.log('门槛覆盖：触发云吸（冲突 ' + m.gate.conflictCount + ' 项）');
  if (m.gate.conflicts.length) console.log('冲突项：' + m.gate.conflicts.map(function (c) { return c.text; }).join('、'));
  if (m.gate.notes.length) console.log('提醒：' + m.gate.notes.length + ' 条');
  console.log('TOP3：' + m.ranked.map(function (r) { return r.result.id + '(' + r.pct + '%)'; }).join(' '));
});

/* 覆盖度检查：所有 24 个结果是否都可达 */
const reachable = {};
vm.runInContext('RESULTS', ctx).forEach(function (r) { reachable[r.id] = 0; });
let total = 0;
for (let n = 0; n < 3000; n++) {
  const answers = {};
  vm.runInContext('QUESTIONS', ctx).forEach(function (q) {
    answers[q.id] = Math.floor(Math.random() * q.options.length);
  });
  if (answers.A6 === 3) continue;
  const dims = vm.runInContext('computeDims(' + JSON.stringify(answers) + ')', ctx);
  const m = vm.runInContext('runMatch(' + JSON.stringify(dims) + ',' + JSON.stringify(answers) + ')', ctx);
  if (!m.gate.forceCloud) {
    reachable[m.main.id] = (reachable[m.main.id] || 0) + 1;
    total++;
  }
}
console.log('\n=== 随机 3000 次作答的结果分布（排除触发云吸的） ===');
const rows = Object.keys(reachable).map(function (k) { return { id: Number(k), n: reachable[k] }; })
  .sort(function (a, b) { return b.n - a.n; });
rows.forEach(function (r) {
  const pct = (r.n / total * 100).toFixed(1);
  console.log('#' + String(r.id).padStart(2, '0') + '  ' + String(r.n).padStart(4) + ' 次  ' + pct + '%');
});
const zero = rows.filter(function (r) { return r.n === 0; });
console.log(zero.length ? ('从未命中的结果：' + zero.map(function (z) { return z.id; }).join(', ')) : '所有结果均可命中 ✓');

/* ---------------- 定向可达性测试 ----------------
 * 针对每个结果的画像向量，逐题挑"最贴近该画像"的选项，看能否命中它自己。
 */
console.log('\n=== 定向可达性测试（按每个结果的画像反向出卷） ===');
const DIM_INDEX = { qin: 0, lv: 1, kong: 2, she: 3, xu: 4, yang: 5, ren: 6 };
const allQ = vm.runInContext('QUESTIONS', ctx);
const allR = vm.runInContext('RESULTS', ctx).filter(function (r) { return !r.isCloud && r.profile; });
let hitCount = 0;

allR.forEach(function (target) {
  const answers = {};
  allQ.forEach(function (q) {
    // 门槛题统一选"无门槛"的那一项（index 1），避免把目标物种自己排除掉
    if (q.part === 'gate') { answers[q.id] = 1; return; }
    if (q.part === 'egg') { answers[q.id] = 0; return; }
    if (q.part === 'conditional') return;
    const want = target.profile[DIM_INDEX[q.dim]];
    let best = 0, bestGap = 99;
    q.options.forEach(function (o, i) {
      const g = Math.abs(o.score - want);
      if (g < bestGap) { bestGap = g; best = i; }
    });
    answers[q.id] = best;
  });

  const dims = vm.runInContext('computeDims(' + JSON.stringify(answers) + ')', ctx);
  const m = vm.runInContext('runMatch(' + JSON.stringify(dims) + ',' + JSON.stringify(answers) + ')', ctx);
  const ok = m.main.id === target.id;
  if (ok) hitCount++;
  console.log((ok ? '  ✓' : '  ✗') + ' 目标 #' + String(target.id).padStart(2, '0') +
    '  实际 #' + String(m.main.id).padStart(2, '0') + ' ' + m.main.title +
    '（' + m.mainPct + '%）' + (ok ? '' : '   ← 未命中'));
});
console.log('\n定向命中率：' + hitCount + '/' + allR.length +
  '（未命中通常是因为该画像不是该维度的最近邻，属正常）');
