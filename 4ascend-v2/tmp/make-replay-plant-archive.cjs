/**
 * Generate a real replay archive whose turn list contains at least one
 * plant-refresh turn (natural and/or post-ASCEND). Outputs the archive code
 * and a per-turn summary so the browser check can target a plant frame.
 */
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.resolve(__dirname, '..');
const source = path.resolve(appDir, 'js/global/fascend');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { ArchiveV0 } = load('archive.cjs');
const { PLAYER_ENUM: R, STONE_ENUM: S } = load('enum.cjs');

const zalgo = load(path.resolve(appDir, 'js/global/utils/basezalgo.cjs').replace(/\\/g, '/')).BaseZalgo;

/**
 * Play a seeded game with the exact replay pipeline and record frames.
 */
function simulate(seed, first = R.BLACK, mode = 0) {
    const board = new Board(9, 9);
    const state = new State();
    state.turn_player = first;
    const rand_aic = new RandAIC(seed);
    const rand_unity = new RandUnity(seed + 99);
    const game = new GameNormal(board, state, rand_aic, rand_unity);

    // RandUnity exposes shuffle() only, so drive move choice with a local LCG.
    let lcg = (seed * 2654435761) >>> 0;
    const pick = (n) => {
        lcg = (lcg * 1664525 + 1013904223) >>> 0;
        return lcg % n;
    };

    const turns = [];
    const frames = [];
    const legal = () => {
        const out = [];
        board.data.forEach((pos) => {
            const stone = state.turn_player === R.BLACK ? S.BLACK : S.WHITE;
            if (game.valid(pos.x, pos.y, stone)) out.push([pos.x, pos.y]);
        });
        return out;
    };

    for (let i = 0; i < 200; i++) {
        const options = legal();
        if (!options.length) break;
        const [x, y] = options[pick(options.length)];

        if (!game.ed_tr_1(x, y)) break;
        turns.push([x, y]);
        game.ed_as_1();
        const combat = game.ed_as_2();
        game.ed_tr_2();
        const win = game.ed_win();
        if (win) {
            game.ed_as_3();
            frames.push({ i, x, y, planted: false, combat: combat !== undefined, win: true, turnCount: state.turn_count });
            break;
        }
        const plants = game.ed_pl_1();
        game.ed_as_3();
        frames.push({
            i,
            x,
            y,
            planted: Boolean(plants),
            plantCount: plants ? plants.length : 0,
            combat: combat !== undefined,
            win: false,
            turnCount: state.turn_count
        });
    }

    return { turns, frames, state };
}

let best = null;
for (let seed = 1; seed <= 4000; seed++) {
    const result = simulate(seed);
    const natural = result.frames.filter((f) => f.planted && !f.combat);
    const postAscend = result.frames.filter((f) => f.planted && f.combat);
    if (natural.length > 0 && postAscend.length > 0) {
        best = { seed, ...result, natural, postAscend };
        break;
    }
}

if (!best) {
    console.error('No archive with both natural and post-ASCEND plant frames found.');
    process.exit(1);
}

const archive = zalgo.encode(ArchiveV0.save(
    [best.seed, best.seed + 99, best.seed + 7],
    [300, 300],
    [6, 6],
    best.turns,
    best.state.turn_count,
    0,
    0
));

const payload = {
    seed: best.seed,
    turns: best.turns.length,
    archive,
    naturalFrames: best.natural.map((f) => ({ turnIndex: f.i, x: f.x, y: f.y, plants: f.plantCount })),
    postAscendFrames: best.postAscend.map((f) => ({ turnIndex: f.i, x: f.x, y: f.y, plants: f.plantCount })),
    frames: best.frames
};

fs.writeFileSync(path.resolve(appDir, 'tmp/replay-plant-archive.json'), JSON.stringify(payload, null, 2), 'utf8');
console.log(`seed=${best.seed} turns=${best.turns.length}`);
console.log(`natural plant frames: ${best.natural.length}, first at move#${best.natural[0].i} (${best.natural[0].x},${best.natural[0].y})`);
console.log(`post-ASCEND plant frames: ${best.postAscend.length}, first at move#${best.postAscend[0].i} (${best.postAscend[0].x},${best.postAscend[0].y})`);
console.log(`archive length=${archive.length} chars`);
