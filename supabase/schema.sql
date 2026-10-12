/* ==========================================================================
   宠物人格测评 · Supabase 数据库初始化脚本
   --------------------------------------------------------------------------
   用法：Supabase 控制台 → 左侧 SQL Editor → New query → 全文粘贴 → Run
   这个脚本可以重复执行，不会破坏已有数据。

   设计要点：
   1. 两张表 card_keys（卡密）与 results（测评结果）。
   2. 两张表都开启 RLS 且**不建任何 policy** —— 前端拿着 anon key 只能调用
      下面三个函数，无法直接 SELECT / INSERT / UPDATE，卡密表不会被拖库。
   3. 三个函数都是 SECURITY DEFINER，以函数所有者的权限执行，绕过 RLS，
      同时把业务规则（次数限制、字段白名单）收在数据库里，前端改不动。
   ========================================================================== */

-- ---------------------------------------------------------------------------
-- 0. 扩展（生成随机短链 id 用）
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------------
-- 1. 卡密表
-- ---------------------------------------------------------------------------
create table if not exists public.card_keys (
  code          text primary key,               -- 卡密，统一存大写
  max_uses      int         not null default 1, -- 可用次数（默认 1 次：一张卡密一次完整测评）
  used          int         not null default 0, -- 已用次数
  disabled      boolean     not null default false,
  note          text,                           -- 备注：批次、渠道、买家等
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

comment on table public.card_keys is '测评卡密，每张默认可测 1 次（一张卡密 = 一次完整测评）';

-- 扣次数的唯一时机：submit_result（答完最后一题、出结果页时）。
-- auth_card 只读校验、不扣次；答题中途退出、刷新、返回上一题都不消耗次数。


-- ---------------------------------------------------------------------------
-- 2. 结果表（分享短链的数据源）
-- ---------------------------------------------------------------------------
create table if not exists public.results (
  id          text primary key,                 -- 8 位短链 id
  payload     jsonb not null,                   -- 结果数据（字段已白名单过滤）
  created_at  timestamptz not null default now()
);

create index if not exists results_created_at_idx on public.results (created_at desc);

comment on table public.results is '测评结果，通过 ?r=<id> 只读分享';


-- ---------------------------------------------------------------------------
-- 3. 开启 RLS 且不建 policy —— 前端无法直接读写这两张表
-- ---------------------------------------------------------------------------
alter table public.card_keys enable row level security;
alter table public.results   enable row level security;


-- ---------------------------------------------------------------------------
-- 4. 校验卡密（不消耗次数）
-- ---------------------------------------------------------------------------
create or replace function public.auth_card(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row  public.card_keys;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', '请先输入卡密');
  end if;

  select * into v_row from public.card_keys where code = v_code;

  if not found then
    return jsonb_build_object('ok', false, 'error', '卡密不存在，请核对后重试或联系客服');
  end if;

  if v_row.disabled then
    return jsonb_build_object('ok', false, 'error', '该卡密已停用，请联系客服');
  end if;

  if v_row.used >= v_row.max_uses then
    return jsonb_build_object(
      'ok', false,
      'error', case when v_row.max_uses = 1
                    then '这张卡密的测评机会已用完，请联系客服'
                    else '这组卡密的 ' || v_row.max_uses || ' 次机会已用完，请联系客服'
               end
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'remaining', v_row.max_uses - v_row.used,
    'limit', v_row.max_uses
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- 5. 提交结果（消耗一次，写库 + 返回短链 id）
--    行锁 FOR UPDATE 保证同一张卡密并发提交时不会超用。
-- ---------------------------------------------------------------------------
create or replace function public.submit_result(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alpha text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  v_code  text := upper(trim(coalesce(p_code, '')));
  v_row   public.card_keys;
  v_id    text;
  v_slim  jsonb;
begin
  select * into v_row from public.card_keys where code = v_code for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '卡密不存在');
  end if;

  if v_row.disabled then
    return jsonb_build_object('ok', false, 'error', '该卡密已停用');
  end if;

  if v_row.used >= v_row.max_uses then
    return jsonb_build_object('ok', false, 'error', '次数已用完');
  end if;

  -- 字段白名单：前端传什么都只保留这些，防止塞入超大内容
  v_slim := jsonb_build_object(
    'r',  p_payload -> 'r',
    'p',  p_payload -> 'p',
    's',  p_payload -> 's',
    'sp', p_payload -> 'sp',
    'b',  p_payload -> 'b',
    'br', left(coalesce(p_payload ->> 'br', ''), 200),
    'd',  coalesce(p_payload -> 'd', '[]'::jsonb),
    'fp', p_payload -> 'fp',
    'fq', coalesce(p_payload -> 'fq', '0'::jsonb),
    'e',  p_payload -> 'e',
    'n',  p_payload -> 'n',
    'f',  p_payload -> 'f',
    'c',  p_payload -> 'c',
    't',  (extract(epoch from now()) * 1000)::bigint
  );

  -- 生成不与现有记录冲突的 8 位短链 id
  loop
    select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '' order by g)
      into v_id
      from generate_series(1, 8) as g;
    exit when not exists (select 1 from public.results where id = v_id);
  end loop;

  insert into public.results (id, payload) values (v_id, v_slim);

  update public.card_keys
     set used = used + 1,
         last_used_at = now()
   where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'remaining', v_row.max_uses - v_row.used - 1
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. 读取结果（分享链接使用，只读）
-- ---------------------------------------------------------------------------
create or replace function public.get_result(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select payload into v_payload
    from public.results
   where id = trim(coalesce(p_id, ''));

  if v_payload is null then
    return jsonb_build_object('ok', false, 'error', '结果不存在或已过期');
  end if;

  return jsonb_build_object('ok', true, 'payload', v_payload);
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. 权限：只把这三个函数开放给前端（anon），表本身一律不给
-- ---------------------------------------------------------------------------
revoke all on function public.auth_card(text)            from public, anon, authenticated;
revoke all on function public.submit_result(text, jsonb) from public, anon, authenticated;
revoke all on function public.get_result(text)           from public, anon, authenticated;

grant execute on function public.auth_card(text)            to anon, authenticated;
grant execute on function public.submit_result(text, jsonb) to anon, authenticated;
grant execute on function public.get_result(text)           to anon, authenticated;


/* ==========================================================================
   以下为「运维操作」，按需单独执行，不要每次都跑

   ── A. 把本地已有的 5 张示例卡密搬过来 ────────────────────────────────
   insert into public.card_keys (code, max_uses, note) values
     ('PET-001', 1, '示例卡密'),
     ('PET-002', 1, '示例卡密'),
     ('PET-003', 1, '示例卡密'),
     ('PET-004', 1, '示例卡密'),
     ('PET-005', 1, '示例卡密')
   on conflict (code) do nothing;

   ── B. 批量生成一批新卡密（8 位随机，字母表已去掉易混的 0/1/I/O）──────
   --   改开头三个值即可：生成多少张 / 每张能用几次 / 批次备注
   do $$
   declare
     v_count int  := 50;
     v_uses  int  := 1;
     v_batch text := '首发批次';
     v_alpha text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
     v_code  text;
     i       int;
   begin
     for i in 1..v_count loop
       loop
         select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '' order by g)
           into v_code
           from generate_series(1, 8) as g;
         v_code := 'PET-' || v_code;
         exit when not exists (select 1 from public.card_keys where code = v_code);
       end loop;
       insert into public.card_keys (code, max_uses, note) values (v_code, v_uses, v_batch);
     end loop;
   end $$;

   -- 紧接着列出这批卡密，右上角 Download CSV 可导出清单发给买家
   select code, max_uses, note
     from public.card_keys
    where note = '首发批次'
    order by created_at desc;

   ── C. 查看每张卡密的剩余次数 ────────────────────────────────────────
   select code,
          used,
          max_uses,
          max_uses - used as remaining,
          disabled,
          note,
          last_used_at
     from public.card_keys
    order by created_at desc;

   ── D. 给某位买家补次数 / 停用 ───────────────────────────────────────
   -- update public.card_keys set max_uses = max_uses + 1 where code = 'PET-XXXXXXXX';
   -- update public.card_keys set disabled = true          where code = 'PET-XXXXXXXX';

   ── E. 看看有多少人测过、都测出了什么 ────────────────────────────────
   select count(*)                                                as total,
          count(*) filter (where created_at > now() - interval '1 day') as today
     from public.results;

   select payload ->> 'r' as result_id, count(*) as hits
     from public.results
    group by 1
    order by hits desc;

   ── F. 把卡密改成「一张只能用一次」────────────────────────────────────
   -- 1) 改列默认值：以后新建的卡密默认就是 1 次
   -- alter table public.card_keys alter column max_uses set default 1;
   -- 2) 把库里已有的卡密也改成 1 次
   --    （已经用过 1 次以上的会因此变成「已用完」，等同于作废，这通常正是想要的效果）
   -- update public.card_keys set max_uses = 1;
   -- 3) 想连已用次数一起清零（谨慎，等于把作废的卡密重新激活）
   -- update public.card_keys set max_uses = 1, used = 0;
   ========================================================================== */
