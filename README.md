# MacroLens

用一个镜头理解宏观经济。MacroLens 是一个 static-first 的宏观经济教育与探索网站，不提供投资建议。

## 产品内容

- Learn：按固定顺序建立宏观经济认知模型，内容与 Concepts 独立。
- Macro Now：查看当前宏观状态、指标依据、可能联系和下一期观察。
- Concepts：按领域和难度浏览概念卡片，查看宏观指标、定义、统计边界和数据来源。
- Topics 元数据：继续用于概念归类、前置关系和兼容页面，不作为知识库主界面的独立筛选入口。
- Relationship Explorer：用可读的关系卡片和传导路径解释指标之间的关联。
- Dashboard：展示当前注册的 11 个 V1 官方指标，包括 PMI、货币供应量、GDP、工业生产、社零、固定资产投资、CPI、核心 CPI 和 PPI。
- `/now/` 是 Macro Now 的正式入口；原 Macro Snapshot 页面对应的旧 `/snapshot/` 地址保留并指向同一套当前状态内容。
- RSS：通过 `/rss.xml` 订阅知识节点、内容和宏观指标数据更新。

站点保留结构化关系数据，用于关系浏览、上下游推理和未来扩展；主产品体验以解释性页面、关系卡片和传导路径为主。

## 数据更新

数据来自国家统计局和中国人民银行的官方发布。GitHub Actions 定时或手动运行以下 ingestion：

- NBS PMI
- PBOC M0/M1/M2
- PBOC 7 天期逆回购政策利率（实际生效／操作日的阶梯序列，详见 [采集说明](docs/policy-rate-ingestion.md)）
- NBS GDP、工业生产、社零、固定资产投资
- NBS CPI、核心 CPI、PPI

每个 adapter 都在写入前执行发布页解析、方法学、历史重叠和数据契约校验。数据变化通过 reviewable pull request 提交到 main，不自动合并；官方数据未变化时不会创建数据 PR。

## 本地开发与验证

项目使用 Node 24 作为标准开发和 CI 运行时；最低兼容版本由 Astro 依赖约束为 Node 22.12.0。推荐使用 .nvmrc 配置运行时。

~~~bash
npm ci
npm run dev
~~~

发布前运行完整验证：

~~~bash
npm ci
npm test
npm run check
npm run build
npm audit
~~~

npm run build 生成静态站点到 dist，随后生成 Pagefind 全文搜索索引。未配置生产 origin 时，本地构建不会生成 canonical 或 sitemap，避免输出 localhost 和占位域名。

## Cloudflare Pages 部署

生产部署使用 Cloudflare Pages 的 Git 集成；GitHub Actions 负责 PR 与 main push 的验证，数据 workflow 负责创建 reviewable data PR。

| 设置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Production branch | main |
| Build command | npm run build |
| Build output directory | dist |
| Node.js version | 24 |

在 Cloudflare Pages 的生产环境变量中设置：

~~~text
PUBLIC_SITE_URL=https://<实际的 Pages 域名或自定义域名>
NODE_VERSION=24
~~~

PUBLIC_SITE_URL 必须是站点真实、稳定的 http/https origin，不带路径。它用于 sitemap、canonical、Open Graph 和 RSS URL。Cloudflare Pages 的 main 构建缺少该变量时会直接失败，不会把当前 deployment 的 CF_PAGES_URL 静默用作 production canonical。

### 访客统计（可选）

访客统计使用 Cloudflare Pages Functions 和 Analytics Engine；未配置时不会影响站点页面访问。部署时配置以下项目：

~~~text
ANALYTICS -> macrolens_visitors（Analytics Engine binding）
CLOUDFLARE_ACCOUNT_ID -> Pages Function variable
CLOUDFLARE_API_TOKEN -> Pages Function secret（需要 Account Analytics Read）
~~~

系统只统计成功的 HTML `GET` 请求，并使用匿名 `HttpOnly; Secure; SameSite=Lax` cookie 生成 visitor identifier。Analytics Engine 保存规范化 pathname 和（学习文章请求中的）稳定文章 ID；不会采集 IP 地址、user-agent（UA）、referrer、query string 或 fragment，也不使用 D1 保存页面访问明细或用户浏览历史。

“累计访客”表示 Analytics Engine 保留周期内的累计 unique visitors，不代表永久历史累计；“今日访客”按上海时区日期统计。页面统计 API `/api/page-stats` 返回学习文章 ID 和 distinct visitor aggregate counts，不返回 visitor ID。同一概念出现在多条学习路线时，按稳定文章 ID 合并 UV。

### 页面反馈（可选）

学习文章页支持匿名的“有帮助 / 需要改进”反馈，使用现有 `macrolens_visitor` HttpOnly cookie 和 Cloudflare D1；概念查询页不显示反馈。未配置时反馈不可用，但不会影响页面访问。D1 迁移文件位于 `migrations/0001_page_feedback.sql`，部署环境需要提供名为 `FEEDBACK_DB` 的 D1 binding。系统不保存 IP、user-agent 或自由文本反馈。历史上写入的概念页 ID 会保留在 D1 中，但新的统计表只展示学习文章反馈。

这次调整不新增或更改 Cloudflare binding，也不需要新的 D1 迁移；合并后按现有 Pages 部署流程发布即可。Analytics Engine 中的学习文章 UV 会从新版本开始积累，旧记录不会回填稳定文章 ID。

仅创建并绑定 D1 不会自动建表。首次部署或新增数据库后，必须对每个实际使用的数据库分别执行迁移；如果 Production 和 Preview 使用不同数据库，两边都要执行：

~~~bash
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
~~~

### 如何查看统计

生产站部署后，日常查看优先使用下面几个入口：

~~~text
/stats                 人类可读的内容统计概览（访问 + 页面反馈）
/api/page-stats        学习文章 total / today UV 原始聚合
/api/visitor-stats     全站 total / today visitor 原始聚合
/api/feedback-stats    学习文章反馈原始聚合（含历史概念页记录）
/api/module-stats      首页、学习、当前宏观、知识库、搜索的模块 UV 聚合
~~~

`/stats` 会把全站访客、模块 UV、学习文章 UV 和 D1 学习文章反馈放在一起，用于先看各入口的访问分布，再发现“高访问 + 低有帮助率”的优先优化文章。同一概念在多条路线出现时只占一行。该页面隐藏公开主导航、使用 `noindex`，并排除在 Pagefind 索引之外；但它不是鉴权边界，知道 URL 的人仍可访问聚合数据。如果以后需要真正的私有后台，应再使用 Cloudflare Access 等方式保护。

页面反馈原始记录保存在 D1 的 `page_feedback` 表中。需要排查单条记录时，可直接查询生产数据库：

~~~bash
npx wrangler d1 execute macrolens_interactions --remote --command "SELECT * FROM page_feedback ORDER BY updated_at DESC;"
~~~

统计接口只返回聚合结果，不返回匿名 visitor ID；概念页旧反馈记录也不会被伪装成学习文章反馈。

站点部署在 Cloudflare Pages origin 根路径，不设置 GitHub Pages 风格的 /MacroLens base。首页、/concepts、/topics、/graph、/search、Pagefind 资源和图表资源均使用根路径。

内容位于 src/content/concepts，指标数据位于 data/indicators，关系数据位于 data/relations。
