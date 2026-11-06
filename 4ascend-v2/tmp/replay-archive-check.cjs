/*
 * 检查回放存档能否解码并按回放流程生成帧。
 */
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.resolve(__dirname, '..');
const cache = new Map();

function load(file) {
    const full = path.isAbsolute(file) ? file : path.resolve(appDir, file);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    const text = fs.readFileSync(full, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(full), p)) : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

const { BaseZalgo } = load('js/global/utils/basezalgo.cjs');
const { ArchiveV0 } = load('js/global/fascend/archive.cjs');
const { Board } = load('js/global/fascend/board.cjs');
const { State } = load('js/global/fascend/state.cjs');
const { GameNormal, GameBlight, GameNight } = load('js/global/fascend/game_normal.cjs');
const { GameBlight: Blight } = load('js/global/fascend/game_blight.cjs');
const { GameNight: Night } = load('js/global/fascend/game_night.cjs');
const { RandAIC, RandUnity } = load('js/global/fascend/rand.cjs');
const { PLAYER_ENUM } = load('js/global/fascend/enum.cjs');
const { RulesRuntime } = load('js/global/fascend/runtime.cjs');

const archive = require('./replay-plant-archive.json').archive;
const decoded = BaseZalgo.decode(archive);
console.log('decode ok, length =', decoded.length);

const parsed = ArchiveV0.load(decoded);
console.log('load ok, turns =', parsed.turns.length, 'mode =', parsed.mode, 'first =', parsed.first);

const board = new Board(9, 9);
const state = new State();
state.turn_player = parsed.first === 1 ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
const game = parsed.mode === 0
    ? new GameNormal(board, state, new RandAIC(parsed.seed_aic), new RandUnity(parsed.seed_unity))
    : parsed.mode === 1
        ? new Blight(board, state, new RandAIC(parsed.seed_aic), new RandUnity(parsed.seed_unity))
        : new Night(board, state, new RandAIC(parsed.seed_aic), new RandUnity(parsed.seed_unity));

let frames = 0;
let win = null;
const solid_boards = [];
RulesRuntime.initialize(game, state.turn_player);
parsed.turns.forEach((pos) => {
    if (win) return;
    const [x, y] = pos;
    const solid = RulesRuntime.solidBoard(game);
    const before = RulesRuntime.snapshot(game);
    before.history = solid_boards.map((board) => Array.from(board));
    if (!game.ed_tr_1(x, y)) {
        console.log('ed_tr_1 失败于', x, y, '已生成帧', frames);
        return;
    }
    solid_boards.push(solid);
    if (solid_boards.length > 7) solid_boards.shift();
    game.ed_as_1();
    game.ed_as_2();
    game.ed_tr_2();
    const result = game.ed_win();
    win = result;
    if (result) {
        game.ed_as_3();
        frames++;
        return;
    }
    game.ed_pl_1();
    game.ed_as_3();
    frames++;
});

console.log('frames =', frames, 'winner =', win);
