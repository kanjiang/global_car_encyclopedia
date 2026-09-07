/**
 * 车型数据质量闸门。自动抓取的草稿并入后，靠这里兜住残缺或异常的数据。
 *
 * 运行：node tests/check-data.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || path.join(__dirname, "..");

global.window = {};
require(path.join(ROOT, "js", "data.js"));
const cars = global.window.CARS;
const core = fs.readFileSync(path.join(ROOT, "js", "core.js"), "utf8");

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const check = (name, ok, detail) => (ok ? console.log(`  PASS  ${name}`) : fail(`${name}${detail ? " -> " + detail : ""}`));

const STRINGS = ["id", "name", "brand", "country", "category", "priceRMB", "engine", "power", "drivetrain", "accent", "emoji", "summary", "description"];
const NUMBERS = ["year", "topSpeed", "accel", "seats"];

console.log(`\n[数据校验] 共 ${cars.length} 款车型`);

const ids = cars.map((c) => c.id);
check("id 唯一", new Set(ids).size === ids.length, ids.filter((v, i) => ids.indexOf(v) !== i).join(", "));

let badFields = [];
for (const c of cars) {
  for (const k of STRINGS) {
    if (typeof c[k] !== "string" || !c[k].trim()) badFields.push(`${c.id}.${k}`);
  }
  for (const k of NUMBERS) {
    if (typeof c[k] !== "number" || !Number.isFinite(c[k])) badFields.push(`${c.id}.${k}`);
  }
  if (!Array.isArray(c.facts) || c.facts.length < 1 || c.facts.some((f) => typeof f !== "string" || !f.trim())) {
    badFields.push(`${c.id}.facts`);
  }
}
check("必填字段齐全且类型正确", badFields.length === 0, badFields.slice(0, 8).join(", "));

// 数值要落在物理上说得通的范围内，防止抓取脚本写进 0 或 NaN
const outOfRange = cars.filter(
  (c) => c.topSpeed < 30 || c.topSpeed > 500 || c.accel <= 0 || c.accel > 120 || c.year < 1880 || c.year > new Date().getFullYear() + 2 || c.seats < 1 || c.seats > 120
);
check("极速 / 加速 / 年份 / 座位数在合理范围", outOfRange.length === 0, outOfRange.map((c) => c.id).join(", "));

const badPower = cars.filter((c) => !/^\d+(\.\d+)?\s*马力/.test(c.power));
check('power 形如 "XXX 马力"（排序按数值解析）', badPower.length === 0, badPower.map((c) => `${c.id}:${c.power}`).join(", "));

const badAccent = cars.filter((c) => !/^linear-gradient\(/.test(c.accent));
check("accent 是合法的渐变值", badAccent.length === 0, badAccent.map((c) => c.id).join(", "));

const noImage = cars.filter((c) => !c.image || !fs.existsSync(path.join(ROOT, c.image)));
check("每款车都有本地配图", noImage.length === 0, noImage.map((c) => c.id).join(", "));

// 类别 / 产地都要有中英对照，否则英文模式会退回中文
const missingDict = [];
for (const v of new Set(cars.map((c) => c.category))) {
  if (!new RegExp(`\\n\\s*${v}:`).test(core)) missingDict.push(`CATEGORY_EN:${v}`);
}
for (const v of new Set(cars.map((c) => c.country))) {
  if (!new RegExp(`\\n\\s*${v}:`).test(core)) missingDict.push(`COUNTRY_EN:${v}`);
}
check("所有类别 / 产地都有中英对照", missingDict.length === 0, missingDict.join(", "));

// 草稿标记不该出现在正式数据里
const leftovers = cars.filter((c) => "_todo" in c || "_source" in c || "_imageBytes" in c);
check("没有残留的草稿标记字段", leftovers.length === 0, leftovers.map((c) => c.id).join(", "));

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURES"}`);
process.exit(failures === 0 ? 0 : 1);
