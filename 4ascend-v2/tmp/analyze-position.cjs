/*
 * 按【正确显示系】(display x=1..9 左→右, y=1..9 下→上) 解码残局码，
 * 打印盘面(含草)，并跑 endgame_tactics：黑落 display(9,4) 后白方应着。
 * display(dx,dy) ⇄ engine(x,y): x = dx-1, y = 9-dy
 * 运行: node tmp/analyze-position.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
globalThis.window = globalThis;

const globalDir = path.resolve(__dirname, '../js/global');
const fascendDir = path.resolve(globalDir, 'fascend');

function makeLoader(dir) {
    const cache = new Map();
    return function load(name) {
        const file = path.resolve(dir, name);
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
        new Function('require', 'module', 'exports', text)(
            (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
            module, module.exports
        );
        return module.exports;
    };
}
const loadGlobal = makeLoader(globalDir);
const loadF = makeLoader(fascendDir);

loadGlobal('endgame.cjs');
const { EndgameArchive } = globalThis.EndgameExports;
const { Board } = loadF('board.cjs');
const { State } = loadF('state.cjs');
const { GameNormal } = loadF('game_normal.cjs');
const { RandAIC, RandUnity } = loadF('rand.cjs');
const { RulesRuntime } = loadF('runtime.cjs');
const { EndgameTactics } = loadF('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = loadF('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

const raw = fs.readFileSync(path.resolve(__dirname, 'endgame-code.txt'), 'utf8').trim();
const data = EndgameArchive.decode(raw);

// cells[i] → archive(bx=i%9, by=floor(i/9)) → display(dx=bx+1, dy=by+1) → engine(x=bx, y=8-by)
const D = Array.from({ length: 10 }, () => new Array(10).fill(null));
const dispBlack = [], dispWhite = [], dispGrass = [];
data.cells.forEach((c, i) => {
    const bx = i % 9, by = Math.floor(i / 9);
    const dx = bx + 1, dy = by + 1;
    D[dy][dx] = { stone: c.stone, plant: Number(c.plant) || 0 };
    if (c.stone === 'black') dispBlack.push([dx, dy]);
    if (c.stone === 'white') dispWhite.push([dx, dy]);
    if ((Number(c.plant) || 0) > 0) dispGrass.push([dx, dy, Number(c.plant)]);
});

console.log('=== 解码 ===', data.format, 'hp 黑/白 =', data.hp.black + '/' + data.hp.white,
    ' 先手 =', data.first, ' 当前行棋 =', data.snapshot.turnPlayer === 1 ? 'white' : 'black',
    ' 玩家 =', data.player, ' 模式 =', data.game_mode, ' 自然生长 =', data.natural_plant);
console.log('黑方正着 =', JSON.stringify(data.black_book), ' 白方预案 =', JSON.stringify(data.white_turns));

const mark = (cell) => {
    if (!cell || cell.stone === 'none') return cell && cell.plant ? 'g' : '.';
    const base = cell.stone === 'black' ? 'B' : cell.stone === 'white' ? 'W'
        : cell.stone === 'black-ascend' ? 'b' : cell.stone === 'white-ascend' ? 'w' : '*';
    return cell.plant ? (base + cell.plant) : base + ' ';
};
console.log('\n=== 盘面（显示系：x 1..9 左→右, y 1..9 下→上；B黑 W白，数字=该格草数，g=空格上的草）===');
console.log('     1  2  3  4  5  6  7  8  9');
for (let dy = 9; dy >= 1; dy--) {
    let line = String(dy).padStart(3, ' ') + '  ';
    for (let dx = 1; dx <= 9; dx++) line += mark(D[dy][dx]).padEnd(3, ' ');
    console.log(line);
}
console.log('黑方显示坐标:', JSON.stringify(dispBlack.sort((a, b) => a[0] - b[0] || a[1] - b[1])));
console.log('白方显示坐标:', JSON.stringify(dispWhite.sort((a, b) => a[0] - b[0] || a[1] - b[1])));
console.log('草 显示坐标:', JSON.stringify(dispGrass.sort((a, b) => a[0] - b[0] || a[1] - b[1])));

const D2B = ([dx, dy]) => [dx - 1, 9 - dy];
const B2D = ([x, y]) => [x + 1, 9 - y];

const buildGame = () => {
    const board = new Board(9, 9);
    data.cells.forEach((c, i) => {
        const bx = i % 9, by = Math.floor(i / 9);
        const y = 8 - by;
        const st = ({ 'black': S.BLACK, 'white': S.WHITE, 'black-ascend': S.BLACK_ASCEND, 'white-ascend': S.WHITE_ASCEND })[c.stone] || S.NONE;
        const pl = Number(c.plant) === 2 ? P.TWO : Number(c.plant) === 1 ? P.ONE : P.NONE;
        board.set_pos(bx, y, st, pl);
    });
    const state = new State();
    state.hp = [data.hp.black, data.hp.white];
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

const ascendList = (game, stone) => {
    const rows = [];
    RulesRuntime.legalMoves(game).forEach((a) => {
        const x = a % game.board.w, y = Math.floor(a / game.board.w);
        if (game.board.get_stone(x, y) !== S.NONE) return;
        const pts = game.board.get_ascend(x, y, stone);
        if (!pts) return;
        const p = tactics.powerOf(pts);
        const [dx, dy] = B2D([x, y]);
        rows.push({ dx, dy, x, y, M: p.M, N: p.N, MN: p.MN });
    });
    rows.sort((a, b) => b.M - a.M || b.MN - a.MN);
    return rows;
};

console.log('\n=== 黑方落子前：白方可成打点（仅 M>=3）===');
ascendList(buildGame(), S.WHITE).filter((r) => r.M >= 3).forEach((r) => console.log(`  display(${r.dx},${r.dy}) M=${r.M} N=${r.N} MN=${r.MN}`));
console.log('=== 黑方落子前：黑方可成打点（仅 M>=3）===');
ascendList(buildGame(), S.BLACK).filter((r) => r.M >= 3).forEach((r) => console.log(`  display(${r.dx},${r.dy}) M=${r.M} N=${r.N} MN=${r.MN}`));

// 黑落 display(9,4)
const [bmx, bmy] = D2B([9, 4]);
console.log(`\n=== 黑方落子 display(9,4) → engine(${bmx},${bmy}) ===`);
const game = buildGame();
if (game.board.get_stone(bmx, bmy) !== S.NONE) {
    console.log('该点已被占用');
} else {
    game.board.set_stone(bmx, bmy, S.BLACK);
    game.board.turns.push([bmx, bmy]);
    game.state.turn_player = R.WHITE;
    game.state.turn_count += 1;

    console.log('黑落(9,4)后，白方可成打点（仅 M>=3）:');
    ascendList(game, S.WHITE).filter((r) => r.M >= 3).forEach((r) => console.log(`  display(${r.dx},${r.dy}) M=${r.M} N=${r.N} MN=${r.MN}`));

    const m = tactics.chooseMove(game);
    if (!m) console.log('\n白方 tactics 未命中（回退树搜索）');
    else {
        const [dx, dy] = B2D([m.x, m.y]);
        const sp = (m.detail && m.detail.selfPower) || {};
        console.log(`\n>> 白方应着: reason=${m.reason}  display(${dx},${dy})  engine(${m.x},${m.y})  M=${sp.M} N=${sp.N} MN=${sp.MN}`);
        console.log('   detail:', JSON.stringify(m.detail));
    }
}