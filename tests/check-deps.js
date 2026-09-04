/**
 * 模块依赖检查：各 JS 模块通过共享的 window.CarApp 命名空间通信，
 * 若某模块用到了别处导出的名字却忘了在头部声明，运行时才会报 ReferenceError。
 * 这里做静态扫描，提前发现遗漏。
 *
 * 运行：node tests/check-deps.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || path.join(__dirname, "..");
const FILES = ["core.js", "tts.js", "quiz.js", "app.js"];

const readModule = (f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8");
const exportBlock = (src) => src.match(/Object\.assign\(App,\s*\{([\s\S]*?)\}\);/);
const namesIn = (block) =>
  block
    .split(",")
    .map((s) => s.split(":")[0].trim())
    .filter(Boolean);

// 汇总所有模块经 App 暴露的名字
const exported = new Set();
for (const f of FILES) {
  const m = exportBlock(readModule(f));
  if (m) namesIn(m[1]).forEach((n) => exported.add(n));
}

let problems = 0;
for (const f of FILES) {
  const src = readModule(f);

  const declared = new Set();
  const collect = (re) => {
    let m;
    while ((m = re.exec(src))) declared.add(m[1]);
  };
  collect(/\bfunction\s+([A-Za-z_$][\w$]*)/g);
  collect(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g);

  const destructured = src.match(/const\s*\{([\s\S]*?)\}\s*=\s*App;/);
  if (destructured) destructured[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => declared.add(n));

  const own = exportBlock(src);
  const ownNames = new Set(own ? namesIn(own[1]) : []);

  const missing = [...exported].filter((name) => {
    if (declared.has(name) || ownNames.has(name)) return false;
    return new RegExp(`(?<![.\\w$])${name}\\s*[(,)\\.\\[;=\\s]`).test(src);
  });

  if (missing.length) {
    problems++;
    console.log(`  FAIL  ${f}: 用到但未声明 -> ${missing.join(", ")}`);
  } else {
    console.log(`  PASS  ${f}`);
  }
}

console.log(problems === 0 ? "\nALL PASS" : `\n${problems} FAILURES`);
process.exit(problems ? 1 : 0);
