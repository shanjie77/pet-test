/* ============================================================
 * 计分与匹配引擎
 * ============================================================ */

/* ---------- 1. 维度计分 ---------- */
function computeDims(answers) {
  const raw = { qin: 0, lv: 0, kong: 0, she: 0, xu: 0, yang: 0, ren: 0 };
  const bonus = { qin: 0, lv: 0, kong: 0, she: 0, xu: 0, yang: 0, ren: 0 };

  QUESTIONS.forEach(function (q) {
    if (q.part !== 'score' && q.part !== 'conditional') return;
    const picked = answers[q.id];
    if (picked === undefined || picked === null) return;

    if (q.part === 'score') {
      const opt = q.options[picked];
      if (opt && typeof opt.score === 'number') raw[q.dim] += opt.score;
    } else {
      const opt = q.options[picked];
      if (opt && opt.dim && typeof opt.score === 'number') {
        // 条件题按 +1 换算到 3-12 的原始分区间
        bonus[opt.dim] += 1;
      }
    }
  });

  const dims = {};
  DIM_KEYS.forEach(function (k) {
    const v = (raw[k] + bonus[k]) / 3;
    dims[k] = Math.max(1, Math.min(4, Math.round(v * 10) / 10));
  });
  return dims;
}

/* ---------- 2. 硬门槛评估 ---------- */
const GAP_TEXT = {
  qin: '你其实不太需要被黏着',
  lv: '你的作息和它的活跃时段对不上',
  kong: '你更想当室友，而不是当主人',
  she: '你不想为了遛它而社交',
  xu: '你受不了它的毛、味和乱',
  yang: '你不太享受精细照料这件事',
  ren: '你的时间与预算兜底还不稳'
};

/* 答题存的是选项下标，这里换算成选项编码（own / allergy / le200 ...） */
function gateCode(answers, id) {
  const q = QUESTIONS.filter(function (x) { return x.id === id; })[0];
  if (!q) return null;
  const i = answers[id];
  if (i === undefined || i === null) return null;
  const opt = q.options[i];
  return opt ? opt.code : null;
}

function evalGate(answers) {
  const excluded = new Set();
  const conflicts = [];
  let forceCloud = false;
  let legalWarn = false;
  const notes = [];

  const cA1 = gateCode(answers, 'A1');
  const cA2 = gateCode(answers, 'A2');
  const cA3 = gateCode(answers, 'A3');
  const cA4 = gateCode(answers, 'A4');
  const cA5 = gateCode(answers, 'A5');
  const cA6 = gateCode(answers, 'A6');

  if (cA3 === 'allergy') {
    ['cat', 'cat-large', 'dog-large', 'dog-small', 'rabbit', 'chinchilla'].forEach(function (t) { excluded.add(t); });
    conflicts.push({ key: 'allergy', text: '你对动物毛发 / 皮屑过敏' });
  } else if (cA3 === 'family') {
    notes.push('家里有人过敏，建议先做一次过敏原检测再决定——这是最容易白花的一笔钱。');
  }

  if (cA1 === 'tiny') {
    ['dog-large', 'dog-small', 'cat-large', 'rabbit', 'farm', 'aquatic-large'].forEach(function (t) { excluded.add(t); });
    conflicts.push({ key: 'space', text: '居住空间不到 15㎡' });
  }
  if (cA1 === 'parents') {
    notes.push('你和长辈同住，养之前请先完成"家庭沟通"这一关，否则最容易被要求送走。');
  }

  if (cA4 === 'le200') {
    ['dog-large', 'dog-small', 'chinchilla', 'bird', 'ferret', 'cat-large'].forEach(function (t) { excluded.add(t); });
    conflicts.push({ key: 'budget', text: '每月预算 200 元以内' });
  }

  if (cA2 === 'gt12') {
    ['dog-large', 'dog-small'].forEach(function (t) { excluded.add(t); });
    conflicts.push({ key: 'time', text: '每天离家超过 12 小时' });
  }

  if (cA5 === 'none') {
    notes.push('长假安置你还没想过。宠物寄养在节假日的价格通常是平日的 1.5–2 倍，且一位难求，建议提前找好备选。');
  }

  if (cA6 === 'wild') {
    forceCloud = true;
    notes.push('你在"从外面捡一只"这一项上触发了法律红线：中国本土绝大多数野生鸟类、龟类、刺猬、蛇类都受《野生动物保护法》保护，带回家饲养即违法，与有没有伤害它无关。');
  } else if (cA6 === 'cheap') {
    legalWarn = true;
    notes.push('来源不明是弃养与违法的主要入口。请要求卖家提供人工繁育来源证明与检疫证明，并保留聊天记录截图。');
  }

  return {
    excluded: excluded,
    conflicts: conflicts,
    conflictCount: conflicts.length,
    forceCloud: forceCloud || conflicts.length >= 2,
    legalWarn: legalWarn,
    notes: notes
  };
}

