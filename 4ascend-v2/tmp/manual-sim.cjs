/*
 * 手工盘面残局模拟：给定黑白棋子（用户坐标 列,行，左下角=(1,1)），
 * 让黑方先落子，再跑 EndgameTactics 得到白方应着。
 * 用法： node tmp/manual-sim.cjs "B:..." "W:..." "9,4" [黑hp] [白hp]
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
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { RulesRuntime } = load('runtime.cjs');
const { EndgameTactics } = load('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = load('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

const parse = (s) => (s.length <= 2 ? [] : s.slice(2).split(';').map((t) => t.split(',').map(Number)));
const BLACK = parse(process.argv[2] || 'B:');
const WHITE = parse(process.argv[3] || 'W:');
const BLACK_MOVE = (process.argv[4] || '').split(',').map(Number);
const HP_BLACK = Number(process.argv[5] ?? 1);
const HP_WHITE = Number(process.argv[6] ?? 1);

const U2B = ([R, C]) => [R - 1, 9 - C];
const B2U = ([x, y]) => [x + 1, 9 - y];

const buildGame = () => {
    const board = new Board(9, 9);
    BLACK.forEach(([R, C]) => { const [x, y] = U2B([R, C]); board.set_pos(x, y, S.BLACK, P.NONE); });
    WHITE.forEach(([R, C]) => { const [x, y] = U2B([R, C]); board.set_pos(x, y, S.WHITE, P.NONE); });
    const state = new State();
    state.hp = [HP_BLACK, HP_WHITE];
    state.turn_player = R.BLACK;
    state.turn_count = 0;
    state.ascend_status = A.NONE;
    state.pending_damage = null;
    state.unascend_charge = 25;
    state.unascend_chargef = [9, 9];
    state.grow_count = 11;
    state.just_unascend = false;
    state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31), new RandUnity(0x4A534B32));
    game.natural_plant = false;
    game.first_player = R.BLACK;
    game.history_boards = [];
    game.board.turns = [];
    RulesRuntime.initialize(game, R.BLACK);
    return game;
};

const show = (game, title) => {
    console.log(`\n=== ${title} ===`);
    console.log('      列1 列2 列3 列4 列5 列6 列7 列8 列9');
    for (let C = 9; C >= 1; C--) {
        let line = `行${C}   `;
        for (let Rx = 1; Rx <= 9; Rx++) {
            const [x, y] = U2B([Rx, C]);
            const st = game.board.get_stone(x, y);
            line += ' ' + ({ [S.BLACK]: 'B', [S.WHITE]: 'W', [S.BLACK_ASCEND]: 'b', [S.WHITE_ASCEND]: 'w' }[st] || '.') + ' ';
        }
        console.log(line);
    }
};

const game = buildGame();
show(game, '初始（黑方行棋）');

const maxM = (b, stone) => {
    let best = null;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        if (b.get_stone(x, y) !== S.NONE) continue;
        const pts = b.get_ascend(x, y, stone);
        if (!pts) continue;
        const p = tactics.powerOf(pts);
        if (!best || p.M > best.M) best = { M: p.M, x, y };
    }
    return best;
};
const w0 = maxM(game.board, S.WHITE);
const b0 = maxM(game.board, S.BLACK);
console.log(`\n[核弹诊断·黑未落子] 白方本手最大可成 M=${w0 ? w0.M : 0} 触发点${w0 ? '(' + B2U([w0.x, w0.y]).join(',') + ')' : '-'}；黑方本手最大可成 M=${b0 ? b0.M : 0} 触发点${b0 ? '(' + B2U([b0.x, b0.y]).join(',') + ')' : '-'}`);

// 黑方落子
const [bx, by] = U2B(BLACK_MOVE);
const nm = (st) => ({ [S.BLACK]: 'B', [S.WHITE]: 'W', [S.BLACK_ASCEND]: 'b', [S.WHITE_ASCEND]: 'w' }[st] || '.');
console.log(`\n黑方落子 用户坐标(${BLACK_MOVE.join(',')}) → board(${bx},${by})，原格=${nm(game.board.get_stone(bx, by))}`);
game.board.set_stone(bx, by, S.BLACK);
game.state.turn_player = R.WHITE;

const w1 = maxM(game.board, S.WHITE);
const b1 = maxM(game.board, S.BLACK);
console.log(`[核弹诊断·黑落子后] 白方本手最大可成 M=${w1 ? w1.M : 0} 触发点${w1 ? '(' + B2U([w1.x, w1.y]).join(',') + ')' : '-'}；黑方本手最大可成 M=${b1 ? b1.M : 0} 触发点${b1 ? '(' + B2U([b1.x, b1.y]).join(',') + ')' : '-'}`);

show(game, '黑方落子后（白方行棋）');

const move = tactics.chooseMove(game);
if (!move) console.log('\n白方 tactics 未命中（回退树搜索）');
else {
    const [dR, dC] = B2U([move.x, move.y]);
    const sp = (move.detail && move.detail.selfPower) || {};
    console.log(`\n>>> 白方应着: reason=${move.reason}  用户坐标(${dR},${dC})  board(${move.x},${move.y})  M=${sp.M} N=${sp.N} MN=${sp.MN}`);
    console.log('    detail =', JSON.stringify(move.detail, (k, v) => (typeof v === 'function' ? '[fn]' : v)));
}

// 二步潜力：白方各落点 → 之后白方下一手最大可成 M（含黑方能否堵）
console.log('\n白方落点 → 下一手白方最大可成 M（前 8）：');
const plan = [];
for (let C = 1; C <= 9; C++) for (let Rx = 1; Rx <= 9; Rx++) {
    const [x, y] = U2B([Rx, C]);
    if (game.board.get_stone(x, y) !== S.NONE) continue;
    const g2 = buildGame();
    g2.board.set_stone(bx, by, S.BLACK);
    g2.board.set_stone(x, y, S.WHITE);
    const after = maxM(g2.board, S.WHITE);
    plan.push({ R: Rx, C, afterM: after ? after.M : 0, at: after ? B2U([after.x, after.y]).join(',') : '-' });
}
plan.sort((a, b) => b.afterM - a.afterM);
plan.slice(0, 8).forEach((r) => console.log(`  用户坐标(${r.R},${r.C})  → 下一手最大 M=${r.afterM}${r.afterM >= 7 ? '  <<< 可成核弹' : ''}  触发点(${r.at})`));
