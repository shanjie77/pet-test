# 部署指南 · GitHub Pages + Supabase

目标：网站有一个固定的网址，手机、电脑随时打开都能用，卡密次数在云端统一记账。

最终架构：

```
   用户浏览器
       │
       ├── 打开网页 ──→ GitHub Pages（只托管静态文件：html/css/js/图片）
       │                    纯静态，全球 CDN，免费，无服务器
       │
       └── 校验卡密 / 保存结果 / 读取分享 ──→ Supabase（Postgres 数据库 + REST 接口）
                            免费额度足够小体量售卖
```

需要两个账号，都支持免费注册：**GitHub**（放网站）和 **Supabase**（放数据）。

---

## 一、Supabase：建库

### 1. 注册并新建项目

1. 打开 <https://supabase.com> → `Start your project` → 用 GitHub 或邮箱注册
2. 进入控制台 → `New project`
   - **Name**：`pet-test`（随意）
   - **Database Password**：点 `Generate a password`，**把密码存到密码管理器**（后面几乎用不到，但别丢）
   - **Region**：选 **Southeast Asia (Singapore)** —— 国内访问延迟最低
   - **Pricing Plan**：Free
3. 点 `Create new project`，等 1–2 分钟初始化

### 2. 建表与函数

1. 左侧菜单 → `SQL Editor` → `New query`
2. 打开本项目的 `supabase/schema.sql`，**全文复制粘贴**进编辑器
3. 点右下角 `Run`（或 Ctrl+Enter）

成功的话会显示 `Success. No rows returned`。

> 这一步做了两件事：建 `card_keys`（卡密）和 `results`（测评结果）两张表，
> 并开启 RLS 且**不建任何 policy**、把业务逻辑收进三个 `SECURITY DEFINER` 函数。
> 结果是：前端拿着 anon key 也没法直接读表，卡密列表不会被拖走。

### 3. 导入卡密

