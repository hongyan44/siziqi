/*
 * 黑(9,4) 后：逐个白方着法 → 黑方最强应手 → 终局 HP。
 * 运行: node tmp/check-white-tries.cjs
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
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = loadF('enum.cjs');

const raw = fs.readFileSync(path.resolve(__dirname, 'endgame-code.txt'), 'utf8').trim();
const data = EndgameArchive.decode(raw);
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
    state.turn_count = 0; state.ascend_status = A.NONE; state.pending_damage = null;
    state.unascend_charge = 25; state.unascend_chargef = [9, 9]; state.grow_count = 11;
    state.just_unascend = false; state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31 >>> 0), new RandUnity(0x4A534B32 >>> 0));
    game.natural_plant = false; game.first_player = R.BLACK; game.board.turns = [];
    RulesRuntime.initialize(game, game.first_player);
    return game;
};

const play = (g, d) => RulesRuntime.applyMove(g, D2B(d)[1] * 9 + D2B(d)[0], { collectEvents: true });

// 黑(9,4) 后，白走 w，黑走 b，再让白走它最好的一手（只用于结算/续命），报告终局 HP
function trial(w, b, w2) {
    const g = buildGame();
    play(g, [9, 4]);
    const rw = play(g, w);
    if (rw.winner !== undefined) return { winner: rw.winner, hp: [...g.state.hp] };
    const rb = play(g, b);
    if (rb.winner !== undefined) return { winner: rb.winner, hp: [...g.state.hp] };
    if (w2) {
        const r2 = play(g, w2);
        if (r2.winner !== undefined) return { winner: r2.winner, hp: [...g.state.hp] };
    }
    return { winner: undefined, hp: [...g.state.hp] };
}

const label = (w) => (w ? `(${w[0]},${w[1]})` : '—');
const tries = [
    { w: [7, 2], b: [7, 2], w2: null, tag: '白(7,2)反击成打 → 黑反击(7,2)' },
    { w: [3, 7], b: [7, 2], w2: null, tag: '白(3,7)成打 → 黑(7,2)核弹' },
    { w: [3, 2], b: [7, 2], w2: null, tag: '白(3,2)成打 → 黑(7,2)核弹' },
    { w: [2, 9], b: [7, 2], w2: [7, 2], tag: '白(2,9)静着 → 黑(7,2)核弹 → 白反击(7,2)' },
    { w: [8, 2], b: [7, 2], w2: [7, 2], tag: '白(8,2)静着 → 黑(7,2)核弹 → 白反击(7,2)' },
    { w: [3, 2], b: [7, 2], w2: [7, 2], tag: '白(3,2)成打 → 黑(7,2)核弹 → 白再反击(7,2)' },
];

console.log('黑(9,4) 后白方各应手 → 终局 HP（黑 hp 起始 1 / 白 hp 起始 1）\n');
tries.forEach((t) => {
    const r = trial(t.w, t.b, t.w2);
    const wname = r.winner === R.BLACK ? '黑胜' : r.winner === R.WHITE ? '白胜' : '未终局';
    console.log(`${t.tag}`);
    console.log(`   白${label(t.w)} 黑${label(t.b)} 白${label(t.w2)}  →  终局 HP 黑=${r.hp[0]} 白=${r.hp[1]}  ${wname}\n`);
});