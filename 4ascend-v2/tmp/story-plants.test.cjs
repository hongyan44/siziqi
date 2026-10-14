/*
 * 剧情对局刷草点：验证 GameStory 只从作者定义的队列里刷草。
 * 运行： bun tmp/story-plants.test.cjs
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
const { GameStory } = load('game_story.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { STONE_ENUM: S, PLANT_ENUM: P, PLAYER_ENUM: R } = load('enum.cjs');

const makeStory = (points = []) => {
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [6, 6];
    state.turn_player = R.BLACK;
    const game = new GameStory(board, state, new RandAIC(1), new RandUnity(2));
    game.plant_points = points.map((point) => [point[0], point[1]]);
    return game;
};

const countPlants = (game) => game.board.data.filter((pos) => pos.plant !== P.NONE).length;

// 1) p_create 每次只消费一个点，按定义顺序返回
{
    const game = makeStory([[4, 4], [5, 4], [6, 5]]);
    const first = game.p_create(2);
    assert.equal(first.length, 1, '一次刷草只落一株');
    assert.equal(first[0].x, 4);
    assert.equal(first[0].y, 4);
    assert.equal(game.plant_points.length, 2, '只消费队首一个点');

    const second = game.p_create(2);
    assert.equal(second[0].x, 5);
    assert.equal(second[0].y, 4);
    console.log('PASS: p_create 按序单点消费');
}

// 2) 队列耗尽后返回空，不再自然刷草
{
    const game = makeStory([]);
    assert.equal(game.p_create(2), undefined, '队列为空时返回空');
    console.log('PASS: 队列耗尽 → 不刷草');
}

// 3) 非法 / 越界坐标被跳过，交给后续合法点
{
    const game = makeStory([[99, 99], [-1, 3], [3, 3]]);
    const result = game.p_create(2);
    assert.equal(result[0].x, 3);
    assert.equal(result[0].y, 3);
    assert.equal(game.plant_points.length, 0, '非法点被丢弃');
    console.log('PASS: 非法/越界刷草点被跳过');
}

// 4) 已经是二草的点被跳过
{
    const game = makeStory([[4, 4], [5, 4]]);
    game.board.set_plant(4, 4, P.TWO);
    const result = game.p_create(2);
    assert.equal(result[0].x, 5);
    assert.equal(game.plant_points.length, 0);
    console.log('PASS: 二草点被跳过');
}

// 5) 有实体普通子的点不能刷草
{
    const game = makeStory([[4, 4], [5, 4]]);
    game.board.set_stone(4, 4, S.BLACK);
    const result = game.p_create(2);
    assert.equal(result[0].x, 5);
    console.log('PASS: 实体普通子点被跳过');
}

// 6) ed_pl_1 在作者定义点上落一株草（空格 → 一草）
{
    const game = makeStory([[4, 4], [5, 4]]);
    game.state.grow_count = 1; // 强制本次生成
    const planted = game.ed_pl_1();
    assert.ok(planted, '应产生刷草结果');
    assert.equal(game.board.get_plant(4, 4), P.ONE, '作者定义点 → 一草');
    assert.equal(game.board.get_plant(5, 4), P.NONE, '未到点的位置不刷草');
    assert.equal(game.plant_points.length, 1, '只消费一个点');
    console.log('PASS: ed_pl_1 落到作者定义点（空格→一草）');
}

// 7) 已有一草的定义点 → 二草
{
    const game = makeStory([[4, 4]]);
    game.board.set_plant(4, 4, P.ONE);
    game.state.grow_count = 1;
    game.ed_pl_1();
    assert.equal(game.board.get_plant(4, 4), P.TWO, '已有一草 → 二草');
    console.log('PASS: 已有草的定义点 → 二草');
}

// 8) 队列耗尽时，后续再触发刷草也不会有任何草出现
{
    const game = makeStory([]);
    game.state.grow_count = 1;
    const planted = game.ed_pl_1();
    assert.equal(planted, undefined, '无点可选 → 无刷草结果');
    assert.equal(countPlants(game), 0, '棋盘上不出现任何草');
    console.log('PASS: 队列耗尽后不再自动刷草');
}

// 9) 连续两次刷草事件按定义顺序各落一株
{
    const game = makeStory([[1, 1], [7, 7]]);
    game.state.grow_count = 1;
    game.ed_pl_1();
    assert.equal(game.board.get_plant(1, 1), P.ONE);
    game.state.grow_count = 1;
    game.ed_pl_1();
    assert.equal(game.board.get_plant(7, 7), P.ONE);
    assert.equal(game.plant_points.length, 0);
    console.log('PASS: 多次刷草事件按序消费');
}

console.log('story-plants: ALL PASS');
