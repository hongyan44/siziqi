/*
 * 对解码盘面做 8 种对称变换，检查哪一种朝向下白方 display(4,5) 是核弹点(M>=7)。
 * 运行： node tmp/sym-check.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const globalDir = path.resolve(__dirname, '../js/global');
const cache = new Map();
function load(file) {
    const abs = path.resolve(file);
    if (cache.has(abs)) return cache.get(abs).exports;
    const module = { exports: {} };
    cache.set(abs, module);
    const text = fs.readFileSync(abs, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', 'window', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(abs), p)) : require(p)),
        module, module.exports, global
    );
    return module.exports;
}
load(path.resolve(globalDir, 'endgame.cjs'));
const { EndgameArchive } = global.EndgameExports;
const raw = fs.readFileSync(path.resolve(__dirname, 'endgame-code.txt'), 'utf8').trim();
const data = EndgameArchive.decode(raw);

// 原始（archive 顺序）棋盘：idx = by*9+bx
const orig = Array.from({ length: 9 }, () => new Array(9).fill('none'));
data.cells.forEach((c, i) => { orig[Math.floor(i / 9)][i % 9] = c.stone; });

// 变换作用在 (bx,by) 0-based 上
const T = {
    'identity': (x, y) => [x, y],
    'rot90cw': (x, y) => [y, 8 - x],
    'rot180': (x, y) => [8 - x, 8 - y],
    'rot270cw': (x, y) => [8 - y, x],
    'mirrorX(左右翻)': (x, y) => [8 - x, y],
    'mirrorY(上下翻)': (x, y) => [x, 8 - y],
    'transpose': (x, y) => [y, x],
    'antiTranspose': (x, y) => [8 - y, 8 - x],
};

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]];
// 返回 grid（[by][bx]）上 (bx,by) 的 ASCEND 力度 M；不可成返回 null
function ascendM(grid, bx, by, stone) {
    if (grid[by][bx] !== 'none') return null;
    const res = [];
    for (const [dx, dy] of DIRS) {
        const c = [];
        let sx = bx + dx, sy = by + dy;
        while (sx >= 0 && sx < 9 && sy >= 0 && sy < 9 && grid[sy][sx] === stone) {
            c.push([sx, sy]); sx += dx; sy += dy;
        }
        res.push(c);
    }
    let n = 0;
    for (let i = 0; i < 8; i += 2) if (res[i].length + res[i + 1].length >= 3) n += res[i].length + res[i + 1].length;
    if (n === 0) return null;
    return n + 1; // + 中心
}

// display 坐标 ↔ 变换后 grid 的 0-based：这里直接以 display(1..9) 为基准，grid[bY][bX]，bX=dx-1,bY=9-dy
// 我们先构造“变换后的 display 棋盘”，再算 M。
for (const [name, fn] of Object.entries(T)) {
    const g = Array.from({ length: 9 }, () => new Array(9).fill('none'));
    for (let by = 0; by < 9; by++) for (let bx = 0; bx < 9; bx++) {
        const [tx, ty] = fn(bx, by);
        g[ty][tx] = orig[by][bx];
    }
    // 转成 display 棋盘 D[dy][dx]，dx,dy 1..9；display(1,1) 是左下角 → board(0,8)
    const D = Array.from({ length: 10 }, () => new Array(10).fill('none'));
    for (let by = 0; by < 9; by++) for (let bx = 0; bx < 9; bx++) {
        const dx = bx + 1, dy = 9 - by;
        D[dy][dx] = g[by][bx];
    }
    // 在 display 空间算 ASCEND（方向对称，可直接用）
    const mAt = (dx, dy, stone) => {
        if (D[dy][dx] !== 'none') return null;
        const res = [];
        for (const [ddx, ddy] of DIRS) {
            const c = [];
            let sx = dx + ddx, sy = dy + ddy;
            while (sx >= 1 && sx <= 9 && sy >= 1 && sy <= 9 && D[sy][sx] === stone) { c.push([sx, sy]); sx += ddx; sy += ddy; }
            res.push(c);
        }
        let n = 0;
        for (let i = 0; i < 8; i += 2) if (res[i].length + res[i + 1].length >= 3) n += res[i].length + res[i + 1].length;
        return n === 0 ? null : n + 1;
    };
    let best = 0, bestPt = null;
    for (let dy = 1; dy <= 9; dy++) for (let dx = 1; dx <= 9; dx++) {
        const m = mAt(dx, dy, 'white');
        if (m && m > best) { best = m; bestPt = [dx, dy]; }
    }
    const m45 = mAt(4, 5, 'white');
    const blackAt94 = D[4][9];
    console.log(`[${name}] 白最大M=${best} @${bestPt ? `(${bestPt})` : '-'} | 白@(4,5) M=${m45 === null ? '不可成' : m45} | (9,4)=${blackAt94} | 白子数=${D.flat().filter((s) => s === 'white').length}`);
}
