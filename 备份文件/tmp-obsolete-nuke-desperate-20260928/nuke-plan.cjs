/*
 * “核弹准备手”扫描：对每个白方落点，模拟落子后计算白方全盘最大 ASCEND 力度 M，
 * 找出“走完这一手之后，白方下一手能否形成 M>=7 核弹”的落点排序。
 * 运行： node tmp/nuke-plan.cjs
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

// —— 局面 1：用户上传编辑器截图（display 坐标）——
const E1_BLACK = [[5, 1], [7, 1], [8, 1], [5, 6], [6, 6], [7, 6], [7, 2], [8, 3]];
const E1_WHITE = [[2, 8], [4, 8], [3, 7], [4, 7], [5, 7], [3, 5], [2, 4], [6, 4], [6, 3], [6, 2]];

// —— 局面 2：残局码解码后挑战页实际渲染（= 解码盘上下翻转）——
const E2_BLACK = [[1, 5], [2, 6], [4, 8], [6, 1], [7, 1], [7, 3], [7, 4], [7, 5], [8, 3]];
const E2_WHITE = [[2, 8], [2, 7], [3, 9], [3, 8], [3, 6], [4, 7], [4, 6], [4, 2], [5, 2], [6, 2]];

const D2B = ([x, y]) => [x - 1, 9 - y];
const B2D = ([x, y]) => [x + 1, 9 - y];

const build = (black, white, extraBlack) => {
    const board = new Board(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) board.set_pos(x, y, S.NONE, P.NONE);
    black.forEach(([dx, dy]) => { const [bx, by] = D2B([dx, dy]); board.set_pos(bx, by, S.BLACK, P.NONE); });
    if (extraBlack) { const [bx, by] = D2B(extraBlack); board.set_pos(bx, by, S.BLACK, P.NONE); }
    white.forEach(([dx, dy]) => { const [bx, by] = D2B([dx, dy]); board.set_pos(bx, by, S.WHITE, P.NONE); });
    return board;
};

const bestM = (board, stone) => {
    let best = null;
    for (let by = 0; by < 9; by++) for (let bx = 0; bx < 9; bx++) {
        if (board.get_stone(bx, by) !== S.NONE) continue;
        const pts = board.get_ascend(bx, by, stone);
        if (!pts) continue;
        const p = tactics.powerOf(pts);
        if (!best || p.M > best.M || (p.M === best.M && p.MN > best.MN)) best = { M: p.M, MN: p.MN, x: bx, y: by };
    }
    return best;
};

const analyze = (label, black, white, extraBlack) => {
    console.log(`\n===== ${label} =====`);
    const b0 = build(black, white, extraBlack);
    const w0 = bestM(b0, S.WHITE);
    const f0 = bestM(b0, S.BLACK);
    console.log(`  落子前：白方最大可成 M=${w0 ? w0.M : 0} @display(${w0 ? B2D([w0.x, w0.y]).join(',') : '-'})；黑方最大可成 M=${f0 ? f0.M : 0} @display(${f0 ? B2D([f0.x, f0.y]).join(',') : '-'})`);

    const rows = [];
    for (let by = 0; by < 9; by++) for (let bx = 0; bx < 9; bx++) {
        if (b0.get_stone(bx, by) !== S.NONE) continue;
        const board = build(black, white, extraBlack);
        board.set_pos(bx, by, S.WHITE, P.NONE);
        const after = bestM(board, S.WHITE);
        rows.push({
            dx: bx + 1, dy: 9 - by,
            afterM: after ? after.M : 0,
            afterAt: after ? B2D([after.x, after.y]).join(',') : '-',
        });
    }
    rows.sort((a, b) => b.afterM - a.afterM);
    console.log('  白方落点 → 落子后白方最大可成 M（降序前 10）：');
    rows.slice(0, 10).forEach((r) => console.log(`    display(${r.dx},${r.dy})  → 之后白方最大 M=${r.afterM}${r.afterM >= 7 ? '  <<< 形成核弹威胁' : ''}  触发点(${r.afterAt})`));
};

analyze('局面1（编辑器截图）', E1_BLACK, E1_WHITE, null);
analyze('局面1 + 黑落(9,4)', E1_BLACK, E1_WHITE, [9, 4]);
analyze('局面2（挑战页实际渲染）', E2_BLACK, E2_WHITE, null);
analyze('局面2 + 黑落(9,4)', E2_BLACK, E2_WHITE, [9, 4]);
