/*
 * 调试：黑(9,4) → 白(7,2) → 黑(7,2) 时，黑方这一手到底拿起哪些子。
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

const name = (st) => st === S.BLACK ? 'B' : st === S.WHITE ? 'W'
    : st === S.BLACK_ASCEND ? 'b*' : st === S.WHITE_ASCEND ? 'w*'
    : st === S.BLACK_USED ? 'b~' : st === S.WHITE_USED ? 'w~' : '.';

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

const dump = (game, title) => {
    console.log(`\n--- ${title} (显示系 x1..9 左→右, y1..9 下→上; b*=黑打子 w*=白打子) ---`);
    console.log('     1  2  3  4  5  6  7  8  9');
    for (let dy = 9; dy >= 1; dy--) {
        let line = String(dy).padStart(3, ' ') + '  ';
        for (let dx = 1; dx <= 9; dx++) {
            const [x, y] = D2B([dx, dy]);
            const pos = game.board.get_pos(x, y);
            const pl = pos.plant === P.TWO ? '2' : pos.plant === P.ONE ? '1' : ' ';
            line += (name(pos.stone) + pl).padEnd(3, ' ');
        }
        console.log(line);
    }
    console.log(`  ascend_status=${String(game.state.ascend_status)}  HP 黑=${game.state.hp[0]}/白=${game.state.hp[1]}  turn=${game.state.turn_player === R.BLACK ? '黑' : '白'}`);
};

const showAscend = (game, [dx, dy], stone, label) => {
    const [x, y] = D2B([dx, dy]);
    const pts = game.board.get_ascend(x, y, stone);
    console.log(`\n>> ${label}: display(${dx},${dy}) engine(${x},${y}) stone=${stone === S.BLACK ? '黑' : '白'}`);
    if (!pts) { console.log('   不成打'); return; }
    console.log(`   拾取 ${pts.length} 子: ` + pts.map((p) => {
        const d = B2D([p.x, p.y]);
        const g = p.plant === P.TWO ? '(草2)' : p.plant === P.ONE ? '(草1)' : '';
        return `${name(p.stone)}@(${d[0]},${d[1]})${g}`;
    }).join(' '));
};

const play = (game, d) => {
    const [x, y] = D2B(d);
    return RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
};

// 关键序列：黑(9,4) → 白(7,2) → 黑(7,2)
const g = buildGame();
dump(g, '初始');
showAscend(g, [7, 2], S.BLACK, '初始 黑在(7,2)');
showAscend(g, [7, 2], S.WHITE, '初始 白在(7,2)');

play(g, [9, 4]);
play(g, [7, 2]);
dump(g, '白落(7,2)成打后（START 挂起）');
showAscend(g, [7, 2], S.BLACK, '白打挂起时 黑反击(7,2)');

const r = play(g, [7, 2]);
console.log('\n黑(7,2) 事件:', JSON.stringify(r.events, null, 1).slice(0, 1200));
dump(g, '结算后');