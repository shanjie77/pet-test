# 测你适合养什么宠物 · 测评网站

支持两种运行方式，前端会自动选择：

| 模式 | 数据存哪 | 什么时候用 |
|---|---|---|
| **Supabase 模式** | Supabase 云端数据库 | 线上部署（GitHub Pages），随时随地可访问 |
| **本地模式** | 本机 `data/*.json` | 本地开发调试，零依赖，不用装任何东西 |

> 线上部署步骤见 **[DEPLOY.md](DEPLOY.md)**。

## 本地启动（本地模式）

```bash
cd pet-test-site
node server.js
# 打开 http://127.0.0.1:5173
```

只需 Node，不需要 `npm install`。
示例卡密：`PET-001` ~ `PET-005`（每组仅可用 1 次）。

指定端口 / 对外服务：

```bash
PORT=8080 HOST=0.0.0.0 node server.js
```

## 目录结构

```
pet-test-site/
├─ server.js                 本地模式的零依赖 Node 服务（静态托管 + 三个接口）
├─ package.json
├─ DEPLOY.md                 线上部署指南（GitHub Pages + Supabase）
├─ .github/workflows/        GitHub Pages 自动部署工作流（只发布 public/）
├─ supabase/schema.sql       Supabase 建表 + RLS + RPC 函数，整段粘进 SQL Editor 跑
├─ data/                     本地模式的数据（含卡密，已在 .gitignore 里排除）
│  ├─ passwords.json         卡密与使用次数（可直接编辑）
│  └─ shares.json            分享结果存储（运行时生成）
└─ public/                   ← 只有这个目录会被发布到线上
   ├─ index.html
   ├─ css/style.css
   ├─ img/pets/              24 张宠物卡通形象（pet-<结果id>.png，透明背景）
   └─ js/
      ├─ config.js           Supabase 地址与 anon key（部署前要填）
      ├─ api.js              数据接口层：Supabase / 本地双模式自动切换
      ├─ results.js          24 种结果 + 慎选清单 + 昵称/朋友圈素材
      ├─ questions.js        30 道题（含计分标注）
      ├─ scoring.js          维度计分 + 加权曼哈顿匹配 + 同簇裁决
      ├─ canvas.js           结果长图（Canvas 手绘，含卡通形象绘制）
      └─ app.js              主流程
```

> `img-src-backup/`（项目根目录）保存了 24 张 1024px 原始生成图，
> 部署时不需要上传。更换/重生成形象后运行
> `scripts/remove-bg.py`（抠背景 + 压缩）即可一键更新 `public/img/pets/`。

## 卡密管理

编辑 `data/passwords.json`：

```json
{
  "passwords": [
    { "code": "PET-001", "limit": 3, "used": 0, "note": "淘宝订单 8888" }
  ]
}
```

- `limit`：该卡密可用次数（默认 3）
- `used`：已用次数，**每提交一次结果 +1**
- 建议每次发新卡密前把 `used` 归零或换新 `code`

> 卡密在"提交结果"时消耗，所以中途退出、刷新页面不会浪费次数。

## 接口

前端不直接调这些路径，统一走 `public/js/api.js`：

| 模式 | 实现 |
|---|---|
| Supabase | `POST {url}/rest/v1/rpc/auth_card` / `submit_result` / `get_result` |
| 本地 | `POST /api/auth` / `/api/submit`，`GET /api/share?id=` |

## 功能清单

- 卡密解锁，每组 1 次（答题中途退出不扣次，交卷出结果后才计 1 次）
- 30 道题（6 门槛 + 21 计分 + 3 彩蛋 + 1 条件触发）
- 支持返回上一题重新选择
- 进度条 + 趣味进度文案 + 中途彩蛋
- 7 维度计分 → 加权曼哈顿距离匹配 24 种结果
- 硬门槛排除（过敏 / 空间 / 预算 / 独处时长）
- 结果页：主结果 / 第二顺位 / 反向提示 / 慎选清单 / 合规提示
- 结果页与长图展示对应物种的卡通形象（24 张统一风格插画）
- 保存长图（Canvas 生成，移动端长按存相册）
- 复制结果链接，他人可只读查看
- 再测一次（次数不足时友好提示）
- 好评有礼弹窗
- 移动端适配

## 卡密计数在什么模式下严格生效

| 场景 | Supabase 模式（线上） | 本地模式 |
|---|---|---|
| 卡密校验失败 / 次数用完 | **拦住，不放行** | 拦住，不放行 |
| 连不上后端 | **拦住**，提示网络异常 | 放行，提示"离线模式" |

线上模式刻意做成"连不上也不放行"——否则只要把 Supabase 域名拉黑就能免费无限测。
本地模式的放行只是为了让开发者能直接双击 html 调试，不要用于正式售卖。

## 部署

线上部署（GitHub Pages + Supabase）完整步骤见 **[DEPLOY.md](DEPLOY.md)**。

也可以放到任意支持 Node 的服务器，`node server.js` 即可（此时是本地模式，不需要 Supabase）。
