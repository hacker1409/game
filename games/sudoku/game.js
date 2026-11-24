(function () {
  const DIFFS = [
    { id: "easy", name: "简单", holes: 38 },
    { id: "medium", name: "中等", holes: 48 },
    { id: "hard", name: "困难", holes: 54 },
    { id: "hell", name: "地狱", holes: 58 },
  ];

  const boardEl = document.getElementById("board");
  const diffsEl = document.getElementById("diffs");
  const padEl = document.getElementById("pad");
  const statusEl = document.getElementById("status");
  const diffLabel = document.getElementById("diff-label");
  const emptyLabel = document.getElementById("empty-label");
  const noteBtn = document.getElementById("note-btn");

  const state = {
    diff: DIFFS[0],
    solution: [],
    given: [],
    values: [],
    notes: [],
    selected: -1,
    noteMode: false,
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

  function canPlace(grid, r, c, n) {
    for (let i = 0; i < 9; i++) {
      if (grid[idx(r, i)] === n || grid[idx(i, c)] === n) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[idx(br + i, bc + j)] === n) return false;
      }
    }
    return true;
  }

  function fillGrid(grid) {
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (let k = 0; k < nums.length; k++) {
        const n = nums[k];
        if (!canPlace(grid, r, c, n)) continue;
        grid[i] = n;
        if (fillGrid(grid)) return true;
        grid[i] = 0;
      }
      return false;
    }
    return true;
  }

  function countSolutions(grid, limit) {
    const g = grid.slice();
    let count = 0;
    function solve() {
      if (count >= limit) return;
      const pos = g.indexOf(0);
      if (pos < 0) {
        count++;
        return;
      }
      const r = Math.floor(pos / 9);
      const c = pos % 9;
      for (let n = 1; n <= 9; n++) {
        if (!canPlace(g, r, c, n)) continue;
        g[pos] = n;
        solve();
        g[pos] = 0;
        if (count >= limit) return;
      }
    }
    solve();
    return count;
  }

  function carve(solution, holes) {
    const puzzle = solution.slice();
    const order = shuffle([...Array(81).keys()]);
    let removed = 0;
    for (let i = 0; i < order.length && removed < holes; i++) {
      const p = order[i];
      const backup = puzzle[p];
      puzzle[p] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[p] = backup;
      } else {
        removed++;
      }
    }
    return puzzle;
  }

  function newPuzzle() {
    const grid = Array(81).fill(0);
    fillGrid(grid);
    state.solution = grid.slice();
    state.given = carve(grid, state.diff.holes);
    state.values = state.given.slice();
    state.notes = Array.from({ length: 81 }, function () {
      return new Set();
    });
    state.selected = -1;
    render();
    setStatus("新局已生成。点格子后用键盘或下方数字填入。");
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
      } else if (state.notes[i].size) {
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
    state.noteMode = !state.noteMode;
    render();
  });
  document.getElementById("erase-btn").addEventListener("click", erase);
  document.getElementById("check-btn").addEventListener("click", function () {
    const bad = conflicts();
    render();
    if (bad.size) setStatus("发现冲突，已标红。", "bad");
    else if (emptyCount()) setStatus("目前没有冲突，继续填。");
    else setStatus("完成！", "ok");
  });
  document.getElementById("new-btn").addEventListener("click", newPuzzle);
  window.addEventListener("keydown", function (e) {
    if (e.key >= "1" && e.key <= "9") inputNumber(Number(e.key));
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
  });

  newPuzzle();
})();
