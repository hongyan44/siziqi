/*
 * 手工盘面核弹分析：给定黑白棋子列表（用户坐标 列,行，左下角=(1,1)），
 * 统计白方每个空点落子后形成的 ASCEND 力度 M，以及“落子后下一手最大可成 M”。
 * 用法： node tmp/manual-nuke.cjs "B:5,1;5,6;6,6" "W:2,4;3,7"
 */
const fs = require('node:fs');
const path = require('node:path');
globalThis.window = globalThis;

const source = path.resolve(__dirname, '../js/global/fascend');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        module, module.exports
    );
    return module.exports;
}
const { Board } = load('board.cjs');
const { EndgameTactics } = load('endgame_tactics.cjs');
const { RulesRuntime } = load('runtime.cjs');
const { STONE_ENUM: S, PLANT_ENUM: P } = load('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

const parse = (s) => {
    const body = s.slice(2);
    if (!body) return [];
    return body.split(';').map((t) => t.split(',').map(Number));
};
const BLACK = parse(process.argv[2] || 'B:');
const WHITE = parse(process.argv[3] || 'W:');

// 用户坐标 (R,C) → board (x, y) = (R-1, 9-C)
const U2B = ([R, C]) => [R - 1, 9 - C];
const B2U = ([x, y]) => [x + 1, 9 - y];

const build = () => {
    const board = new Board(9, 9);
    BLACK.forEach(([R, C]) => { const [x, y] = U2B([R, C]); board.set_pos(x, y, S.BLACK, P.NONE); });
    WHITE.forEach(([R, C]) => { const [x, y] = U2B([R, C]); board.set_pos(x, y, S.WHITE, P.NONE); });
    return board;
};

console.log('黑:', JSON.stringify(BLACK));
console.log('白:', JSON.stringify(WHITE));

const board = build();
console.log('      列1 列2 列3 列4 列5 列6 列7 列8 列9');
for (let C = 9; C >= 1; C--) {
    let line = `行${C}   `;
    for (let R = 1; R <= 9; R++) {
        const [x, y] = U2B([R, C]);
        const st = board.get_stone(x, y);
        line += ' ' + (st === S.BLACK ? 'B' : st === S.WHITE ? 'W' : '.') + ' ';
    }
    console.log(line);
}

const M = (b, R, C, stone) => {
    const [x, y] = U2B([R, C]);
    const pts = b.get_ascend(x, y, stone);
    return pts ? tactics.powerOf(pts) : null;
};

const rows = [];
for (let C = 1; C <= 9; C++) for (let R = 1; R <= 9; R++) {
    const [x, y] = U2B([R, C]);
    if (board.get_stone(x, y) !== S.NONE) continue;
    const p = M(board, R, C, S.WHITE);
    rows.push({ R, C, M: p ? p.M : 0, MN: p ? p.MN : 0 });
}
rows.sort((a, b) => (b.M - a.M) || (b.MN - a.MN));
console.log('\n白方本手落子 → 该手 ASCEND 力度 M（前 12）：');
rows.slice(0, 12).forEach((r) => console.log(`  用户坐标(${r.R},${r.C})  M=${r.M} MN=${r.MN}${r.M >= 7 ? '   <<< 核弹(M>=7)' : ''}`));

// 二步潜力
const plan = [];
for (let C = 1; C <= 9; C++) for (let R = 1; R <= 9; R++) {
    const [x, y] = U2B([R, C]);
    if (board.get_stone(x, y) !== S.NONE) continue;
    const b2 = build();
    b2.set_pos(x, y, S.WHITE, P.NONE);
    let best = null;
    for (let c2 = 1; c2 <= 9; c2++) for (let r2 = 1; r2 <= 9; r2++) {
        const [x2, y2] = U2B([r2, c2]);
        if (b2.get_stone(x2, y2) !== S.NONE) continue;
        const p = M(b2, r2, c2, S.WHITE);
        if (!p) continue;
        if (!best || p.M > best.M) best = { M: p.M, R: r2, C: c2 };
    }
    plan.push({ R, C, afterM: best ? best.M : 0, at: best ? `${best.R},${best.C}` : '-' });
}
plan.sort((a, b) => b.afterM - a.afterM);
console.log('\n白方本手落子 → 落子后白方下一手最大可成 M（前 10）：');
plan.slice(0, 10).forEach((r) => console.log(`  用户坐标(${r.R},${r.C})  → 下一手最大 M=${r.afterM}${r.afterM >= 7 ? '  <<< 可成核弹' : ''}  触发点(${r.at})`));
