/*
 * @Description: 对局攻击回合计数的回归测试
 *   成就「红派 / 终结的渴望」依赖 state.attack_turns：
 *   只有主动发起 ASCEND 的一方在发起回合被记录，安静落子与回合成打不得计入。
 * 运行：node tmp/attack-tracking.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname, '../js/global/fascend');
const cache = new Map();

/**
 * @description: 载入 ESM 风格的规则模块（把 export {X}; 改写为 module.exports）
 * @param {string} name 相对 source 的文件名
 * @return {Object}
 */
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.')
            ? load(path.relative(source, path.resolve(path.dirname(file), p)))
            : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { GameBlight } = load('game_blight.cjs');
const { STONE_ENUM, PLAYER_ENUM, ASCEND_ENUM } = load('enum.cjs');

/**
 * @description: 执行一整个回合（落子 → ASCEND → 结算 → 换手）
 * @param {Object} game
 * @param {number} x
 * @param {number} y
 * @return {Array|null|undefined} ed_as_1 的成打点
 */
const move = (game, x, y) => {
    game.ed_tr_1(x, y);
    const points = game.ed_as_1();
    game.ed_as_2();
    game.ed_tr_2();
    return points;
};

const checkGame = (game_class, label) => {
    const board = new Board(9, 9);
    const state = new State();
    const game = new game_class(board, state, {}, {});

    assert.deepEqual(state.attack_turns, [[], []], `${label}：初始攻击记录为空`);

    // 黑方三子已在棋盘上，随后安静落子不应记录攻击
    board.set_stone(3, 3, STONE_ENUM.BLACK);
    board.set_stone(4, 3, STONE_ENUM.BLACK);
    board.set_stone(5, 3, STONE_ENUM.BLACK);

    const quiet = move(game, 0, 8);
    assert.ok(!quiet, `${label}：安静落子不应成打`);
    assert.deepEqual(state.attack_turns[0], [], `${label}：安静落子不计入攻击`);

    // 白方安静落子
    move(game, 0, 0);
    assert.deepEqual(state.attack_turns[1], [], `${label}：白方安静落子不计入攻击`);

    // 黑方落子 (2,3) 与已有三子连成，主动发起攻击
    const attack = move(game, 2, 3);
    assert.ok(Array.isArray(attack) && attack.length >= 3, `${label}：应成打并返回成打点`);
    assert.equal(state.ascend_status, ASCEND_ENUM.START, `${label}：发起攻击后状态为 START`);
    assert.deepEqual(state.attack_turns[0], [3], `${label}：发起攻击的回合序号应只记录一次`);

    // 白方在 ASCEND 棋子上回应：属于反击，不得计入白方攻击
    move(game, 4, 3);
    assert.deepEqual(state.attack_turns[1], [], `${label}：回合成打不计入攻击`);
    assert.equal(state.attack_turns[0].length, 1, `${label}：黑方攻击记录未被反击污染`);
};

[GameNormal, GameBlight].forEach((game_class, index) => {
    checkGame(game_class, index === 0 ? 'GameNormal' : 'GameBlight');
});

// 未初始化 attack_turns 的旧状态（如运行时快照复原）不得抛错
const legacy_state = new State();
delete legacy_state.attack_turns;
const legacy_board = new Board(9, 9);
const legacy_game = new GameNormal(legacy_board, legacy_state, {}, {});
legacy_state.turn_player = PLAYER_ENUM.BLACK;
legacy_board.set_stone(3, 3, STONE_ENUM.BLACK);
legacy_board.set_stone(4, 3, STONE_ENUM.BLACK);
legacy_board.set_stone(5, 3, STONE_ENUM.BLACK);
legacy_game.ed_tr_1(2, 3);
assert.doesNotThrow(() => legacy_game.ed_as_1(), '缺少 attack_turns 时不应抛错');

console.log('attack-tracking: PASS');
