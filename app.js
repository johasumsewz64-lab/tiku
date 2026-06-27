(function () {
  const questions = globalThis.QUESTION_BANK || [];
  const meta = globalThis.QUESTION_BANK_META || { title: "题库", chapters: [], total: 0, types: {} };

  const storageKeys = {
    results: "building-energy-quiz-results-v1",
    favorites: "building-energy-quiz-favorites-v1",
  };

  const typeNames = {
    all: "全部",
    single: "单选题",
    multiple: "多选题",
    judge: "判断题",
  };

  const els = {
    bankTitle: document.getElementById("bankTitle"),
    sourceName: document.getElementById("sourceName"),
    totalCount: document.getElementById("totalCount"),
    doneCount: document.getElementById("doneCount"),
    accuracyCount: document.getElementById("accuracyCount"),
    chapterSelect: document.getElementById("chapterSelect"),
    typeTabs: document.getElementById("typeTabs"),
    modeSelect: document.getElementById("modeSelect"),
    searchInput: document.getElementById("searchInput"),
    chapterBoard: document.getElementById("chapterBoard"),
    resetButton: document.getElementById("resetButton"),
    favoriteButton: document.getElementById("favoriteButton"),
    typeBadge: document.getElementById("typeBadge"),
    chapterBadge: document.getElementById("chapterBadge"),
    questionCounter: document.getElementById("questionCounter"),
    scoreSummary: document.getElementById("scoreSummary"),
    progressFill: document.getElementById("progressFill"),
    emptyState: document.getElementById("emptyState"),
    emptyText: document.getElementById("emptyText"),
    questionContent: document.getElementById("questionContent"),
    questionStem: document.getElementById("questionStem"),
    optionsList: document.getElementById("optionsList"),
    answerPanel: document.getElementById("answerPanel"),
    resultBadge: document.getElementById("resultBadge"),
    correctAnswer: document.getElementById("correctAnswer"),
    userAnswerText: document.getElementById("userAnswerText"),
    prevButton: document.getElementById("prevButton"),
    submitButton: document.getElementById("submitButton"),
    nextButton: document.getElementById("nextButton"),
    poolCount: document.getElementById("poolCount"),
    questionGrid: document.getElementById("questionGrid"),
    coverArt: document.getElementById("coverArt"),
  };

  const state = {
    filters: {
      chapter: "all",
      type: "all",
      mode: "sequence",
      query: "",
    },
    pool: [],
    currentIndex: 0,
    selected: new Set(),
    results: readJson(storageKeys.results, {}),
    favorites: new Set(readJson(storageKeys.favorites, [])),
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Progress persistence is helpful, but answering should still work when storage is unavailable.
    }
  }

  function shuffle(items) {
    const clone = [...items];
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  }

  function answerKeys(question) {
    return question.answer.split("");
  }

  function formatAnswer(question, keys) {
    if (!keys.length) {
      return "未作答";
    }
    if (question.type === "judge") {
      return keys.map((key) => (key === "√" ? "正确" : "错误")).join("、");
    }
    return keys
      .map((key) => {
        const option = question.options.find((item) => item.key === key);
        return option ? `${key}. ${option.text}` : key;
      })
      .join("；");
  }

  function isCorrect(question, keys) {
    const expected = answerKeys(question).sort().join("");
    const actual = [...keys].sort().join("");
    return expected === actual;
  }

  function currentQuestion() {
    return state.pool[state.currentIndex] || null;
  }

  function answeredResult(question) {
    return question ? state.results[question.id] : null;
  }

  function buildPool(resetIndex = true) {
    const query = state.filters.query.trim().toLowerCase();
    let pool = questions.filter((question) => {
      const chapterPass = state.filters.chapter === "all" || String(question.chapterIndex) === state.filters.chapter;
      const typePass = state.filters.type === "all" || question.type === state.filters.type;
      const text = `${question.stem} ${question.options.map((option) => option.text).join(" ")}`.toLowerCase();
      const queryPass = !query || text.includes(query);
      return chapterPass && typePass && queryPass;
    });

    if (state.filters.mode === "wrong") {
      pool = pool.filter((question) => state.results[question.id] && state.results[question.id].correct === false);
    }

    if (state.filters.mode === "favorite") {
      pool = pool.filter((question) => state.favorites.has(question.id));
    }

    if (state.filters.mode === "random") {
      pool = shuffle(pool);
    }

    state.pool = pool;
    if (resetIndex) {
      state.currentIndex = 0;
    } else {
      state.currentIndex = Math.min(state.currentIndex, Math.max(pool.length - 1, 0));
    }
    syncSelectionFromResult();
  }

  function syncSelectionFromResult() {
    const question = currentQuestion();
    const result = answeredResult(question);
    state.selected = new Set(result ? result.choice : []);
  }

  function setFilterType(type) {
    state.filters.type = type;
    [...els.typeTabs.querySelectorAll(".segment")].forEach((button) => {
      button.classList.toggle("is-active", button.dataset.type === type);
    });
    buildPool();
    render();
  }

  function submitAnswer() {
    const question = currentQuestion();
    if (!question || state.selected.size === 0 || answeredResult(question)) {
      return;
    }

    const choice = [...state.selected];
    const correct = isCorrect(question, choice);
    state.results[question.id] = {
      choice,
      correct,
      answeredAt: new Date().toISOString(),
    };
    writeJson(storageKeys.results, state.results);
    render();
  }

  function toggleFavorite() {
    const question = currentQuestion();
    if (!question) {
      return;
    }
    if (state.favorites.has(question.id)) {
      state.favorites.delete(question.id);
    } else {
      state.favorites.add(question.id);
    }
    writeJson(storageKeys.favorites, [...state.favorites]);
    if (state.filters.mode === "favorite") {
      buildPool(false);
    }
    render();
  }

  function moveQuestion(direction) {
    if (!state.pool.length) {
      return;
    }
    state.currentIndex = Math.min(Math.max(state.currentIndex + direction, 0), state.pool.length - 1);
    syncSelectionFromResult();
    render();
  }

  function jumpToQuestion(index) {
    state.currentIndex = index;
    syncSelectionFromResult();
    render();
  }

  function resetProgress() {
    const ok = window.confirm("清空当前刷题进度、错题记录和收藏？");
    if (!ok) {
      return;
    }
    state.results = {};
    state.favorites = new Set();
    writeJson(storageKeys.results, state.results);
    writeJson(storageKeys.favorites, []);
    buildPool(false);
    render();
  }

  function renderStats() {
    const allResults = Object.values(state.results);
    const done = allResults.length;
    const correct = allResults.filter((item) => item.correct).length;
    const accuracy = done ? Math.round((correct / done) * 100) : 0;

    els.totalCount.textContent = String(meta.total || questions.length);
    els.doneCount.textContent = String(done);
    els.accuracyCount.textContent = `${accuracy}%`;
    els.scoreSummary.textContent = `${correct} 正确`;
  }

  function renderChapterBoard() {
    els.chapterBoard.innerHTML = "";
    meta.chapters.forEach((chapter) => {
      const card = document.createElement("div");
      card.className = "chapter-card";
      const typeSummary = Object.entries(chapter.types)
        .map(([type, count]) => `${typeNames[type]} ${count}`)
        .join(" · ");
      card.innerHTML = `
        <div>
          <strong>${chapter.name}</strong>
          <small>${typeSummary}</small>
        </div>
        <span class="chapter-count">${chapter.count}</span>
      `;
      els.chapterBoard.append(card);
    });
  }

  function renderQuestion() {
    const question = currentQuestion();
    const hasQuestion = Boolean(question);
    els.emptyState.hidden = hasQuestion;
    els.questionContent.hidden = !hasQuestion;
    els.favoriteButton.disabled = !hasQuestion;
    els.prevButton.disabled = !hasQuestion || state.currentIndex === 0;
    els.nextButton.disabled = !hasQuestion || state.currentIndex >= state.pool.length - 1;
    els.poolCount.textContent = `${state.pool.length} 题`;

    if (!question) {
      els.typeBadge.textContent = "无题目";
      els.chapterBadge.textContent = "当前筛选";
      els.questionCounter.textContent = "第 0 / 0 题";
      els.progressFill.style.width = "0%";
      els.questionGrid.innerHTML = "";
      els.submitButton.disabled = true;
      return;
    }

    const result = answeredResult(question);
    const answered = Boolean(result);
    const selectedKeys = result ? result.choice : [...state.selected];
    const expectedKeys = answerKeys(question);

    els.typeBadge.textContent = question.typeLabel;
    els.chapterBadge.textContent = question.chapter;
    els.questionCounter.textContent = `第 ${state.currentIndex + 1} / ${state.pool.length} 题`;
    els.progressFill.style.width = `${((state.currentIndex + 1) / state.pool.length) * 100}%`;
    els.questionStem.textContent = question.stem;
    els.favoriteButton.classList.toggle("is-active", state.favorites.has(question.id));
    els.favoriteButton.setAttribute("aria-pressed", String(state.favorites.has(question.id)));
    els.favoriteButton.querySelector("span").textContent = state.favorites.has(question.id) ? "★" : "☆";

    els.optionsList.innerHTML = "";
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      const isSelected = selectedKeys.includes(option.key);
      const isAnswer = expectedKeys.includes(option.key);
      button.classList.toggle("is-selected", isSelected && !answered);
      button.classList.toggle("is-correct", answered && isAnswer);
      button.classList.toggle("is-wrong", answered && isSelected && !isAnswer);
      button.disabled = answered;
      button.innerHTML = `
        <span class="option-key">${option.key}</span>
        <span class="option-text">${option.text}</span>
      `;
      button.addEventListener("click", () => {
        if (answered) {
          return;
        }
        if (question.type === "multiple") {
          if (state.selected.has(option.key)) {
            state.selected.delete(option.key);
          } else {
            state.selected.add(option.key);
          }
          renderQuestion();
          renderQuestionGrid();
          return;
        }
        state.selected = new Set([option.key]);
        submitAnswer();
      });
      els.optionsList.append(button);
    });

    els.submitButton.disabled = answered || state.selected.size === 0 || question.type !== "multiple";
    els.submitButton.style.visibility = question.type === "multiple" ? "visible" : "hidden";

    if (answered) {
      els.answerPanel.hidden = false;
      els.resultBadge.textContent = result.correct ? "正确" : "错误";
      els.resultBadge.classList.toggle("is-wrong", !result.correct);
      els.correctAnswer.textContent = question.answerText;
      els.userAnswerText.textContent = result.correct ? "你的答案正确。" : `你的答案：${formatAnswer(question, result.choice)}`;
    } else {
      els.answerPanel.hidden = true;
      els.resultBadge.classList.remove("is-wrong");
      els.correctAnswer.textContent = "";
      els.userAnswerText.textContent = "";
    }
  }

  function renderQuestionGrid() {
    els.questionGrid.innerHTML = "";
    state.pool.forEach((question, index) => {
      const result = state.results[question.id];
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "question-chip";
      chip.classList.toggle("is-current", index === state.currentIndex);
      chip.classList.toggle("is-correct", Boolean(result && result.correct));
      chip.classList.toggle("is-wrong", Boolean(result && !result.correct));
      chip.textContent = String(index + 1);
      chip.setAttribute("aria-label", `第 ${index + 1} 题`);
      chip.addEventListener("click", () => jumpToQuestion(index));
      els.questionGrid.append(chip);
    });
  }

  function render() {
    renderStats();
    renderQuestion();
    renderQuestionGrid();
  }

  function populateControls() {
    els.bankTitle.textContent = meta.title || "题库";
    els.sourceName.textContent = meta.source || "";

    els.chapterSelect.innerHTML = '<option value="all">全部章节</option>';
    meta.chapters.forEach((chapter) => {
      const option = document.createElement("option");
      option.value = String(chapter.index);
      option.textContent = `${chapter.name}（${chapter.count}）`;
      els.chapterSelect.append(option);
    });

    renderChapterBoard();
  }

  function drawCoverArt() {
    const canvas = els.coverArt;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#eef5ef";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#f7d46a";
    ctx.beginPath();
    ctx.arc(width - 48, 36, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dfe9e4";
    ctx.fillRect(20, 82, width - 40, 18);

    ctx.fillStyle = "#2e6f8f";
    ctx.fillRect(42, 46, 62, 54);
    ctx.fillStyle = "#18765f";
    ctx.fillRect(112, 30, 78, 70);
    ctx.fillStyle = "#105944";
    ctx.fillRect(198, 54, 56, 46);

    ctx.fillStyle = "#ffffff";
    for (let x = 52; x < 96; x += 18) {
      for (let y = 56; y < 88; y += 16) {
        ctx.fillRect(x, y, 9, 8);
      }
    }
    for (let x = 124; x < 176; x += 18) {
      for (let y = 42; y < 86; y += 16) {
        ctx.fillRect(x, y, 9, 8);
      }
    }

    ctx.fillStyle = "#fff0cc";
    ctx.beginPath();
    ctx.moveTo(110, 30);
    ctx.lineTo(192, 30);
    ctx.lineTo(180, 16);
    ctx.lineTo(122, 16);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#b7791f";
    ctx.lineWidth = 2;
    for (let x = 128; x <= 172; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x - 10, 30);
      ctx.stroke();
    }

    ctx.fillStyle = "#7fba9f";
    ctx.beginPath();
    ctx.moveTo(34, 101);
    ctx.quadraticCurveTo(48, 72, 64, 101);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(width - 88, 101);
    ctx.quadraticCurveTo(width - 70, 66, width - 54, 101);
    ctx.fill();
  }

  function bindEvents() {
    els.chapterSelect.addEventListener("change", () => {
      state.filters.chapter = els.chapterSelect.value;
      buildPool();
      render();
    });

    els.typeTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-type]");
      if (button) {
        setFilterType(button.dataset.type);
      }
    });

    els.modeSelect.addEventListener("change", () => {
      state.filters.mode = els.modeSelect.value;
      buildPool();
      render();
    });

    els.searchInput.addEventListener("input", () => {
      state.filters.query = els.searchInput.value;
      buildPool();
      render();
    });

    els.submitButton.addEventListener("click", submitAnswer);
    els.prevButton.addEventListener("click", () => moveQuestion(-1));
    els.nextButton.addEventListener("click", () => moveQuestion(1));
    els.favoriteButton.addEventListener("click", toggleFavorite);
    els.resetButton.addEventListener("click", resetProgress);

    window.addEventListener("resize", drawCoverArt);
  }

  function init() {
    populateControls();
    bindEvents();
    buildPool();
    render();
    drawCoverArt();
  }

  init();
})();
