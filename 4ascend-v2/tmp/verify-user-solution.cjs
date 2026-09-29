// 验证用户给出的正着: 白 (3,5) -> (5,7) -> (3,7) 构建自己的主动核
const fs = require('node:fs');
const path = require('node:path');
globalThis.window = globalThis;

const fascendDir = path.resolve(__dirname, '../js/global/fascend');
function makeLoader(dir) {
    const cache = new Map();
    return function load(name) {
        const file = path.resolve(dir, name);
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
        new Function('require', 'module', 'exports', text)(
            (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
            module, module.exports
        );
        return module.exports;
    };
}
const loadF = makeLoader(fascendDir);
const { Board } = loadF('board.cjs');
const { State } = loadF('state.cjs');
const { GameNormal } = loadF('game_normal.cjs');
const { RandAIC, RandUnity } = loadF('rand.cjs');
const { RulesRuntime } = loadF('runtime.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, ASCEND_ENUM: A, OVER_ENUM: O } = loadF('enum.cjs');

const U = (x, y) => [x - 1, y - 1];

function buildGame(firstTurn) {
    const board = new Board(9, 9);
    const black = [[1,5],[2,6],[4,8],[6,1],[7,3],[7,4],[7,5],[8,3],[9,4]];
    const white = [[2,7],[2,8],[3,6],[3,8],[4,2],[4,6],[4,7],[5,2],[5,5],[6,2],[7,6]];
    for (const [x, y] of black) board.set_stone(...U(x, y), S.BLACK);
    for (const [x, y] of white) board.set_stone(...U(x, y), S.WHITE);
    const state = new State();
    state.hp = [1, 1];
    state.turn_player = firstTurn;
    state.turn_count = 0; state.ascend_status = A.NONE; state.pending_damage = null;
    state.unascend_charge = 25; state.unascend_chargef = [9, 9]; state.grow_count = 11;
    state.just_unascend = false; state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31 >>> 0), new RandUnity(0x4A534B32 >>> 0));
    game.natural_plant = false; game.first_player = R.BLACK; game.board.turns = [];
    RulesRuntime.initialize(game, game.first_player);
    return game;
}

function play(game, x, y) {
    const who = game.state.turn_player === R.BLACK ? '黑' : '白';
    const ok = game.ed_tr_1(...U(x, y));
    if (!ok) { console.log(`  !! ${who}(${x},${y}) 非法落子`); game.ed_tr_2(); return -1; }
    const picked = game.ed_as_1();
    const n = picked ? picked.length : 0;
    console.log(`  ${who}(${x},${y}) 拿起=${n}${n ? ' -> ' + picked.map(p => `(${p.x + 1},${p.y + 1})`).join('') : ''}`);
    game.ed_as_2();
    game.ed_as_3();
    game.ed_tr_2();
    return n;
}

// 仅探测: 假设某色落(x,y)能拿起多少子 (不实际落子)
function probe(game, x, y, stone) {
    const pts = game.board.get_ascend(...U(x, y), stone);
    return pts ? pts.length : 0;
}

console.log('=== A. 白(3,5)是否安全(不触发打) ===');
let g = buildGame(R.WHITE);
console.log('  落子前白(3,7)潜在拿起 =', probe(g, 3, 7, S.WHITE));
play(g, 3, 5);
console.log('  落(3,5)后白(3,7)潜在拿起 =', probe(g, 3, 7, S.WHITE), '(应=7, 已成立交核)');
console.log('  (3,7)是否黑方打点 =', probe(g, 3, 7, S.BLACK) >= 4 ? '是' : '否');

console.log('=== B. 黑最强应对(7,2)核弹, 白(3,7)反击 => 7v7抵消保命 ===');
play(g, 7, 2); // 黑核弹
play(g, 3, 7); // 白反击
console.log('  => 结算后 黑HP=' + g.state.hp[0] + ' 白HP=' + g.state.hp[1]);

console.log('=== C. 黑若不应(如堵(3,7)失败/走闲), 白建(5,7)再引爆(3,7) => M=10 ===');
g = buildGame(R.WHITE);
play(g, 3, 5);
console.log('  白(5,7)前 probe(3,7)白 =', probe(g, 3, 7, S.WHITE));
play(g, 9, 9); // 黑走闲
play(g, 5, 7);
console.log('  白(5,7)后 probe(3,7)白 =', probe(g, 3, 7, S.WHITE), '(应=10)');
play(g, 9, 8); // 黑走闲
play(g, 3, 7); // 白引爆
console.log('  => 结算后 黑HP=' + g.state.hp[0] + ' 白HP=' + g.state.hp[1]);

console.log('=== D. 白引爆M=10时黑(7,2)核弹反击 => 10-7=3 仍斩 ===');
g = buildGame(R.WHITE);
play(g, 3, 5);
play(g, 9, 9); // 黑走闲
play(g, 5, 7);
play(g, 9, 8); // 黑走闲
play(g, 3, 7); // 白引爆 M=10 (START)
play(g, 7, 2); // 黑核弹反击 M=7 (END)
console.log('  => 结算后 黑HP=' + g.state.hp[0] + ' 白HP=' + g.state.hp[1], g.state.hp[0] <= 0 ? '黑死, 10v7穿透成立' : '');

console.log('=== E. 黑试图堵(3,7): 黑落(3,7)自成打, 白在(3,7)反击 => 核弹对消中引爆 ===');
g = buildGame(R.WHITE);
play(g, 3, 5);
play(g, 9, 9);
play(g, 5, 7);
play(g, 9, 8); // 黑走闲
n = play(g, 3, 7); // 等等, 这里是白回合... 改为黑先堵
console.log('  (此路弃用, 看E2)');

console.log('=== E2. 白(3,5)后黑立即堵(3,7) => 黑自成M=4, 白反击(3,7) ===');
g = buildGame(R.WHITE);
play(g, 3, 5);
play(g, 3, 7); // 黑堵 => 黑成打 M=4
play(g, 3, 7); // 白在(3,7)反击 => 白引爆
console.log('  => 结算后 黑HP=' + g.state.hp[0] + ' 白HP=' + g.state.hp[1], g.state.hp[0] <= 0 ? '黑死, 主动核不可堵成立' : '');

console.log('=== F. 白(7,2)为何错误: 黑反击(7,2)核弹 => 白掉4血死 ===');
g = buildGame(R.WHITE);
play(g, 7, 2);
play(g, 7, 2);
console.log('  => 结算后 黑HP=' + g.state.hp[0] + ' 白HP=' + g.state.hp[1], g.state.hp[1] <= 0 ? '白死' : '');
