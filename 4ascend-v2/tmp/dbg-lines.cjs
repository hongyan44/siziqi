/*
 * 对比两条线：
 *  A) 黑(9,4) → 白(7,2) → 黑(7,2)反击
 *  B) 黑(7,2)         → 白(7,2)反击
 * 打印黑/白各自的打点拾取清单与抵消轮次。
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

const play = (game, d, tag) => {
    const [x, y] = D2B(d);
    const res = RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
    const asc = (res.events || []).find((e) => e.type === 'ascend');
    const combat = (res.events || []).find((e) => e.type === 'combat');
    console.log(`  ${tag} display(${d[0]},${d[1]}) legal=${res.legal}`);
    if (asc) {
        console.log('    成打拾取: ' + asc.points.map((p) => {
            const dd = B2D([p.x, p.y]);
            const g = p.plant === P.TWO ? '草2' : p.plant === P.ONE ? '草1' : '';
            return `(${dd[0]},${dd[1]})${g}`;
        }).join(' '));
    }
    if (combat) {
        console.log(`    结算 hpBefore=${JSON.stringify(combat.hpBefore)} → hpAfter=${JSON.stringify(combat.hpAfter)}`);
        console.log('    抵消轮次 (黑[..] vs 白[..]):');
        combat.rounds.forEach((r2, i) => console.log(`      #${i} 黑=${JSON.stringify(r2[0])} 白=${JSON.stringify(r2[1])}`));
    }
    if (res.winner !== undefined) console.log(`    >>> 胜者 = ${res.winner === R.BLACK ? '黑' : '白'}`);
    return res;
};

console.log('=== A) 黑(9,4) → 白(7,2)成打 → 黑(7,2)反击成打 ===');
const gA = buildGame();
play(gA, [9, 4], '黑');
play(gA, [7, 2], '白');
play(gA, [7, 2], '黑');
console.log(`  终局 HP 黑=${gA.state.hp[0]} 白=${gA.state.hp[1]}`);

console.log('\n=== B) 黑(7,2)成打 → 白(7,2)反击成打（黑未走9,4）===');
const gB = buildGame();
play(gB, [7, 2], '黑');
play(gB, [7, 2], '白');
console.log(`  终局 HP 黑=${gB.state.hp[0]} 白=${gB.state.hp[1]}`);

console.log('\n=== C) 黑(9,4) → 白静着(2,9) → 黑(7,2)核弹 → 白(7,2)反击 ===');
const gC = buildGame();
play(gC, [9, 4], '黑');
play(gC, [2, 9], '白');
play(gC, [7, 2], '黑');
play(gC, [7, 2], '白');
console.log(`  终局 HP 黑=${gC.state.hp[0]} 白=${gC.state.hp[1]}`);

console.log('\n=== D) 黑(9,4) → 白静着(2,9) → 黑(7,2)核弹 → 白(3,7)成打 ===');
const gD = buildGame();
play(gD, [9, 4], '黑');
play(gD, [2, 9], '白');
play(gD, [7, 2], '黑');
play(gD, [3, 7], '白');
console.log(`  终局 HP 黑=${gD.state.hp[0]} 白=${gD.state.hp[1]}`);