在上一步的 SQL Editor 里**新开一个 query**，把本文档 [第五章 · 1. 新增卡密](#1-新增卡密)
那段 SQL 整段粘进去跑一遍即可。

它会在库里生成一批随机卡密（`PET-` + 8 位，字母表已去掉易混的 `0` `1` `I` `O`），
**默认每张只能用 1 次**，也就是一张卡密换一次完整测评。改 SQL 开头三个值就能调整
张数、每张次数和批次备注。生成后直接点结果表右上角的 `Download CSV` 导出成清单。

> **重要**：正式售卖请务必用随机卡密，不要用 `PET-001` 这种连号 ——
> 校验函数是公开可调的，连号别人从 `001` 枚举到 `099` 就白嫖了。

### 4. 抄走两个值

左侧 → `Project Settings`（齿轮）→ `API`，复制这两个：

| 界面上的名字 | 对应 config.js 字段 |
|---|---|
| **Project URL** | `url` |
| **anon / public** 那条 key | `anonKey` |

> ⚠️ 只抄 `anon public`。**不要**抄 `service_role` —— 它能绕过全部权限，
> 而 `config.js` 是公开文件，等于把数据库钥匙贴在门上。

---

## 二、填配置

编辑 `public/js/config.js`：

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdefghijk.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

保存后本地刷新页面，浏览器控制台执行 `PetAPI.mode`，
返回 `"supabase"` 就说明切到云端模式了（`"local"` 表示配置没生效）。

> `url` 末尾有没有 `/` 都行，代码会自动规整。

---

## 三、GitHub：放网站

### 1. 注册并建仓库

1. 打开 <https://github.com> 注册 / 登录
2. 右上角 `+` → `New repository`
   - **Repository name**：`pet-test`（随意，会出现在网址里）
   - **Visibility**：必须选 **Public**
     > 免费账号的 GitHub Pages 只支持公开仓库。
     > 不用担心里面的东西泄露——卡密在 Supabase，`data/` 已被 `.gitignore` 排除，
     > 仓库里只有前端代码和图片，本来就是公开可见的。
   - **不要**勾选 `Add a README file`（本地已有）
3. 点 `Create repository`

### 2. 推送代码

在 `pet-test-site` 目录下执行（把 `你的用户名` 换成实际用户名）：

```bash
git remote add origin https://github.com/你的用户名/pet-test.git
git push -u origin main
```

首次推送会弹出浏览器让你登录 GitHub，登录一次即可，之后不用再登。

### 3. 打开 Pages

1. 仓库页 → `Settings` → 左侧 `Pages`
2. **Source** 选 **`GitHub Actions`**（不是 `Deploy from a branch`）
3. 回到仓库 `Actions` 标签，能看到 `Deploy to GitHub Pages` 在工作
4. 等 1–2 分钟，变成绿色对勾后，网址就是：

```
https://你的用户名.github.io/pet-test/
```

> 只有 `public/` 目录会被发布到线上，`server.js`、`data/` 等不会出现在网站里。

### 4. 以后怎么更新

改完代码只要推一次：

```bash
git add -A && git commit -m "更新说明" && git push
```

GitHub 会自动重新部署，1 分钟左右生效。**不需要**手动上传任何文件。

---

## 四、上线后验证

打开网址，依次确认：

1. 输错卡密 → 提示"卡密不存在"（不是放行进入）
2. 输对的卡密 → 进入说明页，显示"剩余次数：1 次"
3. 答完 30 题 → 出结果页，**卡通形象正常显示**
4. 点"保存测试结果" → 生成一张长图，移动端可长按存相册
5. 点"复制结果链接" → 新开无痕窗口打开该链接 → 能只读看到同一份结果
6. **刷新结果页 → 仍能回到同一份结果**（地址栏此时已自动带上 `?r=xxxx`），
   昵称与交卷时一致。卡密是有限次的，这一条必须成立，否则用户刷新一下就白测了
7. 回 Supabase → `Table Editor` → `card_keys`，该卡密的 `used` 变成了 1

---

## 五、日常运维

### 0. 先进到 SQL Editor

1. 打开 <https://supabase.com/dashboard>，登录你自己的账号
2. 在项目列表里点进 **pet-test** 这个项目
3. 左侧竖排图标里找 **`SQL Editor`**（图标长得像个 `>_` 终端窗口），点它
4. 点 **`New query`**（右上角），把下面的 SQL 粘进去
5. 按 **`Ctrl + Enter`**（或点右下角 `Run`）执行

> 不想记路径的话，直接开这个链接会跳到你的项目：
> <https://supabase.com/dashboard/project/hmzwlraakrgtwgokbftp>
> 进去后照样点左侧的 `SQL Editor`。

### 1. 新增卡密

**一次生成一批（推荐）**——改开头三行数字就行：

```sql
do $$
declare
  v_count int  := 50;          -- 生成多少张
  v_uses  int  := 1;           -- 每张能用几次（1 = 一张卡密换一次完整测评）
  v_batch text := '首发批次';   -- 备注：渠道 / 批次 / 买家
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

select code, max_uses, note
  from public.card_keys
 where note = '首发批次'
 order by created_at desc;
```

结果表格出来后，右上角有 `Download CSV` 可以把卡密清单导出成表格发给买家。

**只加一张指定的**（比如给老客户定制）：

```sql
insert into public.card_keys (code, max_uses, note)
values ('PET-VIP001', 5, '老客户赠送')
on conflict (code) do nothing;
```

**图形界面方式**（不想写 SQL 时）：左侧点 **`Table Editor`** → 选 `card_keys` 表 →
点 `Insert row` → 填 `code` / `max_uses` / `note` → 保存。

> 卡密建议保持 **`PET-` 前缀 + 8 位随机**。随机部分取自去掉易混字符 `0` `1` `I` `O`
> 的 32 字母表，比 `PET-001` 这种连号安全得多 —— 连号别人从 `PET-001` 试到 `PET-099` 就白嫖到了。

### 2. 改次数：一张一次 / 一张多次

**把已有卡密改成「一张只能用一次」：**

```sql
-- 改列默认值：以后新建的卡密默认就是 1 次
alter table public.card_keys alter column max_uses set default 1;

-- 把库里已有的卡密也改成 1 次。
-- 注意：已经用过 1 次以上的会因此变成「已用完」＝作废，这通常正是想要的效果。
update public.card_keys set max_uses = 1;
```

**想反过来放宽（比如一张卡密能测 3 次）：**

```sql
alter table public.card_keys alter column max_uses set default 3;
update public.card_keys set max_uses = 3, used = 0;   -- used 一起清零，等于全部重新激活
```

只改个别几张：

```sql
update public.card_keys set max_uses = 3
 where code in ('PET-XXXXXXXX', 'PET-YYYYYYYY');
```

> **扣次数的时机**：只有**答完最后一题、出结果页**的那一刻才扣 1 次。
> 输入卡密、答题中途退出、刷新页面、返回上一题 —— 全都不消耗次数。
> 所以用户不会因为手滑白白浪费一张卡密。

### 3. 查看与调整

**看每张卡密的剩余次数：**

```sql
select code, used, max_uses, max_uses - used as remaining, disabled, note, last_used_at
  from public.card_keys
 order by created_at desc;
```

**给买家补次数 / 停用某张卡密：**

```sql
update public.card_keys set max_uses = max_uses + 3 where code = 'PET-XXXXXXXX';
update public.card_keys set disabled = true          where code = 'PET-XXXXXXXX';
```

**把某张卡密的已用次数归零：**

```sql
update public.card_keys set used = 0 where code = 'PET-XXXXXXXX';
```

**全部卡密一键复位**（只在测试阶段用，上线后别乱跑）：

```sql
update public.card_keys set used = 0;
```

**看有多少人测过、都测出了什么：**

```sql
select count(*) as total,
       count(*) filter (where created_at > now() - interval '1 day') as today
  from public.results;

select payload ->> 'r' as result_id, count(*) as hits
  from public.results group by 1 order by hits desc;
```

> **两个关键认知**
>
> **改卡密不用重新部署网站。** 卡密存在 Supabase 里，每次输入卡密都是实时查库。
> 增删改完立刻生效，不需要碰 GitHub、不需要等部署、不需要改任何一行前端代码。
> 新增卡密后，直接打开网站输一下就知道了。
>
> **`data/passwords.json` 和线上无关。** 那是本地调试（`npm start`）时读的文件，
> 线上版本完全不读它。它也已经被 `.gitignore` 排除，没有上传到 GitHub。
> 线上唯一认的卡密库，永远只有 Supabase 的 `card_keys` 表。

---

## 六、需要知道的边界

**1. 免费额度**

- GitHub Pages：公开仓库完全免费，带宽和流量无硬上限（合理使用范围内）
- Supabase Free：500MB 数据库、5GB 带宽/月、项目闲置 1 周会自动休眠
  - 一条测评结果约 300 字节，**500MB 能存约 170 万条**，远远够用
  - 休眠只会让首次请求慢几秒，之后自动唤醒，不影响使用
  - 想让项目不休眠，登录控制台点一下即可；重度使用再考虑 Pro（$25/月）

**2. 前端防不住真正的技术高手**

测评结果文案、题目、算法都在 `public/js/*.js` 里，懂技术的人可以打开
开发者工具直接调用内部函数拼出结果页，绕过卡密。这是纯前端方案的固有边界。

对「1–3 元客单价、面向普通用户」这个定位来说，实际风险很低。
如果以后要彻底堵住，需要把结果文案和题库也搬到 Supabase，只在校验通过后下发——
工作量约半天，需要的话可以再做。

**3. 已经做到的**

- 卡密表无法被直接读取（RLS + 只暴露三个 RPC 函数）
- 次数在数据库层用行锁记账，多设备并发也不会超用
- 线上模式连不上后端时**不放行**，避免"断网免费测"
- 提交的字段有白名单，塞不进超大内容
- 页面加了 `noindex`，不会被搜索引擎收录（想被收录就删掉 `index.html` 里那一行）

**4. 分享链接的隐私**

拿 `?r=<id>` 链接的人都能看到这份结果（这就是分享功能本身）。
id 是 8 位随机字符，猜不到别人的；但如果有人把链接发到公开群里，
那份结果就是公开的。这是设计如此，符合"晒结果"的产品定位。