/* ---------- 3. 加权曼哈顿距离匹配（对维度做标准化，避免"中庸画像"通吃） ---------- */
let DIM_STATS = null;

function getDimStats() {
  if (DIM_STATS) return DIM_STATS;
  const pool = RESULTS.filter(function (r) { return !r.isCloud && r.profile; });
  const mus = [], sds = [];
  for (let i = 0; i < 7; i++) {
    let sum = 0;
    pool.forEach(function (r) { sum += r.profile[i]; });
    const mu = sum / pool.length;
    let v2 = 0;
    pool.forEach(function (r) { v2 += (r.profile[i] - mu) * (r.profile[i] - mu); });
    const sd = Math.sqrt(v2 / pool.length) || 1;
    mus.push(mu);
    sds.push(sd);
  }
  DIM_STATS = { mus: mus, sds: sds };
  return DIM_STATS;
}

/* 返回：加权平均的 z 距离（越小越像） */
function zDistance(dims, profile) {
  const st = getDimStats();
  let num = 0, den = 0;
  for (let i = 0; i < 7; i++) {
    const zu = (dims[DIM_KEYS[i]] - st.mus[i]) / st.sds[i];
    const zr = (profile[i] - st.mus[i]) / st.sds[i];
    num += DIM_WEIGHTS[i] * Math.abs(zu - zr);
    den += DIM_WEIGHTS[i];
  }
  return num / den;
}

/* 兼容旧调用：保留 similarity 名称，返回"越大约像"的 0–1 值 */
function similarity(dims, profile) {
  return 1 - zDistance(dims, profile) / 2.6;
}

/* 结果画像簇的二级裁决规则（同簇区分，避免匹配抖动） */
const CLUSTERS = [
  {
    ids: [1, 13],
    decide: function (d) { return d.xu >= 3 ? 1 : 13; },
    tip: '你俩的差别在"能不能忍受一根毛"'
  },
  {
    ids: [3, 16],
    decide: function (d) { return d.xu >= 4 ? 16 : 3; },
    tip: '你俩的差别在"家里下雪你受不受得了"'
  },
  {
    ids: [4, 16],
    decide: function (d) { return d.kong >= 4 ? 4 : (d.kong <= 2 ? 16 : null); },
    tip: '你俩的差别在"你想不想当那个说了算的人"'
  },
  {
    ids: [5, 15, 17],
    decide: function (d) {
      if (d.she >= 4 && d.kong >= 4) return 15;
      if (d.she >= 4 && d.kong <= 3) return 5;
      if (d.she <= 3 && d.xu <= 2) return 17;
      return null;
    },
    tip: '你俩的差别在"你是想被黏着，还是想被陪着"'
  },
  {
    ids: [10, 22],
    decide: function (d) { return d.ren >= 4 ? 22 : 10; },
    tip: '你俩的差别在"你的时间够不够撑住一只高互动宠物"'
  },
  {
    ids: [11, 21],
    decide: function (d) { return d.ren >= 4 ? 21 : 11; },
    tip: '你俩的差别在"你愿不愿意为水体花一份重资产"'
  },
  {
    ids: [12, 23],
    decide: function (d) { return d.yang >= 4 ? 23 : 12; },
    tip: '你俩的差别在"你是想养着它，还是想研究它"'
  },
  {
    ids: [6, 20],
    decide: function (d) { return d.yang >= 4 ? 20 : 6; },
    tip: '你俩的差别在"你想被陪着，还是想每天看到产出"'
  }
];

