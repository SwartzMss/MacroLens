# MacroLens

用一个镜头理解宏观经济。静态优先的宏观经济学习网站，首条完整路径覆盖 M0、M1、M2、人民币贷款、社会融资规模与 LPR。

## 本地运行

```bash
npm install
npm run dev
```

`npm run build` 会生成完全静态的网站，并用 Pagefind 建立全文搜索索引。

内容位于 `src/content/concepts`，指标数据位于 `data/indicators`，关系数据位于 `data/relations`。
