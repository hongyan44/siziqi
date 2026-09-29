/*
 * 残局战术防自杀：己方主动成“打”但会被对方（核弹/草反）抵消反杀时，必须放弃该打。
 * 运行： bun tmp/endgame-anti-suicide.cjs
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
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A } = load('enum.cjs');

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

// 1) 双方 1 血，白方可成 4 连打，但黑方可用“草反”（带草的 4 连）抵消反杀白方。
//    堵点已停用（2026-09-29）：白方不可走自杀式打，但也不再主动堵草反点，
//    返回 null 交由上层（MCTS）处理。
{
    const game = makeGame({ hp: [1, 1], turn: R.WHITE });
    // 白方打点：(3,0) 成 4 连（M=4, 全 1 力）
    [[0, 0], [1, 0], [2, 0]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));
    // 黑方草反打点：(3,5) 成 4 连，其中 (1,5) 带草（力 2）→ 抵消后黑方剩余 1，能反杀 1 血白方
    [[0, 5], [1, 5], [2, 5]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    game.board.set_plant(1, 5, P.ONE);

    const move = tactics.chooseMove(game);
    assert.equal(move, null, '堵点已停用，应返回 null 交由上层接管');
    console.log('PASS: 双方1血，草反可反杀 + 堵点停用 → 返回 null 交上层');
}

// 2) 控制：白方打确实能斩杀黑方（黑方无 ASCEND 可应，只能卖血）→ 仍优先斩杀 (kill)
{
    const game = makeGame({ hp: [1, 1], turn: R.WHITE });
    // 白方打点：(3,0) 成 4 连
    [[0, 0], [1, 0], [2, 0]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));
    // 黑方无任何可成 4 连的应手（互不共线：不成行/列/对角 3 连）
    [[0, 5], [1, 7], [6, 3]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));

    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.equal(move.reason, 'kill', '真正能斩杀时应优先斩杀');
    assert.equal(move.action, 0 * 9 + 3, '应选中白方打点 (3,0) 完成斩杀');
    console.log('PASS: 能斩杀黑方 → 白方仍走 kill (3,0)');
}

console.log('endgame-anti-suicide: ALL PASS');