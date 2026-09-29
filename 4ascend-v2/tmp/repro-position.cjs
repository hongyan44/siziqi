/*
 * 残局码复现（显示坐标为 1-based 左下角原点 = 残局码/挑战页显示系）：
 * 解码残局码 → 重建盘面/状态 → 黑方落子(9,4)（显示系列9行4）→ 观察白方 tactics 应着。
 * 运行： node tmp/repro-position.cjs "<残局码文件路径>"
 */
const fs = require('node:fs');
const path = require('node:path');
globalThis.window = globalThis;

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
        module, module.exports
    );
    return module.exports;
}
const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { RulesRuntime } = load('runtime.cjs');
const { EndgameTactics } = load('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = load('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

const globalDir = path.resolve(__dirname, '../js/global');
const globalCache = new Map();
function loadGlobal(name) {
    const file = path.resolve(globalDir, name);
    if (globalCache.has(file)) return globalCache.get(file).exports;
    const module = { exports: {} };
    globalCache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? loadGlobal(path.resolve(globalDir, p)) : require(p)),
        module, module.exports
    );
    return module.exports;
}
try { loadGlobal('endgame.cjs'); } catch (e) { console.error('加载 endgame.cjs 失败:', e); process.exit(3); }

const codePath = process.argv[2];
if (!codePath || !fs.existsSync(codePath)) { console.error('请提供残局码文件路径'); process.exit(1); }
const rawCode = fs.readFileSync(codePath, 'utf8').trim();

let challengeData;
try { challengeData = globalThis.EndgameExports.EndgameArchive.decode(rawCode); }
catch (e) { console.error('残局码解码失败(传输可能损坏):', e.message); process.exit(2); }

const toStoneName = (code) => {
    if (typeof code === 'string') return code; // decode 已给出 'black'/'white'/'black-ascend'... 名称
    return ['none', 'black', 'white', 'black-ascend', 'white-ascend', 'black-used', 'white-used'][Number(code)] || 'none';
};
const snap = challengeData.snapshot || {};
const mode = snap.mode || challengeData.game_mode || 'normal';
const hp = Array.isArray(snap.hp) ? snap.hp : [challengeData.hp.black, challengeData.hp.white];

// —— 坐标一致性：本脚本统一用【display 系】= 残局码/挑战页显示系，1-based，原点左下角。
//  （列 R 从左 1..9，行 C 从下 1..9。）
// display(R,C) ⇄ board API 左上角 0-based： board = [R-1, 8-(C-1)]
const D2B = ([R, C]) => [R - 1, 8 - (C - 1)];
const B2D = ([x, y]) => [x + 1, 8 - y + 1];

// 解码盘面（存成 board API 左上角系）
const boardStones = new Array(81).fill('none');
const boardPlants = new Array(81).fill(0);
if (Array.isArray(snap.stones) && snap.stones.length === 81) {
    snap.stones.forEach((str, index) => {
        const bx = index % 9; const y = Math.floor(index / 9);
        if (!Array.isArray(boardStones[8 - y])) boardStones[8 - y] = new Array(9).fill('none');
        if (!Array.isArray(boardPlants[8 - y])) boardPlants[8 - y] = new Array(9).fill(0);
        boardStones[8 - y][bx] = toStoneName(str);
        boardPlants[8 - y][bx] = Number(snap.plants[index]) || 0;
    });
} else {
    console.error('WARN 残局码缺少 81 格盘面, stones类型=', Array.isArray(snap.stones), Array.isArray(snap.stones) ? snap.stones.length : typeof snap.stones, ' plants=', Array.isArray(snap.plants) ? snap.plants.length : typeof snap.plants);
}

const mark = (s) => ({ 'black': 'B', 'white': 'W', 'black-ascend': 'b', 'white-ascend': 'w', 'black-used': 'x', 'white-used': 'y' }[s] || '.');

console.log('=== 解码 ===', challengeData.format, mode, 'hp=', hp.join('/'), 'turnPlayer=', snap.turnPlayer, '先手=', challengeData.first);
console.log('=== 盘面（display 系：列1..9左→右，行1..9下→上）===');
console.log('    1  2  3  4  5  6  7  8  9  列R');
for (let C = 9; C >= 1; C--) {
    const rowApi = 9 - C; // 该 display 行对应 board API y
    let line = `${C} `;
    for (let R = 1; R <= 9; R++) line += '  ' + mark(boardStones[rowApi][R - 1]);
    console.log(line);
}
console.log('B=黑  W=白  b/w=升变打（黑/白）\n');

// 黑方（9,4）→ display 系 (R9, C4)
const blackBlock = null;
const [bx, by] = D2B([9, 4]);
console.log(`黑方落子 display(9,4) → board API (${bx},${by})，格内=${mark(boardStones[by][bx])}`);

