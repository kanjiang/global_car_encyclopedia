// 语音朗读：讲解、整页连读、语言切换
(function (App) {
  "use strict";

  const { cars, state, el, TTS, CATEGORY_EN, COUNTRY_EN, brandEn, nameEn, prefersReducedMotion } = App;
  // 跨模块调用延迟绑定，不依赖脚本加载顺序
  const getFiltered = (...a) => App.getFiltered(...a);
  const renderStart = (...a) => App.renderStart(...a);

  // ---------- 朗读讲解（语音合成，双语，面向小朋友） ----------
  let currentSpeakBtn = null;
  let currentUtterance = null;

  function primeVoices() {
    if (!TTS) return [];
    const voices = window.speechSynthesis.getVoices() || [];
    return voices;
  }

  function resumeSpeech(synth) {
    if (typeof synth.resume !== "function") return;
    try {
      synth.resume();
    } catch (e) {
      /* 忽略浏览器语音恢复错误 */
    }
  }

  function pickVoice(lang) {
    if (!TTS) return null;
    const vs = primeVoices();
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
    currentUtterance = null;
    resetSpeakBtn();
  }

  function playUtterance(u, opts = {}) {
    if (!TTS) return;
    const synth = window.speechSynthesis;
    if (opts.cancel) synth.cancel();
    currentUtterance = u;
    resumeSpeech(synth);
    synth.speak(u);
    // Chrome/Edge 在部分系统上会进入 paused 状态，轻推一次可恢复发声。
    window.setTimeout(() => {
      if (currentUtterance === u) resumeSpeech(synth);
    }, 120);
  }

  // 构造一条朗读语句（不管理按钮状态），返回 utterance
  function makeUtterance(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === "en" ? "en-US" : "zh-CN";
    u.rate = 0.92; // 稍慢，方便小朋友听懂
    u.pitch = 1.12; // 稍微活泼一点
    u.volume = 1;
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
      if (currentUtterance === u) currentUtterance = null;
      if (currentSpeakBtn === btn) resetSpeakBtn();
    };
    currentSpeakBtn = btn;
    btn.classList.add("speaking");
    if (btn.hasAttribute("data-speak")) btn.innerHTML = stopLabel();
    playUtterance(u);
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
    playUtterance(u);
  }

  function highlightReadingCard(id) {
    el.cardGrid.querySelectorAll(".car-card.reading").forEach((n) => n.classList.remove("reading"));
    const card = el.cardGrid.querySelector(`.car-card[data-id="${id}"]`);
    if (card) {
      card.classList.add("reading");
      card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
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
    // 游戏停在选关页时立刻换语言；答题途中不打断，下一屏生效
    if (el.quizModal && !el.quizModal.hidden && el.quizBody.querySelector(".quiz-start")) renderStart();
  }
  function updateLangUI() {
    if (el.langToggle) el.langToggle.innerHTML = state.lang === "en" ? "🌐 EN" : "🌐 中";
    if (el.autoReadBtn && !state.autoReading)
      el.autoReadBtn.innerHTML = state.lang === "en" ? "🎧 Read this page" : "🎧 连读本页";
  }


  // ---------- 短句朗读（供小游戏读题与鼓励语使用） ----------
  // 朗读一小段文字（用于读题/鼓励语），跟随当前朗读语言
  function readText(text) {
    if (!TTS) return;
    const u = new SpeechSynthesisUtterance(String(text).replace(/[^\u4e00-\u9fa5A-Za-z0-9，。？！、,.?!' ]/g, ""));
    u.lang = state.lang === "en" ? "en-US" : "zh-CN";
    u.rate = 0.95;
    u.pitch = 1.12;
    u.volume = 1;
    const v = pickVoice(state.lang);
    if (v) u.voice = v;
    u.onend = u.onerror = () => {
      if (currentUtterance === u) currentUtterance = null;
    };
    playUtterance(u, { cancel: true });
  }

  Object.assign(App, {
    primeVoices, pickVoice, stopSpeaking, playUtterance, makeUtterance,
    speak, buildNarration, cardText, readText,
    toggleAutoRead, startAutoRead, stopAutoRead,
    initLang, toggleLang, updateLangUI,
  });
})(window.CarApp);
