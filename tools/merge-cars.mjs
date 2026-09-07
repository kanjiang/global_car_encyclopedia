/**
 * 把 data/incoming.json 里补全好的草稿并入 js/data.js。
 *
 * 会做的事：
 *   1. 逐条校验字段完整性与类型（_todo 没清空的一律拒绝，除非 --force）
 *   2. 按仓库现有代码风格追加到 CARS 数组末尾
 *   3. 把 id 加进 CARS_WITH_IMAGE
 *   4. 记入 tools/seen.json，避免下次又被当成新车提名
 *   5. 清空 data/incoming.json
 *
 * 用法：node tools/merge-cars.mjs [--force] [--only id1,id2]
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, loadCars, loadSeen, readJson, saveJson } from "./wiki.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.indexOf("--only");
const only = onlyArg >= 0 && args[onlyArg + 1] ? new Set(args[onlyArg + 1].split(",").map((s) => s.trim())) : null;

const DATA_FILE = path.join(ROOT, "js", "data.js");
const CORE_FILE = path.join(ROOT, "js", "core.js");

const REQUIRED_STRINGS = ["id", "name", "brand", "country", "category", "priceRMB", "engine", "power", "drivetrain", "accent", "emoji", "summary", "description"];
const REQUIRED_NUMBERS = ["year", "topSpeed", "accel", "seats"];

function validate(entry, knownIds) {
  const errs = [];
  if (entry._todo && entry._todo.length && !force) errs.push(`还有未补全字段：${entry._todo.join("、")}`);
  for (const k of REQUIRED_STRINGS) {
    if (typeof entry[k] !== "string" || !entry[k].trim()) errs.push(`${k} 必须是非空字符串`);
  }
  for (const k of REQUIRED_NUMBERS) {
    if (typeof entry[k] !== "number" || !Number.isFinite(entry[k])) errs.push(`${k} 必须是数字`);
  }
  if (!Array.isArray(entry.facts) || entry.facts.length < 1) errs.push("facts 至少要有 1 条冷知识");
  if (knownIds.has(entry.id)) errs.push(`id ${entry.id} 已存在`);
  if (!fs.existsSync(path.join(ROOT, "images", `${entry.id}.webp`))) errs.push(`缺少配图 images/${entry.id}.webp`);
  if (!/^\d+ 马力$/.test(entry.power || "")) errs.push('power 格式应为 "XXX 马力"');
  return errs;
}

const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
// 仓库里的文件是 CRLF，插入时要沿用原有换行风格，否则整文件 diff 会变成全量改写
const eolOf = (src) => (src.includes("\r\n") ? "\r\n" : "\n");

/** 按 js/data.js 现有风格序列化一条车型 */
function serialize(c) {
  const lines = [
    "  {",
    `    id: ${q(c.id)},`,
    `    name: ${q(c.name)},`,
    `    brand: ${q(c.brand)},`,
    `    country: ${q(c.country)},`,
    `    category: ${q(c.category)},`,
    `    year: ${c.year},`,
    `    priceRMB: ${q(c.priceRMB)},`,
    `    engine: ${q(c.engine)},`,
    `    power: ${q(c.power)},`,
    `    topSpeed: ${c.topSpeed},`,
    `    accel: ${c.accel},`,
    `    drivetrain: ${q(c.drivetrain)},`,
    `    seats: ${c.seats},`,
    `    accent: ${q(c.accent)},`,
    `    emoji: ${q(c.emoji)},`,
    `    summary: ${q(c.summary)},`,
  ];
  const desc = q(c.description);
  if (desc.length > 70) lines.push("    description:", `      ${desc},`);
  else lines.push(`    description: ${desc},`);
  lines.push("    facts: [");
  c.facts.forEach((f) => lines.push(`      ${q(f)},`));
  lines.push("    ],", "  },");
  return lines;
}

function insertCars(src, entries) {
  const eol = eolOf(src);
  const marker = /\r?\n\];\r?\n\r?\n\/\/ 真实车型照片/;
  if (!marker.test(src)) throw new Error("在 js/data.js 里找不到 CARS 数组的结尾标记，请检查文件结构");
  const block = entries.flatMap(serialize).join(eol);
  return src.replace(marker, `${eol}${block}${eol}];${eol}${eol}// 真实车型照片`);
}

function insertImageIds(src, ids) {
  const eol = eolOf(src);
  const re = /(const CARS_WITH_IMAGE = \[[\s\S]*?)\r?\n\];/;
  if (!re.test(src)) throw new Error("在 js/data.js 里找不到 CARS_WITH_IMAGE 数组");
  const rows = [];
  for (let i = 0; i < ids.length; i += 5) {
    rows.push("  " + ids.slice(i, i + 5).map((id) => `"${id}",`).join(" "));
  }
  return src.replace(re, `$1${eol}${rows.join(eol)}${eol}];`);
}

function checkDicts(entries) {
  const core = fs.readFileSync(CORE_FILE, "utf8");
  const missing = [];
  for (const e of entries) {
    if (!new RegExp(`\\n\\s*${e.category}:`).test(core)) missing.push(`CATEGORY_EN 缺少「${e.category}」`);
    if (!new RegExp(`\\n\\s*${e.country}:`).test(core)) missing.push(`COUNTRY_EN 缺少「${e.country}」`);
  }
  return [...new Set(missing)];
}

function main() {
  let incoming = readJson("data/incoming.json", []) || [];
  if (only) incoming = incoming.filter((e) => only.has(e.id));
  if (incoming.length === 0) {
    console.log("data/incoming.json 里没有待并入的车型。");
    return;
  }

  const knownIds = new Set(loadCars().map((c) => c.id));
  const ok = [];
  let rejected = 0;
  for (const entry of incoming) {
    const errs = validate(entry, knownIds);
    if (errs.length) {
      rejected++;
      console.log(`  拒绝 ${entry.id}`);
      errs.forEach((e) => console.log(`       - ${e}`));
      continue;
    }
    ok.push(entry);
    knownIds.add(entry.id);
  }

  if (ok.length === 0) {
    console.log(`\n没有条目通过校验（${rejected} 条被拒）。补全字段后再试。`);
    process.exit(1);
  }

  const dictWarnings = checkDicts(ok);

  let src = fs.readFileSync(DATA_FILE, "utf8");
  src = insertCars(src, ok);
  src = insertImageIds(src, ok.map((e) => e.id));
  fs.writeFileSync(DATA_FILE, src);

  const { file: seenFile, data: seen } = loadSeen();
  for (const e of ok) {
    const title = (e._source && e._source.wikiTitle) || e.name;
    seen[title] = e.id;
  }
  fs.writeFileSync(seenFile, JSON.stringify(seen, null, 2) + "\n");

  const left = (readJson("data/incoming.json", []) || []).filter((e) => !ok.some((o) => o.id === e.id));
  saveJson("data/incoming.json", left);

  console.log(`已并入 ${ok.length} 款车型：${ok.map((e) => e.id).join("、")}`);
  if (rejected) console.log(`${rejected} 条未通过校验，仍留在 data/incoming.json`);
  if (dictWarnings.length) {
    console.log("\n提醒（影响英文朗读，建议在 js/core.js 里补上）：");
    dictWarnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log("\n接着跑 npm test 确认数据与页面都正常。");
}

main();
