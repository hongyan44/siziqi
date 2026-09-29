// 验证用户上传局面：黑方(7,2)主动核 / 白方(7,6)应手判断
// 用户坐标(x,y) -> 本脚本棋盘(x-1, y-1)（整体镜像不影响连线关系）
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

function snapshot(game) {
    return { hp: [...game.state.hp] };
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

console.log('=== 1. 黑(7,2)是否核弹(M>=7) ===');
let g = buildGame(R.BLACK);
let n = play(g, 7, 2);
console.log('  => ' + (n >= 7 ? `核弹 M=${n}` : `非核弹 M=${n}`));

console.log('=== 2. 白实际应手(7,6)后, 黑(7,2)核弹, 白最优反击仍死 ===');
for (const [wx, wy] of [[3, 7], [3, 2]]) {
    const g2 = buildGame(R.WHITE);
    play(g2, 7, 6);
    play(g2, 7, 2);
    play(g2, wx, wy);
    const s = snapshot(g2);
    console.log(`  => 白(${wx},${wy})反击后 黑HP=${s.hp[0]} 白HP=${s.hp[1]} ${s.hp[1] <= 0 ? '白死' : '白活'}`);
}

console.log('=== 3. (7,2)是否白方打点 ===');
g = buildGame(R.WHITE);
n = play(g, 7, 2);
console.log('  => ' + (n >= 4 ? '(7,2)是白方打点' : '不是'));

console.log('=== 4. 白堵(7,2), 黑在(7,2)反击 => 核弹在对消中引爆(主动核不可堵) ===');
g = buildGame(R.WHITE);
play(g, 7, 2);
n = play(g, 7, 2);
let s = snapshot(g);
console.log(`  => 黑反击拿起=${n} 黑HP=${s.hp[0]} 白HP=${s.hp[1]} ${s.hp[1] <= 0 ? '白死, 主动核不可堵成立' : '白活'}`);

console.log('=== 5. 三手计划(黑不堵白选点): (7,2)->黑被迫(3,7)->(7,2)封死->黑任意->(3,7)斩杀 ===');
g = buildGame(R.WHITE);
play(g, 7, 2);       // 白手1: 引爆打点, 逼黑回应
play(g, 3, 7);       // 黑唯一非(7,2)的打
s = snapshot(g);
console.log(`  手1交换后 黑HP=${s.hp[0]} 白HP=${s.hp[1]}`);
if (s.hp[0] > 0 && s.hp[1] > 0) {
    play(g, 7, 2);   // 白手2: 永久封死核弹点
    play(g, 7, 1);   // 黑任意应手
    play(g, 3, 7);   // 白手3: 斩杀打
    play(g, 9, 9);   // 黑无打可应, 任意 => 结算吃满伤害
    s = snapshot(g);
    console.log(`  手3结算后 黑HP=${s.hp[0]} ${s.hp[0] <= 0 ? '黑死, 白胜' : '黑活'}`);
}
