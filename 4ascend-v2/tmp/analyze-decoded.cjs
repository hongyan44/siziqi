/*
 * 用真实解码盘面跑战术分析：
 *   1) 打印盘面（display 坐标：x 左→右, y 下→上, 1-based）
 *   2) 列出白方所有可落点的 ASCEND 力度 M（四方向拿走子总数）
 *   3) 黑方落 (9,4) 后，输出白方 tactics 应着
 * 运行： node tmp/analyze-decoded.cjs
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
const fascend = (n) => load(path.resolve(globalDir, 'fascend', n));
const { Board } = fascend('board.cjs');
const { State } = fascend('state.cjs');
const { GameNormal } = fascend('game_normal.cjs');
const { RandAIC, RandUnity } = fascend('rand.cjs');
const { RulesRuntime } = fascend('runtime.cjs');
const { EndgameTactics } = fascend('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = fascend('enum.cjs');

const tactics = EndgameTactics.create({ RulesRuntime });

const raw = fs.readFileSync(path.resolve(__dirname, 'endgame-code.txt'), 'utf8').trim();
const data = EndgameArchive.decode(raw);

const b2d = (bx, by) => [bx + 1, 9 - by];
const d2b = (dx, dy) => [dx - 1, 9 - dy];

// cells[i] → board(bx = i%9, by = floor(i/9))
const cells = data.cells.map((c) => c.stone);

console.log('=== 盘面（display 坐标）===');
console.log('      1  2  3  4  5  6  7  8  9');
for (let dy = 9; dy >= 1; dy--) {
    const by = 9 - dy;
    let line = String(dy).padStart(3, ' ') + '   ';
    for (let bx = 0; bx < 9; bx++) {
        const s = cells[by * 9 + bx];
        line += (s === 'black' ? 'B' : s === 'white' ? 'W' : s === 'none' ? '.' : '*') + '  ';
    }
    console.log(line);
}
console.log(`hp 黑/白 = ${data.hp.black}/${data.hp.white}  当前行棋 = ${data.snapshot.turnPlayer === 1 ? 'white' : 'black'}\n`);

const buildGame = () => {
    const board = new Board(9, 9);
    for (let i = 0; i < 81; i++) {
        const bx = i % 9, by = Math.floor(i / 9);
        const s = cells[i] === 'black' ? S.BLACK : cells[i] === 'white' ? S.WHITE : S.NONE;
        board.set_pos(bx, by, s, P.NONE);
    }
    const state = new State();
    state.hp = [data.hp.black, data.hp.white];
    state.turn_player = data.snapshot.turnPlayer === 1 ? R.WHITE : R.BLACK;
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

// —— 白方所有可落点的 ASCEND 力度 ——
{
    const g = buildGame();
    const rows = [];
    RulesRuntime.legalMoves(g).forEach((a) => {
        const x = a % g.board.w, y = Math.floor(a / g.board.w);
        if (g.board.get_stone(x, y) !== S.NONE) return;
        const pts = g.board.get_ascend(x, y, S.WHITE);
        if (!pts) return;
        const p = tactics.powerOf(pts);
        rows.push({ x, y, M: p.M, N: p.N, MN: p.MN });
    });
    rows.sort((a, b) => b.M - a.M || b.MN - a.MN);
    console.log('=== 白方可落点 ASCEND 力度（仅列 M>=3）===');
    rows.filter((r) => r.M >= 3).forEach((r) => {
        const [dx, dy] = b2d(r.x, r.y);
        console.log(`  display(${dx},${dy})  M=${r.M} N=${r.N} MN=${r.MN}`);
    });
    const top = rows[0];
    if (top) {
        const [dx, dy] = b2d(top.x, top.y);
        console.log(`  >> 白方最大 M=${top.M} @ display(${dx},${dy})  ${top.M >= 7 ? '已达核弹' : '未达 M>=7'}`);
    } else {
        console.log('  >> 白方无任何可成 ASCEND 点');
    }
    console.log(`  白方 display(4,5) 的 M = ${(() => { const [bx, by] = d2b(4, 5); const pts = g.board.get_ascend(bx, by, S.WHITE); return pts ? tactics.powerOf(pts).M : '不可成(返回null)'; })()}`);
    console.log(`  黑方 display(9,4) 的 M = ${(() => { const [bx, by] = d2b(9, 4); const pts = g.board.get_ascend(bx, by, S.BLACK); return pts ? tactics.powerOf(pts).M : '不可成(返回null)'; })()}\n`);
}

// —— 黑方落 (9,4)，看白方应着 ——
{
    const [bmx, bmy] = d2b(9, 4);
    const game = buildGame();
    if (game.board.get_stone(bmx, bmy) !== S.NONE) {
        console.log(`黑落点 display(9,4) 已被占用，跳过`);
    } else {
        game.board.set_stone(bmx, bmy, S.BLACK);
        game.board.turns.push([bmx, bmy]);
        game.state.turn_player = R.WHITE;
        game.state.turn_count += 1;
        const m = tactics.chooseMove(game);
        if (!m) console.log('白方 tactics 未命中任何分支（回退树搜索）');
        else {
            const [dx, dy] = b2d(m.x, m.y);
            const sp = (m.detail && m.detail.selfPower) || {};
            console.log(`白方应着: reason=${m.reason}  display(${dx},${dy})  M=${sp.M} MN=${sp.MN}`);
            console.log(`  detail: ${JSON.stringify(m.detail)}`);
        }
    }
}
