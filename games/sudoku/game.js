(function () {
  const DIFFS = [
    { id: "easy", name: "简单", holes: 36 },
    { id: "medium", name: "中等", holes: 44 },
    { id: "hard", name: "困难", holes: 50 },
    { id: "hell", name: "地狱", holes: 54 },
  ];

  const boardEl = document.getElementById("board");
  const diffsEl = document.getElementById("diffs");
  const padEl = document.getElementById("pad");
  const statusEl = document.getElementById("status");
  const diffLabel = document.getElementById("diff-label");
  const emptyLabel = document.getElementById("empty-label");
  const noteBtn = document.getElementById("note-btn");
  const newBtn = document.getElementById("new-btn");
  const eraseBtn = document.getElementById("erase-btn");
  const checkBtn = document.getElementById("check-btn");

  const state = {
    diff: DIFFS[0],
    solution: [],
    given: [],
    values: [],
    notes: [],
    selected: -1,
    noteMode: false,
    generating: false,
    genToken: 0,
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function idx(r, c) {
    return r * 9 + c;
  }

  function bitCount(n) {
    let c = 0;
    while (n) {
      n &= n - 1;
      c++;
    }
    return c;
  }

  function lowestBit(n) {
    let b = 1;
    let v = 1;
    while (!(n & b)) {
      b <<= 1;
      v++;
    }
    return v;
  }

  function buildMasks(grid) {
    const rows = Array(9).fill(0);
    const cols = Array(9).fill(0);
    const boxes = Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = grid[i];
      if (!v) continue;
      const bit = 1 << (v - 1);
      const r = (i / 9) | 0;
      const c = i % 9;
      const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    }
    return { rows: rows, cols: cols, boxes: boxes };
  }

  function candidates(masks, i) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    return (~(masks.rows[r] | masks.cols[c] | masks.boxes[b])) & 511;
  }

  function pickCell(grid, masks) {
    let best = -1;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const cand = candidates(masks, i);
      const count = bitCount(cand);
      if (count === 0) return -2;
      if (count < bestCount) {
        bestCount = count;
        best = i;
        if (count === 1) break;
      }
    }
    return best;
  }

  function countSolutions(grid, limit) {
    const g = grid.slice();
    const masks = buildMasks(g);
    let count = 0;

    function dfs() {
      if (count >= limit) return;
      const pos = pickCell(g, masks);
      if (pos === -1) {
        count++;
        return;
      }
      if (pos === -2) return;
      let cand = candidates(masks, pos);
      const r = (pos / 9) | 0;
      const c = pos % 9;
      const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      while (cand) {
        const bit = cand & -cand;
        const n = lowestBit(bit);
        cand ^= bit;
        g[pos] = n;
        masks.rows[r] |= bit;
        masks.cols[c] |= bit;
        masks.boxes[b] |= bit;
        dfs();
        g[pos] = 0;
        masks.rows[r] ^= bit;
        masks.cols[c] ^= bit;
        masks.boxes[b] ^= bit;
        if (count >= limit) return;
      }
    }

    dfs();
    return count;
  }

  function solveOne(grid) {
    const g = grid.slice();
    const masks = buildMasks(g);

    function dfs() {
      const pos = pickCell(g, masks);
      if (pos === -1) return true;
      if (pos === -2) return false;
      let cand = candidates(masks, pos);
      const r = (pos / 9) | 0;
      const c = pos % 9;
      const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      const options = [];
      while (cand) {
        const bit = cand & -cand;
        options.push(bit);
        cand ^= bit;
      }
      shuffle(options);
      for (let i = 0; i < options.length; i++) {
        const bit = options[i];
        const n = lowestBit(bit);
        g[pos] = n;
        masks.rows[r] |= bit;
        masks.cols[c] |= bit;
        masks.boxes[b] |= bit;
        if (dfs()) return true;
        g[pos] = 0;
        masks.rows[r] ^= bit;
        masks.cols[c] ^= bit;
        masks.boxes[b] ^= bit;
      }
      return false;
    }

    return dfs() ? g : null;
  }

  function generateSolved() {
    const grid = Array(81).fill(0);
    for (let band = 0; band < 3; band++) {
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      let k = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          grid[idx(band * 3 + i, band * 3 + j)] = nums[k++];
        }
      }
    }
    return solveOne(grid);
  }

  function setBusy(busy) {
    state.generating = busy;
    newBtn.disabled = busy;
    eraseBtn.disabled = busy;
    checkBtn.disabled = busy;
    noteBtn.disabled = busy;
    [...diffsEl.querySelectorAll("button")].forEach(function (btn) {
      btn.disabled = busy;
    });
    [...padEl.querySelectorAll("button")].forEach(function (btn) {
      btn.disabled = busy;
    });
  }

  function applyPuzzle(solution, given) {
    state.solution = solution;
    state.given = given;
    state.values = given.slice();
    state.notes = Array.from({ length: 81 }, function () {
      return new Set();
    });
    state.selected = -1;
    render();
    setStatus("新局已生成。点格子后用键盘或下方数字填入。");
  }

  function carveAsync(solution, holes, token, done) {
    const puzzle = solution.slice();
    const order = shuffle([...Array(81).keys()]);
    let removed = 0;
    let cursor = 0;

    function step() {
      if (token !== state.genToken) return;
      const start = performance.now();
      while (cursor < order.length && removed < holes && performance.now() - start < 12) {
        const p = order[cursor++];
        const backup = puzzle[p];
        puzzle[p] = 0;
        if (countSolutions(puzzle, 2) !== 1) {
          puzzle[p] = backup;
        } else {
          removed++;
        }
      }
      if (removed >= holes || cursor >= order.length) {
        done(puzzle);
        return;
      }
      setStatus("正在出题… " + Math.min(99, Math.round((removed / holes) * 100)) + "%");
      window.setTimeout(step, 0);
    }

    step();
  }

  function newPuzzle() {
    if (state.generating) return;
    const token = ++state.genToken;
    setBusy(true);
    setStatus("正在出题，请稍候…");
    diffLabel.textContent = state.diff.name;

    window.setTimeout(function () {
      if (token !== state.genToken) return;
      try {
        let solution = null;
        for (let tries = 0; tries < 8 && !solution; tries++) {
          solution = generateSolved();
        }
        if (!solution) throw new Error("generate failed");
        carveAsync(solution, state.diff.holes, token, function (given) {
          if (token !== state.genToken) return;
          applyPuzzle(solution, given);
          setBusy(false);
        });
      } catch (err) {
        setStatus("出题失败，再点一次「新局」。", "bad");
        setBusy(false);
      }
    }, 30);
  }

  function conflicts() {
    const bad = new Set();
    for (let r = 0; r < 9; r++) {
      const seen = {};
      for (let c = 0; c < 9; c++) {
        const i = idx(r, c);
        const v = state.values[i];
        if (!v) continue;
        if (seen[v] != null) {
          bad.add(seen[v]);
          bad.add(i);
        } else seen[v] = i;
      }
    }
    for (let c = 0; c < 9; c++) {
      const seen = {};
      for (let r = 0; r < 9; r++) {
        const i = idx(r, c);
        const v = state.values[i];
        if (!v) continue;
        if (seen[v] != null) {
          bad.add(seen[v]);
          bad.add(i);
        } else seen[v] = i;
      }
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const seen = {};
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const p = idx(br * 3 + i, bc * 3 + j);
            const v = state.values[p];
            if (!v) continue;
            if (seen[v] != null) {
              bad.add(seen[v]);
              bad.add(p);
            } else seen[v] = p;
          }
        }
      }
    }
    return bad;
  }

  function emptyCount() {
    return state.values.filter(function (v) {
      return !v;
    }).length;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function isBand(i) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3);
    const bc = Math.floor(c / 3);
    return (br + bc) % 2 === 1;
  }

  function relatedSet(selected) {
    const set = new Set();
    if (selected < 0) return set;
    const r = Math.floor(selected / 9);
    const c = selected % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 9; i++) {
      set.add(idx(r, i));
      set.add(idx(i, c));
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) set.add(idx(br + i, bc + j));
    }
    return set;
  }

  function render() {
    const bad = conflicts();
    const related = relatedSet(state.selected);
    const selectedValue = state.selected >= 0 ? state.values[state.selected] : 0;
    boardEl.innerHTML = "";
    for (let i = 0; i < 81; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (isBand(i)) btn.classList.add("band");
      if (state.given[i]) btn.classList.add("given");
      else if (state.values[i]) btn.classList.add("user");
      if (related.has(i) && state.selected !== i) btn.classList.add("related");
      if (selectedValue && state.values[i] === selectedValue) btn.classList.add("same");
      if (state.selected === i) btn.classList.add("selected");
      if (bad.has(i)) btn.classList.add("conflict");
      if (state.values[i]) {
        btn.textContent = String(state.values[i]);
      } else if (state.notes[i] && state.notes[i].size) {
        const notes = document.createElement("div");
        notes.className = "notes";
        for (let n = 1; n <= 9; n++) {
          const s = document.createElement("span");
          s.textContent = state.notes[i].has(n) ? String(n) : "";
          notes.appendChild(s);
        }
        btn.appendChild(notes);
      }
      btn.addEventListener("click", function () {
        if (state.generating) return;
        state.selected = i;
        render();
      });
      boardEl.appendChild(btn);
    }
    emptyLabel.textContent = String(emptyCount());
    diffLabel.textContent = state.diff.name;
    noteBtn.classList.toggle("active", state.noteMode);
  }

  function inputNumber(n) {
    if (state.generating) return;
    if (state.selected < 0) return;
    if (state.given[state.selected]) return;
    if (state.noteMode) {
      state.values[state.selected] = 0;
      if (state.notes[state.selected].has(n)) state.notes[state.selected].delete(n);
      else state.notes[state.selected].add(n);
    } else {
      state.values[state.selected] = n;
      state.notes[state.selected].clear();
    }
    render();
    if (emptyCount() === 0 && conflicts().size === 0) {
      setStatus("完成！数独填对了。", "ok");
    }
  }

  function erase() {
    if (state.generating) return;
    if (state.selected < 0 || state.given[state.selected]) return;
    state.values[state.selected] = 0;
    state.notes[state.selected].clear();
    render();
  }

  DIFFS.forEach(function (d) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-tab" + (d.id === state.diff.id ? " active" : "");
    btn.textContent = d.name;
    btn.addEventListener("click", function () {
      if (state.generating) return;
      state.diff = d;
      [...diffsEl.children].forEach(function (el) {
        el.classList.remove("active");
      });
      btn.classList.add("active");
      newPuzzle();
    });
    diffsEl.appendChild(btn);
  });

  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pad-btn";
    btn.textContent = String(n);
    btn.addEventListener("click", function () {
      inputNumber(n);
    });
    padEl.appendChild(btn);
  }

  noteBtn.addEventListener("click", function () {
    if (state.generating) return;
    state.noteMode = !state.noteMode;
    render();
  });
  eraseBtn.addEventListener("click", erase);
  checkBtn.addEventListener("click", function () {
    if (state.generating) return;
    const bad = conflicts();
    render();
    if (bad.size) setStatus("发现冲突，已标红。", "bad");
    else if (emptyCount()) setStatus("目前没有冲突，继续填。");
    else setStatus("完成！", "ok");
  });
  newBtn.addEventListener("click", newPuzzle);
  window.addEventListener("keydown", function (e) {
    if (state.generating) return;
    if (e.key >= "1" && e.key <= "9") inputNumber(Number(e.key));
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
  });

  // 先画空盘，避免首屏白屏；再异步出题
  state.given = Array(81).fill(0);
  state.values = Array(81).fill(0);
  state.notes = Array.from({ length: 81 }, function () {
    return new Set();
  });
  render();
  newPuzzle();
})();
