/*
 * 黑(9,4) → 白(5,7) 后：枚举黑方全部应手，用引擎搜索判断白方能否活。
 * display(dx,dy) ⇄ engine(x,y): x = dx-1, y = 9-dy
 * 运行: node tmp/check-5-7.cjs [depth]
 */
const fs = require('node:fs');
const path = require('node:path');
globalThis.window = globalThis;

const globalDir = path.resolve(__dirname, '../js/global');
const fascendDir = path.resolve(globalDir, 'fascend');
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
const loadGlobal = makeLoader(globalDir);
const loadF = makeLoader(fascendDir);
loadGlobal('endgame.cjs');
const { EndgameArchive } = globalThis.EndgameExports;
const { Board } = loadF('board.cjs');
const { State } = loadF('state.cjs');
const { GameNormal } = loadF('game_normal.cjs');
const { RandAIC, RandUnity } = loadF('rand.cjs');
const { RulesRuntime } = loadF('runtime.cjs');
const { EndgameTactics } = loadF('endgame_tactics.cjs');
const { STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P, ASCEND_ENUM: A, OVER_ENUM: O } = loadF('enum.cjs');
const tactics = EndgameTactics.create({ RulesRuntime });

const raw = fs.readFileSync(path.resolve(__dirname, 'endgame-code.txt'), 'utf8').trim();
const data = EndgameArchive.decode(raw);
const D2B = ([dx, dy]) => [dx - 1, 9 - dy];
const B2D = ([x, y]) => [x + 1, 9 - y];
const fmtD = (d) => `(${d[0]},${d[1]})`;

const buildGame = () => {
    const board = new Board(9, 9);
    data.cells.forEach((c, i) => {
        const bx = i % 9, by = Math.floor(i / 9);
        const y = 8 - by;
        const st = ({ 'black': S.BLACK, 'white': S.WHITE, 'black-ascend': S.BLACK_ASCEND, 'white-ascend': S.WHITE_ASCEND })[c.stone] || S.NONE;
        const pl = Number(c.plant) === 2 ? P.TWO : Number(c.plant) === 1 ? P.ONE : P.NONE;
        board.set_pos(bx, y, st, pl);
    });
    const state = new State();
    state.hp = [data.hp.black, data.hp.white];
    state.turn_player = R.BLACK;
    state.turn_count = 0; state.ascend_status = A.NONE; state.pending_damage = null;
    state.unascend_charge = 25; state.unascend_chargef = [9, 9]; state.grow_count = 11;
    state.just_unascend = false; state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31 >>> 0), new RandUnity(0x4A534B32 >>> 0));
    game.natural_plant = false; game.first_player = R.BLACK; game.board.turns = [];
    RulesRuntime.initialize(game, game.first_player);
    return game;
};
const applyMove = (game, [dx, dy]) => {
    const [x, y] = D2B([dx, dy]);
    return RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
};

// ---------- 先看 (5,7) 本身是什么着 ----------
const probe = buildGame();
applyMove(probe, [9, 4]);
{
    const [x, y] = D2B([5, 7]);
    const asc = probe.board.get_ascend(x, y, S.WHITE);
    const align = probe.board.get_align(x, y, S.WHITE);
    const foeAsc = probe.board.get_ascend(x, y, S.BLACK);
    const legal = probe.valid(x, y, S.WHITE);
    console.log(`白 (5,7) → engine(${x},${y})  legal=${legal}`);
    console.log(`  成打: ${asc ? `M=${tactics.powerOf(asc).M} N=${tactics.powerOf(asc).N} MN=${tactics.powerOf(asc).MN}` : '否'}`);
    console.log(`  己方最大连线: ${align[0]}（横=${align[0]} 竖=${align[1]} 撇=${align[2]} 捺=${align[3]}）`);
    console.log(`  黑方在此能否成打（即是否堵点）: ${foeAsc ? '能' : '不能'}`);
}

// ---------- 搜索 ----------
const WIN = 100000;
const memo = new Map();
let nodes = 0;
const deadline = Date.now() + 180000;

