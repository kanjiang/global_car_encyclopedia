/**
 * 发现值得收录的热门新车。
 *
 * 做法：从维基百科「某年推出的汽车」分类里取出全部新车型，按最近 60 天的
 * 条目访问量排序（访问量就是「热门」的客观信号），排除已收录/已否决的，
 * 再要求必须有首图可用，最后输出前 N 名到 data/candidates.json。
 *
 * 用法：
 *   node tools/discover-cars.mjs                     默认看最近两年、取前 10
 *   node tools/discover-cars.mjs --years 2025,2026 --top 15
 */

import { categoryMembers, pageviewTotals, pageDetails, loadCars, loadSeen, saveJson, readJson, slug } from "./wiki.mjs";

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const thisYear = new Date().getFullYear();
const years = argVal("years", `${thisYear - 1},${thisYear}`).split(",").map((s) => s.trim());
const top = Number(argVal("top", 10));

// 明显不属于「汽车科普图鉴」的条目（概念车、赛车规格、纯商用底盘等噪音）
const TITLE_BLOCKLIST = /(concept|prototype|chassis|platform|specification|list of)/i;

async function main() {
  const cars = loadCars();
  const { data: seen } = loadSeen();
  const knownIds = new Set(cars.map((c) => c.id));
  console.log(`已收录 ${cars.length} 款车，已处理过 ${Object.keys(seen).filter((k) => !k.startsWith("_")).length} 个维基条目`);

  // 1. 汇总候选条目
  const titles = new Set();
  for (const year of years) {
    const members = await categoryMembers(`Cars introduced in ${year}`);
    members.forEach((m) => titles.add(m.title));
    console.log(`  ${year} 年新车条目：${members.length} 个`);
  }
  // 已在 data/incoming.json 里待补的草稿也算处理中，别重复提名
  const pending = new Set((readJson("data/incoming.json", []) || []).map((d) => d._source && d._source.wikiTitle));
  const fresh = [...titles].filter((t) => !(t in seen) && !pending.has(t) && !TITLE_BLOCKLIST.test(t));
  console.log(`共 ${titles.size} 个条目，其中 ${fresh.length} 个未处理过`);
  if (fresh.length === 0) {
    saveJson("data/candidates.json", []);
    console.log("没有新候选，结束。");
    return;
  }

  // 2. 按访问量排热门
  const views = await pageviewTotals(fresh);
  const ranked = fresh
    .map((title) => ({ title, views: views.get(title) || 0 }))
    .sort((a, b) => b.views - a.views);

  // 3. 逐批确认首图与简介，凑满 top 个为止（没有首图的直接跳过）
  const picked = [];
  for (let i = 0; i < ranked.length && picked.length < top; i += 20) {
    const batch = ranked.slice(i, i + 20);
    const details = await pageDetails(batch.map((r) => r.title));
    for (const row of batch) {
      if (picked.length >= top) break;
      const d = details.get(row.title);
      if (!d || !d.image || !d.extract) continue;
      if (knownIds.has(slug(row.title))) continue;
      picked.push({ title: row.title, views: row.views, zhTitle: d.zhTitle, image: d.image.source });
    }
  }

  saveJson("data/candidates.json", picked);
  console.log(`\n候选 ${picked.length} 款（按 60 天访问量排序）：`);
  picked.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.title.padEnd(32)} ${String(p.views).padStart(7)} 次  ${p.zhTitle || "（无中文条目）"}`));
}

main().catch((e) => {
  console.error("发现新车失败：", e.message);
  process.exit(1);
});
