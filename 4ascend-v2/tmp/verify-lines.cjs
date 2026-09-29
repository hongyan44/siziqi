/*
 * 逐行验证：黑(9,4) 后白方应手 → 黑方核弹(7,2) → 结算 HP。
 * 运行: node tmp/verify-lines.cjs
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

const play = (game, d) => {
    const [x, y] = D2B(d);
    const res = RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
    const asc = (res.events || []).find((e) => e.type === 'ascend');
    const combat = (res.events || []).find((e) => e.type === 'combat');
    let line = `  ${d[0]},${d[1]}: legal=${res.legal}`;
    if (asc) line += `  成打(点数=${asc.points.length})`;
    if (combat) line += `  结算 hpBefore=${JSON.stringify(combat.hpBefore)} hpAfter=${JSON.stringify(combat.hpAfter)}`;
    if (res.winner !== undefined) line += `  胜者=${res.winner === R.BLACK ? '黑' : '白'}`;
    console.log(line);
    return res;
};

const runLine = (label, whiteMove) => {
    console.log(`\n=== ${label} ===`);
    const g = buildGame();
    console.log(`  黑方走 (9,4):`); play(g, [9, 4]);
    console.log(`  白方走 ${whiteMove ? `(${whiteMove[0]},${whiteMove[1]})` : '(弃权/静着)'}:`);
    if (whiteMove) play(g, whiteMove);
    console.log(`  黑方走 (7,2) 核弹:`); const r = play(g, [7, 2]);
    if (r.winner === undefined) {
        console.log(`  白方不回应，直接结算:`);
        // 白方随便走一手不成打的点，触发 START->END 结算
        play(g, [9, 9]);
    }
    console.log(`  终局 HP: 黑=${g.state.hp[0]} 白=${g.state.hp[1]}`);
};

runLine('白(3,7)成打 → 黑(7,2)核弹', [3, 7]);
runLine('白(7,2)反击点成打 → 黑(7,2)核弹', [7, 2]);
runLine('白(3,2)成打 → 黑(7,2)核弹', [3, 2]);
runLine('白(9,9)静着 → 黑(7,2)核弹', [9, 9]);

// 对照组：黑方不走(9,4)，直接(7,2)成打，白(7,2)反击
console.log('\n=== 对照：黑直接走(7,2)（不走9,4），白(7,2)反击 ===');
const g2 = buildGame();
play(g2, [7, 2]);
play(g2, [7, 2]);
console.log(`  终局 HP: 黑=${g2.state.hp[0]} 白=${g2.state.hp[1]}`);