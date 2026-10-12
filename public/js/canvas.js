/* ============================================================
 * 结果长图生成（Canvas 手绘，无第三方依赖）
 * 用法：const canvas = await renderResultCanvas(cardData);
 * ============================================================ */

const CARD_W = 750;
const CARD_PAD = 44;
const CARD_SCALE = 2;

const C = {
  bg: '#FFF8F0',
  bgDeep: '#FDF1E3',
  ink: '#2E2621',
  text: '#4C4139',
  muted: '#8C7C6F',
  line: '#EADCCB',
  card: '#FFFFFF',
  amber: '#E2873C',
  amberDeep: '#C96D28',
  amberSoft: '#FBEDDD',
  green: '#3B8A67',
  greenSoft: '#E7F3EC',
  warn: '#C0553A',
  warnSoft: '#FBEAE4'
};

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

function setFont(ctx, size, weight) {
  ctx.font = (weight || 400) + ' ' + size + 'px ' + FONT;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxW) {
  const paras = String(text == null ? '' : text).split('\n');
  const out = [];
  paras.forEach(function (p) {
    if (p === '') { out.push(''); return; }
    let line = '';
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ctx.measureText(line + ch).width > maxW && line !== '') {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line !== '') out.push(line);
  });
  return out;
}

/* 单次渲染流程，返回最终 y（即内容总高） */
function paint(ctx, data) {
  const W = CARD_W;
  const innerW = W - CARD_PAD * 2;
  let y = 0;

  /* ---------- 背景 ---------- */
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, '#FFF3E4');
  g.addColorStop(1, C.bg);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, ctx.canvas.__h || 100000);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 620);

  /* ---------- 顶部品牌行 ---------- */
  y = 52;
  ctx.fillStyle = C.amberDeep;
  ctx.beginPath();
  ctx.arc(CARD_PAD + 9, y - 5, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.amberDeep;
  setFont(ctx, 24, 600);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('宠物人格测评', CARD_PAD + 28, y);

  const dateStr = data.date || '';
  setFont(ctx, 22, 400);
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, W - CARD_PAD, y);
  ctx.textAlign = 'left';

  /* ---------- 吉祥物卡通形象 ---------- */
  const mascot = data.imgEl || null;
  if (mascot) {
    const ms = 300;
    y += 30;
    const cx = W / 2;
    const cy = y + ms / 2;

    ctx.fillStyle = '#FCEBDA';
    ctx.beginPath(); ctx.arc(cx, cy, ms / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#F3DCC4';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, ms / 2 - 8, 0, Math.PI * 2); ctx.stroke();

    // 两侧小装饰点
    ctx.fillStyle = C.amber;
    ctx.beginPath(); ctx.arc(cx - ms / 2 - 26, cy + 26, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8B04B';
    ctx.beginPath(); ctx.arc(cx + ms / 2 + 30, cy - 34, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.green;
    ctx.beginPath(); ctx.arc(cx + ms / 2 + 20, cy + 46, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#EBA9A0';
    ctx.beginPath(); ctx.arc(cx - ms / 2 - 14, cy - 48, 6, 0, Math.PI * 2); ctx.fill();

    ctx.drawImage(mascot, cx - ms / 2, cy - ms / 2, ms, ms);
    y += ms + 36;
  }

  /* ---------- 主结果块 ---------- */
  y += 42;
  ctx.fillStyle = C.muted;
  setFont(ctx, 26, 400);
  ctx.fillText('我的宠物人格是', CARD_PAD, y);

  y += 62;
  ctx.fillStyle = C.ink;
  setFont(ctx, 52, 700);
  const titleLines = wrapLines(ctx, data.title, innerW);
  titleLines.forEach(function (ln) {
    ctx.fillText(ln, CARD_PAD, y);
    y += 64;
  });

  y += 6;
  ctx.fillStyle = C.amberDeep;
  setFont(ctx, 30, 500);
  ctx.fillText(data.emoji + '  ' + data.species, CARD_PAD, y);
  y += 40;

  // 匹配度徽标 / 云吸提示
  const badgeText = data.isCloud ? '系统建议：先云养一段时间' : ('匹配度 ' + data.pct + '%');
  setFont(ctx, 26, 600);
  const bw = ctx.measureText(badgeText).width + 40;
  ctx.fillStyle = data.isCloud ? C.warnSoft : C.amberSoft;
  roundRect(ctx, CARD_PAD, y, bw, 52, 26);
  ctx.fill();
  ctx.fillStyle = data.isCloud ? C.warn : C.amberDeep;
  ctx.fillText(badgeText, CARD_PAD + 20, y + 35);
  y += 84;

  /* ---------- 签名 ---------- */
  setFont(ctx, 28, 500);
  const signLines = wrapLines(ctx, '“' + data.signature + '”', innerW - 40);
  const signH = signLines.length * 42 + 56;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, CARD_PAD, y, innerW, signH, 18);
  ctx.fill();
  ctx.fillStyle = C.amber;
  ctx.fillRect(CARD_PAD, y + 16, 5, signH - 32);
  ctx.fillStyle = C.text;
  let sy = y + 46;
  signLines.forEach(function (ln) {
    ctx.fillText(ln, CARD_PAD + 34, sy);
    sy += 42;
  });
  y += signH + 40;

  /* ---------- 维度条形 ---------- */
  ctx.fillStyle = C.ink;
  setFont(ctx, 30, 600);
  ctx.fillText('你的七个维度', CARD_PAD, y);
  y += 40;

  const starOf = function (v) {
    const n = Math.max(1, Math.min(5, Math.round(v / 4 * 5)));
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  };

  for (let i = 0; i < 7; i++) {
    const k = DIM_KEYS[i];
    const v = data.dims[k];
    ctx.fillStyle = C.text;
    setFont(ctx, 25, 400);
    ctx.fillText(DIM_NAMES[i], CARD_PAD, y + 20);

    const barX = CARD_PAD + 190;
    const barW = innerW - 190 - 150;
    ctx.fillStyle = '#F0E4D6';
    roundRect(ctx, barX, y + 4, barW, 16, 8);
    ctx.fill();
    ctx.fillStyle = C.amber;
    roundRect(ctx, barX, y + 4, Math.max(10, barW * (v / 4)), 16, 8);
    ctx.fill();

    ctx.fillStyle = C.muted;
    setFont(ctx, 22, 400);
    ctx.textAlign = 'right';
    ctx.fillText(starOf(v), W - CARD_PAD, y + 22);
    ctx.textAlign = 'left';
    y += 42;
  }
  y += 24;

  /* ---------- 通用文本卡片 ---------- */
  function textCard(heading, body, tone) {
    const pad = 30;
    setFont(ctx, 27, 400);
    const lines = wrapLines(ctx, body, innerW - pad * 2);
    const bodyH = lines.length * 40;
    const h = bodyH + 96;

    ctx.fillStyle = C.card;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.stroke();

    ctx.fillStyle = tone === 'warn' ? C.warn : (tone === 'green' ? C.green : C.amberDeep);
    setFont(ctx, 27, 600);
    ctx.fillText(heading, CARD_PAD + pad, y + 48);

    ctx.fillStyle = C.text;
    setFont(ctx, 27, 400);
    let ty = y + 48 + 42;
    lines.forEach(function (ln) {
      ctx.fillText(ln, CARD_PAD + pad, ty);
      ty += 40;
    });
    y += h + 26;
  }

  function listCard(heading, items) {
    const pad = 30;
    setFont(ctx, 26, 400);
    let rows = [];
    items.forEach(function (it) {
      rows = rows.concat(wrapLines(ctx, it, innerW - pad * 2 - 26));
    });
    const h = rows.length * 40 + 96;
    ctx.fillStyle = C.card;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.stroke();

    ctx.fillStyle = C.amberDeep;
    setFont(ctx, 27, 600);
    ctx.fillText(heading, CARD_PAD + pad, y + 48);

    ctx.textBaseline = 'alphabetic';
    let ty = y + 48 + 42;
    rows.forEach(function (ln, idx) {
      ctx.fillStyle = C.amber;
      setFont(ctx, 26, 400);
      ctx.fillText('·', CARD_PAD + pad, ty);
      ctx.fillStyle = C.text;
      ctx.fillText(ln, CARD_PAD + pad + 20, ty);
      ty += 40;
    });
    y += h + 26;
  }

  textCard('为什么是你', data.why, 'amber');
  listCard('现实账本（先看这个再做决定）', data.ledger);
  textCard('避坑提示', data.avoid, 'warn');

  if (data.legal) {
    textCard('合法来源提示', data.legal, 'warn');
  }

  /* ---------- TA 想说的话 + 朋友圈 ---------- */
  {
    const pad = 30;
    setFont(ctx, 27, 500);
    const qLines = wrapLines(ctx, '“' + data.quote + '”', innerW - pad * 2);
    const mText = data.moment ? (data.moment.text + '（' + data.moment.sub + '）') : '';
    setFont(ctx, 25, 400);
    const mLines = mText ? wrapLines(ctx, mText, innerW - pad * 2 - 60) : [];
    const h = qLines.length * 42 + mLines.length * 38 + (mLines.length ? 120 : 78);

    ctx.fillStyle = '#FFFDF9';
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.stroke();

    ctx.fillStyle = C.muted;
    setFont(ctx, 24, 400);
    ctx.fillText('它想对你说的一句话', CARD_PAD + pad, y + 44);

    ctx.fillStyle = C.ink;
    setFont(ctx, 27, 500);
    let ty = y + 88;
    qLines.forEach(function (ln) { ctx.fillText(ln, CARD_PAD + pad, ty); ty += 42; });

    if (mLines.length) {
      ty += 12;
      ctx.fillStyle = C.amberDeep;
      setFont(ctx, 24, 600);
      ctx.fillText('TA 的朋友圈', CARD_PAD + pad, ty);
      ty += 34;
      ctx.fillStyle = C.muted;
      setFont(ctx, 25, 400);
      ctx.fillText('🐾', CARD_PAD + pad, ty);
      mLines.forEach(function (ln) {
        ctx.fillText(ln, CARD_PAD + pad + 46, ty);
        ty += 38;
      });
    }
    y += h + 26;
  }

  textCard('你会学到的一个冷知识', data.knowledge, 'amber');

  if (data.nick) {
    textCard('给它取个名字吧', '推荐昵称：' + data.nick + '（结果页可以点"换一批"）', 'amber');
  }

  /* ---------- 最不适合 ---------- */
  if (data.bad) {
    const pad = 30;
    const body = '你最不适合养的是「' + data.bad.species + '」——因为' + data.badReason;
    setFont(ctx, 26, 400);
    const lines = wrapLines(ctx, body, innerW - pad * 2);
    const h = lines.length * 40 + 96;
    ctx.fillStyle = C.warnSoft;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.fillStyle = C.warn;
    setFont(ctx, 27, 600);
    ctx.fillText('反向提示', CARD_PAD + pad, y + 48);
    ctx.fillStyle = C.text;
    setFont(ctx, 26, 400);
    let ty = y + 90;
    lines.forEach(function (ln) { ctx.fillText(ln, CARD_PAD + pad, ty); ty += 40; });
    y += h + 26;
  }

  /* ---------- 副结果 ---------- */
  if (data.sub) {
    const pad = 30;
    const body = '如果未来你的生活状态变了，「' + data.sub.species + '（' + data.sub.title + '）」会是你的第二顺位，匹配度 ' + data.sub.pct + '%。';
    setFont(ctx, 26, 400);
    const lines = wrapLines(ctx, body, innerW - pad * 2);
    const h = lines.length * 40 + 96;
    ctx.fillStyle = C.greenSoft;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.fillStyle = C.green;
    setFont(ctx, 27, 600);
    ctx.fillText('你的第二顺位', CARD_PAD + pad, y + 48);
    ctx.fillStyle = C.text;
    setFont(ctx, 26, 400);
    let ty = y + 90;
    lines.forEach(function (ln) { ctx.fillText(ln, CARD_PAD + pad, ty); ty += 40; });
    y += h + 26;
  }

  /* ---------- 未来准备清单（触发云吸时保留原最优结果） ---------- */
  if (data.futurePlan) {
    const pad = 30;
    const body = '如果按你现在的生活方式去匹配，最接近你的是「' + data.futurePlan.species + '（' +
      data.futurePlan.title + '）」，匹配度 ' + data.futurePlan.pct + '%。但它需要的前提你现在还不具备——先把上面那几条现实条件解决掉，再来看它。';
    setFont(ctx, 26, 400);
    const lines = wrapLines(ctx, body, innerW - pad * 2);
    const h = lines.length * 40 + 96;
    ctx.fillStyle = C.greenSoft;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.fillStyle = C.green;
    setFont(ctx, 27, 600);
    ctx.fillText('等条件成熟了再说', CARD_PAD + pad, y + 48);
    ctx.fillStyle = C.text;
    setFont(ctx, 26, 400);
    let ty = y + 90;
    lines.forEach(function (ln) { ctx.fillText(ln, CARD_PAD + pad, ty); ty += 40; });
    y += h + 26;
  }

  /* ---------- 慎选清单（法律红线） ---------- */
  {
    const pad = 30;
    const items = AVOID_LIST.filter(function (a) { return a.legal; }).map(function (a) {
      return a.name + '：' + a.why;
    });
    setFont(ctx, 25, 400);
    let rows = [];
    items.forEach(function (it) { rows = rows.concat(wrapLines(ctx, it, innerW - pad * 2 - 26)); });
    const h = rows.length * 38 + 108;
    ctx.fillStyle = C.warnSoft;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();
    ctx.fillStyle = C.warn;
    setFont(ctx, 27, 600);
    ctx.fillText('⚠ 千万别碰：法律红线', CARD_PAD + pad, y + 48);
    setFont(ctx, 25, 400);
    ctx.fillStyle = C.text;
    let ty = y + 92;
    rows.forEach(function (ln) {
      ctx.fillStyle = C.warn;
      ctx.fillText('·', CARD_PAD + pad, ty);
      ctx.fillStyle = C.text;
      ctx.fillText(ln, CARD_PAD + pad + 20, ty);
      ty += 38;
    });
    y += h + 26;
  }

  /* ---------- 页脚 ---------- */
  {
    const pad = 30;
    const foot = '本测评推荐的所有物种均须为人工繁育或家养来源。中国本土野生动物受《野生动物保护法》保护，捕捉、买卖、饲养均违法。';
    setFont(ctx, 23, 400);
    const lines = wrapLines(ctx, foot, innerW - pad * 2);
    const h = lines.length * 36 + 170;
    ctx.fillStyle = C.bgDeep;
    roundRect(ctx, CARD_PAD, y, innerW, h, 18);
    ctx.fill();

    ctx.fillStyle = C.muted;
    let ty = y + 46;
    lines.forEach(function (ln) { ctx.fillText(ln, CARD_PAD + pad, ty); ty += 36; });

    ty += 14;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CARD_PAD + pad, ty - 12);
    ctx.lineTo(W - CARD_PAD - pad, ty - 12);
    ctx.stroke();

    ty += 22;
    ctx.fillStyle = C.amberDeep;
    setFont(ctx, 26, 600);
    ctx.fillText('测你适合养什么宠物', CARD_PAD + pad, ty);
    ty += 38;
    ctx.fillStyle = C.muted;
    setFont(ctx, 23, 400);
    ctx.fillText('30 道生活情境题 · 24 种人宠关系人格 · 附合法饲养红线', CARD_PAD + pad, ty);

    y += h + 48;
  }

  return y;
}

function renderResultCanvas(data) {
  // 第一遍：测量总高
  const probe = document.createElement('canvas');
  probe.width = CARD_W;
  probe.height = 100;
  const pctx = probe.getContext('2d');
  const totalH = Math.ceil(paint(pctx, data)) + 20;

  // 第二遍：真实绘制
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W * CARD_SCALE;
  canvas.height = totalH * CARD_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.canvas.__h = totalH;
  ctx.scale(CARD_SCALE, CARD_SCALE);
  ctx.textBaseline = 'alphabetic';
  paint(ctx, data);

  return canvas;
}

function canvasToBlob(canvas, cb) {
  if (canvas.toBlob) {
    canvas.toBlob(function (b) { cb(b); }, 'image/png', 0.95);
  } else {
    const url = canvas.toDataURL('image/png');
    const bin = atob(url.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    cb(new Blob([arr], { type: 'image/png' }));
  }
}

/* 预加载宠物卡通形象，失败时返回 null（长图自动退回无形象版式） */
function loadPetImage(src) {
  return new Promise(function (resolve) {
    if (!src) { resolve(null); return; }
    const im = new Image();
    im.onload = function () { resolve(im); };
    im.onerror = function () { resolve(null); };
    im.src = src;
  });
}
