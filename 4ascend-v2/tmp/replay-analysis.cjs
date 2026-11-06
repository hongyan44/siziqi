/*
 * 回放局势分析：静态胜率与着手质量判定回归。
 * 运行： bun tmp/replay-analysis.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname, '../js/core/replay-analysis.cjs');
const text = fs.readFileSync(source, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
const mod = { exports: {} };
new Function('require', 'module', 'exports', text)(require, mod, mod.exports);

const { ReplayAnalysis } = mod.exports;

// 复用真实规则引擎做一次整盘联调
const base = path.resolve(__dirname, '../js/global/fascend');
const cache = new Map();
function load(name) {
    const file = path.resolve(base, name);
    if (cache.has(file)) return cache.get(file).exports;
    const item = { exports: {} };
    cache.set(file, item);
    const source_text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', source_text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        item,
        item.exports
    );
    return item.exports;
}

const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { PLAYER_ENUM, STONE_ENUM, PLANT_ENUM } = load('enum.cjs');

const SIZE = 9;
const index = (x, y) => y * SIZE + x;

const makeGrid = (black = [], white = []) => {
    const grid = new Uint8Array(SIZE * SIZE);
    black.forEach(([x, y]) => grid[index(x, y)] = 1);
    white.forEach(([x, y]) => grid[index(x, y)] = 2);
    return grid;
};

// 1) 空盘对峙
{
    const rate = ReplayAnalysis.evaluate_frame({
        'grid': makeGrid(),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [6, 6],
        'winner': null,
    });
    assert.ok(Math.abs(rate - 0.5) < 1e-9, `空盘应为 50%，实际 ${rate}`);
    console.log('PASS: 空盘胜率 50%');
}

// 2) 黑方三连（下一手可成 4 连打）胜率应高于 50%
{
    const rate = ReplayAnalysis.evaluate_frame({
        'grid': makeGrid([[0, 0], [1, 0], [2, 0]]),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [6, 6],
        'winner': null,
    });
    assert.ok(rate > 0.55, `黑方三连应形成威胁，实际 ${rate}`);
    console.log(`PASS: 黑方三连胜率 ${(rate * 100).toFixed(1)}%`);
}

// 3) 血量落后胜率应下降
{
    const behind = ReplayAnalysis.evaluate_frame({
        'grid': makeGrid(),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [2, 6],
        'winner': null,
    });
    assert.ok(behind < 0.3, `黑方 2 血对 6 血应明显落后，实际 ${behind}`);
    console.log(`PASS: 血量落后胜率 ${(behind * 100).toFixed(1)}%`);
}

// 4) 终局帧直接取极值
{
    const blackWin = ReplayAnalysis.evaluate_frame({
        'grid': makeGrid([[0, 0], [1, 0], [2, 0], [3, 0]]),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [6, 0],
        'winner': 0,
    });
    assert.equal(blackWin, 1);

    const whiteWin = ReplayAnalysis.evaluate_frame({
        'grid': makeGrid([], [[0, 0], [1, 0], [2, 0], [3, 0]]),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [0, 6],
        'winner': 1,
    });
    assert.equal(whiteWin, 0);
    console.log('PASS: 终局帧胜率取 0/1');
}

// 5) 六档标识阈值
{
    // 与最优解同档时按自身收益细分
    assert.equal(ReplayAnalysis.classify(0.10, 0.00), 'brilliant');
    assert.equal(ReplayAnalysis.classify(0.05, 0.00), 'good');
    assert.equal(ReplayAnalysis.classify(0.01, 0.00), 'interesting');
    assert.equal(ReplayAnalysis.classify(-0.01, 0.00), 'interesting');

    // 与最优解存在差距时按损失细分
    assert.equal(ReplayAnalysis.classify(0.00, 0.03), 'dubious');
    assert.equal(ReplayAnalysis.classify(0.00, 0.08), 'mistake');
    assert.equal(ReplayAnalysis.classify(0.00, 0.20), 'blunder');
    console.log('PASS: !! / ! / !? / ?! / ? / ?? 六档分类');
}

// 6) 整盘分析：首手以空盘为基准，落子方由下一手反推
{
    const empty = new Uint8Array(SIZE * SIZE);
    const frames = [
        { 'grid': makeGrid([[0, 0]]), 'plants': empty, 'hp': [6, 6], 'turn': 1, 'winner': null },
        { 'grid': makeGrid([[0, 0]], [[4, 4]]), 'plants': empty, 'hp': [6, 6], 'turn': 0, 'winner': null },
        { 'grid': makeGrid([[0, 0], [3, 0]], [[4, 4]]), 'plants': empty, 'hp': [6, 6], 'turn': 1, 'winner': 0 },
    ];

    const result = ReplayAnalysis.analyze(frames);
    assert.equal(result.rates.length, frames.length);
    assert.equal(result.moves.length, frames.length);
    assert.equal(result.counts.brilliant + result.counts.good + result.counts.interesting + result.counts.dubious + result.counts.mistake + result.counts.blunder, frames.length);

    assert.equal(result.moves[0].mover, 0, '首手下一手为白，落子方应为黑');
    assert.equal(result.moves[1].mover, 1, '第二手下一手为黑，落子方应为白');
    assert.equal(result.moves[2].mover, 0, '第三手下一手为白，落子方应为黑');

    const legal = ['brilliant', 'good', 'interesting', 'dubious', 'mistake', 'blunder'];
    result.moves.forEach((move) => {
        assert.ok(legal.includes(move.label), `未知标签 ${move.label}`);
        assert.ok(Number.isFinite(move.delta));
        assert.ok(move.regret >= 0);
    });

    // 黑方获胜的收尾手应判为妙手
    assert.equal(result.moves[2].label, 'brilliant', '获胜收尾手应为妙手');
    const count_text = legal.map((label) => `${label}:${result.counts[label]}`).join(' ');
    console.log(`PASS: 整盘分析 ${count_text}`);
}

// 7) 与真实规则引擎联调：按 replay.cjs 的结算顺序生成帧并分析
{
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [6, 6];
    state.turn_player = PLAYER_ENUM.BLACK;
    const game = new GameNormal(board, state, new RandAIC(1), new RandUnity(2));

    let winner = null;
    const frames = [];
    const turns = [
        [4, 4], [3, 4], [4, 3], [3, 3], [5, 5],
        [3, 5], [5, 3], [2, 4], [4, 5], [2, 5],
    ];

    turns.forEach(([x, y]) => {
        if (winner !== null) return;
        if (!game.ed_tr_1(x, y)) return;

        game.ed_as_1();
        game.ed_as_2();
        game.ed_tr_2();

        const win = game.ed_win();
        if (win) {
            winner = win;
            game.ed_as_3();
        } else {
            game.ed_pl_1();
            game.ed_as_3();
        }

        const grid = new Uint8Array(SIZE * SIZE);
        const plants = new Uint8Array(SIZE * SIZE);
        board.data.forEach((pos) => {
            grid[index(pos.x, pos.y)] = pos.stone === STONE_ENUM.BLACK ? 1 : pos.stone === STONE_ENUM.WHITE ? 2 : 0;
            plants[index(pos.x, pos.y)] = pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0;
        });

        frames.push({
            'grid': grid,
            'plants': plants,
            'hp': [state.hp[0], state.hp[1]],
            'turn': state.turn_player === PLAYER_ENUM.WHITE ? 1 : 0,
            'winner': winner === PLAYER_ENUM.BLACK ? 0 : winner === PLAYER_ENUM.WHITE ? 1 : null,
        });
    });

    assert.ok(frames.length >= 4, `真实引擎回放帧数不足：${frames.length}`);

    const started = Date.now();
    const result = ReplayAnalysis.analyze(frames);
    const cost = Date.now() - started;

    assert.equal(result.rates.length, frames.length);
    result.rates.forEach((rate) => {
        assert.ok(Number.isFinite(rate) && rate >= 0 && rate <= 1, `非法胜率 ${rate}`);
    });
    result.moves.forEach((move) => {
        assert.ok(['brilliant', 'good', 'interesting', 'dubious', 'mistake', 'blunder'].includes(move.label));
    });
    assert.equal(result.counts.brilliant + result.counts.good + result.counts.interesting + result.counts.dubious + result.counts.mistake + result.counts.blunder, frames.length);

    const count_text = ['brilliant', 'good', 'interesting', 'dubious', 'mistake', 'blunder']
        .map((label) => `${label}:${result.counts[label]}`)
        .join(' ');
    console.log(`PASS: 真实引擎 ${frames.length} 帧联调，用时 ${cost}ms，${count_text}`);
}

// 8) 替代最佳着法：排序、数量限制、排除实际落点
{
    const frame = {
        'grid': makeGrid([[0, 0], [1, 0], [2, 0]]),
        'plants': new Uint8Array(SIZE * SIZE),
        'hp': [6, 6],
        'turn': 1,
        'winner': null,
    };

    const list = ReplayAnalysis.best_moves(frame, 0, [6, 6], 3, null);
    assert.equal(list.length, 3);
    for (let i = 1; i < list.length; i++) {
        assert.ok(list[i - 1].view >= list[i].view, '替代着法应按胜率降序');
    }
    list.forEach((item) => {
        assert.ok(item.x >= 0 && item.x < SIZE && item.y >= 0 && item.y < SIZE);
        assert.ok(frame.grid[item.y * SIZE + item.x] === 0, '替代着法不能落在已占用的点');
    });

    const excluded = ReplayAnalysis.best_moves(frame, 0, [6, 6], 2, [3, 0]);
    assert.equal(excluded.length, 2);
    assert.ok(!excluded.some((item) => item.x === 3 && item.y === 0), '应排除实际落点');

    assert.equal(ReplayAnalysis.best_moves(frame, 0, [6, 6], 1, null).length, 1, '数量应限制为 1');
    console.log('PASS: 替代最佳着法排序 / 数量 1-3 / 排除实际落点');
}

console.log('ALL PASS: replay-analysis');
