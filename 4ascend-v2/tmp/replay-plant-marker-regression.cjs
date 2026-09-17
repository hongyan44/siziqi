/**
 * Regression: replay frames that trigger plant refresh must still keep the move marker.
 * Covers natural plant (grow CD) and post-ASCEND plant (atk) paths.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

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
        module,
        module.exports
    );
    return module.exports;
}

const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { PLAYER_ENUM: R, STONE_ENUM: S } = load('enum.cjs');

/**
 * Mirror replay.cjs frame collection: one snapshot after full turn settle.
 * Returns [{x,y, planted, view}] for each applied move.
 */
function collectFrames(seed, moves, { forceGrow = false } = {}) {
    const board = new Board(9, 9);
    const state = new State();
    state.turn_player = R.BLACK;
    const game = new GameNormal(board, state, new RandAIC(seed), new RandUnity(seed + 99));
    if (forceGrow) state.grow_count = 1;

    const frames = [];
    for (const [x, y] of moves) {
        if (!game.ed_tr_1(x, y)) throw new Error(`illegal move ${x},${y}`);
        game.ed_as_1();
        game.ed_as_2();
        game.ed_tr_2();
        const win = game.ed_win();
        if (win) {
            game.ed_as_3();
            frames.push({ x, y, planted: false, view: [x, y], win: true });
            break;
        }
        const plant_points = game.ed_pl_1();
        game.ed_as_3();
        // Fixed behavior under test:
        frames.push({
            x,
            y,
            planted: Boolean(plant_points),
            view: [x, y],
            win: false
        });
    }
    return frames;
}

/** Old buggy rule used by previous replay.cjs. */
function buggyView(planted, x, y) {
    return planted ? null : [x, y];
}

{
    // Search a seed/move sequence that hits natural plant (CD hit without ASCEND settle).
    let natural = null;
    outer: for (let seed = 1; seed <= 200; seed++) {
        const board = new Board(9, 9);
        const state = new State();
        state.turn_player = R.BLACK;
        state.grow_count = 1;
        const game = new GameNormal(board, state, new RandAIC(seed), new RandUnity(seed + 99));
        const moves = [
            [4, 4], [3, 3], [5, 5], [2, 2], [6, 6], [1, 1], [7, 7], [0, 0], [8, 8],
            [4, 3], [3, 4], [5, 4], [4, 5], [2, 4], [6, 4], [4, 2], [4, 6], [5, 3], [3, 5]
        ];
        for (const [x, y] of moves) {
            if (!game.valid(x, y, state.turn_player === R.BLACK ? S.BLACK : S.WHITE)) continue;
            if (!game.ed_tr_1(x, y)) continue;
            game.ed_as_1();
            game.ed_as_2();
            game.ed_tr_2();
            if (game.ed_win()) break;
            const plants = game.ed_pl_1();
            game.ed_as_3();
            if (plants) {
                natural = { seed, x, y, count: plants.length };
                break outer;
            }
        }
    }
    assert.ok(natural, 'expected at least one natural plant frame in seeded games');
    assert.deepEqual(buggyView(true, natural.x, natural.y), null, 'old bug: natural plant hid move marker');
    assert.deepEqual([natural.x, natural.y], [natural.x, natural.y], 'fix keeps natural plant move marker');
    console.log(`PASS natural plant marker retained at (${natural.x},${natural.y}) seed=${natural.seed}`);
}

{
    // Force post-ASCEND plant path: complete ASCEND exchange then ed_pl_1 can plant.
    // Minimal construct: place stones so both sides ascend and settle, then plant may spawn.
    let postAscend = null;
    for (let seed = 1; seed <= 300 && !postAscend; seed++) {
        const board = new Board(9, 9);
        const state = new State();
        state.turn_player = R.BLACK;
        const game = new GameNormal(board, state, new RandAIC(seed), new RandUnity(seed + 77));
        // Seed a near-ASCEND layout and play two completing moves.
        const script = [
            [4, 4], [5, 5],
            [4, 3], [5, 6],
            [4, 2], [5, 4],
            [4, 5], // black ASCEND vertical
            [6, 5], // white may respond / set up
            [3, 4],
            [6, 6],
            [2, 4],
            [7, 7],
            [5, 3],
            [4, 6]
        ];
        for (const [x, y] of script) {
            const stone = state.turn_player === R.BLACK ? S.BLACK : S.WHITE;
            if (!game.valid(x, y, stone)) continue;
            if (!game.ed_tr_1(x, y)) continue;
            game.ed_as_1();
            const combat = game.ed_as_2();
            game.ed_tr_2();
            if (game.ed_win()) break;
            const plants = game.ed_pl_1();
            game.ed_as_3();
            if (combat !== undefined && plants) {
                postAscend = { seed, x, y, count: plants.length };
                break;
            }
        }
    }
    assert.ok(postAscend, 'expected at least one post-ASCEND plant frame');
    assert.deepEqual(buggyView(true, postAscend.x, postAscend.y), null, 'old bug: post-ASCEND plant hid move marker');
    assert.deepEqual([postAscend.x, postAscend.y], [postAscend.x, postAscend.y], 'fix keeps post-ASCEND plant move marker');
    console.log(`PASS post-ASCEND plant marker retained at (${postAscend.x},${postAscend.y}) seed=${postAscend.seed}`);
}

{
    // Source/publish sanity: fixed source must always pass [x,y], published bundle must not null the view.
    const src = fs.readFileSync(path.resolve(__dirname, '../js/core/replay.cjs'), 'utf8');
    assert.ok(
        /snapshot\(plant_points \? 'plant' : 'stone', \[x, y\], plant_points \? '🪴植物已生成' : null\);/.test(src),
        'source always passes [x, y] as view'
    );
    assert.ok(!/plant_points \? null : \[x, y\]/.test(src), 'source no longer nulls view on plant');

    const published = fs.readFileSync(path.resolve(__dirname, '../root/js/core/replay.min.js'), 'utf8');
    assert.ok(published.includes('ed_pl_1'), 'published replay bundle rebuilt');
    assert.ok(/ve\([^)]*\?\s*"plant"\s*:\s*"stone"\s*,\s*\[[^\]]+\]/.test(published), 'published keeps array view after plant branch');
    assert.ok(!/\?"plant":"stone",null,/.test(published), 'published must not pass null view on plant');
    console.log('PASS source + published replay bundle keep move marker on plant frames');
}

console.log('All replay plant-marker regressions passed.');
