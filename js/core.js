// 共享基础：数据、状态、DOM 引用、工具、弹窗管理、主题
window.CarApp = window.CarApp || {};
(function (App) {
  "use strict";

  const cars = window.CARS || [];
  const TTS = typeof window !== "undefined" && "speechSynthesis" in window;

  // 状态
  const state = {
    keyword: "",
    category: "全部",
    country: "全部",
    sort: "default",
    compare: [],
    lang: "zh", // 朗读语言：zh | en
    autoReading: false,
  };
  const COMPARE_MAX = 4;

  // 中英对照词典（用于英文朗读）
  const CATEGORY_EN = {
    超级跑车: "hypercar",
    跑车: "sports car",
    豪华轿车: "luxury sedan",
    SUV: "SUV",
    电动车: "electric car",
    越野: "off-road vehicle",
    经典老爷车: "classic car",
    家用轿车: "family car",
    皮卡: "pickup truck",
    卡车: "truck",
    工程车: "construction vehicle",
    巴士: "bus",
    赛车: "race car",
  };
  const COUNTRY_EN = {
    法国: "France",
    意大利: "Italy",
    德国: "Germany",
    日本: "Japan",
    英国: "the United Kingdom",
    美国: "the United States",
    中国: "China",
    瑞典: "Sweden",
    韩国: "South Korea",
    奥地利: "Austria",
  };
  // 从「英文 中文」混合串里取拉丁字母/数字部分
  function latinPart(str) {
    const m = (str || "").match(/[A-Za-z0-9][A-Za-z0-9 .\-]*/g);
    return m ? m.join(" ").trim() : "";
  }
  const brandEn = (c) => latinPart(c.brand) || c.brand;
  const nameEn = (c) => latinPart(c.name) || c.name;

  // 按当前朗读语言取文案
  const t = (zh, en) => (state.lang === "en" ? en : zh);
  const carLabel = (c) => `${c.emoji} ${state.lang === "en" ? nameEn(c) : c.name}`;
  const countryLabel = (v) => (state.lang === "en" ? COUNTRY_EN[v] || v : v);
  const categoryLabel = (v) => (state.lang === "en" ? CATEGORY_EN[v] || v : v);

  // DOM
  const el = {
    heroSearch: document.getElementById("heroSearch"),
    heroSearchBtn: document.getElementById("heroSearchBtn"),
    heroChips: document.getElementById("heroChips"),
    statsGrid: document.getElementById("statsGrid"),
    totalCount: document.getElementById("totalCount"),
    searchInput: document.getElementById("searchInput"),
    categoryChips: document.getElementById("categoryChips"),
    countrySelect: document.getElementById("countrySelect"),
    sortSelect: document.getElementById("sortSelect"),
    cardGrid: document.getElementById("cardGrid"),
    emptyState: document.getElementById("emptyState"),
    modal: document.getElementById("modal"),
    modalBody: document.getElementById("modalBody"),
    themeToggle: document.getElementById("themeToggle"),
    header: document.querySelector(".site-header"),
    scrollProgress: document.getElementById("scrollProgress"),
    carousel: document.getElementById("carousel"),
    carSlides: document.getElementById("carSlides"),
    carDots: document.getElementById("carDots"),
    carPrev: document.getElementById("carPrev"),
    carNext: document.getElementById("carNext"),
    carProgress: document.getElementById("carProgress"),
    compareBar: document.getElementById("compareBar"),
    compareChips: document.getElementById("compareChips"),
    compareCount: document.getElementById("compareCount"),
    compareClear: document.getElementById("compareClear"),
    compareGo: document.getElementById("compareGo"),
    compareModal: document.getElementById("compareModal"),
    compareBody: document.getElementById("compareBody"),
    langToggle: document.getElementById("langToggle"),
    autoReadBtn: document.getElementById("autoReadBtn"),
    quizStartBtn: document.getElementById("quizStartBtn"),
    quizModal: document.getElementById("quizModal"),
    quizBody: document.getElementById("quizBody"),
  };

  // 本周精选（按此顺序展示的车型 id；缺失则自动跳过）
  const FEATURED_IDS = [
    "bugatti-chiron",
    "koenigsegg-jesko",
    "lamborghini-aventador",
    "porsche-911",
    "ferrari-f8",
  ];

  const uniq = (arr) => Array.from(new Set(arr));
  const categories = ["全部", ...uniq(cars.map((c) => c.category))];
  const countries = ["全部", ...uniq(cars.map((c) => c.country))];

  // ---------- 弹窗通用：滚动锁 + 焦点管理 ----------
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  const overlayStack = [];
  const overlayTrigger = new WeakMap();

  const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 三个弹窗共用页面滚动条，按「是否还有弹窗打开」推导，避免各自置空时互相踩踏。
  function syncScrollLock() {
    const anyOpen = [el.modal, el.compareModal, el.quizModal].some((m) => m && !m.hidden);
    document.body.style.overflow = anyOpen ? "hidden" : "";
  }

  function focusableIn(node) {
    return Array.from(node.querySelectorAll(FOCUSABLE)).filter((n) => !n.hidden && n.getAttribute("aria-hidden") !== "true");
  }

  function showOverlay(node) {
    if (!node || !node.hidden) return;
    overlayTrigger.set(node, document.activeElement);
    node.hidden = false;
    overlayStack.push(node);
    syncScrollLock();
    const first = focusableIn(node)[0];
    if (first) first.focus();
  }

  function hideOverlay(node) {
    if (!node || node.hidden) return;
    node.hidden = true;
    const i = overlayStack.indexOf(node);
    if (i >= 0) overlayStack.splice(i, 1);
    syncScrollLock();
    const back = overlayTrigger.get(node);
    overlayTrigger.delete(node);
    if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
  }

  const topOverlay = () => overlayStack[overlayStack.length - 1] || null;

  // 焦点困在最上层弹窗内，避免 Tab 跑到弹窗背后的内容
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const top = topOverlay();
    if (!top) return;
    const items = focusableIn(top);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!top.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }


  // ---------- 通用工具 ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const sample = (arr, k) => shuffle(arr).slice(0, k);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 主题 ----------
  function initTheme() {
    const saved = localStorage.getItem("cars-theme");
    if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      el.themeToggle.textContent = "☀️";
    }
  }
  function toggleTheme() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
      el.themeToggle.textContent = "🌙";
      localStorage.setItem("cars-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      el.themeToggle.textContent = "☀️";
      localStorage.setItem("cars-theme", "light");
    }
  }

  Object.assign(App, {
    cars, TTS, state, COMPARE_MAX,
    CATEGORY_EN, COUNTRY_EN, latinPart, brandEn, nameEn,
    t, carLabel, countryLabel, categoryLabel,
    el, FEATURED_IDS, uniq, categories, countries,
    FOCUSABLE, prefersReducedMotion, syncScrollLock, focusableIn,
    showOverlay, hideOverlay, topOverlay, trapFocus,
    shuffle, sample, rand, initTheme, toggleTheme,
  });
})(window.CarApp);
