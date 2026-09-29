/*
 * 残局战术：低血（Y<3）绝地反击——纯堵徒劳时弃堵转攻、改为形成“打”。
 * 运行： bun tmp/endgame-desperate-offense.cjs
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
const { STONE_ENUM: S, PLAYER_ENUM: R, ASCEND_ENUM: A } = load('enum.cjs');

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

// 1) Y<3 且玩家有 2 个独立打点（堵不住）+ 己方能成打 → 弃堵转攻
{
    const game = makeGame({ hp: [6, 2], turn: R.WHITE });
    // 玩家两个打点：(3,4) 与 (3,8)（各成一排 4 连）
    [[0, 4], [1, 4], [2, 4]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    [[0, 8], [1, 8], [2, 8]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    // 己方单个打点：(7,0)（成一行 4 连）
    [[4, 0], [5, 0], [6, 0]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));

    const move = tactics.chooseMove(game);
    assert.ok(move, '应找到绝地反击落点');
    assert.equal(move.reason, 'desperate-offense');
    // 己方在 (3,0) 与 (7,0) 都能成同一排 4 连打，取更小索引 (3,0)
    assert.ok([3, 7].includes(move.action), `应改走己方打点（实际 ${move.action}）`);
    // 且绝不应落在玩家的堵点 (3,4)/(3,8) 上
    assert.notEqual(move.action, 4 * 9 + 3);
    assert.notEqual(move.action, 8 * 9 + 3);
    console.log(`PASS: Y<3 堵不住 → 弃堵转攻（desperate-offense @${move.action}）`);
}

// 2) Y<3 但玩家只有 1 个打点（堵得住）→ 保持堵点
{
    const game = makeGame({ hp: [6, 2], turn: R.WHITE });
    [[0, 4], [1, 4], [2, 4]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    // 只剩单打点：确认己方手中没有成打机会，仍应堵 (3,4)
    [[4, 0], [5, 0], [6, 8]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回堵点');
    assert.equal(move.reason, 'block-player-ascend');
    assert.equal(move.action, 4 * 9 + 3, '应堵住唯一打点 (3,4)');
    console.log('PASS: Y<3 单打点堵得住 → 仍堵点（block-player-ascend (3,4)）');
}

// 3) 双方都是 3 血（Y=3）：玩家有 2 个打点堵不住 + 己方能成 3连（非斩杀）→ 触发绝地反击
{
    const game = makeGame({ hp: [3, 3], turn: R.WHITE });
    [[0, 4], [1, 4], [2, 4]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    [[0, 8], [1, 8], [2, 8]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    // 己方唯一进攻点：在 (1,1) 落子成三连 (0,1)(1,1)(2,1)，非 4 连不构成斩杀
    [[0, 1], [2, 1]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.equal(move.reason, 'desperate-offense', 'Y=3 时 3血同样不能卖血/纯堵，应弃堵转攻');
    assert.equal(move.action, 1 * 9 + 1, '应改走自己的 3连进攻点 (1,1)');
    console.log('PASS: 双方 3 血 → 触发绝地反击，弃堵转攻形成 3连（desperate-offense (1,1)）');
}

// 4) 血量高于 3（Y=4）→ 不触发绝地反击，仍按常规堵
{
    const game = makeGame({ hp: [6, 4], turn: R.WHITE });
    [[0, 4], [1, 4], [2, 4]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    [[0, 8], [1, 8], [2, 8]].forEach(([x, y]) => game.board.set_stone(x, y, S.BLACK));
    [[0, 1], [2, 1]].forEach(([x, y]) => game.board.set_stone(x, y, S.WHITE));
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.notEqual(move.reason, 'desperate-offense', 'Y=4 不应触发绝地反击');
    console.log(`PASS: Y=4 不触发绝地反击（实际 ${move.reason}）`);
}

console.log('endgame-desperate-offense: ALL PASS');