(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CowPuzzle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PASTURES = [
    { fill: "#f6c8cf", spot: "#d9467a" },
    { fill: "#f6e3a4", spot: "#d4920a" },
    { fill: "#b6e5c1", spot: "#2f9d5b" },
    { fill: "#b7dcf8", spot: "#2f7ec4" },
    { fill: "#d8c7f8", spot: "#7c52c9" },
    { fill: "#fbcfa8", spot: "#e36d1f" },
    { fill: "#b4e9e1", spot: "#1c9a8c" },
    { fill: "#f4bfd9", spot: "#c43b8e" },
    { fill: "#d4e28a", spot: "#6b8e23" },
    { fill: "#c9d4f0", spot: "#4a6fa5" },
    { fill: "#efc9a8", spot: "#b86b3a" },
    { fill: "#a8d8d0", spot: "#2f7a70" },
  ];

  const CAMPAIGN = [
    {
      id: "easy",
      name: "简单",
      blurb: "4×4～5×5",
      hintLimit: null,
      secPerSize: 30,
      stages: [
        { size: 4, maxGivens: 2, title: "初识牧场", timeLimitSec: 90 },
        { size: 4, maxGivens: 1, title: "四色草地", timeLimitSec: 80 },
        { size: 4, maxGivens: 0, title: "独立思考", timeLimitSec: 75 },
        { size: 5, maxGivens: 2, title: "多一头牛", timeLimitSec: 110 },
        { size: 5, maxGivens: 1, title: "线索变少", timeLimitSec: 100 },
        { size: 5, maxGivens: 0, title: "简单通关", timeLimitSec: 90 },
      ],
    },
    {
      id: "medium",
      name: "中等",
      blurb: "6×6～7×7",
      hintLimit: 2,
      secPerSize: 24,
      stages: [
        { size: 6, maxGivens: 2, title: "青草蔓延", timeLimitSec: 130 },
        { size: 6, maxGivens: 1, title: "六宫试炼", timeLimitSec: 120 },
        { size: 6, maxGivens: 0, title: "无提示入门", timeLimitSec: 110 },
        { size: 7, maxGivens: 2, title: "草原扩张", timeLimitSec: 160 },
        { size: 7, maxGivens: 1, title: "七色迷宫", timeLimitSec: 145 },
        { size: 7, maxGivens: 0, title: "中等通关", timeLimitSec: 130 },
      ],
    },
    {
      id: "hard",
      name: "困难",
      blurb: "8×8～9×9",
      hintLimit: 0,
      secPerSize: 26,
      stages: [
        { size: 8, maxGivens: 2, title: "八方牧场", timeLimitSec: 190 },
        { size: 8, maxGivens: 1, title: "线索稀少", timeLimitSec: 175 },
        { size: 8, maxGivens: 0, title: "纯逻辑", timeLimitSec: 160 },
        { size: 9, maxGivens: 2, title: "九色迷踪", timeLimitSec: 220 },
        { size: 9, maxGivens: 1, title: "硬核推演", timeLimitSec: 200 },
        { size: 9, maxGivens: 0, title: "终极找牛", timeLimitSec: 185 },
      ],
    },
    {
      id: "hell",
      name: "地狱",
      blurb: "10×10～11×11",
      hintLimit: 0,
      secPerSize: 22,
      stages: [
        { size: 10, maxGivens: 1, title: "深渊入口", timeLimitSec: 210 },
        { size: 10, maxGivens: 0, title: "十方无援", timeLimitSec: 190 },
        { size: 10, maxGivens: 0, title: "窒息牧场", timeLimitSec: 175 },
        { size: 11, maxGivens: 1, title: "炼狱边境", timeLimitSec: 240 },
        { size: 11, maxGivens: 0, title: "十一重影", timeLimitSec: 220 },
        { size: 11, maxGivens: 0, title: "地狱通关", timeLimitSec: 200 },
      ],
    },
  ];

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function touches(rowA, colA, rowB, colB) {
    return Math.max(Math.abs(rowA - rowB), Math.abs(colA - colB)) === 1;
  }

  function randomPlacement(n) {
    const pos = new Array(n);
    const used = new Array(n).fill(false);

    function search(row) {
      if (row === n) return true;
      const cols = shuffle([...Array(n).keys()]);
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (used[col]) continue;
        if (row > 0 && Math.abs(col - pos[row - 1]) < 2) continue;
        pos[row] = col;
        used[col] = true;
        if (search(row + 1)) return true;
        used[col] = false;
      }
      return false;
    }

    if (!search(0)) return null;
    return pos;
  }

  function growRegions(n, placement) {
    const grid = Array.from({ length: n }, function () {
      return Array(n).fill(-1);
    });
    const size = new Array(n).fill(0);
    for (let row = 0; row < n; row++) {
      grid[row][placement[row]] = row;
      size[row] = 1;
    }

    let empty = n * n - n;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const bias = 0.55 + Math.random() * 1.2;

    while (empty > 0) {
      const options = [];
      let total = 0;
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          if (grid[row][col] !== -1) continue;
          const touch = new Map();
          for (let d = 0; d < dirs.length; d++) {
            const nr = row + dirs[d][0];
            const nc = col + dirs[d][1];
            if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
            const id = grid[nr][nc];
            if (id === -1) continue;
            touch.set(id, (touch.get(id) || 0) + 1);
          }
          touch.forEach(function (count, id) {
            const weight = Math.pow(count, bias) / Math.max(1, size[id]);
            options.push({ row: row, col: col, id: id, weight: weight });
            total += weight;
          });
        }
      }
      if (!options.length || total <= 0) return null;
      let roll = Math.random() * total;
      let picked = options[options.length - 1];
      for (let i = 0; i < options.length; i++) {
        roll -= options[i].weight;
        if (roll <= 0) {
          picked = options[i];
          break;
        }
      }
      grid[picked.row][picked.col] = picked.id;
      size[picked.id] += 1;
      empty -= 1;
    }
    return grid;
  }

  function collectSolutions(regions, n, givens, limit) {
    const pos = new Array(n);
    const usedCol = new Array(n).fill(false);
    const usedRegion = new Array(n).fill(false);
    const found = [];
    const cap = limit == null ? 2 : limit;
    const lockedRow = new Array(n).fill(false);

    if (givens) {
      for (let i = 0; i < givens.length; i++) {
        const given = givens[i];
        pos[given.row] = given.col;
        usedCol[given.col] = true;
        usedRegion[regions[given.row][given.col]] = true;
        lockedRow[given.row] = true;
      }
    }

    function search(row) {
      if (found.length >= cap) return;
      if (row === n) {
        found.push(pos.slice());
        return;
      }
      if (lockedRow[row]) {
        search(row + 1);
        return;
      }
      for (let col = 0; col < n; col++) {
        if (usedCol[col]) continue;
        if (row > 0 && Math.abs(col - pos[row - 1]) < 2) continue;
        const region = regions[row][col];
        if (usedRegion[region]) continue;
        pos[row] = col;
        usedCol[col] = true;
        usedRegion[region] = true;
        search(row + 1);
        usedCol[col] = false;
        usedRegion[region] = false;
        if (found.length >= cap) return;
      }
    }

    search(0);
    return found;
  }

  function countSolutions(regions, n, givens, limit) {
    return collectSolutions(regions, n, givens, limit).length;
  }

  function minimalGivens(regions, placement) {
    const n = placement.length;
    let sols = collectSolutions(regions, n, [], 2);
    if (sols.length <= 1) return [];

    const candidates = shuffle([...Array(n).keys()]);
    const chosen = [];

    for (let i = 0; i < candidates.length; i++) {
      const row = candidates[i];
      chosen.push({ row: row, col: placement[row] });
      sols = collectSolutions(regions, n, chosen, 2);
      if (sols.length <= 1) return chosen;
    }
    return chosen;
  }

  function createPuzzle(size, options) {
    const opts = options || {};
    const n = size;
    const targetGivens = opts.maxGivens == null ? Math.max(1, Math.floor(n / 4)) : opts.maxGivens;
    const maxAttempts =
      opts.maxAttempts || (n <= 5 ? 450 : n <= 7 ? 320 : n <= 9 ? 220 : 140);
    let best = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const placement = randomPlacement(n);
      if (!placement) continue;
      const regions = growRegions(n, placement);
      if (!regions) continue;

      const solutions = collectSolutions(regions, n, [], 2);
      if (solutions.length === 0) continue;

      if (solutions.length === 1) {
        return finish(n, regions, placement, [], attempt);
      }

      const givens = minimalGivens(regions, placement);
      if (!best || givens.length < best.givens.length) {
        best = { regions: regions, placement: placement, givens: givens, attempt: attempt };
      }
      if (givens.length <= targetGivens) {
        return finish(n, regions, placement, givens, attempt);
      }
    }

    if (!best) {
      throw new Error("暂时没能铺出这片草地");
    }
    return finish(n, best.regions, best.placement, best.givens, best.attempt);
  }

  function finish(n, regions, placement, givens, attempts) {
    const shift = Math.floor(Math.random() * PASTURES.length);
    const colors = Array.from({ length: n }, function (_, index) {
      return PASTURES[(index + shift) % PASTURES.length];
    });
    return {
      size: n,
      regions: regions,
      solution: placement.slice(),
      givens: (givens || []).map(function (g) {
        return { row: g.row, col: g.col };
      }),
      colors: colors,
      serial: Math.floor(1000 + Math.random() * 9000),
      attempts: attempts,
    };
  }

  function validateBoard(regions, cows) {
    const n = regions.length;
    const conflicts = [];
    const byRow = Array.from({ length: n }, function () {
      return [];
    });
    const byCol = Array.from({ length: n }, function () {
      return [];
    });
    const byRegion = Array.from({ length: n }, function () {
      return [];
    });

    for (let i = 0; i < cows.length; i++) {
      const cow = cows[i];
      byRow[cow.row].push(cow);
      byCol[cow.col].push(cow);
      byRegion[regions[cow.row][cow.col]].push(cow);
    }

    function mark(group, reason) {
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        conflicts.push({ row: group[i].row, col: group[i].col, reason: reason });
      }
    }

    for (let i = 0; i < n; i++) {
      mark(byRow[i], "row");
      mark(byCol[i], "col");
      mark(byRegion[i], "color");
    }

    for (let a = 0; a < cows.length; a++) {
      for (let b = a + 1; b < cows.length; b++) {
        if (touches(cows[a].row, cows[a].col, cows[b].row, cows[b].col)) {
          conflicts.push({ row: cows[a].row, col: cows[a].col, reason: "touch" });
          conflicts.push({ row: cows[b].row, col: cows[b].col, reason: "touch" });
        }
      }
    }

    const unique = {};
    const list = [];
    for (let i = 0; i < conflicts.length; i++) {
      const key = conflicts[i].row + "," + conflicts[i].col;
      if (unique[key]) continue;
      unique[key] = true;
      list.push(conflicts[i]);
    }

    const complete =
      cows.length === n &&
      list.length === 0 &&
      byRow.every(function (g) {
        return g.length === 1;
      }) &&
      byCol.every(function (g) {
        return g.length === 1;
      }) &&
      byRegion.every(function (g) {
        return g.length === 1;
      });

    return { conflicts: list, complete: complete };
  }

  function getDifficulty(id) {
    return (
      CAMPAIGN.find(function (item) {
        return item.id === id;
      }) || CAMPAIGN[0]
    );
  }

  function getStage(diffId, stageIndex) {
    const diff = getDifficulty(diffId);
    return diff.stages[stageIndex] || null;
  }

  return {
    PASTURES: PASTURES,
    CAMPAIGN: CAMPAIGN,
    createPuzzle: createPuzzle,
    countSolutions: countSolutions,
    collectSolutions: collectSolutions,
    randomPlacement: randomPlacement,
    growRegions: growRegions,
    validateBoard: validateBoard,
    touches: touches,
    getDifficulty: getDifficulty,
    getStage: getStage,
  };
});
