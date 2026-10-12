/* ==========================================================================
   Supabase 配置
   --------------------------------------------------------------------------
   把下面两个值换成你自己的（Supabase 控制台 → Project Settings → API）：

     url      = Project URL         形如 https://abcdefghijk.supabase.co
     anonKey  = anon public 那一条   形如 eyJhbGciOiJIUzI1NiIsInR5cCI6...

   ⚠️ 只填 anon public key。绝对不要填 service_role key —— 那个 key 会
      绕过所有权限校验，而这个文件是公开托管的，等于把数据库钥匙贴在门上。

   anon key 本身就是设计成可以公开的：它能不能读到数据，完全由数据库里
   的 RLS 策略决定。本项目的 RLS 策略已经在 supabase/schema.sql 里配好，
   客户端无法直接读写任何一张表。

   两个值都留空时，网站会自动回退到本地 Node 服务（npm start 那种跑法），
   方便本地开发调试。
   ========================================================================== */
window.SUPABASE_CONFIG = {
  url: '',
  anonKey: ''
};
