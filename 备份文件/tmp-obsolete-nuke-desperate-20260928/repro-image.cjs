/*
 * 按用户残局图重建局面（非残局码解码）：
 *  坐标 = 残局图标准制 x=1..9(左→右), y=1..9(下→上)。
 *  黑方先行落子图指定 (9,4)，观察白方 tactics 应着。
 * 运行： node tmp/repro-image.cjs
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
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { RulesRuntime } = load('runtime.cjs');
const { EndgameTactics } = load('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = load('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

// —— 局面对照（display 坐标：x 左→右, y 下→上，1-based）——
const BLACK_D = [[5, 1], [7, 1], [8, 1], [5, 6], [6, 6], [7, 6], [7, 2], [8, 3]];
const WHITE_D = [[2, 8], [4, 8], [3, 7], [4, 7], [5, 7], [3, 5], [2, 4], [6, 4], [6, 3], [6, 2]];
const HP = [1, 1];            // [黑, 白]
const BLACK_MOVE_D = [9, 4];  // 黑方先行落子（先横后竖）

// display(x,y) → board API(x0=index, y0=index, 左上角0-based)
const D2B = ([x, y]) => [x - 1, 8 - (y - 1)];

const grid = () => Array.from({ length: 9 }, () => new Array(9).fill('none')); // [y][x] board API
const g = grid();
for (const [x, y] of BLACK_D) { const [bx, by] = D2B([x, y]); g[by][bx] = 'black'; }
for (const [x, y] of WHITE_D) { const [bx, by] = D2B([x, y]); g[by][bx] = 'white'; }

const mark = (s) => ({ 'black': 'B', 'white': 'W' }[s] || '.');
console.log('=== 重建局面（display 坐标：x左→右, y下→上）===');
console.log('    1 2 3 4 5 6 7 8 9  x');
for (let D = 9; D >= 1; D--) {
    const by = 8 - (D - 1);
    let line = `${D}  `;
    for (let bx = 0; bx < 9; bx++) line += mark(g[by][bx]) + ' ';
    console.log(line);
}
console.log('hp 黑/白 =', HP.join('/'), ' 黑先行落子 (9,4)\n');

const buildGame = () => {
    const board = new Board(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        board.set_pos(x, y, g[y][x] === 'black' ? S.BLACK : g[y][x] === 'white' ? S.WHITE : S.NONE, P.NONE);
    }
    const state = new State();
    state.hp = [...HP];
    state.turn_player = R.BLACK;
    state.turn_count = 0;
    state.ascend_status = A.NONE;
    state.pending_damage = null;
    state.unascend_charge = 25;
    state.unascend_chargef = [9, 9];
    state.grow_count = 11;
    state.just_unascend = false;
    state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31 >>> 0), new RandUnity(0x4A534B32 >>> 0));
    game.natural_plant = false;
    game.first_player = R.BLACK;
    game.board.turns = [];
    RulesRuntime.initialize(game, game.first_player);
    return game;
};

// 术前诊断
const diag = buildGame();
const foeNow = tactics.maxAscendNow.call(tactics, diag, S.BLACK);
const whiteBest = (() => { let b = null; RulesRuntime.legalMoves(diag).forEach((a) => { const x = a % diag.board.w, y = Math.floor(a / diag.board.w); const pts = diag.board.get_ascend(x, y, S.WHITE); if (pts) { const p = tactics.powerOf(pts); if (!b || p.MN > b.MN) b = { M: p.M, MN: p.MN, x, y }; } }); return b; })();
console.log(`[诊断] 黑当前最大可成打 M=${foeNow ? foeNow.M : 0} MN=${foeNow ? foeNow.MN : 0}；白本手最大可成打 M=${whiteBest ? whiteBest.M : 0} MN=${whiteBest ? whiteBest.MN : 0} → 白本手可到M≥7? ${whiteBest ? whiteBest.M >= 7 : false}`);
console.log(`[诊断] 黑落(9,4)后白面对的黑方打点/核弹威胁见下实测\n`);

// —— 白方全部可落点的“四方向核弹力度 M”，用于核对 (4,5) ——
{
    const g0 = buildGame();
    const rows = [];
    RulesRuntime.legalMoves(g0).forEach((a) => {
        const x = a % g0.board.w, y = Math.floor(a / g0.board.w);
        if (g0.board.get_stone(x, y) !== S.NONE) return;
        const pts = g0.board.get_ascend(x, y, S.WHITE);
        if (!pts) return;
        const p = tactics.powerOf(pts);
        rows.push({ x, y, M: p.M, N: p.N, MN: p.MN, n: pts.length });
    });
    rows.sort((a, b) => b.M - a.M || b.MN - a.MN);
    console.log('=== 白方可落点·核弹力度 M（四方向拿走子总数，仅列 M>=3）===');
    rows.filter((r) => r.M >= 3).forEach((r) => {
        const [dRx, dCc] = [r.x + 1, 8 - r.y + 1];
        console.log(`  display(${dRx},${dCc})  board(${r.x},${r.y})  M=${r.M} N=${r.N} MN=${r.MN}`);
    });
    const top = rows[0];
    console.log(`  >> 白方最大核弹力度 M=${top ? top.M : 0}${top && top.M >= 7 ? '  → 已达核弹!' : '  → 未达 M≥7，无核弹可扩'}`);
}
const [bmx, bmy] = D2B(BLACK_MOVE_D);
const game = buildGame();
if (game.board.get_stone(bmx, bmy) !== S.NONE) { console.log(`黑落点 board(${bmx},${bmy}) (display 9,4) 已被占用`); process.exit(0); }
game.board.set_stone(bmx, bmy, S.BLACK);
game.board.turns.push([bmx, bmy]);
game.state.turn_player = R.WHITE;
game.state.turn_count += 1;

const m = tactics.chooseMove(game);
if (!m) {
    console.log('白方 tactics 未命中任何分支（回退树搜索）');
} else {
    const [x, y] = B2D([m.x, m.y]);
    const sp = (m.detail && m.detail.selfPower) || {};
    console.log(`白方应着: reason=${m.reason}  display(${x},${y})  board(${m.x},${m.y})  M=${sp.M} MN=${sp.MN}`);
    if (m.detail) console.log(`  detail: isKill=${m.detail.isKill} suicidalAscend=${m.detail.suicidalAscend} mustAnswer=${m.detail.mustAnswer} beatsThreat=${m.detail.beatsThreat} blocks=${m.detail.blockPoint}`);
}
function B2D([bx, by]) { return [bx + 1, 8 - by + 1]; }