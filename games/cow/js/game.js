(function () {
  const STORAGE_KEY = "cow-find-progress-v1";

  const boardEl = document.getElementById("board");
  const diffTabsEl = document.getElementById("diff-tabs");
  const stageGridEl = document.getElementById("stage-grid");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");
  const timerWrapEl = document.getElementById("timer-wrap");
  const stageLabelEl = document.getElementById("stage-label");
  const sizeEl = document.getElementById("size-label");
  const hintMetaEl = document.getElementById("hint-meta");
  const winEl = document.getElementById("win-banner");
  const winTextEl = document.getElementById("win-text");
  const nextBtn = document.getElementById("next-btn");
  const modeCowBtn = document.getElementById("mode-cow");
  const modeGrassBtn = document.getElementById("mode-grass");
  const retryBtn = document.getElementById("retry-btn");
  const clearBtn = document.getElementById("clear-btn");
  const hintBtn = document.getElementById("hint-btn");
  const checkBtn = document.getElementById("check-btn");
  const progressTextEl = document.getElementById("progress-text");
  const timeoutModalEl = document.getElementById("timeout-modal");
  const timeoutContinueBtn = document.getElementById("timeout-continue-btn");
  const timeoutCancelBtn = document.getElementById("timeout-cancel-btn");
  const timeoutMessageEl = document.getElementById("timeout-message");
  const winModalEl = document.getElementById("win-modal");
  const winMessageEl = document.getElementById("win-message");
  const winTitleEl = document.getElementById("win-title");
  const winNextBtn = document.getElementById("win-next-btn");
  const winStayBtn = document.getElementById("win-stay-btn");

  const state = {
    difficultyId: "easy",
    stageIndex: 0,
    puzzle: null,
    cells: [],
    mode: "cow",
    startedAt: 0,
    timerId: null,
    timeLimitSec: 120,
    won: false,
    timedOut: false,
    hintsUsed: 0,
    progress: null,
    loadToken: 0,
  };

  function defaultProgress() {
    const bag = {};
    CowPuzzle.CAMPAIGN.forEach(function (diff, index) {
      bag[diff.id] = {
        unlockedStage: index === 0 ? 0 : -1,
        cleared: {},
      };
    });
    return {
      difficulties: bag,
      current: { difficultyId: "easy", stageIndex: 0 },
    };
  }

  function reconcileUnlocks(progress) {
    const order = CowPuzzle.CAMPAIGN;
    for (let i = 0; i < order.length - 1; i++) {
      const diff = order[i];
      const bag = progress.difficulties[diff.id];
      if (!bag) continue;
      const allCleared = diff.stages.every(function (_stage, index) {
        return !!bag.cleared[String(index)];
      });
      if (!allCleared) continue;
      const next = order[i + 1];
      if (progress.difficulties[next.id].unlockedStage < 0) {
        progress.difficulties[next.id].unlockedStage = 0;
      }
    }
    return progress;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      CowPuzzle.CAMPAIGN.forEach(function (diff, index) {
        const saved = parsed.difficulties && parsed.difficulties[diff.id];
        if (!saved) return;
        base.difficulties[diff.id] = {
          unlockedStage: typeof saved.unlockedStage === "number" ? saved.unlockedStage : index === 0 ? 0 : -1,
          cleared: saved.cleared || {},
        };
      });
      if (parsed.current) {
        base.current = {
          difficultyId: parsed.current.difficultyId || "easy",
          stageIndex: parsed.current.stageIndex || 0,
        };
      }
      return reconcileUnlocks(base);
    } catch (err) {
      return defaultProgress();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function currentDiff() {
    return CowPuzzle.getDifficulty(state.difficultyId);
  }

  function currentStage() {
    return currentDiff().stages[state.stageIndex];
  }

  function isDifficultyUnlocked(diffId) {
    return state.progress.difficulties[diffId].unlockedStage >= 0;
  }

  function isStageUnlocked(diffId, stageIndex) {
    return stageIndex <= state.progress.difficulties[diffId].unlockedStage;
  }

  function isStageCleared(diffId, stageIndex) {
    return !!state.progress.difficulties[diffId].cleared[String(stageIndex)];
  }

  function clearedCount(diffId) {
    return Object.keys(state.progress.difficulties[diffId].cleared).length;
  }

  function unlockNextAfterClear(diffId, stageIndex) {
    const diff = CowPuzzle.getDifficulty(diffId);
    const bag = state.progress.difficulties[diffId];
    const nextStage = stageIndex + 1;
    if (nextStage < diff.stages.length) {
      bag.unlockedStage = Math.max(bag.unlockedStage, nextStage);
    } else {
      bag.unlockedStage = Math.max(bag.unlockedStage, diff.stages.length - 1);
      const order = CowPuzzle.CAMPAIGN;
      const idx = order.findIndex(function (item) {
        return item.id === diffId;
      });
      if (idx >= 0 && idx < order.length - 1) {
        const nextDiff = order[idx + 1];
        if (state.progress.difficulties[nextDiff.id].unlockedStage < 0) {
          state.progress.difficulties[nextDiff.id].unlockedStage = 0;
        }
      }
    }
  }

  function markCleared(timeMs) {
    const bag = state.progress.difficulties[state.difficultyId];
    const key = String(state.stageIndex);
    const prev = bag.cleared[key];
    if (!prev || timeMs < prev.timeMs) {
      bag.cleared[key] = { timeMs: timeMs, hints: state.hintsUsed };
    }
    unlockNextAfterClear(state.difficultyId, state.stageIndex);
    saveProgress();
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function stageTimeLimitSec() {
    const stage = currentStage();
    const diff = currentDiff();
    if (stage && typeof stage.timeLimitSec === "number") return stage.timeLimitSec;
    const per = diff.secPerSize || 30;
    return Math.max(60, (stage ? stage.size : 4) * per);
  }

  function remainingMs() {
    return state.timeLimitSec * 1000 - (Date.now() - state.startedAt);
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function hideTimeoutModal() {
    if (timeoutModalEl) timeoutModalEl.hidden = true;
  }

  function hideWinModal() {
    if (winModalEl) winModalEl.hidden = true;
  }

  function showTimeoutModal() {
    hideWinModal();
    const diff = currentDiff();
    const stageNo = state.stageIndex + 1;
    if (timeoutMessageEl) {
      timeoutMessageEl.textContent =
        "「" + diff.name + "」第 " + stageNo + " 关时间到了。是否继续挑战这一关？";
    }
    if (timeoutModalEl) timeoutModalEl.hidden = false;
  }

  function showWinModal(elapsed, next) {
    hideTimeoutModal();
    const diff = currentDiff();
    const stageNo = state.stageIndex + 1;
    if (winTitleEl) winTitleEl.textContent = "过关啦！";
    if (next) {
      const nextDiff = CowPuzzle.getDifficulty(next.difficultyId);
      const nextLabel =
        next.difficultyId === state.difficultyId
          ? "第 " + (next.stageIndex + 1) + " 关"
          : "「" + nextDiff.name + "」第 1 关";
      if (winMessageEl) {
        winMessageEl.textContent =
          "「" +
          diff.name +
          "」第 " +
          stageNo +
          " 关已完成，用时 " +
          formatTime(elapsed) +
          "。是否进入" +
          nextLabel +
          "？";
      }
      if (winNextBtn) {
        winNextBtn.hidden = false;
        winNextBtn.textContent = "下一关";
        winNextBtn.onclick = function () {
          hideWinModal();
          selectStage(next.difficultyId, next.stageIndex);
        };
      }
      if (winStayBtn) winStayBtn.textContent = "先停一停";
    } else {
      if (winMessageEl) {
        winMessageEl.textContent =
          "全部通关！用时 " + formatTime(elapsed) + "，你是找牛大师。";
      }
      if (winNextBtn) winNextBtn.hidden = true;
      if (winStayBtn) winStayBtn.textContent = "好的";
    }
    if (winModalEl) winModalEl.hidden = false;
  }

  function updateTimerDisplay() {
    const left = remainingMs();
    timerEl.textContent = formatTime(left);
    if (timerWrapEl) {
      timerWrapEl.classList.toggle("urgent", left <= 15000 && left > 0);
      timerWrapEl.classList.toggle("expired", left <= 0);
    }
  }

  function onTimeUp() {
    if (state.won || state.timedOut) return;
    state.timedOut = true;
    stopTimer();
    updateTimerDisplay();
    setStatus("时间到！请选择是否继续。", "bad");
    showTimeoutModal();
  }

  function startTimer() {
    stopTimer();
    hideTimeoutModal();
    state.timedOut = false;
    state.timeLimitSec = stageTimeLimitSec();
    state.startedAt = Date.now();
    updateTimerDisplay();
    state.timerId = setInterval(function () {
      if (state.won || state.timedOut) {
        stopTimer();
        return;
      }
      updateTimerDisplay();
      if (remainingMs() <= 0) onTimeUp();
    }, 200);
  }

  function hintLimit() {
    return currentDiff().hintLimit;
  }

  function hintsLeft() {
    const limit = hintLimit();
    if (limit == null) return Infinity;
    return Math.max(0, limit - state.hintsUsed);
  }

  function updateHintUi() {
    const limit = hintLimit();
    if (limit == null) {
      hintMetaEl.textContent = "不限";
      hintBtn.disabled = false;
      hintBtn.title = "提示一头正确的牛";
    } else if (limit === 0) {
      hintMetaEl.textContent = "禁用";
      hintBtn.disabled = true;
      hintBtn.title = "本难度不能使用提示";
    } else {
      hintMetaEl.textContent = state.hintsUsed + "/" + limit;
      hintBtn.disabled = hintsLeft() <= 0 || state.won;
      hintBtn.title = hintsLeft() > 0 ? "本关还剩 " + hintsLeft() + " 次提示" : "本关提示已用完";
    }
  }

  function currentCows() {
    const cows = [];
    for (let r = 0; r < state.cells.length; r++) {
      for (let c = 0; c < state.cells[r].length; c++) {
        if (state.cells[r][c] === "cow") cows.push({ row: r, col: c });
      }
    }
    return cows;
  }

  function isGiven(row, col) {
    const givens = state.puzzle.givens || [];
    for (let i = 0; i < givens.length; i++) {
      if (givens[i].row === row && givens[i].col === col) return true;
    }
    return false;
  }

  function paintConflicts() {
    const nodes = boardEl.querySelectorAll(".cell");
    nodes.forEach(function (node) {
      node.classList.remove("conflict");
    });
    if (!state.puzzle || !state.cells.length) {
      return { conflicts: [], complete: false };
    }
    const result = CowPuzzle.validateBoard(state.puzzle.regions, currentCows());
    result.conflicts.forEach(function (item) {
      const node = boardEl.querySelector('[data-row="' + item.row + '"][data-col="' + item.col + '"]');
      if (node) node.classList.add("conflict");
    });
    return result;
  }

  function renderMarks() {
    if (!state.cells.length) return;
    const nodes = boardEl.querySelectorAll(".cell");
    nodes.forEach(function (node) {
      const row = Number(node.dataset.row);
      const col = Number(node.dataset.col);
      if (!state.cells[row] || state.cells[row][col] == null) return;
      const value = state.cells[row][col];
      const mark = node.querySelector(".mark");
      const lock = node.querySelector(".lock");
      if (!mark) return;
      if (value === "cow") {
        mark.textContent = "🐄";
        mark.className = "mark cow";
      } else if (value === "grass") {
        mark.textContent = "×";
        mark.className = "mark grass";
      } else {
        mark.textContent = "";
        mark.className = "mark";
      }
      if (lock) lock.style.display = isGiven(row, col) ? "block" : "none";
    });
  }

  function resetBoardView() {
    // 只清内容，保留棋盘占位尺寸，避免切关时页面上下跳
    const nodes = boardEl.querySelectorAll(".cell .mark");
    nodes.forEach(function (mark) {
      mark.textContent = "";
      mark.className = mark.classList.contains("lock") ? "mark lock" : "mark";
    });
    boardEl.querySelectorAll(".cell").forEach(function (cell) {
      cell.classList.remove("conflict", "hint-flash");
      const lock = cell.querySelector(".lock");
      if (lock) lock.style.display = "none";
    });
    state.cells = [];
    state.puzzle = null;
  }

  function nextPlayable() {
    const diff = currentDiff();
    const nextStage = state.stageIndex + 1;
    if (nextStage < diff.stages.length && isStageUnlocked(state.difficultyId, nextStage)) {
      return { difficultyId: state.difficultyId, stageIndex: nextStage };
    }
    const order = CowPuzzle.CAMPAIGN;
    const idx = order.findIndex(function (item) {
      return item.id === state.difficultyId;
    });
    if (idx >= 0 && idx < order.length - 1) {
      const nextDiff = order[idx + 1];
      if (isDifficultyUnlocked(nextDiff.id) && isStageUnlocked(nextDiff.id, 0)) {
        return { difficultyId: nextDiff.id, stageIndex: 0 };
      }
    }
    return null;
  }

  function maybeWin() {
    const result = paintConflicts();
    if (result.complete && !state.won) {
      state.won = true;
      stopTimer();
      const elapsed = Date.now() - state.startedAt;
      markCleared(elapsed);
      renderDiffTabs();
      renderStageGrid();
      updateProgressText();

      const next = nextPlayable();
      winEl.classList.add("show");
      if (next) {
        const nextDiff = CowPuzzle.getDifficulty(next.difficultyId);
        const label =
          next.difficultyId === state.difficultyId
            ? "下一关：第 " + (next.stageIndex + 1) + " 关"
            : "解锁「" + nextDiff.name + "」第 1 关";
        winTextEl.textContent = "过关！用时 " + formatTime(elapsed) + " · " + label;
        nextBtn.hidden = false;
        nextBtn.onclick = function () {
          hideWinModal();
          selectStage(next.difficultyId, next.stageIndex);
        };
      } else {
        winTextEl.textContent = "全部通关！用时 " + formatTime(elapsed) + "，你是找牛大师。";
        nextBtn.hidden = true;
      }
      showWinModal(elapsed, next);
      setStatus(
        next
          ? "过关了！可以选择进入下一关。"
          : "全部通关！每行、每列、每种颜色都刚好一头牛。",
        "ok"
      );
      updateHintUi();
    } else if (!state.won) {
      winEl.classList.remove("show");
      if (result.conflicts.length) {
        setStatus("有牛挤到一起了：检查同行、同列、同色，或挨着的格子。", "bad");
      } else {
        const left = state.puzzle.size - currentCows().length;
        setStatus(left > 0 ? "还差 " + left + " 头牛。左键放牛，右键标草地。" : "牛都放好了，再核对一下规则。");
      }
    }
    return result;
  }

  function cycleCell(row, col, preferred) {
    if (!state.puzzle || !state.cells.length) return;
    if (state.won || state.timedOut || isGiven(row, col)) return;
    const current = state.cells[row][col];
    let next = "";
    if (preferred === "cow") {
      next = current === "cow" ? "" : "cow";
    } else if (preferred === "grass") {
      next = current === "grass" ? "" : "grass";
    } else if (current === "") {
      next = "cow";
    } else if (current === "cow") {
      next = "grass";
    } else {
      next = "";
    }
    state.cells[row][col] = next;
    renderMarks();
    maybeWin();
  }

  let lastFitKey = "";
  let fitTimer = null;

  function fitBoard(force) {
    if (!state.puzzle) return;
    const n = state.puzzle.size;
    const wrap = boardEl.parentElement;
    const styles = wrap ? window.getComputedStyle(wrap) : null;
    const padX = styles
      ? (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0)
      : 0;
    const wrapWidth = wrap ? wrap.clientWidth - padX : window.innerWidth - 24;
    const panel = boardEl.closest(".board-panel");
    const panelPad = panel ? 28 : 0;
    const available = Math.min(
      wrapWidth || window.innerWidth - 24,
      window.innerWidth - panelPad,
      620
    );
    const border = 6;
    const cell = Math.max(18, Math.floor((available - border) / n));
    const key = n + ":" + cell;
    if (!force && key === lastFitKey) return;
    lastFitKey = key;
    boardEl.style.setProperty("--cell", cell + "px");
  }

  function scheduleFitBoard() {
    if (fitTimer) clearTimeout(fitTimer);
    fitTimer = setTimeout(function () {
      fitTimer = null;
      fitBoard(false);
    }, 150);
  }

  function buildBoard() {
    const puzzle = state.puzzle;
    const n = puzzle.size;
    boardEl.style.setProperty("--size", String(n));
    boardEl.classList.remove("board-large", "board-hell");
    boardEl.innerHTML = "";

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const region = puzzle.regions[row][col];
        const color = puzzle.colors[region] || puzzle.colors[0] || { fill: "#dce8cb" };
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.style.setProperty("--cell-fill", color.fill || "#dce8cb");
        cell.setAttribute("aria-label", "第" + (row + 1) + "行第" + (col + 1) + "列");

        const mark = document.createElement("span");
        mark.className = "mark";
        cell.appendChild(mark);

        const lock = document.createElement("span");
        lock.className = "mark lock";
        lock.textContent = "固";
        lock.style.display = "none";
        cell.appendChild(lock);

        cell.addEventListener("click", function (event) {
          event.preventDefault();
          cell.blur();
          cycleCell(row, col, state.mode);
        });
        cell.addEventListener("contextmenu", function (event) {
          event.preventDefault();
          cycleCell(row, col, "grass");
        });

        boardEl.appendChild(cell);
      }
    }
    fitBoard(true);
  }

  function applyGivens() {
    const n = state.puzzle.size;
    state.cells = Array.from({ length: n }, function () {
      return Array(n).fill("");
    });
    (state.puzzle.givens || []).forEach(function (given) {
      state.cells[given.row][given.col] = "cow";
    });
  }

  function updateProgressText() {
    const diff = currentDiff();
    const cleared = clearedCount(state.difficultyId);
    progressTextEl.textContent =
      diff.name + "进度 " + cleared + "/" + diff.stages.length + " · 已解锁到第 " + (state.progress.difficulties[state.difficultyId].unlockedStage + 1) + " 关";
  }

  function loadStage() {
    const diff = currentDiff();
    const stage = currentStage();
    if (!stage || !isStageUnlocked(state.difficultyId, state.stageIndex)) {
      setStatus("这一关还没解锁。", "bad");
      return;
    }

    const token = ++state.loadToken;
    state.progress.current = {
      difficultyId: state.difficultyId,
      stageIndex: state.stageIndex,
    };
    saveProgress();

    stopTimer();
    hideTimeoutModal();
    hideWinModal();
    // 先清掉上一关的牛和色块，避免切关时残留整盘图标
    resetBoardView();
    setStatus("正在铺草地…");
    winEl.classList.remove("show");
    nextBtn.hidden = true;
    state.won = false;
    state.timedOut = false;
    state.hintsUsed = 0;
    state.timeLimitSec = stageTimeLimitSec();
    stageLabelEl.textContent = diff.name + " · 第 " + (state.stageIndex + 1) + " 关";
    sizeEl.textContent = stage.size + "×" + stage.size;
    timerEl.textContent = formatTime(state.timeLimitSec * 1000);
    if (timerWrapEl) {
      timerWrapEl.classList.remove("urgent", "expired");
    }
    updateHintUi();
    updateProgressText();
    renderDiffTabs();
    renderStageGrid();

    window.setTimeout(function () {
      if (token !== state.loadToken) return;
      try {
        const puzzle = CowPuzzle.createPuzzle(stage.size, {
          maxGivens: stage.maxGivens,
          maxAttempts:
            stage.size >= 11 ? 100 : stage.size >= 10 ? 120 : stage.size >= 9 ? 180 : stage.size >= 8 ? 220 : 320,
        });
        if (token !== state.loadToken) return;
        state.puzzle = puzzle;
        applyGivens();
        buildBoard();
        renderMarks();
        startTimer();
        const givenCount = (state.puzzle.givens || []).length;
        const title = stage.title ? "「" + stage.title + "」" : "";
        const limitTip = "限时 " + state.timeLimitSec + " 秒。";
        if (givenCount) {
          setStatus(title + limitTip + "本关有 " + givenCount + " 头固定牛。");
        } else {
          setStatus(title + limitTip + "本关没有固定线索，全靠推理。");
        }
        maybeWin();
        updateHintUi();
      } catch (err) {
        if (token !== state.loadToken) return;
        setStatus("出题失败，点「重玩本关」再试一次。", "bad");
      }
    }, 30);
  }

  function selectStage(diffId, stageIndex) {
    if (!isDifficultyUnlocked(diffId)) {
      setStatus("先通关上一难度，才能进入这里。", "bad");
      return;
    }
    if (!isStageUnlocked(diffId, stageIndex)) {
      setStatus("先过前面的关卡，才能开这一关。", "bad");
      return;
    }
    state.difficultyId = diffId;
    state.stageIndex = stageIndex;
    loadStage();
  }

  function clearMarks() {
    if (!state.puzzle || state.won || state.timedOut) return;
    for (let r = 0; r < state.cells.length; r++) {
      for (let c = 0; c < state.cells[r].length; c++) {
        if (!isGiven(r, c)) state.cells[r][c] = "";
      }
    }
    renderMarks();
    setStatus("已清空你的标记。");
    maybeWin();
  }

  function giveHint() {
    if (!state.puzzle || state.won || state.timedOut) return;
    if (hintsLeft() <= 0) {
      setStatus(hintLimit() === 0 ? "本难度不能用提示。" : "本关提示次数用完了。", "bad");
      return;
    }
    const solution = state.puzzle.solution;
    const options = [];
    for (let row = 0; row < solution.length; row++) {
      const col = solution[row];
      if (state.cells[row][col] !== "cow") options.push({ row: row, col: col });
    }
    if (!options.length) {
      setStatus("已经没有可提示的牛了。");
      return;
    }
    const pick = options[Math.floor(Math.random() * options.length)];
    state.cells[pick.row][pick.col] = "cow";
    state.hintsUsed += 1;
    renderMarks();
    updateHintUi();
    const node = boardEl.querySelector('[data-row="' + pick.row + '"][data-col="' + pick.col + '"]');
    if (node) {
      node.classList.add("hint-flash");
      window.setTimeout(function () {
        node.classList.remove("hint-flash");
      }, 800);
    }
    setStatus("提示了一头牛。");
    maybeWin();
  }

  function checkNow() {
    if (!state.puzzle) return;
    const result = maybeWin();
    if (state.won) return;
    if (result.conflicts.length) {
      setStatus("发现 " + result.conflicts.length + " 处冲突，已标红。", "bad");
    } else if (currentCows().length < state.puzzle.size) {
      setStatus("目前没有冲突，但牛还没放齐。");
    } else {
      setStatus("看起来都合规了，再确认一下每种颜色。");
    }
  }

  function setMode(mode) {
    state.mode = mode;
    modeCowBtn.classList.toggle("active", mode === "cow");
    modeGrassBtn.classList.toggle("active", mode === "grass");
  }

  function renderDiffTabs() {
    diffTabsEl.innerHTML = "";
    CowPuzzle.CAMPAIGN.forEach(function (diff) {
      const unlocked = isDifficultyUnlocked(diff.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "level-tab" +
        (diff.id === state.difficultyId ? " active" : "") +
        (unlocked ? "" : " locked");
      btn.textContent = unlocked ? diff.name : diff.name + " 🔒";
      btn.disabled = !unlocked;
      btn.title = unlocked ? diff.blurb : "通关上一难度后解锁";
      btn.addEventListener("click", function () {
        if (!unlocked) return;
        if (state.difficultyId === diff.id) return;
        const start = Math.min(
          state.progress.difficulties[diff.id].unlockedStage,
          diff.stages.length - 1
        );
        selectStage(diff.id, Math.max(0, start));
      });
      diffTabsEl.appendChild(btn);
    });
  }

  function renderStageGrid() {
    const diff = currentDiff();
    stageGridEl.innerHTML = "";
    diff.stages.forEach(function (stage, index) {
      const unlocked = isStageUnlocked(diff.id, index);
      const cleared = isStageCleared(diff.id, index);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "stage-btn" +
        (index === state.stageIndex ? " active" : "") +
        (cleared ? " cleared" : "") +
        (unlocked ? "" : " locked");
      btn.disabled = !unlocked;
      btn.innerHTML =
        '<span class="stage-num">' +
        (index + 1) +
        "</span>" +
        '<span class="stage-size">' +
        stage.size +
        "×" +
        stage.size +
        "</span>";
      if (!unlocked) btn.title = "先过第 " + index + " 关";
      else if (cleared) btn.title = stage.title + "（已通关）";
      else btn.title = stage.title;
      btn.addEventListener("click", function () {
        selectStage(diff.id, index);
      });
      stageGridEl.appendChild(btn);
    });
  }

  modeCowBtn.addEventListener("click", function () {
    setMode("cow");
  });
  modeGrassBtn.addEventListener("click", function () {
    setMode("grass");
  });
  retryBtn.addEventListener("click", function () {
    loadStage();
  });
  clearBtn.addEventListener("click", clearMarks);
  hintBtn.addEventListener("click", giveHint);
  checkBtn.addEventListener("click", checkNow);
  timeoutContinueBtn.addEventListener("click", function () {
    hideTimeoutModal();
    loadStage();
  });
  timeoutCancelBtn.addEventListener("click", function () {
    hideTimeoutModal();
    setStatus("已暂停。可点「重玩本关」再试，或先去别的关卡。", "bad");
  });
  winStayBtn.addEventListener("click", function () {
    hideWinModal();
    setStatus("已留在本关。想继续可点「下一关」，或从关卡列表进入。", "ok");
  });

  state.progress = loadProgress();
  saveProgress();
  const bootDiff = state.progress.current.difficultyId;
  const bootStage = state.progress.current.stageIndex;
  if (isDifficultyUnlocked(bootDiff) && isStageUnlocked(bootDiff, bootStage)) {
    state.difficultyId = bootDiff;
    state.stageIndex = bootStage;
  } else {
    state.difficultyId = "easy";
    state.stageIndex = 0;
  }

  setMode("cow");
  loadStage();

  window.addEventListener("resize", scheduleFitBoard);
})();
