/**
 * Supabase 接口层契约自测
 *
 *   用桩 fetch 把 js/api.js 跑起来，验证：
 *     - 配了 Supabase 时，请求发到 PostgREST 的 RPC 端点，带 apikey 头
 *     - 参数名与数据库函数签名一致（p_code / p_payload / p_id）
 *     - { ok:false } 的业务失败 → reject 且带 .biz（前端据此提示而不是放行）
 *     - 网络/HTTP 失败 → reject 且不带 .biz
 *     - 没配 Supabase 时回退到本地 /api/*
 *
 *   运行：node scripts/test-supabase-api.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const API_SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '   → ' + extra : '')); }
}

function makeFetcher(reply) {
  const calls = [];
  const fn = function (url, opts) {
    calls.push({ url: url, opts: opts || {} });
    const r = typeof reply === 'function' ? reply(url, opts, calls.length) : reply;
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: function () { return Promise.resolve(r.body == null ? '' : JSON.stringify(r.body)); }
    });
  };
  fn.calls = calls;
  return fn;
}

function loadApi(cfg, fetcher) {
  const sandbox = { console: console, fetch: fetcher };
  sandbox.window = { SUPABASE_CONFIG: cfg };
  vm.createContext(sandbox);
  vm.runInContext(API_SRC, sandbox);
  return sandbox.window.PetAPI;
}

const CFG = { url: 'https://demo1234.supabase.co/', anonKey: 'anon-key-abc' };

(async function () {
  /* ---------- 1. 模式识别 ---------- */
  console.log('\n[1] 模式识别');
  check('配置齐全 → supabase 模式', loadApi(CFG, makeFetcher({ status: 200, body: {} })).mode === 'supabase');
  check('配置为空 → local 模式', loadApi({ url: '', anonKey: '' }, makeFetcher({ status: 200, body: {} })).mode === 'local');
  check('只填 url → local 模式', loadApi({ url: CFG.url, anonKey: '' }, makeFetcher({ status: 200, body: {} })).mode === 'local');

  /* ---------- 2. auth 成功 ---------- */
  console.log('\n[2] auth_card 成功路径');
  let f = makeFetcher({ status: 200, body: { ok: true, remaining: 2, limit: 3 } });
  let api = loadApi(CFG, f);
  let res = await api.auth('PET-001');
  check('拿到 remaining', res.remaining === 2, JSON.stringify(res));
  check('URL 打到正确的 RPC 端点', f.calls[0].url === 'https://demo1234.supabase.co/rest/v1/rpc/auth_card', f.calls[0].url);
  check('URL 末尾斜杠已规整', f.calls[0].url.indexOf('.co//') < 0);
  check('带 apikey 头', f.calls[0].opts.headers.apikey === 'anon-key-abc');
  check('带 Authorization 头', f.calls[0].opts.headers.Authorization === 'Bearer anon-key-abc');
  check('方法为 POST', f.calls[0].opts.method === 'POST');
  check('参数名与函数签名一致 p_code', JSON.parse(f.calls[0].opts.body).p_code === 'PET-001', f.calls[0].opts.body);

  /* ---------- 3. auth 业务失败 ---------- */
  console.log('\n[3] auth_card 业务失败（卡密不存在 / 次数用完）');
  for (const msg of ['卡密不存在，请核对后重试或联系客服', '这组卡密的 3 次机会已用完，请联系客服']) {
    api = loadApi(CFG, makeFetcher({ status: 200, body: { ok: false, error: msg } }));
    let err = null;
    try { await api.auth('X'); } catch (e) { err = e; }
    check('reject 且带 .biz → ' + msg.slice(0, 8), err && err.biz === true && err.message === msg, err ? err.message : 'no error');
  }

  /* ---------- 4. 网络 / HTTP 失败 ---------- */
  console.log('\n[4] 网络与 HTTP 失败（不能带 .biz，前端据此区分）');
  api = loadApi(CFG, makeFetcher({ status: 500, body: { message: '数据库连接失败' } }));
  let e1 = null;
  try { await api.auth('X'); } catch (e) { e1 = e; }
  check('HTTP 500 透出 message', e1 && e1.message === '数据库连接失败', e1 && e1.message);
  check('HTTP 500 不带 .biz', e1 && !e1.biz);

  api = loadApi(CFG, function () { return Promise.reject(new TypeError('Failed to fetch')); });
  let e2 = null;
  try { await api.auth('X'); } catch (e) { e2 = e; }
  check('网络异常不带 .biz', e2 && !e2.biz, e2 && String(e2.message));

  /* ---------- 5. submit ---------- */
  console.log('\n[5] submit_result 参数契约');
  f = makeFetcher({ status: 200, body: { ok: true, id: 'Ab3xY9Kq', remaining: 1 } });
  api = loadApi(CFG, f);
  res = await api.submit('PET-001', { r: 6, p: 88, d: [20, 40, 10, 10, 20, 20, 10] });
  check('URL 正确', f.calls[0].url.endsWith('/rest/v1/rpc/submit_result'));
  const body = JSON.parse(f.calls[0].opts.body);
  check('参数名 p_code', body.p_code === 'PET-001');
  check('参数名 p_payload', body.p_payload && body.p_payload.r === 6, JSON.stringify(body));
  check('拿回短链 id', res.id === 'Ab3xY9Kq');
  check('拿回剩余次数', res.remaining === 1);

  /* ---------- 6. share ---------- */
  console.log('\n[6] get_result 参数契约');
  f = makeFetcher({ status: 200, body: { ok: true, payload: { r: 3, p: 93 } } });
  api = loadApi(CFG, f);
  res = await api.share('lrvI8dAL');
  check('URL 正确', f.calls[0].url.endsWith('/rest/v1/rpc/get_result'));
  check('参数名 p_id', JSON.parse(f.calls[0].opts.body).p_id === 'lrvI8dAL');
  check('拿回 payload', res.payload && res.payload.r === 3);

  /* ---------- 7. 本地回退 ---------- */
  console.log('\n[7] 未配置 Supabase 时回退本地服务');
  f = makeFetcher({ status: 200, body: { ok: true, remaining: 3, limit: 3 } });
  api = loadApi({ url: '', anonKey: '' }, f);
  await api.auth('PET-001');
  check('打到本地 /api/auth', f.calls[0].url === '/api/auth', f.calls[0].url);
  check('本地用 password 字段', JSON.parse(f.calls[0].opts.body).password === 'PET-001');
  check('本地不带 apikey 头', !f.calls[0].opts.headers.apikey);

  f = makeFetcher({ status: 200, body: { ok: true, payload: { r: 1 } } });
  api = loadApi({ url: '', anonKey: '' }, f);
  await api.share('a b&c');
  check('分享 id 做了 URL 编码', f.calls[0].url === '/api/share?id=a%20b%26c', f.calls[0].url);

  /* ---------- 8. 错误响应不是 JSON 也不能崩 ---------- */
  console.log('\n[8] 异常响应健壮性');
  const rawFetcher = function () {
    return Promise.resolve({ ok: false, status: 502, text: function () { return Promise.resolve('<html>Bad Gateway</html>'); } });
  };
  api = loadApi(CFG, rawFetcher);
  let e3 = null;
  try { await api.auth('X'); } catch (e) { e3 = e; }
  check('非 JSON 错误体降级为 HTTP 状态码提示', e3 && /502/.test(e3.message), e3 && e3.message);
  check('非 JSON 错误体不带 .biz', e3 && !e3.biz);

  /* ---------- 汇总 ---------- */
  console.log('\n' + '─'.repeat(52));
  console.log(fail === 0 ? ('全部通过：' + pass + '/' + (pass + fail)) : ('通过 ' + pass + '，失败 ' + fail));
  process.exit(fail === 0 ? 0 : 1);
})();