function search(game, depth, alpha, beta) {
    nodes++;
    const w = RulesRuntime.winner(game);
    if (w !== undefined) return w === R.WHITE ? WIN : -WIN;
    if (depth <= 0) return 0;
    if (Date.now() > deadline) return 0;
    const legal = RulesRuntime.legalMoves(game);
    if (!legal.length) return 0;

    const key = RulesRuntime.stateKey(game) + '|' + depth;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;

    const self = game.state.turn_player;
    const maximizing = self === R.WHITE;
    const selfStone = self === R.BLACK ? S.BLACK : S.WHITE;
    const foeStone = self === R.BLACK ? S.WHITE : S.BLACK;
    const foeAsc = self === R.BLACK ? S.WHITE_ASCEND : S.BLACK_ASCEND;

    const ordered = legal.map((a) => {
        const x = a % 9, y = Math.floor(a / 9);
        let pri = 0;
        if (game.board.get_ascend(x, y, selfStone)) pri += 1000;
        if (game.board.get_stone(x, y) === foeAsc) pri += 500;
        if (game.board.get_ascend(x, y, foeStone)) pri += 200;
        if (game.board.get_align(x, y, selfStone)[0] >= 3) pri += 50;
        return { a, pri };
    }).sort((p, q) => q.pri - p.pri).map((p) => p.a);

    let best = maximizing ? -Infinity : Infinity;
    for (const a of ordered) {
        const fork = RulesRuntime.fork(game);
        const res = RulesRuntime.applyMove(fork, a, {});
        if (!res.legal) continue;
        const v = search(fork, depth - 1, alpha, beta);
        if (maximizing) {
            if (v > best) best = v;
            if (best > alpha) alpha = best;
        } else {
            if (v < best) best = v;
            if (best < beta) beta = best;
        }
        if (alpha >= beta) break;
    }
    if (best === -Infinity) best = 0;
    memo.set(key, best);
    return best;
}

const depth = Number(process.argv[2] || 4);
const after = buildGame();
applyMove(after, [9, 4]);
const rw = applyMove(after, [5, 7]);
console.log(`\n黑(9,4) → 白(5,7)  legal=${rw.legal} winner=${rw.winner}  白落子后 HP 黑=${after.state.hp[0]} 白=${after.state.hp[1]}`);
console.log(`  黑方行棋，pendingDamage=${JSON.stringify(after.state.pending_damage)}\n`);

const rows = [];
for (const a of RulesRuntime.legalMoves(after)) {
    const x = a % 9, y = Math.floor(a / 9);
    const d = B2D([x, y]);
    const g = RulesRuntime.fork(after);
    const res = RulesRuntime.applyMove(g, a, {});
    if (!res.legal) continue;
    let value;
    if (res.winner !== undefined) value = res.winner === R.WHITE ? WIN : -WIN;
    else value = search(g, depth - 1, -Infinity, Infinity);
    const asc = after.board.get_ascend(x, y, S.BLACK);
    const p = asc ? tactics.powerOf(asc) : null;
    rows.push({ d, a, value, M: p ? p.M : 0, MN: p ? p.MN : 0, isAsc: Boolean(asc), hp: [...g.state.hp] });
}
rows.sort((u, v) => u.value - v.value || v.MN - u.MN || u.a - v.a);
console.log(`黑方应手评估（value 从白方视角：<=-100000 表示黑胜；深度 ${depth}）`);
rows.slice(0, 12).forEach((row) => {
    const tag = row.value >= WIN ? '白胜' : row.value <= -WIN ? '黑胜' : row.value > 0 ? '白优' : row.value < 0 ? '黑优' : '未定';
    console.log(`  黑${fmtD(row.d)}  成打=${row.isAsc ? `M=${row.M} M+N=${row.MN}` : '否'}  → ${tag} (value=${row.value})`);
});
const blackWins = rows.filter((r) => r.value <= -WIN).length;
console.log(`\n黑方能强制取胜的应手数: ${blackWins} / ${rows.length}`);
console.log(`(节点数 ${nodes})`);

// ---------- 若黑直接走核弹，白方还有哪些应手 ----------
console.log('\n--- 黑(7,2) 核弹后，白方可成打点 ---');
const afterNuke = RulesRuntime.fork(after);
const rn = applyMove(afterNuke, [7, 2]);
console.log(`  黑(7,2) legal=${rn.legal} winner=${rn.winner} HP 黑=${afterNuke.state.hp[0]} 白=${afterNuke.state.hp[1]}`);
RulesRuntime.legalMoves(afterNuke).forEach((a) => {
    const x = a % 9, y = Math.floor(a / 9);
    const pts = afterNuke.board.get_ascend(x, y, S.WHITE);
    if (!pts) return;
    const p = tactics.powerOf(pts);
    console.log(`  白${fmtD(B2D([x, y]))}  成打 M=${p.M} N=${p.N} MN=${p.MN}  落在黑打子上=${afterNuke.board.get_stone(x, y) === S.BLACK_ASCEND}`);
});