// 重建 game
const buildGame = () => {
    const board = new Board(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        const n = boardStones[y][x];
        const st = ({ 'black': S.BLACK, 'white': S.WHITE, 'black-ascend': S.BLACK_ASCEND, 'white-ascend': S.WHITE_ASCEND })[n] || S.NONE;
        board.set_pos(x, y, st, boardPlants[y][x] === 2 ? P.TWO : boardPlants[y][x] === 1 ? P.ONE : P.NONE);
    }
    const state = new State();
    state.hp = [Math.max(0, Number(hp[0])), Math.max(0, Number(hp[1]))];
    state.turn_player = Number(snap.turnPlayer) === 1 ? R.WHITE : R.BLACK;
    state.turn_count = Math.max(0, Number(snap.turnCount) || 0);
    state.ascend_status = Number(snap.ascendStatus) === 1 ? A.START : Number(snap.ascendStatus) === 2 ? A.END : A.NONE;
    state.pending_damage = Array.isArray(snap.pendingDamage) ? snap.pendingDamage.map((v) => Number(v)) : null;
    state.unascend_charge = Number.isFinite(Number(snap.unascendCharge)) ? Number(snap.unascendCharge) : 25;
    state.unascend_chargef = Array.isArray(snap.fastUnascendCharge) ? snap.fastUnascendCharge.map((v) => Number(v)) : [9, 9];
    state.grow_count = Number.isFinite(Number(snap.growCount)) ? Number(snap.growCount) : 11;
    state.just_unascend = Boolean(snap.justUnascend);
    state.over_status = Number(snap.overStatus) === 1 ? O.ENABLE : Number(snap.overStatus) === 2 ? O.EXECUTE : O.NONE;
    const ri = (src, fallback) => {
        const seed = src && Number.isFinite(Number(src.seed)) ? Number(src.seed) >>> 0 : fallback >>> 0;
        const r = new RandAIC(seed === fallback ? seed : src ? new RandAIC(seed).seed : seed);
        // 统一 RandAIC/RandUnity：此处仅用于占位，tactics 不强依赖 RNG
        return r;
    };
    const randAic = (() => { const s0 = snap.randAic && Number.isFinite(Number(snap.randAic.seed)) ? Number(snap.randAic.seed) >>> 0 : 0x4A534B31 >>> 0; const r = new RandAIC(s0); if (snap.randAic && Array.isArray(snap.randAic.states)) r.states = snap.randAic.states.map((v) => Number(v) >>> 0); return r; })();
    const randUnity = (() => { const s1 = snap.randUnity && Number.isFinite(Number(snap.randUnity.seed)) ? Number(snap.randUnity.seed) >>> 0 : 0x4A534B32 >>> 0; const r = new RandUnity(s1); if (snap.randUnity && Array.isArray(snap.randUnity.states)) r.states = snap.randUnity.states.map((v) => Number(v) >>> 0); return r; })();
    const game = new GameNormal(board, state, randAic, randUnity);
    game.natural_plant = false;
    if ('alwaysOverload' in snap) game.always_overload = Boolean(snap.alwaysOverload);
    game.first_player = Number(snap.firstPlayer) === 1 ? R.WHITE : R.BLACK;
    game.history_boards = (snap.history || []).map((b) => Uint8Array.from(b));
    game.board.turns = (snap.turns || []).map(([x, y]) => [x, y]);
    RulesRuntime.initialize(game, game.first_player);
    return game;
};

try {
    const game = buildGame();
    // 事前诊断：双方当前/本手最大可成 ASCEND（M / MN），判定是否存在“核弹”
    const foeNow = tactics.maxAscendNow ? tactics.maxAscendNow.call(tactics, game, S.BLACK) : null;
    // 用临时副本算白方本手最大可成（不污染黑落子前的 game）
    const whiteBestNow = (() => {
        const g2 = buildGame();
        const b = g2.board; let best = null;
        RulesRuntime.legalMoves(g2).forEach((a) => { const x = a % g2.board.w, y = Math.floor(a / g2.board.w); const pts = b.get_ascend(x, y, S.WHITE); if (pts) { const p = tactics.powerOf(pts); if (!best || p.MN > best.MN) best = { M: p.M, MN: p.MN, x, y }; } });
        return best;
    })();
    console.log(`[核弹诊断] 黑方当前最大可成打 M=${foeNow ? foeNow.M : 0} MN=${foeNow ? foeNow.MN : 0}；白方本手最大可成打 M=${whiteBestNow ? whiteBestNow.M : 0} MN=${whiteBestNow ? whiteBestNow.MN : 0} -> 白方本手可到 M≥7? ${whiteBestNow ? whiteBestNow.M >= 7 : false}`);

    const orig = game.board.get_stone(bx, by);
    if (orig !== S.NONE) { console.log('(9,4) 已被占用'); process.exit(0); }
    game.board.set_stone(bx, by, S.BLACK);
    game.state.turn_player = R.WHITE;
    const m = tactics.chooseMove(game);
    if (!m) console.log('白方 tactics 未命中（回退树搜索）');
    else {
        const [dR, dC] = B2D([m.x, m.y]);
        const sp = (m.detail && m.detail.selfPower) || {};
        console.log(`白方应着: reason=${m.reason}  display(${dR},${dC})  (board ${m.x},${m.y})  M=${sp.M} N=${sp.N} MN=${sp.MN}`);
        if (m.detail) console.log('  detail.isKill=', m.detail.isKill, ' beatsThreat=', m.detail.beatsThreat, ' mustAnswer=', m.detail.mustAnswer);
    }
} catch (e) {
    console.log('模拟出错:', e && e.stack || e);
}