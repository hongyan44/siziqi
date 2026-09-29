/*
 * 残局战术：防自杀 / 斩杀落子矫正回归。
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
const xy = (x, y) => y * 9 + x;

function makeGame({ hp = [6, 6], turn = R.WHITE, ascend = A.NONE } = {}) {
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [...hp];
    state.turn_player = turn;
    state.ascend_status = ascend;
    const game = new GameNormal(board, state, new RandAIC(1), new RandUnity(2));
    game.natural_plant = false;
    RulesRuntime.initialize(game, R.BLACK);
    return game;
}

function putLine(game, color, cells) {
    cells.forEach(([x, y]) => game.board.set_stone(x, y, color));
}

// 1) 斩杀：白方 4 连，黑方 HP=3，必须打杀点（X <= M-1）
{
    const game = makeGame({ hp: [3, 6], turn: R.WHITE });
    // 堵住左侧，仅保留右侧杀点 (4,4)
    putLine(game, S.BLACK, [[0, 4]]);
    putLine(game, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应找到斩杀落点');
    assert.equal(move.action, xy(4, 4));
    assert.equal(move.reason, 'kill');
    console.log('PASS: kill when X <= M-1');
}

// 2) 防自杀：黑方已形成 4 打悬空，白方 HP=3，M=4 >= 3+1，必须 ASCEND 回应
{
    const game = makeGame({ hp: [6, 3], turn: R.WHITE, ascend: A.START });
    // 黑方盘旋 4 子
    putLine(game, S.BLACK_ASCEND, [[1, 1], [2, 1], [3, 1], [4, 1]]);
    // 堵住左侧，仅保留 (5,5) 成打
    putLine(game, S.BLACK, [[1, 5]]);
    putLine(game, S.WHITE, [[2, 5], [3, 5], [4, 5]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '防自杀应返回落点');
    assert.ok(move.reason.startsWith('anti-suicide') || move.reason === 'answer-ascend', `reason=${move.reason}`);
    assert.equal(move.action, xy(5, 5));
    console.log('PASS: anti-suicide must answer with ASCEND');
}

// 3) 堵点已停用（2026-09-29）：黑可在 (4,4) 成打，白自己不成打。
//    现在 AI 不再主动堵，返回 null 交由上层（MCTS）接管。
{
    const game = makeGame({ hp: [6, 6], turn: R.WHITE });
    putLine(game, S.BLACK, [[0, 4], [1, 4], [2, 4], [3, 4]]);
    // 黑方线 0-3，唯一成打空点是 (4,4)；白子放角落避免自己成打。
    putLine(game, S.WHITE, [[0, 0], [8, 8]]);
    const move = tactics.chooseMove(game);
    assert.equal(move, null, '堵点已停用，应返回 null 交由上层接管');
    console.log('PASS: block disabled, returns null for MCTS fallback');
}

// 4) 构建打已停用（2026-09-29）：AI 不再主动构建 ASCEND，返回 null 交上层。
{
    const game = makeGame({ hp: [6, 6], turn: R.WHITE });
    putLine(game, S.BLACK, [[0, 2]]);
    putLine(game, S.WHITE, [[1, 2], [2, 2], [3, 2]]);
    const move = tactics.chooseMove(game);
    assert.equal(move, null, '构建打已停用，应返回 null 交由上层接管');
    console.log('PASS: build disabled, returns null for MCTS fallback');
}

// 5) 人机 ??? 的战术兜底只在斩杀线开启；HP=4 不应触发
{
    const safeGame = makeGame({ hp: [4, 6], turn: R.WHITE });
    putLine(safeGame, S.BLACK, [[0, 4]]);
    putLine(safeGame, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    assert.equal(EndgameTactics.isKillZone(safeGame), false);
    assert.equal(tactics.safetyNet(safeGame), null);

    safeGame.state.hp[0] = 3;
    assert.equal(EndgameTactics.isKillZone(safeGame), true);
    const safetyMove = tactics.safetyNet(safeGame);
    assert.ok(safetyMove && safetyMove.reason === 'kill');
    console.log('PASS: ??? safety net only starts at HP <= 3');
}

// challenge.html / worker 接线冒烟
{
    const challenge = fs.readFileSync(path.resolve(__dirname, '../html/endgame/challenge.html'), 'utf8');
    const worker = fs.readFileSync(path.resolve(__dirname, '../js/worker/ai.cjs'), 'utf8');
    assert.match(challenge, /战术矫正/);
    assert.match(worker, /EndgameTactics/);
    assert.match(worker, /endgameTactics\.chooseMove/);
    assert.match(worker, /ENDGAME_TACTICS_THINK/);
    // ??? 人机：仅 synchronizeRandom + KillZone 时启用 safetyNet，且先跑 MCTS。
    assert.match(worker, /knownRandom && EndgameTactics\.isKillZone\(game\)/);
    assert.match(worker, /endgameTactics\.safetyNet\(game\)/);
    assert.match(worker, /async ZERO_THINK[\s\S]*await search\.search[\s\S]*safetyNet/);
    // 第一步白方也必须先跑 aiThink；仅斩杀/防自杀可覆盖正着。
    assert.match(challenge, /const decision = await aiThink\(\);/);
    assert.match(challenge, /criticalReasons/);
    assert.match(challenge, /isCriticalTactical/);
    assert.match(challenge, /else if \(isBookMove\) \{\s*move = branchResult\.white_move;/);
    assert.doesNotMatch(challenge, /const move = \(branchResult && branchResult\.white_move\) \? branchResult\.white_move : await aiThink\(\);/);
    console.log('PASS: challenge/worker wiring');
}

console.log('endgame-tactics-regression: ALL PASS');
