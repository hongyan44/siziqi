/*
 * 核弹对弈：对方核弹不可堵 / 差值大于己方血量时，优先堵对方新方向，其次扩大己方核弹。
 * 运行： bun tmp/endgame-nuke.cjs
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
const put = (game, c, cells) => cells.forEach(([x, y]) => game.board.set_stone(x, y, c));
const xy = (x, y) => y * 9 + x;

// 1) 敌方 7 连核弹（M 潜力 8）不可放任，白方堵其完成点 (7,4)
{
    const game = makeGame({ hp: [6, 6], turn: R.WHITE });
    put(game, S.BLACK, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]);
    put(game, S.WHITE, [[0, 8], [8, 0]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    console.log(`  命中 reason=${move.reason} action=(${move.x},${move.y})`);
    assert.ok(['nuke-block', 'block-player-ascend'].includes(move.reason), `应堵敌方核弹完成点，实测 reason=${move.reason}`);
    assert.equal(move.action, xy(7, 4), '应堵 (7,4) 阻止黑方成 M=8 核弹');
    console.log('PASS: 敌方核弹完成点 → 优先堵点 (nuke-block)');
}

// 2) 己方核弹 < 对方核弹，且对方核弹足以斩杀己方：堵其中某方向救不了自己，
//    应转 nuke-expand 扩大己方核弹（而非 nuke-block）。黑7连核弹 MN=8，白方仅能成 4连(MN4)。
{
    const game = makeGame({ hp: [6, 6], turn: R.WHITE });
    // 主核弹 7 连完成点：(7,4)
    put(game, S.BLACK, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]);
    // 白方只能扩出弱核弹（4连 MN4），不足以应对黑 M8 核弹 → 不该堵，应扩己方核弹
    put(game, S.WHITE, [[4, 0], [5, 0], [6, 0]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.equal(move.reason, 'nuke-expand', '己方核弹<对方核弹时不得 nuke-block，应扩大己方核弹');
    assert.equal(move.action, xy(3, 0), '应在 (3,0) 扩大己方核弹而非堵黑方');
    console.log('PASS: 己方核弹<对方核弹 → nuke-expand 扩大己方核弹 @(3,0)，不堵');
}

// 3) 斩杀同步：若白方 4 连打能斩杀黑方，绝不改为核弹扩张，直接 kill
{
    const game = makeGame({ hp: [1, 3], turn: R.WHITE });
    put(game, S.WHITE, [[0, 0], [1, 0], [2, 0]]);
    put(game, S.BLACK, [[0, 5], [1, 5]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.equal(move.reason, 'kill', '能斩杀时必须斩杀');
    assert.equal(move.action, xy(3, 0));
    console.log('PASS: 能斩杀 → 立即 kill，核弹扩张不覆盖');
}

// 4) 回归守护：普通单打点不进入核弹对弈，仍走常规 block-player-ascend
{
    const game = makeGame({ hp: [6, 6], turn: R.WHITE });
    put(game, S.BLACK, [[0, 4], [1, 4], [2, 4]]);
    put(game, S.WHITE, [[8, 8], [0, 0]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回堵点');
    assert.equal(move.reason, 'block-player-ascend', '非核弹的普通单打点不进核弹对弈');
    assert.equal(move.action, xy(3, 4));
    console.log('PASS: 普通单打点 → block-player-ascend (3,4)，未被核弹对弈劫持');
}

// 5) 核弹竞争：己方核弹 ≥ 对方核弹（自足，堵后能应对而不死）→ 才去堵对方新方向(nuke-block)
//    黑方血量抬高使 kill 不成立，纯验证“自足核弹 → 堵对方新方向”
{
    const game = makeGame({ hp: [10, 6], turn: R.WHITE });
    put(game, S.BLACK, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]); // 主核弹完成点(7,4)
    put(game, S.BLACK, [[4, 1], [4, 2], [4, 3]]);                                   // 另一方向完成点(4,0)
    put(game, S.WHITE, [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8]]); // 白 7连 MN8 自足
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    assert.equal(move.reason, 'nuke-block', '核弹竞争且己方核弹自足时才堵对方新方向');
    assert.ok([xy(7, 4), xy(4, 0)].includes(move.action), `应堵敌方核弹方向完成点之一（实际 ${move.action}）`);
    console.log(`PASS: 核弹竞争(己方自足) → nuke-block 堵对方新方向 @(${move.x},${move.y})`);
}

// 6) 黑方下一步即可成 M7 核弹斩杀 hp1 白方；白方有 6 连可扩成 M7 核弹保命 →
//    白方必须形成己方核弹(扩大核弹/抢成核弹)，绝不能去堵黑方末端或走自杀 3 连。
{
    const game = makeGame({ hp: [6, 1], turn: R.WHITE });
    // 黑 6 连：(0,4)~(5,4)，下一步落 (6,4) 即成 M7 核弹斩杀 hp1 白
    put(game, S.BLACK, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]]);
    // 白 6 连：(2,8)~(7,8)，本手落 (1,8) 或 (8,8) 即成 M7 核弹
    put(game, S.WHITE, [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8]]);
    const move = tactics.chooseMove(game);
    assert.ok(move, '应返回一个落点');
    const safe = xy(1, 8);
    const safe2 = xy(8, 8);
    assert.ok([safe, safe2].includes(move.action),
        `黑方下一步斩杀 hp1 白时，白方应抢占核弹点 (1,8)/(8,8) 保命，实测 (${move.x},${move.y}) ${move.reason}`);
    assert.notEqual(move.reason, 'block-player-ascend', '不得退化为堵黑方核弹末端');
    console.log(`PASS: 黑必杀前一手 → 白方抢占己方核弹保命 @(${move.x},${move.y}) (${move.reason})`);
}

console.log('endgame-nuke: ALL PASS');