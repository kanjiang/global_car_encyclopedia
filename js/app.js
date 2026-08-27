(function () {
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
  };
  // 从「英文 中文」混合串里取拉丁字母/数字部分
  function latinPart(str) {
    const m = (str || "").match(/[A-Za-z0-9][A-Za-z0-9 .\-]*/g);
    return m ? m.join(" ").trim() : "";
  }
  const brandEn = (c) => latinPart(c.brand) || c.brand;
  const nameEn = (c) => latinPart(c.name) || c.name;

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

  // ---------- 初始化 ----------
  function init() {
    renderCarousel();
    renderStats();
    renderCategoryChips();
    renderCountryOptions();
    renderHeroChips();
    bindEvents();
    render();
    initTheme();
    initScrollFx();
    bindQuiz();
    if (TTS) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {};
      window.addEventListener("beforeunload", stopSpeaking);
      initLang();
    } else {
      if (el.langToggle) el.langToggle.style.display = "none";
      if (el.autoReadBtn) el.autoReadBtn.style.display = "none";
    }
  }

  function renderStats() {
    const brands = uniq(cars.map((c) => c.brand)).length;
    const maxSpeed = Math.max(...cars.map((c) => c.topSpeed));
    const stats = [
      { icon: "🚗", value: cars.length, suffix: "", label: "收录车型" },
      { icon: "🏭", value: brands, suffix: "", label: "全球品牌" },
      { icon: "🌍", value: countries.length - 1, suffix: "", label: "覆盖国家" },
      { icon: "⚡", value: maxSpeed, suffix: " km/h", label: "最高车速" },
    ];
    el.statsGrid.innerHTML = stats
      .map(
        (s) => `
      <div class="stat-card">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-num grad" data-target="${s.value}" data-suffix="${s.suffix}">0${s.suffix}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
      )
      .join("");
    animateCounters();
  }

  function animateCounters() {
    const nums = el.statsGrid.querySelectorAll(".stat-num");
    nums.forEach((node) => {
      const target = parseInt(node.dataset.target, 10) || 0;
      const suffix = node.dataset.suffix || "";
      const duration = 1100;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- 本周精选轮播 ----------
  const carState = { index: 0, list: [], raf: null, elapsed: 0, last: 0, paused: false, duration: 5500 };

  function buildFeaturedList() {
    const picked = FEATURED_IDS.map((id) => cars.find((c) => c.id === id)).filter(Boolean);
    // 精选不足 3 张时，用「最高车速」最快且未入选的车型自动补齐
    if (picked.length < 3) {
      const chosen = new Set(picked.map((c) => c.id));
      cars
        .slice()
        .sort((a, b) => b.topSpeed - a.topSpeed)
        .forEach((c) => {
          if (picked.length < 5 && !chosen.has(c.id)) {
            picked.push(c);
            chosen.add(c.id);
          }
        });
    }
    return picked;
  }

  function renderCarousel() {
    if (!el.carSlides) return;
    carState.list = buildFeaturedList();
    if (carState.list.length === 0) {
      const section = document.getElementById("featured");
      if (section) section.style.display = "none";
      return;
    }

    el.carSlides.innerHTML = carState.list
      .map(
        (c, i) => `
      <div class="slide ${i === 0 ? "active" : ""}" data-i="${i}" ${
          c.image ? `style="background-image:url('${c.image}')"` : `style="background:${c.accent}"`
        }>
        <div class="slide-content">
          <p class="s-brand">${c.brand}</p>
          <h3 class="s-name">${c.name}</h3>
          <p class="s-summary">${c.summary}</p>
          <div class="slide-stats">
            <div class="ss"><b>${c.topSpeed}</b><span>km/h 极速</span></div>
            <div class="ss"><b>${c.accel}s</b><span>0-100 加速</span></div>
            <div class="ss"><b>${c.power}</b><span>最大功率</span></div>
          </div>
          <button class="slide-cta" data-detail="${c.id}">查看详情 →</button>
        </div>
      </div>`
      )
      .join("");

    el.carDots.innerHTML = carState.list
      .map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "active" : ""}" aria-label="第${i + 1}张"></button>`)
      .join("");

    el.carousel.setAttribute("tabindex", "0");
    bindCarousel();
    startCarousel();
  }

  function goToSlide(i) {
    const n = carState.list.length;
    carState.index = ((i % n) + n) % n;
    el.carSlides.querySelectorAll(".slide").forEach((s, idx) => {
      s.classList.toggle("active", idx === carState.index);
    });
    el.carDots.querySelectorAll("button").forEach((d, idx) => {
      d.classList.toggle("active", idx === carState.index);
    });
    resetProgress();
  }

  function resetProgress() {
    carState.elapsed = 0;
    carState.last = 0;
    if (el.carProgress) el.carProgress.style.transform = "scaleX(0)";
  }

  // 用 requestAnimationFrame 驱动进度条与自动切换（暂停/恢复更自然）
  function carTick(now) {
    if (!carState.last) carState.last = now;
    const dt = now - carState.last;
    carState.last = now;
    if (!carState.paused && carState.list.length > 1) {
      carState.elapsed += dt;
      const p = Math.min(carState.elapsed / carState.duration, 1);
      if (el.carProgress) el.carProgress.style.transform = `scaleX(${p})`;
      if (p >= 1) goToSlide(carState.index + 1);
    }
    carState.raf = requestAnimationFrame(carTick);
  }
  function startCarousel() {
    if (carState.raf) cancelAnimationFrame(carState.raf);
    resetProgress();
    carState.raf = requestAnimationFrame(carTick);
  }

  function bindCarousel() {
    el.carPrev.addEventListener("click", () => goToSlide(carState.index - 1));
    el.carNext.addEventListener("click", () => goToSlide(carState.index + 1));
    el.carDots.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-dot]");
      if (!btn) return;
      goToSlide(parseInt(btn.dataset.dot, 10));
    });
    el.carSlides.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-detail]");
      if (!btn) return;
      openModal(btn.dataset.detail);
    });

    // 悬停暂停
    el.carousel.addEventListener("mouseenter", () => (carState.paused = true));
    el.carousel.addEventListener("mouseleave", () => {
      carState.paused = false;
      carState.last = 0;
    });

    // 键盘方向键
    el.carousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") goToSlide(carState.index - 1);
      else if (e.key === "ArrowRight") goToSlide(carState.index + 1);
    });

    // 滑动手势（触摸 + 鼠标拖拽）
    let startX = null;
    let dragging = false;
    const onStart = (x) => {
      startX = x;
      dragging = true;
      carState.paused = true;
    };
    const onEnd = (x) => {
      if (!dragging || startX === null) return;
      const dx = x - startX;
      if (Math.abs(dx) > 45) goToSlide(carState.index + (dx < 0 ? 1 : -1));
      dragging = false;
      startX = null;
      carState.paused = false;
      carState.last = 0;
    };
    el.carousel.addEventListener("touchstart", (e) => onStart(e.touches[0].clientX), { passive: true });
    el.carousel.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientX), { passive: true });
    el.carousel.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      onStart(e.clientX);
    });
    window.addEventListener("pointerup", (e) => {
      if (dragging) onEnd(e.clientX);
    });
  }

  function renderCategoryChips() {
    el.categoryChips.innerHTML = categories
      .map(
        (cat) =>
          `<button data-category="${cat}" class="${
            cat === state.category ? "active" : ""
          }">${cat}</button>`
      )
      .join("");
  }

  function renderCountryOptions() {
    el.countrySelect.innerHTML = countries
      .map((c) => `<option value="${c}">${c === "全部" ? "全部国家" : c}</option>`)
      .join("");
  }

  function renderHeroChips() {
    const suggestions = ["超级跑车", "电动车", "SUV", "日本", "德国", "经典老爷车"];
    el.heroChips.innerHTML = suggestions
      .map((s) => `<button data-suggest="${s}">${s}</button>`)
      .join("");
  }

  // ---------- 事件 ----------
  function bindEvents() {
    el.searchInput.addEventListener("input", (e) => {
      state.keyword = e.target.value.trim();
      render();
    });

    el.heroSearchBtn.addEventListener("click", () => {
      applyHeroSearch(el.heroSearch.value.trim());
    });
    el.heroSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyHeroSearch(el.heroSearch.value.trim());
    });

    el.heroChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-suggest]");
      if (!btn) return;
      applyHeroSearch(btn.dataset.suggest);
    });

    el.categoryChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-category]");
      if (!btn) return;
      state.category = btn.dataset.category;
      renderCategoryChips();
      render();
    });

    el.countrySelect.addEventListener("change", (e) => {
      state.country = e.target.value;
      render();
    });

    el.sortSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      render();
    });

    el.cardGrid.addEventListener("click", (e) => {
      const sp = e.target.closest("[data-speak-card]");
      if (sp) {
        e.stopPropagation();
        const c = cars.find((x) => x.id === sp.dataset.speakCard);
        if (c) speak(cardText(c), sp);
        return;
      }
      const cmp = e.target.closest("[data-compare]");
      if (cmp) {
        e.stopPropagation();
        toggleCompare(cmp.dataset.compare);
        return;
      }
      const card = e.target.closest("[data-id]");
      if (!card) return;
      openModal(card.dataset.id);
    });

    el.modal.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-close")) {
        closeModal();
        return;
      }
      const sp = e.target.closest("[data-speak]");
      if (sp) {
        const c = cars.find((x) => x.id === sp.dataset.speak);
        if (c) speak(buildNarration(c), sp);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeCompare();
        closeQuiz();
      }
    });

    // 对比栏 & 对比弹窗
    el.compareChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-remove]");
      if (!btn) return;
      toggleCompare(btn.dataset.remove);
    });
    el.compareClear.addEventListener("click", clearCompare);
    el.compareGo.addEventListener("click", openCompare);
    el.compareModal.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-close-cmp")) closeCompare();
    });

    el.themeToggle.addEventListener("click", toggleTheme);

    if (el.langToggle) el.langToggle.addEventListener("click", toggleLang);
    if (el.autoReadBtn) el.autoReadBtn.addEventListener("click", toggleAutoRead);
  }

  // 顶部搜索：智能匹配类型 / 国家 / 关键词
  function applyHeroSearch(value) {
    if (!value) return;
    if (categories.includes(value)) {
      state.category = value;
      state.keyword = "";
      el.searchInput.value = "";
      renderCategoryChips();
    } else if (countries.includes(value)) {
      state.country = value;
      state.keyword = "";
      el.searchInput.value = "";
      el.countrySelect.value = value;
    } else {
      state.keyword = value;
      el.searchInput.value = value;
    }
    render();
    document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- 过滤 & 排序 ----------
  function getFiltered() {
    let list = cars.slice();

    if (state.category !== "全部") {
      list = list.filter((c) => c.category === state.category);
    }
    if (state.country !== "全部") {
      list = list.filter((c) => c.country === state.country);
    }
    if (state.keyword) {
      const kw = state.keyword.toLowerCase();
      list = list.filter((c) =>
        [c.name, c.brand, c.country, c.category, c.summary]
          .join(" ")
          .toLowerCase()
          .includes(kw)
      );
    }

    switch (state.sort) {
      case "speed-desc":
        list.sort((a, b) => b.topSpeed - a.topSpeed);
        break;
      case "accel-asc":
        list.sort((a, b) => a.accel - b.accel);
        break;
      case "power-desc":
        list.sort((a, b) => parseInt(b.power) - parseInt(a.power));
        break;
      case "year-asc":
        list.sort((a, b) => a.year - b.year);
        break;
      default:
        break;
    }
    return list;
  }

  // ---------- 渲染卡片 ----------
  function render() {
    stopAutoRead();
    const list = getFiltered();
    el.totalCount.textContent = list.length;

    if (list.length === 0) {
      el.cardGrid.innerHTML = "";
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;

    el.cardGrid.innerHTML = list.map(cardTemplate).join("");
    applyReveal();
    applyTilt();
  }

  function cardTemplate(c, i) {
    return `
    <article class="car-card reveal" data-id="${c.id}" style="transition-delay:${Math.min(i, 12) * 45}ms">
      <div class="car-visual" style="background:${c.accent}">
        <span class="cat-tag">${c.category}</span>
        <span class="country-tag">${c.country}</span>
        <span class="emoji">${c.emoji}</span>
        ${
          c.image
            ? `<img class="car-photo" src="${c.image}" alt="${c.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
            : ""
        }
        <button class="compare-btn ${state.compare.includes(c.id) ? "active" : ""}" data-compare="${c.id}">
          ${state.compare.includes(c.id) ? "✓ 已选" : "＋ 对比"}
        </button>
        ${TTS ? `<button class="card-speak" data-speak-card="${c.id}" aria-label="朗读 ${c.name}" title="朗读">🔊</button>` : ""}
      </div>
      <div class="car-info">
        <span class="car-brand">${c.brand}</span>
        <h3 class="car-name">${c.name}</h3>
        <p class="car-summary">${c.summary}</p>
        <div class="car-specs">
          <div class="spec"><b>${c.topSpeed}</b><span>km/h 极速</span></div>
          <div class="spec"><b>${c.accel}s</b><span>0-100</span></div>
          <div class="spec"><b>${c.power.replace(/[^0-9]/g, "") || "-"}</b><span>马力</span></div>
        </div>
      </div>
    </article>`;
  }

  // ---------- 详情弹窗 ----------
  function openModal(id) {
    const c = cars.find((x) => x.id === id);
    if (!c) return;
    stopSpeaking();

    const specs = [
      ["最高车速", c.topSpeed + " km/h"],
      ["0-100 加速", c.accel + " s"],
      ["最大功率", c.power],
      ["动力形式", c.engine],
      ["驱动", c.drivetrain],
      ["座位", c.seats + " 座"],
      ["参考价格", c.priceRMB],
    ];

    el.modalBody.innerHTML = `
      <div class="modal-hero" style="background:${c.accent}">
        <span class="emoji">${c.emoji}</span>
        ${
          c.image
            ? `<img class="modal-photo" src="${c.image}" alt="${c.name}" referrerpolicy="no-referrer" onerror="this.remove()">`
            : ""
        }
        <div class="modal-hero-title">
          <p class="m-brand-top">${c.brand}</p>
          <h3>${c.name}</h3>
        </div>
      </div>
      <div class="modal-content">
        <div class="tags"><span>🌍 ${c.country}</span><span>🏷️ ${c.category}</span><span>📅 ${c.year}</span></div>
        ${TTS ? `<button class="speak-btn" data-speak="${c.id}">🔊 朗读讲解</button>` : ""}
        <p class="summary-line">${c.summary}</p>
        <p class="desc">${c.description}</p>
        <div class="spec-grid">
          ${specs
            .map(
              ([k, v]) =>
                `<div class="spec-item"><div class="k">${k}</div><div class="v">${v}</div></div>`
            )
            .join("")}
        </div>
        <div class="facts">
          <h4>💡 你知道吗？</h4>
          <div class="fact-cards">
            ${c.facts.map((f) => `<div class="fact-card"><span class="fc-q">你知道吗？</span><span class="fc-a">${f}</span></div>`).join("")}
          </div>
        </div>
      </div>`;

    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    el.modal.hidden = true;
    document.body.style.overflow = "";
    stopSpeaking();
  }

  // ---------- 朗读讲解（语音合成，双语，面向小朋友） ----------
  let currentSpeakBtn = null;

  function pickVoice(lang) {
    if (!TTS) return null;
    const vs = window.speechSynthesis.getVoices() || [];
    const re = lang === "en" ? /^en[-_]?/i : /^zh[-_]?/i;
    return vs.find((v) => re.test(v.lang)) || null;
  }

  const speakLabel = () => (state.lang === "en" ? "🔊 Read aloud" : "🔊 朗读讲解");
  const stopLabel = () => (state.lang === "en" ? "⏸ Stop" : "⏸ 停止朗读");

  function resetSpeakBtn() {
    if (!currentSpeakBtn) return;
    currentSpeakBtn.classList.remove("speaking");
    if (currentSpeakBtn.hasAttribute("data-speak")) currentSpeakBtn.innerHTML = speakLabel();
    currentSpeakBtn = null;
  }

  function stopSpeaking() {
    if (!TTS) return;
    window.speechSynthesis.cancel();
    resetSpeakBtn();
  }

  // 构造一条朗读语句（不管理按钮状态），返回 utterance
  function makeUtterance(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === "en" ? "en-US" : "zh-CN";
    u.rate = 0.92; // 稍慢，方便小朋友听懂
    u.pitch = 1.12; // 稍微活泼一点
    const v = pickVoice(state.lang);
    if (v) u.voice = v;
    return u;
  }

  function speak(text, btn) {
    if (!TTS) return;
    stopAutoRead();
    const synth = window.speechSynthesis;
    const same = currentSpeakBtn === btn;
    synth.cancel();
    resetSpeakBtn();
    if (same) return; // 再次点击同一个按钮 = 停止

    const u = makeUtterance(text);
    u.onend = u.onerror = () => {
      if (currentSpeakBtn === btn) resetSpeakBtn();
    };
    currentSpeakBtn = btn;
    btn.classList.add("speaking");
    if (btn.hasAttribute("data-speak")) btn.innerHTML = stopLabel();
    synth.speak(u);
  }

  // 详情讲解词（双语）
  function buildNarration(c) {
    if (state.lang === "en") {
      return (
        `The ${brandEn(c)} ${nameEn(c)} is a ${CATEGORY_EN[c.category] || c.category} from ${COUNTRY_EN[c.country] || c.country}, introduced in ${c.year}. ` +
        `It reaches a top speed of ${c.topSpeed} kilometers per hour, and accelerates from zero to one hundred in just ${c.accel} seconds.`
      );
    }
    return (
      `这是来自${c.country}的${c.brand}，${c.name}。${c.summary}。` +
      `它属于${c.category}，在${c.year}年推出。` +
      `它跑起来最快每小时可以到${c.topSpeed}公里，` +
      `从停下来加速到每小时一百公里，只要${c.accel}秒哦。` +
      `${c.description} ` +
      `再告诉你几个有趣的小知识：${c.facts.join("；")}。`
    );
  }

  // 卡片快速朗读词（双语）
  function cardText(c) {
    if (state.lang === "en") {
      return `The ${brandEn(c)} ${nameEn(c)}. A ${CATEGORY_EN[c.category] || c.category} from ${COUNTRY_EN[c.country] || c.country}.`;
    }
    return `${c.name}。${c.summary}`;
  }

  // ---------- 整页自动连读 ----------
  const autoState = { queue: [], index: 0 };

  function toggleAutoRead() {
    if (state.autoReading) {
      stopAutoRead();
    } else {
      startAutoRead();
    }
  }

  function startAutoRead() {
    if (!TTS) return;
    const list = getFiltered();
    if (list.length === 0) return;
    stopSpeaking();
    autoState.queue = list;
    autoState.index = 0;
    state.autoReading = true;
    if (el.autoReadBtn) {
      el.autoReadBtn.classList.add("reading");
      el.autoReadBtn.innerHTML = state.lang === "en" ? "⏹ Stop reading" : "⏹ 停止连读";
    }
    readNext();
  }

  function readNext() {
    if (!state.autoReading) return;
    if (autoState.index >= autoState.queue.length) {
      stopAutoRead();
      return;
    }
    const c = autoState.queue[autoState.index];
    highlightReadingCard(c.id);
    const u = makeUtterance(cardText(c));
    u.onend = () => {
      if (!state.autoReading) return;
      autoState.index += 1;
      readNext();
    };
    u.onerror = () => stopAutoRead();
    window.speechSynthesis.speak(u);
  }

  function highlightReadingCard(id) {
    el.cardGrid.querySelectorAll(".car-card.reading").forEach((n) => n.classList.remove("reading"));
    const card = el.cardGrid.querySelector(`.car-card[data-id="${id}"]`);
    if (card) {
      card.classList.add("reading");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function stopAutoRead() {
    if (!TTS) return;
    const was = state.autoReading;
    state.autoReading = false;
    if (was) window.speechSynthesis.cancel();
    el.cardGrid.querySelectorAll(".car-card.reading").forEach((n) => n.classList.remove("reading"));
    if (el.autoReadBtn) {
      el.autoReadBtn.classList.remove("reading");
      el.autoReadBtn.innerHTML = state.lang === "en" ? "🎧 Read this page" : "🎧 连读本页";
    }
  }

  // ---------- 语言切换 ----------
  function initLang() {
    const saved = localStorage.getItem("cars-lang");
    if (saved === "en") state.lang = "en";
    updateLangUI();
  }
  function toggleLang() {
    stopSpeaking();
    stopAutoRead();
    state.lang = state.lang === "en" ? "zh" : "en";
    localStorage.setItem("cars-lang", state.lang);
    updateLangUI();
  }
  function updateLangUI() {
    if (el.langToggle) el.langToggle.innerHTML = state.lang === "en" ? "🌐 EN" : "🌐 中";
    if (el.autoReadBtn && !state.autoReading)
      el.autoReadBtn.innerHTML = state.lang === "en" ? "🎧 Read this page" : "🎧 连读本页";
  }

  // ---------- 车型对比 ----------
  function toggleCompare(id) {
    const idx = state.compare.indexOf(id);
    if (idx >= 0) {
      state.compare.splice(idx, 1);
    } else {
      if (state.compare.length >= COMPARE_MAX) {
        flashCompareBar();
        return;
      }
      state.compare.push(id);
    }
    updateCompareButtons();
    renderCompareBar();
  }

  function clearCompare() {
    state.compare = [];
    updateCompareButtons();
    renderCompareBar();
  }

  function updateCompareButtons() {
    el.cardGrid.querySelectorAll("[data-compare]").forEach((btn) => {
      const on = state.compare.includes(btn.dataset.compare);
      btn.classList.toggle("active", on);
      btn.textContent = on ? "✓ 已选" : "＋ 对比";
    });
  }

  function renderCompareBar() {
    if (state.compare.length === 0) {
      el.compareBar.classList.remove("show");
      return;
    }
    el.compareBar.classList.add("show");
    el.compareChips.innerHTML = state.compare
      .map((id) => {
        const c = cars.find((x) => x.id === id);
        return `<span class="cmp-chip">${c.emoji} ${c.name}<button data-remove="${id}" aria-label="移除">✕</button></span>`;
      })
      .join("");
    el.compareCount.textContent = state.compare.length;
    el.compareGo.disabled = state.compare.length < 2;
  }

  function flashCompareBar() {
    el.compareBar.classList.remove("flash");
    void el.compareBar.offsetWidth;
    el.compareBar.classList.add("flash");
  }

  const CMP_ROWS = [
    { k: "车型图片", type: "img" },
    { k: "品牌", get: (c) => c.brand },
    { k: "类型", get: (c) => c.category },
    { k: "产地", get: (c) => c.country },
    { k: "年代", get: (c) => c.year },
    { k: "最高车速", get: (c) => c.topSpeed + " km/h", val: (c) => c.topSpeed, best: "max" },
    { k: "0-100 加速", get: (c) => c.accel + " s", val: (c) => c.accel, best: "min" },
    { k: "最大功率", get: (c) => c.power, val: (c) => parseInt(c.power, 10) || 0, best: "max" },
    { k: "动力形式", get: (c) => c.engine },
    { k: "驱动", get: (c) => c.drivetrain },
    { k: "座位", get: (c) => c.seats + " 座" },
    { k: "参考价格", get: (c) => c.priceRMB },
  ];

  function openCompare() {
    if (state.compare.length < 2) return;
    const list = state.compare.map((id) => cars.find((c) => c.id === id)).filter(Boolean);

    const header =
      `<div class="cmp-cell cmp-corner">参数</div>` +
      list
        .map(
          (c) => `
        <div class="cmp-cell cmp-head" style="background:${c.accent}">
          ${c.image ? `<img src="${c.image}" alt="${c.name}" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="cmp-emoji">${c.emoji}</span>`}
          <span class="cmp-head-name">${c.name}</span>
          <span class="cmp-head-brand">${c.brand}</span>
        </div>`
        )
        .join("");

    const rowsHtml = CMP_ROWS.map((row) => {
      if (row.type === "img") return "";
      let bestVal = null;
      if (row.best) {
        const vals = list.map(row.val);
        bestVal = row.best === "max" ? Math.max(...vals) : Math.min(...vals);
      }
      const cells = list
        .map((c) => {
          const isBest = row.best && row.val(c) === bestVal && list.length > 1;
          return `<div class="cmp-cell ${isBest ? "best" : ""}">${row.get(c)}${isBest ? " <span class='crown'>★</span>" : ""}</div>`;
        })
        .join("");
      return `<div class="cmp-cell cmp-key">${row.k}</div>${cells}`;
    }).join("");

    el.compareBody.innerHTML = `
      <h3 class="cmp-modal-title">车型参数对比 <span class="muted small">（★ 为该项最优）</span></h3>
      <div class="cmp-table" style="grid-template-columns: 120px repeat(${list.length}, minmax(140px, 1fr));">
        ${header}
        ${rowsHtml}
      </div>`;
    el.compareModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCompare() {
    if (el.compareModal) el.compareModal.hidden = true;
    if (el.modal && el.modal.hidden) document.body.style.overflow = "";
  }

  // ---------- 滚动渐入 ----------
  let revealObserver = null;
  function applyReveal() {
    if (!("IntersectionObserver" in window)) {
      el.cardGrid.querySelectorAll(".reveal").forEach((n) => n.classList.add("in"));
      return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    el.cardGrid.querySelectorAll(".reveal").forEach((n) => revealObserver.observe(n));
  }

  // ---------- 卡片 3D 倾斜 ----------
  function applyTilt() {
    if (window.matchMedia("(hover: none)").matches) return;
    el.cardGrid.querySelectorAll(".car-card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-6px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  // ---------- 滚动进度 & 头部阴影 ----------
  function initScrollFx() {
    const onScroll = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      if (el.scrollProgress) el.scrollProgress.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + "%";
      if (el.header) el.header.classList.toggle("scrolled", scrolled > 12);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------- 小小汽车问答小游戏 ----------
  const QUIZ_TOTAL = 10;
  const QUIZ_TIME = 10000; // 计时模式每题限时（毫秒）
  const quiz = { questions: [], index: 0, score: 0, answered: false, mode: "mix", streak: 0, bestStreak: 0, timerRAF: null };

  // 用 Web Audio 合成答对/答错音效（无需外部文件，离线可用）
  let audioCtx = null;
  function playSound(kind) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const notes = kind === "ok" ? [660, 880, 1320] : [320, 200];
      let t = audioCtx.currentTime;
      notes.forEach((f) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = kind === "ok" ? "triangle" : "sawtooth";
        o.frequency.value = f;
        o.connect(g);
        g.connect(audioCtx.destination);
        const dur = kind === "ok" ? 0.12 : 0.18;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t);
        o.stop(t + dur);
        t += dur * 0.9;
      });
    } catch (e) {
      /* 忽略音频错误 */
    }
  }

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

  // 面向浏览器直接朗读一段中文（用于读题/鼓励语）
  function readText(text) {
    if (!TTS) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[^\u4e00-\u9fa5A-Za-z0-9，。？！、,.?! ]/g, ""));
    u.lang = "zh-CN";
    u.rate = 0.95;
    u.pitch = 1.12;
    const v = pickVoice("zh");
    if (v) u.voice = v;
    synth.speak(u);
  }

  function nameOptions(correct) {
    const others = sample(cars.filter((c) => c.id !== correct.id), 3);
    return shuffle([correct, ...others]).map((c) => ({ label: `${c.emoji} ${c.name}`, correct: c.id === correct.id }));
  }
  function valueQuestion(prompt, valFn, mode, pool) {
    const src = pool && pool.length >= 4 ? pool : cars;
    const four = sample(src, 4);
    const vals = four.map(valFn);
    const best = mode === "min" ? Math.min(...vals) : Math.max(...vals);
    const options = shuffle(four).map((c) => ({ label: `${c.emoji} ${c.name}`, correct: valFn(c) === best }));
    return { prompt, options };
  }
  function pickFromSet(list, correctVal) {
    const distract = sample(list.filter((v) => v !== correctVal), 3);
    return shuffle([correctVal, ...distract]).map((v) => ({ label: v, correct: v === correctVal }));
  }

  const QUIZ_BUILDERS = {
    name: (pool) => {
      const c = rand(pool);
      return { prompt: "🔍 猜猜这是哪辆车？", image: c.image, options: nameOptions(c) };
    },
    country: (pool) => {
      const c = rand(pool);
      return { prompt: `🌍 ${c.name} 来自哪个国家？`, image: c.image, options: pickFromSet(uniq(cars.map((x) => x.country)), c.country) };
    },
    category: (pool) => {
      const c = rand(pool);
      return { prompt: `🏷️ ${c.name} 属于哪种车？`, image: c.image, options: pickFromSet(uniq(cars.map((x) => x.category)), c.category) };
    },
    fastest: (pool) => valueQuestion("🏁 下面哪辆车跑得最快？", (c) => c.topSpeed, "max", pool),
    power: (pool) => valueQuestion("💪 谁的马力最大？", (c) => parseInt(c.power, 10) || 0, "max", pool),
    quick: (pool) => valueQuestion("⚡ 谁的加速最快（0-100 最快）？", (c) => c.accel, "min", pool),
  };

  const ALL_KEYS = Object.keys(QUIZ_BUILDERS);
  const superPool = cars.filter((c) => /跑车|超跑|超级/.test(c.category));
  const QUIZ_MODES = {
    mix: { label: "🎲 混合挑战", desc: "各种题型都有", keys: ALL_KEYS, pool: () => cars },
    name: { label: "🔍 看图猜车", desc: "看图片猜车名", keys: ["name"], pool: () => cars },
    country: { label: "🌍 认识国家", desc: "猜车来自哪国", keys: ["country"], pool: () => cars },
    category: { label: "🏷️ 认识车型", desc: "猜它是哪种车", keys: ["category"], pool: () => cars },
    battle: { label: "🏆 巅峰对决", desc: "比谁更快更强", keys: ["fastest", "power", "quick"], pool: () => cars },
    super: { label: "🏎️ 超跑专场", desc: "只考超级跑车", keys: ALL_KEYS, pool: () => (superPool.length >= 4 ? superPool : cars) },
    timed: { label: "⏱️ 计时挑战", desc: "每题限时抢答", keys: ALL_KEYS, pool: () => cars, timed: true },
  };

  // 连击彩带庆祝
  function launchConfetti() {
    const host = el.quizModal;
    if (!host) return;
    const colors = ["#38bdf8", "#a855f7", "#f43f5e", "#22c55e", "#f7b500", "#fb923c"];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.2 + "s";
      host.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  function clearTimer() {
    if (quiz.timerRAF) {
      cancelAnimationFrame(quiz.timerRAF);
      quiz.timerRAF = null;
    }
  }

  function startTimer() {
    clearTimer();
    const bar = el.quizBody.querySelector("#quizTimerBar");
    if (!bar) return;
    const start = performance.now();
    const tick = (now) => {
      const left = Math.max(0, 1 - (now - start) / QUIZ_TIME);
      bar.style.width = left * 100 + "%";
      bar.classList.toggle("low", left <= 0.3);
      if (left <= 0) {
        timeUp();
        return;
      }
      quiz.timerRAF = requestAnimationFrame(tick);
    };
    quiz.timerRAF = requestAnimationFrame(tick);
  }

  function timeUp() {
    clearTimer();
    if (quiz.answered) return;
    quiz.answered = true;
    quiz.streak = 0;
    const q = quiz.questions[quiz.index];
    el.quizBody.querySelectorAll(".quiz-option").forEach((b, i) => {
      b.disabled = true;
      if (q.options[i].correct) b.classList.add("correct");
    });
    const fb = el.quizBody.querySelector("#quizFeedback");
    const ans = q.options.find((o) => o.correct);
    const last = quiz.index + 1 >= QUIZ_TOTAL;
    fb.innerHTML = `<span class="fb-no">⏰ 时间到！正确答案是：${ans ? ans.label : ""}</span>`;
    playSound("no");
    readText("时间到啦");
    fb.innerHTML += `<button class="quiz-next" data-next>${last ? "🏆 看结果" : "下一题 →"}</button>`;
  }

  function genQuestions(n, modeKey) {
    const mode = QUIZ_MODES[modeKey] || QUIZ_MODES.mix;
    const pool = mode.pool();
    const qs = [];
    for (let i = 0; i < n; i++) qs.push(QUIZ_BUILDERS[rand(mode.keys)](pool));
    return qs;
  }

  function openQuiz() {
    stopSpeaking();
    stopAutoRead();
    el.quizModal.hidden = false;
    document.body.style.overflow = "hidden";
    renderStart();
  }

  function renderStart() {
    el.quizBody.innerHTML = `
      <div class="quiz-start">
        <div class="quiz-start-emoji">🎮</div>
        <h3 class="quiz-start-title">选择一个挑战</h3>
        <div class="quiz-modes">
          ${Object.entries(QUIZ_MODES)
            .map(([k, m]) => `<button class="quiz-mode" data-mode="${k}"><span class="qm-label">${m.label}</span><span class="qm-desc">${m.desc}</span></button>`)
            .join("")}
        </div>
      </div>`;
  }

  function startGame(modeKey) {
    stopSpeaking();
    quiz.mode = modeKey;
    quiz.questions = genQuestions(QUIZ_TOTAL, modeKey);
    quiz.index = 0;
    quiz.score = 0;
    quiz.streak = 0;
    quiz.bestStreak = 0;
    renderQuestion();
  }

  function closeQuiz() {
    if (!el.quizModal) return;
    clearTimer();
    el.quizModal.hidden = true;
    document.body.style.overflow = "";
    if (TTS) window.speechSynthesis.cancel();
  }

  function renderQuestion() {
    clearTimer();
    const q = quiz.questions[quiz.index];
    const timed = QUIZ_MODES[quiz.mode] && QUIZ_MODES[quiz.mode].timed;
    quiz.answered = false;
    const progress = (quiz.index / QUIZ_TOTAL) * 100;
    const streakBadge = quiz.streak >= 2 ? `<span id="quizStreak" class="quiz-streak">🔥 ${quiz.streak}</span>` : `<span id="quizStreak"></span>`;
    el.quizBody.innerHTML = `
      <div class="quiz-top">
        <div class="quiz-progress"><span style="width:${progress}%"></span></div>
        <div class="quiz-meta"><span>第 ${quiz.index + 1} / ${QUIZ_TOTAL} 题</span>${streakBadge}<span id="quizScore">⭐ ${quiz.score}</span></div>
        ${timed ? `<div class="quiz-timer"><span id="quizTimerBar" style="width:100%"></span></div>` : ""}
      </div>
      ${q.image ? `<div class="quiz-image"><img src="${q.image}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ""}
      <div class="quiz-prompt-row">
        <h3 class="quiz-prompt">${q.prompt}</h3>
        ${TTS ? `<button class="quiz-read" data-read aria-label="读题">🔊 读题</button>` : ""}
      </div>
      <div class="quiz-options">
        ${q.options.map((o, i) => `<button class="quiz-option" data-opt="${i}">${o.label}</button>`).join("")}
      </div>
      <div class="quiz-feedback" id="quizFeedback"></div>`;
    if (timed) startTimer();
  }

  function answerQuiz(optIndex) {
    if (quiz.answered) return;
    quiz.answered = true;
    clearTimer();
    const q = quiz.questions[quiz.index];
    const chosen = q.options[optIndex];
    const btns = el.quizBody.querySelectorAll(".quiz-option");
    btns.forEach((b, i) => {
      b.disabled = true;
      if (q.options[i].correct) b.classList.add("correct");
      if (i === optIndex && !chosen.correct) b.classList.add("wrong");
    });
    const fb = el.quizBody.querySelector("#quizFeedback");
    const last = quiz.index + 1 >= QUIZ_TOTAL;
    if (chosen.correct) {
      quiz.score += 1;
      quiz.streak += 1;
      if (quiz.streak > quiz.bestStreak) quiz.bestStreak = quiz.streak;
      const scoreEl = el.quizBody.querySelector("#quizScore");
      if (scoreEl) scoreEl.textContent = `⭐ ${quiz.score}`;
      const streakEl = el.quizBody.querySelector("#quizStreak");
      if (streakEl) streakEl.className = "quiz-streak";
      if (streakEl && quiz.streak >= 2) streakEl.textContent = `🔥 ${quiz.streak}`;
      let combo = "";
      if (quiz.streak >= 3) {
        combo = `<span class="quiz-combo">🔥 ${quiz.streak} 连对！太棒啦！</span>`;
        launchConfetti();
        playSound("ok");
        readText(rand(["连对啦，太厉害了", "哇，连对好几题", "你是汽车小天才"]));
      } else {
        playSound("ok");
        readText(rand(["答对啦，真棒", "太厉害了", "答对了，你真聪明"]));
      }
      fb.innerHTML = `<span class="fb-ok">🎉 答对啦！</span>${combo}`;
    } else {
      quiz.streak = 0;
      const ans = q.options.find((o) => o.correct);
      fb.innerHTML = `<span class="fb-no">😊 没关系，正确答案是：${ans ? ans.label : ""}</span>`;
      playSound("no");
      readText("没关系，再试试看");
    }
    fb.innerHTML += `<button class="quiz-next" data-next>${last ? "🏆 看结果" : "下一题 →"}</button>`;
  }

  function nextQuiz() {
    clearTimer();
    quiz.index += 1;
    if (quiz.index >= QUIZ_TOTAL) renderResult();
    else renderQuestion();
  }

  function renderResult() {
    const s = quiz.score;
    const t = QUIZ_TOTAL;
    const pct = s / t;
    const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct >= 0.3 ? 1 : 0;
    const starStr = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    let msg;
    if (pct >= 0.9) msg = "太厉害啦，你是汽车小达人！🏆";
    else if (pct >= 0.6) msg = "很棒哦，继续加油！👍";
    else if (pct >= 0.3) msg = "不错的开始，再玩一次会更好！💪";
    else msg = "没关系，多玩几次就记住啦！🚗";
    const streakLine = quiz.bestStreak >= 2 ? `<p class="quiz-result-streak">🔥 最高连对 ${quiz.bestStreak} 题</p>` : "";
    if (pct >= 0.6) launchConfetti();
    el.quizBody.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result-stars">${starStr}</div>
        <h3>你答对了 ${s} / ${t} 题</h3>
        ${streakLine}
        <p class="quiz-result-msg">${msg}</p>
        <div class="quiz-result-actions">
          <button class="quiz-next" data-replay>🔁 再玩一次</button>
          <button class="quiz-close-btn" data-restart>🎮 换个挑战</button>
          <button class="quiz-close-btn" data-close-quiz>关闭</button>
        </div>
      </div>`;
    readText(`你答对了${s}题。${msg}`);
  }

  function bindQuiz() {
    if (el.quizStartBtn) el.quizStartBtn.addEventListener("click", openQuiz);
    if (!el.quizModal) return;
    el.quizModal.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-close-quiz")) {
        closeQuiz();
        return;
      }
      const modeBtn = e.target.closest("[data-mode]");
      if (modeBtn) {
        startGame(modeBtn.dataset.mode);
        return;
      }
      const opt = e.target.closest("[data-opt]");
      if (opt) {
        answerQuiz(parseInt(opt.dataset.opt, 10));
        return;
      }
      if (e.target.closest("[data-next]")) {
        nextQuiz();
        return;
      }
      if (e.target.closest("[data-replay]")) {
        startGame(quiz.mode);
        return;
      }
      if (e.target.closest("[data-restart]")) {
        renderStart();
        return;
      }
      if (e.target.closest("[data-read]")) {
        readText(quiz.questions[quiz.index].prompt);
      }
    });
  }

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

  init();
})();
