/**
 * 清理 images/ 里没人引用的车图。
 *
 * 自动抓取时会先把候选车的配图都下下来，被否决的车就会留下孤图。
 * 已收录（js/data.js）和待补草稿（data/incoming.json）引用的图都会保留。
 *
 * 用法：
 *   node tools/prune-images.mjs            只列出会删哪些（不动文件）
 *   node tools/prune-images.mjs --delete   真的删除
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCars, readJson } from "./wiki.mjs";

const doDelete = process.argv.includes("--delete");
const dir = path.join(ROOT, "images");

const used = new Set(loadCars().filter((c) => c.image).map((c) => path.basename(c.image)));
for (const d of readJson("data/incoming.json", []) || []) used.add(`${d.id}.webp`);

const orphans = fs.readdirSync(dir).filter((f) => f.endsWith(".webp") && !used.has(f));

if (orphans.length === 0) {
  console.log(`images/ 里没有孤立图片（共 ${used.size} 张在用）。`);
} else {
  console.log(`${orphans.length} 张图没有被引用：`);
  for (const f of orphans) {
    const bytes = fs.statSync(path.join(dir, f)).size;
    console.log(`  ${f.padEnd(32)} ${String(bytes).padStart(8)} bytes${doDelete ? "  已删除" : ""}`);
    if (doDelete) fs.unlinkSync(path.join(dir, f));
  }
  if (!doDelete) console.log("\n加 --delete 才会真的删除。");
}
