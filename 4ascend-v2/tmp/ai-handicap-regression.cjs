/*
 * 人机挑战难度取用弱化回归：简单不优先占草、普通不卖血。
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
const { AiHandicap } = load('ai_handicap.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A } = load('enum.cjs');

const handicap = AiHandicap.create({ RulesRuntime });
const xy = (x, y) => y * 9 + x;

function makeGame({ hp = [6, 6], turn = R.BLACK } = {}) {
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [...hp];
    state.turn_player = turn;
    const game = new GameNormal(board, state, new RandAIC(1), new RandUnity(2));
    game.natural_plant = false;
    RulesRuntime.initialize(game, R.BLACK);
    return game;
}

const put = (game, color, cells, plant) => cells.forEach(([x, y]) => {
    game.board.set_stone(x, y, color);
    if (plant) game.board.set_plant(x, y, plant);
});

// 难度档位映射
assert.equal(AiHandicap.levelOf('1'), 'easy');
assert.equal(AiHandicap.levelOf('2'), 'normal');
assert.equal(AiHandicap.levelOf('3'), null);
assert.equal(AiHandicap.levelOf('4'), null);
assert.equal(AiHandicap.levelOf('5'), null);
assert.equal(AiHandicap.levelOf('6'), null);
assert.equal(AiHandicap.levelOf(null), null);
console.log('PASS: 仅简单/普通进入取用弱化，熟练及以上不参与');

// 1) 简单：引擎取占草点 → 改堵玩家打点
{
    const game = makeGame({ turn: R.BLACK });
    // 白方 3 连，左侧被堵，(4,4) 是白方单独打点
    put(game, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    put(game, S.BLACK, [[0, 4]]);
    // 引擎取了一个占草点 (7, 7)，该点既不形成打也不是堵点
    game.board.set_plant(7, 7, P.ONE);

    const info = handicap.describe(game, xy(7, 7));
    assert.equal(info.landsOnPlant, true, '(7,7) 应被识别为占草点');
    assert.equal(info.blockPoint, false);

    const result = handicap.adjust(game, xy(7, 7), '1');
    assert.ok(result, '简单难度应改写占草落点');
    assert.equal(result.reason, 'easy-block-player-ascend');
    assert.equal(result.action, xy(4, 4), '应改到玩家打点 (4,4)');
    console.log('PASS: 简单难度优先堵玩家打点，不优先占草');
}

// 2) 简单：引擎取非占草点 → 不改写
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    put(game, S.BLACK, [[0, 4]]);
    const result = handicap.adjust(game, xy(0, 0), '1');
    assert.equal(result, null, '非占草落点应保持原样');
    console.log('PASS: 简单难度仅在取占草点时改写');
}

// 3) 简单：盘面无玩家打点 → 不改写
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE, [[1, 4], [2, 4]]);
    game.board.set_plant(7, 7, P.ONE);
    const result = handicap.adjust(game, xy(7, 7), '1');
    assert.equal(result, null, '没有堵点时应保持原样');
    console.log('PASS: 简单难度无堵点时不动落点');
}

// 4) 普通：引擎取卖血点 → 改自己的打点
{
    const game = makeGame({ turn: R.BLACK });
    // 白方盘旋 4 子，其中 (4,4) 是对方盘旋子：黑方落在此处即卖血
    put(game, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
    // 黑方自己可成打的点：(6,6)(6,7)(6,8) 三连，落 (6,5) 成打
    put(game, S.BLACK, [[6, 6], [6, 7], [6, 8]]);

    const info = handicap.describe(game, xy(4, 4));
    assert.equal(info.landsOnFoeAscend, true, '(4,4) 应落在对手盘旋子上');
    assert.equal(info.sellBlood, true, '(4,4) 应被识别为卖血点');

    const result = handicap.adjust(game, xy(4, 4), '2');
    assert.ok(result, '普通难度应改写卖血落点');
    assert.equal(result.reason, 'normal-no-sell-blood');
    const chosen = handicap.describe(game, result.action);
    assert.equal(chosen.formsAscend, true, '改后的落点必须是自己的打点');
    assert.notEqual(result.action, xy(4, 4));
    console.log(`PASS: 普通难度不卖血，改到自身打点 (${chosen.x},${chosen.y})`);
}

// 5) 普通：没有打点可用 → 才允许卖血
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
    // 黑方仅两个孤子，无法形成任何打
    put(game, S.BLACK, [[0, 0], [8, 8]]);
    const result = handicap.adjust(game, xy(4, 4), '2');
    assert.equal(result, null, '确实没有打点时应保持卖血');
    console.log('PASS: 普通难度无打点时才允许卖血');
}

// 6) 普通：引擎取非卖血点 → 不改写
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
    put(game, S.BLACK, [[6, 6], [6, 7], [6, 8]]);
    const result = handicap.adjust(game, xy(6, 5), '2');
    assert.equal(result, null, '非卖血落点应保持原样');
    console.log('PASS: 普通难度仅在取卖血点时改写');
}

// 7) 熟练及以上：完全不参与
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
    put(game, S.BLACK, [[6, 6], [6, 7], [6, 8]]);
    game.board.set_plant(7, 7, P.ONE);
    ['3', '4', '5', '6'].forEach((option) => {
        assert.equal(handicap.adjust(game, xy(4, 4), option), null, `难度 ${option} 不应改写卖血`);
        assert.equal(handicap.adjust(game, xy(7, 7), option), null, `难度 ${option} 不应改写占草`);
    });
    console.log('PASS: 熟练 / 高级 / 顶级 / ??? 行为不变');
}

// 8) 改写结果必定合法
{
    const game = makeGame({ turn: R.BLACK });
    put(game, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    put(game, S.BLACK, [[0, 4]]);
    game.board.set_plant(7, 7, P.ONE);
    const legal = RulesRuntime.legalMoves(game);
    const result = handicap.adjust(game, xy(7, 7), '1');
    assert.ok(legal.includes(result.action), '改写后的落点必须合法');
    console.log('PASS: 改写落点始终合法');
}

console.log('\n全部通过：难度取用弱化回归');
