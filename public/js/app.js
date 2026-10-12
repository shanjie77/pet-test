/* ============================================================
 * 主流程
 * ============================================================ */
(function () {
  'use strict';

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  const state = {
    password: '',
    remaining: null,
    answers: {},
    flow: [],
    idx: 0,
    match: null,
    card: null,
    cardData: null,
    readonly: false,
    shareUrl: '',
    nickname: ''
  };

  const EGG_BY_Q = { Q10: MID_EGGS[10], Q16: MID_EGGS[16], Q21: MID_EGGS[21] };

  /* ---------------- 工具 ---------------- */
  function show(id) {
    $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
    $('#' + id).classList.add('is-active');
    window.scrollTo(0, 0);
  }

  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, ms || 2000);
  }

  function eggToast(msg) {
    const t = $('#egg-toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 1800);
  }

  function openModal(title, bodyHtml, actions) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    const wrap = $('#modal-actions');
    wrap.innerHTML = '';
    (actions || [{ label: '我知道了', primary: false }]).forEach(function (a) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-line');
      b.textContent = a.label;
      b.onclick = function () {
        closeModal();
        if (a.onClick) a.onClick();
      };
      wrap.appendChild(b);
    });
    $('#modal-mask').hidden = false;
  }

  function closeModal() { $('#modal-mask').hidden = true; }
  $('#modal-mask').addEventListener('click', function (e) {
    if (e.target === $('#modal-mask')) closeModal();
  });

  /* 数据接口统一走 PetAPI（见 js/api.js）：
     线上部署打 Supabase，本地开发打 /api/*。 */
  const REMOTE = !!(window.PetAPI && window.PetAPI.isRemote);

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- 答题流构建 ---------------- */
  function rebuildFlow() {
    const flow = [];
    QUESTIONS.forEach(function (q) { if (q.part === 'gate') flow.push(q); });
    QUESTIONS.forEach(function (q) {
      if (q.part === 'conditional' && q.cond && q.cond(state.answers)) flow.push(q);
    });
    QUESTIONS.forEach(function (q) { if (q.part === 'score') flow.push(q); });
    QUESTIONS.forEach(function (q) { if (q.part === 'egg') flow.push(q); });
    state.flow = flow;
    if (state.idx > flow.length - 1) state.idx = flow.length - 1;
    if (state.idx < 0) state.idx = 0;
  }

  /* ---------------- 1. 密码门 ---------------- */
  $('#pw-btn').addEventListener('click', doUnlock);
  $('#pw-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doUnlock();
  });

  function doUnlock() {
    const pw = ($('#pw-input').value || '').trim();
    if (!pw) { $('#pw-hint').textContent = '请先输入卡密'; return; }
    $('#pw-btn').disabled = true;
    $('#pw-hint').textContent = '正在校验…';

    PetAPI.auth(pw).then(function (res) {
      state.password = pw;
      state.remaining = (typeof res.remaining === 'number') ? res.remaining : null;
      $('#pw-hint').textContent = '解锁成功';
      $('#intro-remaining').textContent = '剩余次数：' + (state.remaining == null ? '—' : state.remaining) + ' 次';
      show('view-intro');
    }).catch(function (err) {
      // 业务拒绝（卡密不存在 / 次数已用完）—— 直接提示，不放行
      if ((err && err.biz) || REMOTE) {
        $('#pw-hint').textContent = (err && err.message) || '卡密校验失败，请联系客服';
        return;
      }
      // 仅本地开发模式：服务没起时放行，方便直接双击 html 调试
      state.password = pw;
      state.remaining = null;
      $('#pw-hint').textContent = '解锁成功';
      $('#intro-remaining').textContent = '剩余次数：离线模式（不校验）';
      show('view-intro');
    }).then(function () {
      $('#pw-btn').disabled = false;
    });
  }

  /* ---------------- 2. 开始测评 ---------------- */
  $('#start-btn').addEventListener('click', function () {
    startQuiz();
  });

  function startQuiz() {
    state.answers = {};
    state.idx = 0;
    state.match = null;
    state.cardData = null;
    rebuildFlow();
    show('view-quiz');
    renderQuestion();
  }

  /* ---------------- 3. 答题 ---------------- */
  $('#q-back').addEventListener('click', function () {
    if (state.idx === 0) {
      if (state.readonly) return;
      show('view-intro');
      return;
    }
    state.idx -= 1;
    renderQuestion();
  });

  function renderQuestion() {
    const q = state.flow[state.idx];
    if (!q) return;

    const total = state.flow.length;
    const cur = state.idx + 1;
    $('#q-idx').textContent = cur + '/' + total;
    $('#q-bar').style.width = Math.round(cur / total * 100) + '%';

    let pt = PROGRESS_TEXT[0].text;
    PROGRESS_TEXT.forEach(function (p) { if (cur > p.at) pt = p.text; });
    if (cur >= total) pt = PROGRESS_TEXT[PROGRESS_TEXT.length - 1].text;
    $('#q-progress-text').textContent = pt;

    let partName = '生活情境题';
    if (q.part === 'gate') partName = '先说说你的现实条件';
    else if (q.part === 'egg') partName = '彩蛋环节 · 不计分';
    else if (q.part === 'conditional') partName = '家庭沟通题';
    $('#q-part').textContent = partName;
    $('#q-part').hidden = false;

    $('#q-text').textContent = q.text;

    const box = $('#q-options');
    box.innerHTML = '';
    q.options.forEach(function (opt, i) {
      const btn = document.createElement('button');
      btn.className = 'opt';
      const picked = state.answers[q.id] === i;
      if (picked) btn.classList.add('is-picked');
      btn.innerHTML = '<span class="key">' + 'ABCD'[i] + '</span><span>' + opt.label +
        (opt.note ? '<span class="opt-note">' + opt.note + '</span>' : '') + '</span>';
      btn.onclick = function () { pick(q, i); };
      box.appendChild(btn);
    });
  }

  function pick(q, i) {
    state.answers[q.id] = i;
    rebuildFlow();

    if (EGG_BY_Q[q.id]) eggToast(EGG_BY_Q[q.id]);

    // 若当前题已不在流中（条件题被移除），直接重绘
    const cur = state.flow[state.idx];
    if (!cur) { submit(); return; }

    if (state.idx >= state.flow.length - 1) {
      submit();
      return;
    }
    state.idx += 1;
    setTimeout(function () {
      renderQuestion();
    }, EGG_BY_Q[q.id] ? 700 : 120);
  }

  /* ---------------- 4. 提交计算 ---------------- */
  function submit() {
    show('view-loading');
    $('#loading-text').textContent = '正在把你和全国 24 种宠物做匹配…';

    setTimeout(function () {
      const dims = computeDims(state.answers);
      const m = runMatch(dims, state.answers);
      state.match = m;
      state.cardData = buildCardData(m);

      renderResult(state.cardData, false);
      show('view-result');

      // 上报结果（顺带消耗一次卡密）
      const payload = {
        r: m.main.id,
        p: m.mainPct,
        s: m.sub ? m.sub.id : null,
        sp: m.subPct,
        b: m.bad ? m.bad.id : null,
        br: m.badReason,
        d: DIM_KEYS.map(function (k) { return Math.round(dims[k] * 10); }),
        fp: m.futurePlan ? m.futurePlan.result.id : null,
        fq: m.futurePlan ? m.futurePlan.pct : 0,
        e: state.answers.Q22 || null,
        n: state.answers.Q23 || null,
        f: state.answers.Q24 || null,
        c: m.gate.forceCloud ? 1 : 0,
        t: Date.now()
      };

      PetAPI.submit(state.password, payload).then(function (res) {
        state.shareUrl = location.origin + location.pathname + '?r=' + res.id;
        if (typeof res.remaining === 'number') state.remaining = res.remaining;
        paintShareUrl();
      }).catch(function (err) {
        if (REMOTE) {
          // 线上模式不使用 ?d= 本地链接：那等于绕开卡密校验，链接一旦传开就是免费无限次
          state.shareUrl = null;
          paintShareUrl();
          toast((err && err.biz)
            ? (err.message + '（本次结果可正常查看，但无法生成分享链接）')
            : '云端保存失败，分享链接暂时不可用，请稍后重试', 3200);
        } else {
          // 本地开发模式：把结果编码进链接，方便离线调试
          state.shareUrl = location.origin + location.pathname + '?d=' + encodePayload(payload);
          paintShareUrl();
        }
      });
    }, 1200);
  }

  function buildCardData(m) {
    const r = m.main;
    const nickStyle = state.answers.Q23 || 'A';
    const names = NICKNAMES[nickStyle] || NICKNAMES.A;
    if (!state.nickname || names.indexOf(state.nickname) < 0) {
      state.nickname = names[Math.floor(Math.random() * names.length)];
    }
    return {
      date: todayStr(),
      title: r.title,
      species: r.species,
      emoji: r.emoji,
      img: 'img/pets/pet-' + r.id + '.png',
      signature: r.signature,
      pct: m.mainPct,
      isCloud: !!r.isCloud,
      dims: m.dims,
      why: r.why,
      ledger: r.ledger,
      avoid: r.avoid,
      legal: r.legal,
      quote: r.quote,
      knowledge: r.knowledge,
      nick: state.nickname,
      nickList: names,
      nickStyle: nickStyle,
      moment: MOMENTS[state.answers.Q24] || null,
      sub: m.sub ? { species: m.sub.species, title: m.sub.title, pct: m.subPct } : null,
      futurePlan: m.futurePlan ? { species: m.futurePlan.result.species, title: m.futurePlan.result.title, pct: m.futurePlan.pct } : null,
      bad: m.bad ? { species: m.bad.species, reason: m.badReason } : null,
      gateNotes: m.gate.notes,
      legalWarn: m.gate.legalWarn,
      conflictTexts: m.gate.conflicts.map(function (c) { return c.text; }),
      resultId: r.id
    };
  }

  /* ---------------- 5. 结果页渲染 ---------------- */
  function starOf(v) {
    const n = Math.max(1, Math.min(5, Math.round(v / 4 * 5)));
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderResult(c, readonly) {
    const html = [];
    state.card = c;

    html.push('<div class="r-hero">');
    html.push('<div class="r-mascot"><img src="' + esc(c.img) + '" alt="' + esc(c.species) + ' 卡通形象" onerror="this.style.display=\'none\'"></div>');
    html.push('<div class="r-eyebrow">我的宠物人格是</div>');
    html.push('<div class="r-title">' + esc(c.title) + '</div>');
    html.push('<div class="r-species">' + c.emoji + ' ' + esc(c.species) + '</div>');
    html.push('<div class="r-badges">');
    if (c.isCloud) {
      html.push('<span class="pill warn">系统建议：先云养一段时间</span>');
    } else {
      html.push('<span class="pill">匹配度 ' + c.pct + '%</span>');
    }
    if (c.sub) html.push('<span class="pill green">第二顺位：' + esc(c.sub.species) + '</span>');
    html.push('</div>');
    html.push('<div class="r-quote">' + esc(c.signature) + '</div>');
    html.push('</div>');

    // 门槛提示
    if (c.conflictTexts.length) {
      html.push('<div class="sec"><div class="sec-card warn"><b>你的现实条件已生效：</b><br>' +
        c.conflictTexts.map(function (t) { return '· ' + esc(t); }).join('<br>') +
        '<br><span style="font-size:13px;color:var(--muted)">以上条件已用于排除不适合你的物种。</span></div></div>');
    }
    if (c.gateNotes && c.gateNotes.length) {
      html.push('<div class="sec"><div class="sec-title">📌 想提醒你一件事</div><div class="sec-card">' +
        c.gateNotes.map(function (t) { return esc(t); }).join('<br><br>') + '</div></div>');
    }

    // 维度
    if (!c.isCloud) {
      const rows = DIM_KEYS.map(function (k, i) {
        const v = c.dims[k];
        return '<div class="dim-row"><span class="k">' + DIM_NAMES[i] + '</span>' +
          '<span class="track"><i style="width:' + Math.round(v / 4 * 100) + '%"></i></span>' +
          '<span class="v">' + starOf(v) + '</span></div>';
      }).join('');
      html.push('<div class="sec"><div class="sec-title">📊 你的七个维度</div><div class="sec-card">' + rows + '</div></div>');
    }

    html.push('<div class="sec"><div class="sec-title">🧠 为什么是你</div><div class="sec-card">' + esc(c.why) + '</div></div>');

    html.push('<div class="sec"><div class="sec-title">💰 现实账本（先看这个再做决定）</div><div class="sec-card"><ul>' +
      c.ledger.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div></div>');

    html.push('<div class="sec"><div class="sec-title">⚠️ 避坑提示</div><div class="sec-card warn">' + esc(c.avoid) + '</div></div>');

    if (c.legal) {
      html.push('<div class="sec"><div class="sec-title">⚖️ 合法来源提示</div><div class="sec-card warn">' + esc(c.legal) + '</div></div>');
    }

    // 它想说的话 + 朋友圈
    html.push('<div class="sec"><div class="sec-title">💬 它想对你说的一句话</div>' +
      '<div class="sec-card"><div style="font-size:17px;font-weight:700;color:var(--ink)">“' + esc(c.quote) + '”</div></div>');
    if (c.moment) {
      html.push('<div class="moment"><div class="who"><img class="ava" src="' + esc(c.img) + '" alt="" onerror="this.style.display=\'none\'">' + esc(c.species) + ' 的朋友圈</div>' +
        '<div class="txt">' + esc(c.moment.text) + '</div>' +
        '<div class="sub">' + esc(c.moment.sub) + '</div></div>');
    }
    html.push('</div>');

    html.push('<div class="sec"><div class="sec-title">📖 你会学到的一个冷知识</div><div class="sec-card">' + esc(c.knowledge) + '</div></div>');

    // 昵称
    html.push('<div class="sec"><div class="sec-title">🏷️ 给它取个名字吧</div><div class="sec-card">' +
      '<div class="nick-box" id="nick-box">' +
      c.nickList.map(function (n) {
        return '<span class="nick-chip"' + (n === c.nick ? ' style="background:var(--amber);color:#fff"' : '') + '>' + esc(n) + '</span>';
      }).join('') +
      '</div><div><button class="link-btn" id="nick-shuffle">换一批 →</button></div></div></div>');

    // 反向提示
    if (c.bad) {
      html.push('<div class="sec"><div class="sec-title">🚫 反向提示</div><div class="sec-card warn">' +
        '你最不适合养的是「' + esc(c.bad.species) + '」——因为' + esc(c.bad.reason) + '</div></div>');
    }

    // 副结果
    if (c.sub) {
      html.push('<div class="sec"><div class="sec-title">🌱 你的第二顺位</div><div class="sec-card green">' +
        '如果未来你的生活状态变了，「' + esc(c.sub.species) + '（' + esc(c.sub.title) + '）」会是你的第二选择，匹配度 ' + c.sub.pct + '%。' +
        '</div></div>');
    }

    // 未来准备清单（触发云吸时保留）
    if (c.futurePlan) {
      html.push('<div class="sec"><div class="sec-title">📋 等条件成熟了再说</div><div class="sec-card green">' +
        '如果按你现在的生活方式去匹配，最接近你的是「' + esc(c.futurePlan.species) + '（' + esc(c.futurePlan.title) + '）」，匹配度 ' + c.futurePlan.pct + '%。' +
        '<br>但它需要的前提你现在还不具备——先把上面那几条现实条件解决掉，再来看它。</div></div>');
    }

    // 慎选清单
    html.push('<div class="sec"><div class="sec-title">🧨 慎选清单：美貌陷阱与法律红线</div>');
    AVOID_LIST.forEach(function (a) {
      html.push('<div class="avoid-item"><div class="n' + (a.legal ? ' legal' : '') + '">' +
        (a.legal ? '⚠ ' : '') + esc(a.name) + '</div>' +
        '<div class="d">网上看到的样子：' + esc(a.net) + '<br>真实的样子：' + esc(a.real) + '<br>' +
        (a.legal ? '<b style="color:var(--warn)">' : '') + esc(a.why) + (a.legal ? '</b>' : '') + '</div></div>');
    });
    html.push('</div>');

    html.push('<div class="legal-strip">本测评推荐的所有物种均须为<b>人工繁育或家养</b>来源。中国本土野生动物受《野生动物保护法》保护，捕捉、买卖、饲养均违法。本测评为趣味生活方式匹配工具，不构成医学、兽医或心理学诊断建议。</div>');

    // 操作区
    html.push('<div class="r-actions">');
    html.push('<button class="btn btn-primary btn-block" id="act-save">保存测试结果（生成图片）</button>');
    html.push('<button class="btn btn-ghost btn-block" id="act-share">复制结果链接，分享给别人</button>');
    html.push('<div class="row">');
    if (readonly) {
      html.push('<button class="btn btn-line" id="act-again">我也要测一份</button>');
    } else {
      html.push('<button class="btn btn-line" id="act-again">再测一次</button>');
    }
    html.push('<button class="btn btn-line" id="act-review">好评有礼</button>');
    html.push('</div>');
    html.push('</div>');

    html.push('<div class="share-panel" id="share-panel"><textarea class="share-link" id="share-link" readonly></textarea>' +
      '<button class="btn btn-primary btn-block" id="act-copy">复制链接</button></div>');

    $('#result-body').innerHTML = html.join('');
    $('#shared-banner').hidden = !readonly;

    bindResultEvents(readonly);
    paintShareUrl();
  }

  function bindResultEvents(readonly) {
    const shuffle = $('#nick-shuffle');
    if (shuffle) {
      shuffle.onclick = function () {
        const names = state.card.nickList;
        let next = names[Math.floor(Math.random() * names.length)];
        if (names.length > 1) {
          while (next === state.card.nick) next = names[Math.floor(Math.random() * names.length)];
        }
        state.card.nick = next;
        state.nickname = next;
        renderResult(state.card, readonly);
      };
    }

    $('#act-save').onclick = doSaveImage;

    $('#act-share').onclick = function () {
      const panel = $('#share-panel');
      panel.classList.add('is-open');
      if (!state.shareUrl) {
        toast('链接生成中，请稍候一秒再点');
        return;
      }
      paintShareUrl();
      toast('链接已生成，点下方按钮复制');
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    $('#act-copy').onclick = function () {
      const val = state.shareUrl;
      if (!val) { toast('链接还没生成好'); return; }
      copyText(val).then(function () { toast('链接已复制，快去分享吧'); });
    };

    $('#act-again').onclick = function () {
      if (readonly) {
        show('view-lock');
        $('#pw-input').value = '';
        $('#pw-hint').textContent = '每组卡密可测评 3 次，请勿外传';
        return;
      }
      if (typeof state.remaining === 'number' && state.remaining <= 0) {
        openModal('次数已用完', '<p>本组卡密的 3 次测评机会已经用完啦。</p>' +
          '<div class="step">想再测一次，或者分享给朋友一起测，可以在店铺下单获取新的卡密。</div>' +
          '<p style="color:var(--muted);font-size:13.5px">如果你觉得这个测评有帮助，也欢迎给个好评支持一下 🌿</p>',
          [{ label: '我知道了', primary: true }]);
        return;
      }
      openModal('要再测一次吗？', '<p>再测一次会重新开始 30 道题，并且会消耗一次测评机会。</p>' +
        '<div class="step">当前剩余次数：<b>' + (state.remaining == null ? '离线模式' : state.remaining + ' 次') + '</b></div>',
        [
          { label: '开始新的测评', primary: true, onClick: function () { startQuiz(); } },
          { label: '先不用了', primary: false }
        ]);
    };

    $('#act-review').onclick = function () {
      openModal('好评有礼 🎁',
        '<p>如果你觉得这个测评有点意思、也确实有点用，欢迎帮我们点个好评 🙏</p>' +
        '<div class="step"><b>第 1 步</b>　在店铺里给出好评（15 字以上并附截图）</div>' +
        '<div class="step"><b>第 2 步</b>　把好评截图发送给客服</div>' +
        '<div class="step"><b>第 3 步</b>　客服核验通过后，立返 <span class="hl">1 元</span> 现金</div>' +
        '<p style="color:var(--muted);font-size:13.5px;margin-top:12px">同一订单限一次；返现一般在核验后 24 小时内到账。谢谢你的支持，这是我们继续更新的动力 🌿</p>',
        [{ label: '好，这就去', primary: true }, { label: '稍后再说', primary: false }]);
    };
  }

  function paintShareUrl() {
    const el = $('#share-link');
    if (el) el.value = state.shareUrl || '（分享链接暂时不可用，请稍后重试）';
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      resolve();
    });
  }

  /* ---------------- 6. 保存长图 ---------------- */
  function doSaveImage() {
    toast('正在生成图片…', 1800);
    loadPetImage(state.card.img).then(function (imgEl) {
      const card = Object.assign({}, state.card, { imgEl: imgEl });
      setTimeout(function () {
      let canvas;
      try {
        canvas = renderResultCanvas(card);
      } catch (e) {
        openModal('生成失败', '<p>图片生成出错了，你可以先截图保存结果页，或稍后再试一次。</p>' +
          '<p style="color:var(--muted);font-size:13px">错误信息：' + esc(e.message) + '</p>',
          [{ label: '我知道了', primary: true }]);
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');

      canvasToBlob(canvas, function (blob) {
        const url = URL.createObjectURL(blob);
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

        let body = '<div class="share-img-wrap"><img src="' + dataUrl + '" alt="测评结果长图">';
        body += '<p class="tip">' + (isMobile ? '长按上方图片 → 保存到相册' : '点击下方按钮保存到电脑') + '</p>';
        body += '<a class="btn btn-primary btn-block" href="' + url + '" download="宠物人格测评-' + state.card.title + '.png" style="text-decoration:none;display:block;text-align:center">下载图片</a>';
        body += '<p class="tip" style="margin-top:14px">如果长按没有出现"保存图片"，可以先截图，或在电脑端浏览器打开本链接保存。</p></div>';

        openModal('保存到相册', body, [{ label: '完成', primary: false }]);
      });
      }, 60);
    });
  }

  /* ---------------- 7. 分享结果读取 ---------------- */
  function boot() {
    const params = new URLSearchParams(location.search);
    const rid = params.get('r');
    const raw = params.get('d');

    if (rid) {
      PetAPI.share(rid)
        .then(function (j) {
          renderFromPayload(j.payload, true);
        })
        .catch(function (e) {
          openModal('结果加载失败', '<p>这份结果可能已经过期了。</p>' +
            '<p style="color:var(--muted);font-size:13px">' + esc(e.message || '') + '</p>',
            [{ label: '我也要测一份', primary: true, onClick: function () { show('view-lock'); } }]);
        });
      return;
    }

    // ?d= 是本地开发模式的离线链接；线上模式不认，避免绕开卡密校验
    if (raw && !REMOTE) {
      try {
        renderFromPayload(decodePayload(raw), true);
      } catch (e) {
        show('view-lock');
      }
    }
  }

  function renderFromPayload(p, readonly) {
    const dims = {};
    DIM_KEYS.forEach(function (k, i) { dims[k] = p.d[i] / 10; });

    const main = RESULTS.filter(function (r) { return r.id === p.r; })[0] || RESULTS[0];
    const sub = p.s ? (RESULTS.filter(function (r) { return r.id === p.s; })[0] || null) : null;
    const bad = p.b ? (RESULTS.filter(function (r) { return r.id === p.b; })[0] || null) : null;
    const fp = p.fp ? (RESULTS.filter(function (r) { return r.id === p.fp; })[0] || null) : null;

    const nickStyle = p.n || 'A';
    const names = NICKNAMES[nickStyle] || NICKNAMES.A;

    const c = {
      date: todayStr(),
      title: main.title,
      species: main.species,
      emoji: main.emoji,
      img: 'img/pets/pet-' + main.id + '.png',
      signature: main.signature,
      pct: p.p,
      isCloud: !!main.isCloud,
      dims: dims,
      why: main.why,
      ledger: main.ledger,
      avoid: main.avoid,
      legal: main.legal,
      quote: main.quote,
      knowledge: main.knowledge,
      nick: names[0],
      nickList: names,
      nickStyle: nickStyle,
      moment: MOMENTS[p.f] || null,
      sub: sub ? { species: sub.species, title: sub.title, pct: p.sp } : null,
      futurePlan: fp ? { species: fp.species, title: fp.title, pct: p.fq || 0 } : null,
      bad: bad ? { species: bad.species, reason: p.br || '' } : null,
      gateNotes: [],
      legalWarn: false,
      conflictTexts: [],
      resultId: main.id
    };

    state.card = c;
    state.shareUrl = location.href;
    renderResult(c, true);
    show('view-result');
  }

  boot();
})();
