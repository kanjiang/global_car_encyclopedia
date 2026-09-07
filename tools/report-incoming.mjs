/**
 * 把 data/incoming.json 渲染成 Markdown，用作自动开 PR 时的说明。
 * 运行：node tools/report-incoming.mjs
 */

import { readJson } from "./wiki.mjs";

const drafts = readJson("data/incoming.json", []) || [];
const candidates = readJson("data/candidates.json", []) || [];
const views = new Map(candidates.map((c) => [c.title, c.views]));

if (drafts.length === 0) {
  console.log("这次没有发现值得收录的新车。");
  process.exit(0);
}

console.log(`本次自动发现了 **${drafts.length} 款热门新车**（按维基百科最近 60 天访问量排序），配图已下载到 \`images/\`，草稿在 \`data/incoming.json\`。\n`);
console.log("| 车型 | 品牌 | 产地 | 类别 | 年份 | 60 天访问量 | 待补字段 |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const d of drafts) {
  const v = views.get(d._source.wikiTitle);
  console.log(
    `| [${d.name}](https://en.wikipedia.org/wiki/${encodeURIComponent(d._source.wikiTitle.replace(/ /g, "_"))}) | ${d.brand} | ${d.country || "?"} | ${d.category || "?"} | ${d.year || "?"} | ${v ? v.toLocaleString() : "-"} | ${d._todo.length ? d._todo.join("、") : "无"} |`
  );
}

console.log(`
## 合并前要做的事

维基百科的信息框通常没有极速、零百加速和价格，中文条目也不一定存在，所以这些字段需要人工或 AI 补全（缺字段的条目会被 \`cars:merge\` 拦住，不会流入线上数据）。

最省事的办法：在 Cursor 里切到这个分支，让 agent 执行「补全 data/incoming.json 里的 _todo 字段并合并」。
没有 Cursor 时，照 [docs/fill-drafts-prompt.md](../blob/main/docs/fill-drafts-prompt.md) 把草稿丢给任意网页版 AI 也能补。手动做则是：

1. 编辑 \`data/incoming.json\`，补齐每条的 \`_todo\` 字段（极速、加速、参考价、座位数），并把 \`_todo\` 清空
2. 给每辆车写 1–2 条小朋友能看懂的冷知识（\`facts\`）
3. 核对自动判定的 \`category\` / \`country\` / \`power\` 是否准确
4. 运行 \`npm run cars:merge\` 并入 \`js/data.js\`，再运行 \`npm test\`
5. 如果出现了新的类别或产地，按提示在 \`js/core.js\` 的 \`CATEGORY_EN\` / \`COUNTRY_EN\` 里补中英对照

不想收录的条目，直接从 \`data/incoming.json\` 删掉，并在 \`tools/seen.json\` 里把它的维基条目名记为 \`"-"\`，以后就不会再被提名。
`);
