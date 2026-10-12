/**
 * 宠物人格测评 · 零依赖服务端
 * 只使用 Node 内置模块，不需要 npm install。
 *
 *   node server.js
 *   PORT=5173 HOST=127.0.0.1 node server.js
 *
 * 接口：
 *   POST /api/auth    { password }               → { ok, remaining }
 *   POST /api/submit  { password, payload }       → { ok, id, remaining }   （消耗一次）
 *   GET  /api/share?id=xxx                        → { ok, payload }
 *   GET  /api/ping                                → { ok, ts }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PW_FILE = path.join(DATA_DIR, 'passwords.json');
const SHARE_FILE = path.join(DATA_DIR, 'shares.json');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';

/* ---------------- 数据读写（带内存缓存 + 简单串行写） ---------------- */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureDefaultPasswords() {
  ensureDataDir();
  if (fs.existsSync(PW_FILE)) return;
  const samples = [];
  for (let i = 1; i <= 5; i++) {
    samples.push({
      code: 'PET-' + String(i).padStart(3, '0'),
      limit: 3,
      used: 0,
      note: '示例卡密，可自行删除'
    });
  }
  writeJSON(PW_FILE, { passwords: samples });
  console.log('[init] 已生成示例卡密文件 data/passwords.json（示例码：PET-001 ~ PET-005）');
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

let writeQueue = Promise.resolve();
function writeJSON(file, obj) {
  ensureDataDir();
  const tmp = file + '.tmp';
  const data = JSON.stringify(obj, null, 2);
  writeQueue = writeQueue.then(function () {
    return new Promise(function (resolve) {
      fs.writeFile(tmp, data, 'utf8', function () {
        fs.rename(tmp, file, function () { resolve(); });
      });
    });
  });
  return writeQueue;
}

ensureDefaultPasswords();

/* ---------------- 工具 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > (limit || 256 * 1024)) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('请求格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function newId() {
  return crypto.randomBytes(6).toString('base64')
    .replace(/\+/g, 'A').replace(/\//g, 'B').replace(/=/g, '')
    .slice(0, 8);
}

/* ---------------- 静态文件 ---------------- */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[\/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, function (err, st) {
    if (err || !st.isFile()) {
      // SPA 兜底
      const index = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(index, function (e2, buf) {
        if (e2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, function (e3, buf) {
      if (e3) { res.writeHead(500); res.end('Read error'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
        'Content-Length': buf.length
      });
      res.end(buf);
    });
  });
}

/* ---------------- 业务接口 ---------------- */
function findPassword(db, code) {
  if (!db || !Array.isArray(db.passwords)) return null;
  const key = String(code || '').trim();
  for (let i = 0; i < db.passwords.length; i++) {
    if (String(db.passwords[i].code).trim() === key) return db.passwords[i];
  }
  return null;
}

function handleAuth(req, res) {
  readBody(req).then(function (body) {
    const db = readJSON(PW_FILE, { passwords: [] });
    const rec = findPassword(db, body.password);
    if (!rec) return sendJSON(res, 200, { ok: false, error: '卡密不存在，请核对后重试或联系客服' });
    if (rec.used >= rec.limit) {
      return sendJSON(res, 200, { ok: false, error: '这组卡密的 ' + rec.limit + ' 次机会已用完，请联系客服' });
    }
    return sendJSON(res, 200, { ok: true, remaining: rec.limit - rec.used, limit: rec.limit });
  }).catch(function (e) {
    sendJSON(res, 400, { ok: false, error: e.message });
  });
}

function handleSubmit(req, res) {
  readBody(req).then(function (body) {
    const db = readJSON(PW_FILE, { passwords: [] });
    const rec = findPassword(db, body.password);
    if (!rec) return sendJSON(res, 200, { ok: false, error: '卡密不存在' });
    if (rec.used >= rec.limit) {
      return sendJSON(res, 200, { ok: false, error: '次数已用完' });
    }

    const payload = body.payload || {};
    // 只保留必要字段，避免被塞入超大内容
    const slim = {
      r: payload.r, p: payload.p, s: payload.s, sp: payload.sp,
      b: payload.b, br: String(payload.br || '').slice(0, 200),
      d: Array.isArray(payload.d) ? payload.d.slice(0, 7) : [],
      fp: payload.fp || null, fq: payload.fq || 0,
      e: payload.e, n: payload.n, f: payload.f, c: payload.c, t: Date.now()
    };

    const id = newId();
    const store = readJSON(SHARE_FILE, {});
    store[id] = slim;

    // 只保留最近 5000 条
    const keys = Object.keys(store);
    if (keys.length > 5000) {
      keys.sort(function (a, b) { return (store[a].t || 0) - (store[b].t || 0); });
      for (let i = 0; i < keys.length - 5000; i++) delete store[keys[i]];
    }

    rec.used += 1;
    writeJSON(PW_FILE, db).then(function () {
      return writeJSON(SHARE_FILE, store);
    }).then(function () {
      sendJSON(res, 200, { ok: true, id: id, remaining: rec.limit - rec.used });
    });
  }).catch(function (e) {
    sendJSON(res, 400, { ok: false, error: e.message });
  });
}

function handleShare(req, res, query) {
  const id = query.get('id');
  if (!id) return sendJSON(res, 400, { ok: false, error: '缺少 id' });
  const store = readJSON(SHARE_FILE, {});
  const payload = store[id];
  if (!payload) return sendJSON(res, 404, { ok: false, error: '结果不存在或已过期' });
  return sendJSON(res, 200, { ok: true, payload: payload });
}

/* ---------------- 启动 ---------------- */
const server = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = u.pathname;

  if (p === '/api/ping') return sendJSON(res, 200, { ok: true, ts: Date.now() });
  if (p === '/api/auth' && req.method === 'POST') return handleAuth(req, res);
  if (p === '/api/submit' && req.method === 'POST') return handleSubmit(req, res);
  if (p === '/api/share' && req.method === 'GET') return handleShare(req, res, u.searchParams);

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, req.url);

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, HOST, function () {
  console.log('');
  console.log('  宠物人格测评已启动');
  console.log('  本地地址：http://' + HOST + ':' + PORT);
  console.log('  管理卡密：' + PW_FILE);
  console.log('  分享数据：' + SHARE_FILE);
  console.log('');
});

process.on('uncaughtException', function (e) {
  console.error('[error]', e && e.message);
});
