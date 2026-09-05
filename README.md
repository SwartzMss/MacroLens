# MacroLens

用一个镜头理解宏观经济。MacroLens 是一个 static-first 的宏观经济教育与探索网站，不提供投资建议。

## 产品内容

- Concepts：按概念浏览宏观指标、定义、统计边界和数据来源。
- Topics：按学习主题组织概念与前置知识。
- Relationship Explorer：用可读的关系卡片和传导路径解释指标之间的关联。
- Dashboard：展示当前注册的 11 个 V1 官方指标，包括 PMI、货币供应量、GDP、工业生产、社零、固定资产投资、CPI、核心 CPI 和 PPI。
- Macro Snapshot：基于已加载数据和显式规则生成确定性的宏观状态、证据和关注项。

站点保留结构化关系数据，用于关系浏览、上下游推理和未来扩展；主产品体验以解释性页面、关系卡片和传导路径为主。

## 数据更新

数据来自国家统计局和中国人民银行的官方发布。GitHub Actions 定时或手动运行以下 ingestion：

- NBS PMI
- PBOC M0/M1/M2
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

PUBLIC_SITE_URL 必须是站点真实、稳定的 http/https origin，不带路径。它用于 sitemap、canonical 和 Open Graph URL。Cloudflare Pages 的 main 构建缺少该变量时会直接失败，不会把当前 deployment 的 CF_PAGES_URL 静默用作 production canonical。

Umami tracking script 会在所有页面加载。页脚访客统计通过同源的 `/api/umami-stats` Pages Function 读取 Umami Cloud 数据；API key 只在服务端使用，未配置或请求失败时统计区块会保持隐藏。在 Cloudflare Pages 中配置：

~~~text
UMAMI_API_KEY=<Umami Cloud API key，作为 secret 保存>
UMAMI_WEBSITE_ID=<可选，默认使用 issue #84 提供的网站 ID>
UMAMI_API_ENDPOINT=https://api.umami.is/v1
PUBLIC_UMAMI_WEBSITE_ID=<可选，用于覆盖 tracking script 的网站 ID>
~~~

Umami Cloud API key 不能写入前端代码或 `PUBLIC_` 变量。`UMAMI_API_ENDPOINT` 仅在使用自建 Umami 实例时覆盖默认的 Cloud API 地址。

站点部署在 Cloudflare Pages origin 根路径，不设置 GitHub Pages 风格的 /MacroLens base。首页、/concepts、/topics、/graph、/search、Pagefind 资源和图表资源均使用根路径。

内容位于 src/content/concepts，指标数据位于 data/indicators，关系数据位于 data/relations。
