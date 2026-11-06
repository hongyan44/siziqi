/*
 * 残局「AI 先手」回归：白方 AI 以第 0 手开局，黑方仍是第 1 手。
 * 运行： node tmp/endgame-ai-first.cjs
 *
 * 覆盖：
 *   A. 存档：first=white 时编码/解码得到白方开局；旧编码器行为保持兼容；
 *   B. 刷草计划：作者按黑方手数填写的回合在 AI 先手时整体后移 1 回合，
 *      白方第 0 手不触发，黑方第 1 手后才触发；
 *   C. 页面接线：编辑器开关 / 挑战页开局落子 / 白方预案不被第 0 手消费。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const globalDir = path.resolve(__dirname, '..', 'js', 'global');
const pageDir = path.resolve(__dirname, '..', 'html', 'endgame');

const moduleCache = new Map();
function evaluate(file, textOverride) {
    if (!textOverride && moduleCache.has(file)) return moduleCache.get(file);
    const module = { exports: {} };
    const record = { module, window: {} };
    moduleCache.set(file, record);
    const raw = textOverride || fs.readFileSync(file, 'utf8');
    const text = raw.replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    const sandbox = {
        module,
        exports: module.exports,
        window: record.window,
        console,
        require: (p) => (p.startsWith('.') ? evaluate(path.resolve(path.dirname(file), p)).module.exports : require(p)),
        __dirname: path.dirname(file),
        __filename: file,
        Uint8Array, Uint16Array, Int8Array, ArrayBuffer,
        Array, Number, Math, Boolean, String, Map, Set, WeakMap, Object, Symbol, JSON, Date, RegExp,
        TypeError, RangeError, Error, Promise, Infinity, NaN, isNaN, parseInt, parseFloat, Buffer,
    };
    vm.runInNewContext(text, sandbox, { filename: file });
    return record;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const cells = Array.from({ length: 81 }, () => ({ stone: 'none', plant: 0 }));

const { EndgameArchive } = evaluate(path.join(globalDir, 'endgame.cjs')).window.EndgameExports;

// ---------- A. 存档：first=white 即 AI 先手 ----------
const base = {
    cells,
    player: 'black',
    first: 'black',
    natural_plant: false,
    hp: { black: 6, white: 6 },
    blackBook: [[4, 4]],
    whiteTurns: [[4, 5]],
    aiPreset: [[5, 4], [5, 5]],
    fallback: { level: 2 },
};

const aiFirstLoad = EndgameArchive.decode(EndgameArchive.encode({ ...base, first: 'white' }));
assert.equal(aiFirstLoad.first, 'white', 'first=white 必须往返保留，表示 AI（白方）先手');
assert.equal(aiFirstLoad.snapshot.firstPlayer, 1, '先手方必须为白方');
assert.equal(aiFirstLoad.snapshot.turnPlayer, 1, 'AI 先手的初始行棋方必须为白方（第 0 手）');
assert.equal(aiFirstLoad.snapshot.turnCount, 0, 'AI 先手初始局面必须从第 0 手开始');
same(aiFirstLoad.white_turns, [[4, 5]], '白方预案不得因 AI 先手改变（仍从黑方第 1 手配对）');
same(aiFirstLoad.ai_preset, [[5, 4], [5, 5]], 'AI 预设必须完整保留，第 1 个用于白方第 0 手');

const blackFirstLoad = EndgameArchive.decode(EndgameArchive.encode(base));
assert.equal(blackFirstLoad.first, 'black', '默认仍为黑方先手');
assert.equal(blackFirstLoad.snapshot.turnPlayer, 0, '黑方先手时初始行棋方必须为黑方');

// 显式快照（中途局面）不得被“先手方”默认值覆盖。
const explicitTurn = EndgameArchive.decode(EndgameArchive.encode({
    ...base,
    first: 'white',
    snapshot: { turnPlayer: 0, turnCount: 4 },
}));
assert.equal(explicitTurn.snapshot.turnPlayer, 0, '显式 snapshot.turnPlayer 必须优先于先手方默认值');
assert.equal(explicitTurn.snapshot.turnCount, 4, '显式快照回合数不得丢失');

// 旧编码器（HEAD）对 first=white 仍按黑方开局，兼容历史存档行为。
const legacyText = execSync('git show HEAD:4ascend-v2/js/global/endgame.cjs', { cwd: repoRoot, encoding: 'utf8' });
const legacyArchive = evaluate(path.join(globalDir, '__legacy_endgame_ai_first.cjs'), legacyText).window.EndgameExports.EndgameArchive;
const legacyLoad = EndgameArchive.decode(legacyArchive.encode({ ...base, first: 'white' }));
assert.equal(legacyLoad.snapshot.turnPlayer, 0, '旧存档快照仍按旧编码器的行棋方解码');

// ---------- B. 刷草计划回合后移 ----------
const { RulesRuntime } = evaluate(path.join(globalDir, 'fascend', 'runtime.cjs')).module.exports;
const { GameNormal } = evaluate(path.join(globalDir, 'fascend', 'game_normal.cjs')).module.exports;
const { Board } = evaluate(path.join(globalDir, 'fascend', 'board.cjs')).module.exports;
const { State } = evaluate(path.join(globalDir, 'fascend', 'state.cjs')).module.exports;
const { RandAIC, RandUnity } = evaluate(path.join(globalDir, 'fascend', 'rand.cjs')).module.exports;
const { PLAYER_ENUM } = evaluate(path.join(globalDir, 'fascend', 'enum.cjs')).module.exports;

const makeGame = (whiteFirst, shift, authoredTurn = 1) => {
    const state = new State();
    state.turn_player = whiteFirst ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
    state.hp = [6, 6];
    const game = new GameNormal(new Board(9, 9), state, new RandAIC(1), new RandUnity(2));
    game.natural_plant = false;
    game.plant_schedule = [{ turn: authoredTurn + (whiteFirst ? shift : 0), cells: [[0, 0]] }];
    game.plant_fired = new Set();
    RulesRuntime.initialize(game, state.turn_player);
    return game;
};
const play = (game, x, y) => {
    assert.equal(game.ed_tr_1(x, y), true, '测试落子必须合法');
    game.ed_tr_2();
};
const plantsAfter = (game) => [...(game.ed_pl_1() || []), ...RulesRuntime.applyScheduledPlants(game)].length;

const shifted = makeGame(true, 1);
play(shifted, 4, 4); // 白方第 0 手
assert.equal(shifted.state.turn_count, 1, '白方第 0 手后总手数为 1');
assert.equal(plantsAfter(shifted), 0, '白方第 0 手不得触发按黑方手数填写的第 1 回合刷草');
play(shifted, 3, 3); // 黑方第 1 手
assert.equal(shifted.state.turn_count, 2, '黑方第 1 手后总手数为 2');
assert.equal(plantsAfter(shifted), 1, '黑方第 1 手后才触发第 1 回合刷草');

const unshifted = makeGame(true, 0);
play(unshifted, 4, 4);
assert.equal(plantsAfter(unshifted), 1, '不后移会误在白方第 0 手触发（这正是必须后移的原因）');

// ---------- C. 页面接线 ----------
const submit = fs.readFileSync(path.join(pageDir, 'submit.html'), 'utf8');
const challenge = fs.readFileSync(path.join(pageDir, 'challenge.html'), 'utf8');
assert.match(submit, /id='ai_first'/, '编辑器必须提供 AI 先手开关');
assert.match(submit, /first: aiFirst \? 'white' : 'black'/, '勾选后导出 first=white');
assert.match(submit, /data\.first === 'white'/, '导入残局码时必须回填 AI 先手开关');
assert.match(challenge, /const aiOpensFirst = \(\) => Boolean\(state && state\.turn_player === PLAYER_ENUM\.WHITE && state\.turn_count === 0\)/, '挑战页必须只在初始局面识别 AI 先手');
assert.match(challenge, /const plantTurnShift = aiOpensFirst\(\) \? 1 : 0/, 'AI 先手时刷草计划必须整体后移 1 回合');
assert.match(challenge, /await playWhite\(null, generation\)/, 'AI 先手必须以 null 分支开局，确保不消费白方预案');
assert.match(challenge, /白方已先手落子，轮到你（黑方）落子。/, 'AI 开局后必须提示黑方落子');

console.log('endgame-ai-first: all assertions passed');
