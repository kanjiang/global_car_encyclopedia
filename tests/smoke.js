/**
 * 端到端行为测试：用 jsdom 加载真实 index.html 与全部脚本，模拟点击验证关键功能。
 *
 * 运行：npm test          （或 node tests/smoke.js）
 * 也可指定其他目录用于对比基线：node tests/smoke.js <项目目录>
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = process.argv[2] || path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
const check = (name, ok, detail) => {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`);
  }
};

function boot() {
  const dom = new JSDOM(read("index.html"), {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost/",
  });
  const { window } = dom;

  // jsdom 未实现的浏览器 API，用最小桩替代
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};

  const spoken = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  window.speechSynthesis = {
    getVoices: () => [],
    speak(u) {
      spoken.push(u.text);
    },
    cancel() {},
    resume() {},
  };
  window.AudioContext = class {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }
    createOscillator() {
      return { frequency: {}, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    resume() {}
  };

  // 按 index.html 里的顺序加载脚本，确保测的是真实加载链路
  const scripts = Array.from(window.document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src"));
  for (const src of scripts) window.eval(read(src));
  return { window, spoken };
}

function run() {
  const { window, spoken } = boot();
  const doc = window.document;
  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => Array.from(doc.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const key = (k) => doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));

  console.log("\n[1] 基础渲染");
  check("车卡片已渲染", $$(".car-card").length > 0, `count=${$$(".car-card").length}`);
  check("统计卡片已渲染", $$(".stat-card").length === 4);
  check("轮播已渲染", $$(".slide").length > 0);

  console.log("\n[2] 滚动锁互不踩踏");
  click($(".car-card"));
  const afterDetail = doc.body.style.overflow;
  click($("#quizStartBtn"));
  const afterQuiz = doc.body.style.overflow;
  // 关掉游戏，详情仍开着，滚动应保持锁定
  click($("#quizModal [data-close-quiz]"));
  const afterQuizClose = doc.body.style.overflow;
  check("打开详情后锁定", afterDetail === "hidden", afterDetail);
  check("打开游戏后锁定", afterQuiz === "hidden", afterQuiz);
  check("关游戏但详情仍开 -> 保持锁定", afterQuizClose === "hidden", `got "${afterQuizClose}"`);
  click($("#modal [data-close]"));
  check("全部关闭后解锁", doc.body.style.overflow === "", `got "${doc.body.style.overflow}"`);

  console.log("\n[3] 每道题恰好一个正确答案 + 无重复出题");
  // 数据中存在并列值（加速 2.9s 有 4 辆、极速 250km/h 有 4 辆），
  // 若不保证最优值唯一，比拼类题目会出现多个正确选项。
  const modes = ["mix", "name", "country", "category", "battle", "super", "timed"];
  let totalQuestions = 0;
  let multiCorrect = 0;
  let dupRounds = 0;

  for (const mode of modes) {
    for (let round = 0; round < 12; round++) {
      click($("#quizStartBtn"));
      const modeBtn = $(`[data-mode="${mode}"]`);
      if (!modeBtn) {
        console.log(`  (未找到模式 ${mode})`);
        break;
      }
      click(modeBtn);

      const seen = [];
      for (let q = 0; q < 10; q++) {
        const opts = $$(".quiz-option");
        if (opts.length === 0) break;
        seen.push($(".quiz-prompt").textContent + "||" + opts.map((o) => o.textContent.trim()).join("|"));
        click(opts[0]);
        const correct = $$(".quiz-option.correct").length;
        totalQuestions++;
        if (correct !== 1) {
          multiCorrect++;
          if (multiCorrect <= 3) {
            console.log(`        [${mode}] 正确项=${correct} 题干="${$(".quiz-prompt").textContent}"`);
          }
        }
        const next = $("[data-next]");
        if (next) click(next);
      }
      if (new Set(seen).size !== seen.length) dupRounds++;
      const close = $("#quizModal [data-close-quiz]");
      if (close) click(close);
    }
  }

  check(`所有题目均只有一个正确答案 (共 ${totalQuestions} 题)`, multiCorrect === 0, `${multiCorrect} 题有多个正确项`);
  check("一轮内无重复题目", dupRounds === 0, `${dupRounds} 轮出现重复`);

  console.log("\n[4] 英文模式");
  click($("#langToggle"));
  click($("#quizStartBtn"));
  const startTitle = $(".quiz-start-title").textContent;
  check("选关页切换为英文", /Pick a challenge/.test(startTitle), startTitle);
  click($('[data-mode="mix"]'));
  const promptEn = $(".quiz-prompt").textContent;
  check("题干为英文", /[A-Za-z]{4,}/.test(promptEn) && !/[\u4e00-\u9fa5]/.test(promptEn), promptEn);
  click($$(".quiz-option")[0]);
  const fbEn = $(".quiz-feedback").textContent;
  check("反馈为英文", !/[\u4e00-\u9fa5]/.test(fbEn), fbEn);
  const lastSpoken = spoken[spoken.length - 1] || "";
  check("语音内容为英文", !/[\u4e00-\u9fa5]/.test(lastSpoken), lastSpoken);
  click($("#quizModal [data-close-quiz]"));
  click($("#langToggle"));

  console.log("\n[5] 弹窗焦点管理");
  const trigger = $("#quizStartBtn");
  trigger.focus();
  click(trigger);
  check("打开后焦点进入弹窗", $("#quizModal").contains(doc.activeElement), doc.activeElement && doc.activeElement.className);

  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const items = Array.from($("#quizModal").querySelectorAll(FOCUSABLE));
  items[items.length - 1].focus();
  key("Tab");
  check("Tab 从末位循环回首位", doc.activeElement === items[0], doc.activeElement && doc.activeElement.textContent);
  key("Escape");
  check("Esc 关闭弹窗", $("#quizModal").hidden);
  check("关闭后焦点回到触发按钮", doc.activeElement === trigger, doc.activeElement && doc.activeElement.id);

  click($(".car-card"));
  click($("#quizStartBtn"));
  key("Escape");
  check("Esc 只关最上层（详情仍开）", $("#quizModal").hidden && !$("#modal").hidden);
  key("Escape");
  check("再按 Esc 关闭详情", $("#modal").hidden);
  check("全部关闭后滚动恢复", doc.body.style.overflow === "", `got "${doc.body.style.overflow}"`);

  console.log("\n[6] 搜索与筛选");
  const total = $$(".car-card").length;
  const input = $("#searchInput");
  input.value = "保时捷";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const filtered = $$(".car-card").length;
  check("搜索能过滤", filtered > 0 && filtered < total, `${filtered}/${total}`);
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  check("清空后恢复", $$(".car-card").length === total);

  console.log("\n[7] 车型对比");
  const cmpBtns = $$("[data-compare]");
  click(cmpBtns[0]);
  click(cmpBtns[1]);
  check("对比栏显示", $("#compareBar").classList.contains("show"));
  click($("#compareGo"));
  check("对比表格渲染", $$(".cmp-table .cmp-cell").length > 0);
  click($("#compareModal [data-close-cmp]"));
  check("关闭对比后解锁滚动", doc.body.style.overflow === "", `got "${doc.body.style.overflow}"`);

  console.log("\n[8] 图片引用完整");
  const cars = window.CARS || [];
  const missing = cars.filter((c) => c.image && !fs.existsSync(path.join(ROOT, c.image)));
  check("所有引用的车图都存在", missing.length === 0, missing.map((c) => c.image).join(", "));

  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURES"}`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
