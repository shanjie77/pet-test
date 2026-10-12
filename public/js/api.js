/* ==========================================================================
   数据接口层
   --------------------------------------------------------------------------
   两种运行模式，前端自动选择，业务代码不需要关心：

     1. Supabase 模式 —— config.js 里填了 url + anonKey 时启用
        （GitHub Pages / 线上部署走这一种，数据存在 Supabase 云端）
     2. 本地模式 —— 没配置时回退到项目自带的 Node 服务 /api/*
        （npm start 本地开发走这一种，数据存在 data/*.json）

   对外暴露三个方法，全部返回 Promise：

     PetAPI.auth(code)             → { remaining, limit }
     PetAPI.submit(code, payload)  → { id, remaining }
     PetAPI.share(id)              → payload

   错误约定：业务失败（卡密不存在、次数用完）reject 的 Error 带 .biz = true，
   网络/服务失败不带该标记。调用方据此区分「业务拒绝」与「连不上服务」，
   线上模式下不会因为连不上就放行。
   ========================================================================== */
(function (global) {
  'use strict';

  var CFG = global.SUPABASE_CONFIG || {};
  var BASE = String(CFG.url || '').replace(/\/+$/, '');
  var KEY = String(CFG.anonKey || '').trim();
  var REMOTE = !!(BASE && KEY);

  function bizError(msg) {
    var e = new Error(msg || '操作失败');
    e.biz = true;
    return e;
  }

  function parse(res) {
    return res.text().then(function (txt) {
      var data = null;
      if (txt) { try { data = JSON.parse(txt); } catch (e) { data = null; } }
      return { res: res, data: data };
    });
  }

  /* Supabase REST：直接打 PostgREST 的 RPC 端点，不引 supabase-js */
  function rpc(fn, args) {
    return fetch(BASE + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify(args || {})
    }).then(parse).then(function (o) {
      if (!o.res.ok) {
        var msg = (o.data && (o.data.message || o.data.hint || o.data.error)) || ('服务异常（HTTP ' + o.res.status + '）');
        throw new Error(msg);
      }
      return o.data;
    });
  }

  function postLocal(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(parse).then(function (o) {
      if (!o.res.ok) throw new Error((o.data && o.data.error) || '请求失败');
      return o.data || {};
    });
  }

  function getLocal(path) {
    return fetch(path).then(parse).then(function (o) {
      if (!o.res.ok) throw new Error((o.data && o.data.error) || '请求失败');
      return o.data || {};
    });
  }

  /* 后端统一用 { ok, error } 表达业务结果，这里把它翻译成 reject */
  function expectOk(data) {
    if (!data || data.ok !== true) {
      throw bizError((data && data.error) || '操作失败，请稍后重试');
    }
    return data;
  }

  var PetAPI = {
    mode: REMOTE ? 'supabase' : 'local',
    isRemote: REMOTE,

    auth: function (code) {
      return (REMOTE
        ? rpc('auth_card', { p_code: code })
        : postLocal('/api/auth', { password: code })
      ).then(expectOk);
    },

    submit: function (code, payload) {
      return (REMOTE
        ? rpc('submit_result', { p_code: code, p_payload: payload })
        : postLocal('/api/submit', { password: code, payload: payload })
      ).then(expectOk);
    },

    share: function (id) {
      return (REMOTE
        ? rpc('get_result', { p_id: id })
        : getLocal('/api/share?id=' + encodeURIComponent(id))
      ).then(expectOk);
    }
  };

  global.PetAPI = PetAPI;
})(window);
