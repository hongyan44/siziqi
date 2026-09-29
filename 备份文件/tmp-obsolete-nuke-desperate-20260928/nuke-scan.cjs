/*
 * 用真实 Board API 扫描指定局面下双方所有可落点的 ASCEND 力度（M = 四方向拿走子总数，M>=7 为核弹）。
 * 局面 A = 残局码解码结果（本脚本内联）；同时给出 A 的上下翻转局面 B 的坐标标注。
 * 运行： node tmp/nuke-scan.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

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

// 局面 A（display 坐标，x 右、y 上，1-based）= 残局码解码结果
const A_BLACK = [[1, 5], [2, 4], [4, 2], [6, 9], [7, 5], [7, 6], [7, 7], [7, 9], [8, 7]];
const A_WHITE = [[2, 2], [2, 3], [3, 1], [3, 2], [3, 4], [4, 3], [4, 4], [4, 8], [5, 8], [6, 8]];

const D2B = ([x, y]) => [x - 1, 9 - y];

const build = (black, white) => {
    const board = new Board(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) board.set_pos(x, y, S.NONE, P.NONE);
    black.forEach(([dx, dy]) => { const [bx, by] = D2B([dx, dy]); board.set_pos(bx, by, S.BLACK, P.NONE); });
    white.forEach(([dx, dy]) => { const [bx, by] = D2B([dx, dy]); board.set_pos(bx, by, S.WHITE, P.NONE); });
    return board;
};

const scan = (label, black, white) => {
    const board = build(black, white);
    console.log(`\n===== ${label} =====`);
    for (const [name, stone] of [['白', S.WHITE], ['黑', S.BLACK]]) {
        const rows = [];
        for (let by = 0; by < 9; by++) for (let bx = 0; bx < 9; bx++) {
            if (board.get_stone(bx, by) !== S.NONE) continue;
            const pts = board.get_ascend(bx, by, stone);
            if (!pts) continue;
            const p = tactics.powerOf(pts);
            rows.push({ dx: bx + 1, dy: 9 - by, M: p.M, MN: p.MN });
        }
        rows.sort((a, b) => b.M - a.M || b.MN - a.MN);
        console.log(`  [${name}方] 可成点按 M 降序（前 8）：`);
        rows.slice(0, 8).forEach((r) => console.log(`    display(${r.dx},${r.dy})  M=${r.M} MN=${r.MN}${r.M >= 7 ? '   <<< 核弹' : ''}`));
        if (!rows.length) console.log('    （无任何可成 ASCEND 的点）');
        const nuke = rows.filter((r) => r.M >= 7);
        console.log(`  [${name}方] M>=7 核弹点数量 = ${nuke.length}${nuke.length ? ' → ' + nuke.map((r) => `(${r.dx},${r.dy})M${r.M}`).join(' ') : ''}`);
    }
};

scan('局面 A（残局码解码原样）', A_BLACK, A_WHITE);

// B = A 上下翻转：display(x,y) -> (x, 10-y)
const flipY = (list) => list.map(([x, y]) => [x, 10 - y]);
scan('局面 B（= A 上下翻转，即挑战页实际渲染）', flipY(A_BLACK), flipY(A_WHITE));

// 黑方在 B 落 (9,4) 后，白方扫描
scan('局面 B + 黑落(9,4)', flipY(A_BLACK).concat([[9, 4]]), flipY(A_WHITE));
// 黑方在 A 落 (9,4) 后，白方扫描
scan('局面 A + 黑落(9,4)', A_BLACK.concat([[9, 4]]), A_WHITE);
