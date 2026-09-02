// 「小小汽车问答」小游戏
(function (App) {
  "use strict";

  const {
    cars, el, TTS, uniq, t, carLabel, countryLabel, categoryLabel, nameEn,
    shuffle, sample, rand, showOverlay, hideOverlay, prefersReducedMotion,
  } = App;
  const stopSpeaking = (...a) => App.stopSpeaking(...a);
  const stopAutoRead = (...a) => App.stopAutoRead(...a);
  const readText = (...a) => App.readText(...a);

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



  function nameOptions(correct, pool) {
    const src = pool && pool.length >= 4 ? pool : cars;
    const others = sample(src.filter((c) => c.id !== correct.id), 3);
    return shuffle([correct, ...others]).map((c) => ({ label: carLabel(c), correct: c.id === correct.id }));
  }

  // 数据里存在并列值（如 4 辆车同为 2.9s），必须保证最优值唯一，
  // 否则一道题会出现多个正确选项。做法：先选出胜者，再从「严格更差」的车里抽干扰项。
  function valueQuestion(prompt, valFn, mode, pool, key) {
    const src = pool && pool.length >= 4 ? pool : cars;
    const isBetter = (a, b) => (mode === "min" ? a < b : a > b);
    for (const winner of shuffle(src)) {
      const wv = valFn(winner);
      const worse = src.filter((c) => c.id !== winner.id && isBetter(wv, valFn(c)));
      if (worse.length >= 3) {
        const four = shuffle([winner, ...sample(worse, 3)]);
        return {
          prompt,
          key: `${key}:${winner.id}`,
          options: four.map((c) => ({ label: carLabel(c), correct: c.id === winner.id })),
        };
      }
    }
    return null;
  }

  function pickFromSet(list, correctVal, labelFn) {
    const distract = sample(list.filter((v) => v !== correctVal), 3);
    return shuffle([correctVal, ...distract]).map((v) => ({ label: labelFn(v), correct: v === correctVal }));
  }

  const QUIZ_BUILDERS = {
    name: (pool) => {
      const c = rand(pool);
      return {
        prompt: t("🔍 猜猜这是哪辆车？", "🔍 Which car is this?"),
        image: c.image,
        key: `name:${c.id}`,
        options: nameOptions(c, pool),
      };
    },
    country: (pool) => {
      const c = rand(pool);
      return {
        prompt: t(`🌍 ${c.name} 来自哪个国家？`, `🌍 Which country is the ${nameEn(c)} from?`),
        image: c.image,
        key: `country:${c.id}`,
        options: pickFromSet(uniq(cars.map((x) => x.country)), c.country, countryLabel),
      };
    },
    category: (pool) => {
      const c = rand(pool);
      return {
        prompt: t(`🏷️ ${c.name} 属于哪种车？`, `🏷️ What kind of car is the ${nameEn(c)}?`),
        image: c.image,
        key: `category:${c.id}`,
        options: pickFromSet(uniq(cars.map((x) => x.category)), c.category, categoryLabel),
      };
    },
    fastest: (pool) => valueQuestion(t("🏁 下面哪辆车跑得最快？", "🏁 Which car is the fastest?"), (c) => c.topSpeed, "max", pool, "fastest"),
    power: (pool) =>
      valueQuestion(t("💪 谁的马力最大？", "💪 Which car has the most horsepower?"), (c) => parseInt(c.power, 10) || 0, "max", pool, "power"),
    quick: (pool) =>
      valueQuestion(t("⚡ 谁的加速最快（0-100 最快）？", "⚡ Which car accelerates fastest (0-100)?"), (c) => c.accel, "min", pool, "quick"),
  };

  const ALL_KEYS = Object.keys(QUIZ_BUILDERS);
  const superPool = cars.filter((c) => /跑车|超跑|超级/.test(c.category));
  const QUIZ_MODES = {
    mix: { label: "🎲 混合挑战", labelEn: "🎲 Mixed", desc: "各种题型都有", descEn: "A bit of everything", keys: ALL_KEYS, pool: () => cars },
    name: { label: "🔍 看图猜车", labelEn: "🔍 Guess the car", desc: "看图片猜车名", descEn: "Name it from a photo", keys: ["name"], pool: () => cars },
    country: { label: "🌍 认识国家", labelEn: "🌍 Countries", desc: "猜车来自哪国", descEn: "Where is it from?", keys: ["country"], pool: () => cars },
    category: { label: "🏷️ 认识车型", labelEn: "🏷️ Car types", desc: "猜它是哪种车", descEn: "What kind of car?", keys: ["category"], pool: () => cars },
    battle: {
      label: "🏆 巅峰对决",
      labelEn: "🏆 Showdown",
      desc: "比谁更快更强",
      descEn: "Faster and stronger",
      keys: ["fastest", "power", "quick"],
      pool: () => cars,
    },
    super: {
      label: "🏎️ 超跑专场",
      labelEn: "🏎️ Supercars",
      desc: "只考超级跑车",
      descEn: "Supercars only",
      keys: ALL_KEYS,
      pool: () => (superPool.length >= 4 ? superPool : cars),
    },
    timed: {
      label: "⏱️ 计时挑战",
      labelEn: "⏱️ Time attack",
      desc: "每题限时抢答",
      descEn: "Beat the clock",
      keys: ALL_KEYS,
      pool: () => cars,
      timed: true,
    },
  };
  const modeLabel = (k) => {
    const m = QUIZ_MODES[k] || QUIZ_MODES.mix;
    return t(m.label, m.labelEn);
  };

  // 本地最佳成绩（按模式记录）
  const QUIZ_BEST_KEY = "quizBest";
  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(QUIZ_BEST_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveBest(obj) {
    try {
      localStorage.setItem(QUIZ_BEST_KEY, JSON.stringify(obj));
    } catch (e) {
      /* 忽略存储错误 */
    }
  }

  // 连击彩带庆祝
  function launchConfetti() {
    const host = el.quizModal;
    if (!host || prefersReducedMotion()) return;
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
    const answer = ans ? ans.label : "";
    const last = quiz.index + 1 >= QUIZ_TOTAL;
    fb.innerHTML = `<span class="fb-no">${t(`⏰ 时间到！正确答案是：${answer}`, `⏰ Time's up! The answer is: ${answer}`)}</span>`;
    playSound("no");
    readText(t("时间到啦", "Time is up"));
    fb.innerHTML += `<button class="quiz-next" data-next>${
      last ? t("🏆 看结果", "🏆 See results") : t("下一题 →", "Next →")
    }</button>`;
  }

  function genQuestions(n, modeKey) {
    const mode = QUIZ_MODES[modeKey] || QUIZ_MODES.mix;
    const pool = mode.pool();
    const qs = [];
    const used = new Set();
    // 同一「题型 + 车型」在一轮里只出现一次
    for (let guard = 0; qs.length < n && guard < n * 40; guard++) {
      const q = QUIZ_BUILDERS[rand(mode.keys)](pool);
      if (!q || used.has(q.key)) continue;
      used.add(q.key);
      qs.push(q);
    }
    // 题库太小时允许重复，保证题数固定
    for (let guard = 0; qs.length < n && guard < n * 40; guard++) {
      const q = QUIZ_BUILDERS[rand(mode.keys)](pool);
      if (q) qs.push(q);
    }
    return qs;
  }

  function openQuiz() {
    stopSpeaking();
    stopAutoRead();
    renderStart();
    showOverlay(el.quizModal);
  }

  function renderStart() {
    const best = loadBest();
    el.quizBody.innerHTML = `
      <div class="quiz-start">
        <div class="quiz-start-emoji">🎮</div>
        <h3 class="quiz-start-title">${t("选择一个挑战", "Pick a challenge")}</h3>
        <div class="quiz-modes">
          ${Object.entries(QUIZ_MODES)
            .map(
              ([k, m]) =>
                `<button class="quiz-mode" data-mode="${k}"><span class="qm-label">${t(m.label, m.labelEn)}</span><span class="qm-desc">${t(
                  m.desc,
                  m.descEn
                )}</span>${
                  best[k] != null
                    ? `<span class="qm-best">${t(`🏅 最佳 ${best[k]}/${QUIZ_TOTAL}`, `🏅 Best ${best[k]}/${QUIZ_TOTAL}`)}</span>`
                    : ""
                }</button>`
            )
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
    hideOverlay(el.quizModal);
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
        <div class="quiz-meta"><span>${t(
          `第 ${quiz.index + 1} / ${QUIZ_TOTAL} 题`,
          `Question ${quiz.index + 1} / ${QUIZ_TOTAL}`
        )}</span>${streakBadge}<span id="quizScore">⭐ ${quiz.score}</span></div>
        ${timed ? `<div class="quiz-timer"><span id="quizTimerBar" style="width:100%"></span></div>` : ""}
      </div>
      ${q.image ? `<div class="quiz-image"><img src="${q.image}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ""}
      <div class="quiz-prompt-row">
        <h3 class="quiz-prompt">${q.prompt}</h3>
        ${TTS ? `<button class="quiz-read" data-read aria-label="${t("读题", "Read question")}">🔊 ${t("读题", "Read")}</button>` : ""}
      </div>
      <div class="quiz-options">
        ${q.options.map((o, i) => `<button class="quiz-option" data-opt="${i}">${o.label}</button>`).join("")}
      </div>
      <div class="quiz-feedback" id="quizFeedback" role="status" aria-live="polite"></div>`;
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
        combo = `<span class="quiz-combo">${t(`🔥 ${quiz.streak} 连对！太棒啦！`, `🔥 ${quiz.streak} in a row! Awesome!`)}</span>`;
        launchConfetti();
        playSound("ok");
        readText(rand(t(["连对啦，太厉害了", "哇，连对好几题", "你是汽车小天才"], ["Great streak", "Wow, several in a row", "You are a car genius"])));
      } else {
        playSound("ok");
        readText(rand(t(["答对啦，真棒", "太厉害了", "答对了，你真聪明"], ["That's right, well done", "Awesome", "Correct, you are smart"])));
      }
      fb.innerHTML = `<span class="fb-ok">${t("🎉 答对啦！", "🎉 Correct!")}</span>${combo}`;
    } else {
      quiz.streak = 0;
      const ans = q.options.find((o) => o.correct);
      const answer = ans ? ans.label : "";
      fb.innerHTML = `<span class="fb-no">${t(`😊 没关系，正确答案是：${answer}`, `😊 Not quite. The answer is: ${answer}`)}</span>`;
      playSound("no");
      readText(t("没关系，再试试看", "Never mind, try again"));
    }
    fb.innerHTML += `<button class="quiz-next" data-next>${
      last ? t("🏆 看结果", "🏆 See results") : t("下一题 →", "Next →")
    }</button>`;
  }

  function nextQuiz() {
    clearTimer();
    quiz.index += 1;
    if (quiz.index >= QUIZ_TOTAL) renderResult();
    else renderQuestion();
  }

  function renderResult() {
    const s = quiz.score;
    const total = QUIZ_TOTAL;
    const pct = s / total;
    const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct >= 0.3 ? 1 : 0;
    const starStr = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    let msg;
    if (pct >= 0.9) msg = t("太厉害啦，你是汽车小达人！🏆", "Amazing! You are a car expert! 🏆");
    else if (pct >= 0.6) msg = t("很棒哦，继续加油！👍", "Well done, keep it up! 👍");
    else if (pct >= 0.3) msg = t("不错的开始，再玩一次会更好！💪", "Good start, try once more! 💪");
    else msg = t("没关系，多玩几次就记住啦！🚗", "No worries, play again and you'll remember! 🚗");
    const streakLine =
      quiz.bestStreak >= 2
        ? `<p class="quiz-result-streak">${t(`🔥 最高连对 ${quiz.bestStreak} 题`, `🔥 Best streak: ${quiz.bestStreak}`)}</p>`
        : "";
    const best = loadBest();
    const prev = best[quiz.mode] != null ? best[quiz.mode] : -1;
    const isRecord = s > prev;
    if (isRecord) {
      best[quiz.mode] = s;
      saveBest(best);
    }
    const bestNow = Math.max(s, prev);
    const recordLine = isRecord ? `<p class="quiz-record">${t("🎉 新纪录！", "🎉 New record!")}</p>` : "";
    const bestLine = `<p class="quiz-best">${t(
      `${modeLabel(quiz.mode)} 最佳：${bestNow} / ${total}`,
      `${modeLabel(quiz.mode)} best: ${bestNow} / ${total}`
    )}</p>`;
    if (pct >= 0.6 || isRecord) launchConfetti();
    el.quizBody.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result-stars">${starStr}</div>
        <h3>${t(`你答对了 ${s} / ${total} 题`, `You got ${s} / ${total} right`)}</h3>
        ${recordLine}
        ${streakLine}
        ${bestLine}
        <p class="quiz-result-msg">${msg}</p>
        <div class="quiz-result-actions">
          <button class="quiz-next" data-replay>${t("🔁 再玩一次", "🔁 Play again")}</button>
          <button class="quiz-close-btn" data-restart>${t("🎮 换个挑战", "🎮 Change challenge")}</button>
          <button class="quiz-close-btn" data-close-quiz>${t("关闭", "Close")}</button>
        </div>
      </div>`;
    readText(
      t(
        `${isRecord ? "新纪录！" : ""}你答对了${s}题。${msg}`,
        `${isRecord ? "New record! " : ""}You got ${s} right. ${msg}`
      )
    );
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


  Object.assign(App, { bindQuiz, openQuiz, closeQuiz, renderStart });
})(window.CarApp);