function resolveCluster(cands, dims) {
  const top = cands.slice(0, 3);
  if (top.length < 2) return null;
  const band = top[top.length - 1].dist - top[0].dist;
  if (band > 0.05) return null;

  // 只在与"当前最优结果"同簇的规则里做裁决，避免跨簇误判
  for (let i = 0; i < CLUSTERS.length; i++) {
    const cl = CLUSTERS[i];
    if (cl.ids.indexOf(top[0].result.id) < 0) continue;
    const inCluster = top.filter(function (c) { return cl.ids.indexOf(c.result.id) >= 0; });
    if (inCluster.length >= 2) {
      const pick = cl.decide(dims);
      if (pick) {
        const chosen = cands.filter(function (c) { return c.result.id === pick; })[0];
        if (chosen) return { chosen: chosen, tip: cl.tip, ids: cl.ids };
      }
      return null;
    }
  }
  return null;
}

/* ---------- 4. 主匹配流程 ---------- */
function runMatch(dims, answers) {
  const gate = evalGate(answers);

  let pool = RESULTS.filter(function (r) {
    if (r.isCloud || !r.profile) return false;
    for (let i = 0; i < r.tags.length; i++) {
      if (gate.excluded.has(r.tags[i])) return false;
    }
    return true;
  });

  let fallbackUsed = false;
  if (pool.length === 0) {
    pool = RESULTS.filter(function (r) { return !r.isCloud && r.profile; });
    fallbackUsed = true;
  }

  const scored = pool.map(function (r) {
    return { result: r, dist: zDistance(dims, r.profile) };
  }).sort(function (a, b) { return a.dist - b.dist; });

  const clusterPick = resolveCluster(scored, dims);
  let main, clusterTip = '';
  if (clusterPick && clusterPick.chosen.dist <= scored[0].dist + 0.05) {
    main = clusterPick.chosen;
    clusterTip = clusterPick.tip;
  } else {
    main = scored[0];
  }

  // 副结果：排除主结果所在簇
  const mainCluster = CLUSTERS.filter(function (c) { return c.ids.indexOf(main.result.id) >= 0; })[0];
  const blocked = mainCluster ? mainCluster.ids : [main.result.id];
  const sub = scored.filter(function (s) { return blocked.indexOf(s.result.id) < 0; })[0] || null;

  // 反向提示：最不适合
  const bad = scored[scored.length - 1];
  let badReason = '';
  if (bad) {
    let worstKey = DIM_KEYS[0], worstGap = -1;
    for (let i = 0; i < 7; i++) {
      const gap = Math.abs(dims[DIM_KEYS[i]] - bad.result.profile[i]) * DIM_WEIGHTS[i];
      if (gap > worstGap) { worstGap = gap; worstKey = DIM_KEYS[i]; }
    }
    badReason = GAP_TEXT[worstKey] + '。';
  }

  // 匹配度：由 z 距离换算，钳制在 60%–97%
  const PCT_K = 22;
  const pct = function (item) {
    const v = 100 - item.dist * PCT_K;
    return Math.round(Math.max(60, Math.min(97, v)));
  };

  // 硬门槛覆盖：冲突 ≥2 项 或 触发法律红线 → 主结果换成「云吸选手」，
  // 原来的最优结果降级为"等条件成熟后的准备清单"
  let finalMain = main;
  let finalPct = pct(main);
  let futurePlan = null;
  let finalSub = sub;

  if (gate.forceCloud) {
    const cloud = RESULTS.filter(function (r) { return r.isCloud; })[0];
    if (cloud) {
      futurePlan = { result: main.result, pct: pct(main) };
      finalMain = { result: cloud, dist: 0 };
      finalPct = 0;
      finalSub = null;
    }
  }

  return {
    gate: gate,
    dims: dims,
    main: finalMain.result,
    mainDist: finalMain.dist,
    mainPct: finalPct,
    sub: finalSub ? finalSub.result : null,
    subPct: finalSub ? pct(finalSub) : 0,
    futurePlan: futurePlan,
    bad: bad ? bad.result : null,
    badReason: badReason,
    clusterTip: clusterTip,
    fallbackUsed: fallbackUsed,
    ranked: scored.slice(0, 3).map(function (s) {
      return { result: s.result, pct: pct(s) };
    })
  };
}

/* ---------- 5. 分享载荷的编解码（无服务端时的兜底） ---------- */
function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePayload(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}
