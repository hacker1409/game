(function () {
  const DIFFS = [
    { id: "easy", name: "简单", w: 9, h: 9, mines: 10 },
    { id: "medium", name: "中等", w: 12, h: 12, mines: 24 },
    { id: "hard", name: "困难", w: 16, h: 16, mines: 48 },
    { id: "hell", name: "地狱", w: 18, h: 18, mines: 72 },
  ];

  const boardEl = document.getElementById("board");
  const state = {
    diff: DIFFS[0],
    grid: [],
    open: [],
    flag: [],
    started: false,
    dead: false,
    won: false,
    timer: null,
    seconds: 0,
  };

  function setStatus(t, k) {
    const el = document.getElementById("status");
    el.textContent = t;
    el.className = "status" + (k ? " " + k : "");
  }

  function idx(x, y) {
    return y * state.diff.w + x;
  }

  function inBound(x, y) {
    return x >= 0 && y >= 0 && x < state.diff.w && y < state.diff.h;
  }

  function neighbors(x, y) {
    const list = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inBound(nx, ny)) list.push([nx, ny]);
      }
    }
    return list;
  }

  function placeMines(sx, sy) {
    const banned = new Set([idx(sx, sy)]);
    neighbors(sx, sy).forEach(function (p) {
      banned.add(idx(p[0], p[1]));
    });
    let placed = 0;
    while (placed < state.diff.mines) {
      const x = Math.floor(Math.random() * state.diff.w);
      const y = Math.floor(Math.random() * state.diff.h);
      const i = idx(x, y);
      if (banned.has(i) || state.grid[i] === -1) continue;
      state.grid[i] = -1;
      placed++;
    }
    for (let y = 0; y < state.diff.h; y++) {
      for (let x = 0; x < state.diff.w; x++) {
        const i = idx(x, y);
        if (state.grid[i] === -1) continue;
        let n = 0;
        neighbors(x, y).forEach(function (p) {
          if (state.grid[idx(p[0], p[1])] === -1) n++;
        });
        state.grid[i] = n;
      }
    }
  }

  function startTimer() {
    stopTimer();
    state.seconds = 0;
    document.getElementById("time").textContent = "0";
    state.timer = setInterval(function () {
      state.seconds++;
      document.getElementById("time").textContent = String(state.seconds);
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function flagsLeft() {
    let f = 0;
    state.flag.forEach(function (v) {
      if (v) f++;
    });
    return state.diff.mines - f;
  }

  function checkWin() {
    for (let i = 0; i < state.grid.length; i++) {
      if (state.grid[i] !== -1 && !state.open[i]) return false;
    }
    return true;
  }

  function reveal(x, y) {
    const i = idx(x, y);
    if (!inBound(x, y) || state.open[i] || state.flag[i]) return;
    state.open[i] = true;
    if (state.grid[i] === 0) {
      neighbors(x, y).forEach(function (p) {
        reveal(p[0], p[1]);
      });
    }
  }

  function fitBoard() {
    boardEl.style.setProperty("--cols", String(state.diff.w));
    boardEl.style.setProperty("--rows", String(state.diff.h));
  }

  function newGame() {
    stopTimer();
    const n = state.diff.w * state.diff.h;
    state.grid = Array(n).fill(0);
    state.open = Array(n).fill(false);
    state.flag = Array(n).fill(false);
    state.started = false;
    state.dead = false;
    state.won = false;
    state.seconds = 0;
    document.getElementById("time").textContent = "0";
    document.getElementById("diff-label").textContent = state.diff.name;
    document.getElementById("size-label").textContent = state.diff.w + "×" + state.diff.h;
    document.getElementById("left").textContent = String(state.diff.mines);
    fitBoard();
    setStatus("左键揭开，右键插旗。盘面大小固定，难度只改变密度。");
    render();
  }

  function clickCell(x, y, right) {
    if (state.dead || state.won) return;
    const i = idx(x, y);
    if (right) {
      if (state.open[i]) return;
      state.flag[i] = !state.flag[i];
      document.getElementById("left").textContent = String(flagsLeft());
      render();
      return;
    }
    if (state.flag[i]) return;
    if (!state.started) {
      placeMines(x, y);
      state.started = true;
      startTimer();
    }
    if (state.grid[i] === -1) {
      state.dead = true;
      state.open[i] = true;
      stopTimer();
      for (let k = 0; k < state.grid.length; k++) {
        if (state.grid[k] === -1) state.open[k] = true;
      }
      setStatus("踩雷了，再来一局。", "bad");
      render();
      return;
    }
    reveal(x, y);
    if (checkWin()) {
      state.won = true;
      stopTimer();
      setStatus("扫清了！用时 " + state.seconds + " 秒。", "ok");
    }
    render();
  }

  function render() {
    boardEl.innerHTML = "";
    fitBoard();
    for (let y = 0; y < state.diff.h; y++) {
      for (let x = 0; x < state.diff.w; x++) {
        const i = idx(x, y);
        const btn = document.createElement("button");
        btn.type = "button";
        if (state.flag[i] && !state.open[i]) {
          btn.className = "flag";
          btn.textContent = "⚑";
        } else if (state.open[i]) {
          if (state.grid[i] === -1) {
            btn.className = "open bomb";
            btn.textContent = "●";
          } else {
            btn.className = "open" + (state.grid[i] ? " c" + state.grid[i] : "");
            btn.textContent = state.grid[i] ? String(state.grid[i]) : "";
          }
        }
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          clickCell(x, y, false);
        });
        btn.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          clickCell(x, y, true);
        });
        boardEl.appendChild(btn);
      }
    }
  }

  const diffsEl = document.getElementById("diffs");
  DIFFS.forEach(function (d) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-tab" + (d.id === state.diff.id ? " active" : "");
    btn.textContent = d.name;
    btn.addEventListener("click", function () {
      state.diff = d;
      [...diffsEl.children].forEach(function (el) {
        el.classList.remove("active");
      });
      btn.classList.add("active");
      newGame();
    });
    diffsEl.appendChild(btn);
  });
  document.getElementById("new-btn").addEventListener("click", newGame);
  window.addEventListener("resize", fitBoard);
  newGame();
})();
