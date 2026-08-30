# MacroLens

用一个镜头理解宏观经济。MacroLens 是基于 Astro、Markdown/JSON、ECharts、Cytoscape 和 Pagefind 的静态宏观经济学习网站。

## 本地开发

```bash
npm ci
npm run dev
```

## 生产验证

```bash
npm run check
npm run build
npm run preview
```

`npm run build` 将静态站点写入 `dist`，随后生成 Pagefind 全文搜索索引。未配置生产 origin 时，本地构建不会生成 canonical 或 sitemap，避免输出 localhost 和占位域名。

## Cloudflare Pages 部署

生产部署使用 Cloudflare Pages 的 Git 集成；GitHub Actions 只负责 PR 与 `main` push 的验证，避免维护第二套部署流水线。

| 设置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `20` |

在 Cloudflare Pages 的生产环境变量中设置：

```text
PUBLIC_SITE_URL=https://<实际的 Pages 域名或自定义域名>
NODE_VERSION=20
```

值必须是站点真实、稳定的 `http`/`https` origin，不带路径。它用于 sitemap、canonical 和 Open Graph URL，配置修改不需要改源码。Cloudflare Pages 的 `main` 构建缺少该变量时会直接失败；不会把当前 deployment 的 `CF_PAGES_URL` 静默用作 production canonical。Preview 构建不应冒充 production canonical。

站点部署在 Cloudflare Pages origin 根路径，不设置 GitHub Pages 风格的 `/MacroLens` base。首页、`/concepts`、stable-ID 详情页、`/search`、Pagefind 资源和图表资源均使用根路径。

内容位于 `src/content/concepts`，指标数据位于 `data/indicators`，关系数据位于 `data/relations`。
