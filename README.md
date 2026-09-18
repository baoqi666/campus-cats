# 校园小猫图鉴

一个面向校园的流浪猫信息记录网站：**用户可上传在校园看到的小猫照片**，管理员可录入猫咪信息、猫际关系、常出没地点，以及绝育 / 病史 / 驱虫 / 疫苗接种情况，并可为患病小猫发起**展示型资金筹集**。

- 前端：纯静态 HTML + 原生 JS（零构建、零依赖），移动端优先
- 后端：Supabase（Postgres + Auth + Storage，免费额度即可）
- 筹款：网站只做项目展示与进度追踪，实际收款走外部（微信 / 支付宝收款码等），合规简单

## 目录结构

```
campus-cat/
├─ index.html            # 页面外壳 + 导航
├─ assets/css/style.css  # 浅蓝柔和主题
├─ src/
│  ├─ config.js          # 填入你的 Supabase URL / Key
│  ├─ supabase.js        # 初始化客户端
│  ├─ db.js              # 所有数据读写
│  ├─ auth.js            # 管理员登录
│  └─ app.js             # 路由 + 全部页面 + 管理端
└─ supabase/schema.sql   # 建表 + 权限 + 存储桶（一次性执行）
```

## 上线步骤（约 10 分钟）

### 1. 建 Supabase 项目
打开 https://app.supabase.com → New project（免费）。等数据库就绪。

### 2. 执行数据库结构
左侧 SQL Editor → 粘贴 `supabase/schema.sql` 全部内容 → Run。
这一步会建好 7 张表、行级安全策略，以及图片存储桶 `catphotos`。

### 3. 配置管理员
- Authentication → Users → Add user，用你的邮箱建一个账号（设密码）。
- SQL Editor 执行：`insert into admins (email) values ('你的邮箱');`
  （`schema.sql` 里默认有一行 `admin@example.com`，记得改成你自己的，或追加。）

### 4. 填入密钥
打开 `src/config.js`，把 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 换成
Project Settings → API 里的 URL 与 `anon public` key。
（可选）填入 `DONATION_QR_URL`（收款码图片）与 `DONATION_NOTE`。

### 5. 部署前端
把整个 `campus-cat/` 目录作为静态站点发布即可：
- EdgeOne Makers / GitHub Pages / 任意静态托管
- 或本地预览：`python -m http.server 8080`，浏览器开 `http://localhost:8080`

## 功能地图

用户端
- 猫咪列表（按性别 / 状态 / 昵称筛选）
- 猫咪详情：封面、性格、常出没地点、健康时间线、猫际关系、照片墙、关联筹款
- 上传目击 / 照片（可关联已知猫，或报“新猫”待管理员建档）
- 筹款列表 / 详情（进度条 + 捐款记录 + 收款说明）

管理端（邮箱登录后）
- 统计看板
- 猫咪增删改查（含封面图）
- 目击审核：通过发布 / 拒绝 / 一键转为新猫
- 筹款管理：新建 / 编辑 / 删除 / 记录一笔捐款（到账后登记，进度自动更新）

## 数据模型

| 表 | 作用 |
|---|---|
| `cats` | 猫咪主档案 |
| `cat_locations` | 常出没地点（一只猫多条） |
| `cat_relationships` | 猫际关系（母子 / 父子 / 兄弟姐妹 / 情侣 / 同窝 / 其他） |
| `health_records` | 健康记录（绝育 / 病史 / 驱虫 / 疫苗，各带日期） |
| `sightings` | 用户上传（照片、地点、备注、审核状态） |
| `campaigns` | 筹款项目 |
| `donations` | 捐款记录（进度由其汇总） |
| `admins` | 管理员邮箱白名单 |

## 权限说明
- 猫咪 / 地点 / 关系 / 健康 / 筹款：**公开可读，仅管理员可写**
- 目击：**任何人可提交**，已发布的才对公开可见
- 照片：存储桶 `catphotos` 公开读、允许匿名上传

## 想加的功能（可选扩展）
- 地图选点记录常出没位置
- 猫咪 AI 识图（按品种/个体）
- 领养申请流程
- 站内消息 / 志愿者排班
