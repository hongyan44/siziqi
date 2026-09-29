/*
 * 斩杀硬限制回归：
 *  A) 对方反打能斩杀己方（自杀式斩杀）→ 禁止 return 'kill'
 *  B) 对方最大可成打 M+N 严格高于己方 → 禁止 return 'kill'
 * 运行： node tmp/endgame-kill-guard.cjs
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
const { RulesRuntime } = load('runtime.cjs');
const { EndgameTactics } = load('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R } = load('enum.cjs');

const tactics = EndgameTactics.create({ RulesRuntime });

function makeGame({ hp = [6, 6], turn = R.WHITE } = {}) {
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [...hp];
    state.turn_player = turn;
    const game = new GameNormal(board, state, new RandAIC(1), new RandUnity(2));
    game.natural_plant = false;
    RulesRuntime.initialize(game, R.BLACK);
    return game;
}
const put = (game, c, cells) => cells.forEach(([x, y]) => game.board.set_stone(x, y, c));

// 1) 对照组：白成 M4 打可斩黑(hp2)，黑当前无更大打可应 → 允许斩杀(kill)
{
    const game = makeGame({ hp: [2, 6], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]);
    put(game, S.BLACK, [[0, 5], [1, 5]]); // 黑无立即成打能力
    const move = tactics.chooseMove(game);
    assert.ok(move, '对照组应返回 kill 落点');
    assert.equal(move.reason, 'kill', `对照组应保留斩杀，实测 ${move.reason}`);
    assert.equal(move.action, 3, '应在 (3,0) 成 4 连打');
    console.log(`PASS: 对照(对方无更大打) → kill @(${move.x},${move.y})`);
}

// 2) 规则 B：白成 M4 打，但黑下一步可成 M6 更大打 → 禁止斩杀
{
    const game = makeGame({ hp: [2, 6], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]);
    // 黑 5 连行1：(1,1)..(5,1)，下一步可落 (0,1)/(6,1) 成 M6/M7 更大打
    put(game, S.BLACK, [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]);
    const move = tactics.chooseMove(game);
    assert.ok(!move || move.reason !== 'kill', `对方最大打高于己方时禁止斩杀，实测 reason=${move && move.reason} @(${move && move.x},${move && move.y})`);
    console.log(`PASS: 对方最大打>己方 → 禁斩 (reason=${move && move.reason})`);
}

// 3) 规则 A+B：白 hp 极低，成 M4 打，黑能成更大打反杀 → 禁止斩杀
{
    const game = makeGame({ hp: [1, 1], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]);
    put(game, S.BLACK, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]); // 黑 6 连，可成 M7
    const move = tactics.chooseMove(game);
    assert.ok(!move || move.reason !== 'kill', `反打可斩杀己方且对方打更大 → 禁斩，实测 ${move && move.reason}`);
    console.log(`PASS: 反打斩杀己方(对方更大) → 禁斩 (reason=${move && move.reason})`);
}

// 4) 规则 A：已方打等于对方打也无法破防（相等抵消伤害为0）→ 不得视为可斩杀
{
    const game = makeGame({ hp: [2, 6], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]); // 可成 M4
    put(game, S.BLACK, [[0, 1], [1, 1], [2, 1]]); // 黑也可成 M4 (0,1..2,1 + [3,1])
    const move = tactics.chooseMove(game);
    // 双方打相等(cancel 抵消为0)，白成打拿不到伤害 → 不算斩杀；断言非 kill
    assert.ok(!move || move.reason !== 'kill', `对方打不弱于己方时可被完全抵消 → 禁斩，实测 ${move && move.reason}`);
    console.log(`PASS: 对方可成不小打 → 不可贸然斩杀 (reason=${move && move.reason})`);
}

// 5) 用户口径：双方各 1 血，对方最大打与己方相等 → 不是“对方高于己方”，不算自杀，
//    但相等抵消伤害为 0，也构不成斩杀 → 断言非 kill
{
    const game = makeGame({ hp: [1, 1], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]); // 白可成 M4
    put(game, S.BLACK, [[0, 1], [1, 1], [2, 1]]); // 黑也可成 M4（相等）
    const move = tactics.chooseMove(game);
    assert.ok(!move || move.reason !== 'kill', `对方打不高于己方且抵消无伤害 → 不构成斩杀，实测 ${move && move.reason}`);
    console.log(`PASS: 双方1血+相等打 → 非kill (reason=${move && move.reason})`);
}

// 6) 用户口径：双方各 1 血，己方打 M5 严格大于对方可成 M4 → 吃反击不死且能斩杀 → kill
{
    const game = makeGame({ hp: [1, 1], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0], [3, 0]]); // 落 (4,0) 成 M5
    put(game, S.BLACK, [[0, 1], [1, 1], [2, 1]]);        // 黑最大可成 M4
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回落点');
    assert.equal(move.reason, 'kill', `己方打>对方打且吃反击不死 → 可斩杀，实测 ${move.reason} @(${move.x},${move.y})`);
    assert.equal(move.action, 4, '应在 (4,0) 成 5 连打斩杀');
    console.log(`PASS: 双方1血+己方打更大 → kill @(${move.x},${move.y})`);
}

console.log('endgame-kill-guard: ALL PASS');