/*
 * 黑(9,4) → 白(5,7) → 黑(7,2) 核弹 → 白方各应手，报告终局 HP 与抵消轮次。
 * 运行: node tmp/check-5-7-line.cjs
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
const fmtD = (d) => `(${d[0]},${d[1]})`;

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

const play = (game, [dx, dy], tag) => {
    const [x, y] = D2B([dx, dy]);
    const res = RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
    const asc = (res.events || []).find((e) => e.type === 'ascend');
    const combat = (res.events || []).find((e) => e.type === 'combat');
    console.log(`  ${tag} ${fmtD([dx, dy])} legal=${res.legal}${res.winner !== undefined ? ` winner=${res.winner === R.BLACK ? '黑' : '白'}` : ''}`);
    if (asc) {
        console.log(`    成打拾取: ` + asc.points.map((p) => {
            const dd = B2D([p.x, p.y]);
            const g = p.plant === P.TWO ? '草2' : p.plant === P.ONE ? '草1' : '';
            return `${fmtD(dd)}${g}`;
        }).join(' '));
    }
    if (combat) {
        console.log(`    结算 hpBefore=[${combat.hpBefore}] → hpAfter=[${combat.hpAfter}]`);
        combat.rounds.forEach((r2, i) => console.log(`      #${i} 黑=[${r2[0]}] 白=[${r2[1]}]`));
    }
    return res;
};

const line = (label, whiteFirst, whiteAnswer) => {
    console.log(`\n=== ${label} ===`);
    const g = buildGame();
    play(g, [9, 4], '黑');
    play(g, whiteFirst, '白');
    play(g, [7, 2], '黑');
    if (whiteAnswer) play(g, whiteAnswer, '白');
    console.log(`  >>> 终局 HP 黑=${g.state.hp[0]} 白=${g.state.hp[1]}  ${g.state.hp[1] <= 0 ? '白负（归零）' : '白存活'}`);
};

line('白(5,7) → 黑(7,2) → 白(3,7) 成打 MN10', [5, 7], [3, 7]);
line('白(5,7) → 黑(7,2) → 白(7,2) 反击 MN6', [5, 7], [7, 2]);
line('白(5,7) → 黑(7,2) → 白(3,2) 成打 MN4', [5, 7], [3, 2]);
line('对照：白(8,2) → 黑(7,2) → 白(7,2) 反击', [8, 2], [7, 2]);