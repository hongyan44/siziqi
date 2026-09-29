/*
 * 残局：黑落 display(9,4) 后，白方最佳应手（引擎级搜索 + 打点枚举）。
 * display(dx,dy) ⇄ engine(x,y): x = dx-1, y = 9-dy
 * 运行: node tmp/white-best-reply.cjs
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
const D = Array.from({ length: 10 }, () => new Array(10).fill(null));
data.cells.forEach((c, i) => {
    const bx = i % 9, by = Math.floor(i / 9);
    D[by + 1][bx + 1] = { stone: c.stone, plant: Number(c.plant) || 0 };
});

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
    state.turn_count = 0;
    state.ascend_status = A.NONE;
    state.pending_damage = null;
    state.unascend_charge = 25;
    state.unascend_chargef = [9, 9];
    state.grow_count = 11;
    state.just_unascend = false;
    state.over_status = O.NONE;
    const game = new GameNormal(board, state, new RandAIC(0x4A534B31 >>> 0), new RandUnity(0x4A534B32 >>> 0));
    game.natural_plant = false;
    game.first_player = R.BLACK;
    game.board.turns = [];
    RulesRuntime.initialize(game, game.first_player);
    return game;
};

const applyMove = (game, [dx, dy]) => {
    const [x, y] = D2B([dx, dy]);
    return RulesRuntime.applyMove(game, y * 9 + x, { collectEvents: true });
};

// ---------- 打点枚举 ----------
const ascendPoints = (game, stone) => {
    const rows = [];
    RulesRuntime.legalMoves(game).forEach((a) => {
        const x = a % game.board.w, y = Math.floor(a / game.board.w);
        const pts = game.board.get_ascend(x, y, stone);
        if (!pts) return;
        const p = tactics.powerOf(pts);
        rows.push({
            action: a, x, y, d: B2D([x, y]),
            M: p.M, N: p.N, MN: p.MN, powers: p.powers,
            pieces: pts.map((q) => B2D([q.x, q.y])),
            onFoeAscend: game.board.get_stone(x, y) !== S.NONE,
        });
    });
    rows.sort((a, b) => b.M - a.M || b.MN - a.MN);
    return rows;
};

const fmtD = (d) => `(${d[0]},${d[1]})`;
const fmtPieces = (ps) => ps.map(fmtD).join(' ');

const showAscends = (label, game, stone) => {
    console.log(`\n--- ${label} ---`);
    ascendPoints(game, stone).forEach((r) => {
        console.log(`  ${fmtD(r.d)}  M=${r.M} N=${r.N} M+N=${r.MN}  powers=[${r.powers.join(',')}]  nuke=${r.M >= 7 ? 'YES' : 'no'}${r.onFoeAscend ? ' (落在敌方打子上=反击)' : ''}`);
        console.log(`      拾取: ${fmtPieces(r.pieces)}`);
    });
};

console.log('=== 初始盘面（黑先，HP 黑1/白1，无自然刷草）===');
console.log('     1  2  3  4  5  6  7  8  9');
for (let dy = 9; dy >= 1; dy--) {
    let line = String(dy).padStart(3, ' ') + '  ';
    for (let dx = 1; dx <= 9; dx++) {
        const c = D[dy][dx];
        if (!c || c.stone === 'none') { line += (c && c.plant ? 'g' : '.').padEnd(3, ' '); continue; }
        const base = c.stone === 'black' ? 'B' : c.stone === 'white' ? 'W' : c.stone === 'black-ascend' ? 'b' : 'w';
        line += (c.plant ? base + c.plant : base + ' ').padEnd(3, ' ');
    }
    console.log(line);
}
showAscends('黑落(9,4)前 · 白方可成打点', buildGame(), S.WHITE);
showAscends('黑落(9,4)前 · 黑方可成打点', buildGame(), S.BLACK);

// ---------- 黑落 (9,4) ----------
const afterBlack = buildGame();
const r = applyMove(afterBlack, [9, 4]);
console.log(`\n=== 黑落 display(9,4) → engine${JSON.stringify(D2B([9, 4]))} legal=${r.legal} winner=${r.winner} ===`);
console.log(`  黑落子后 HP: 黑=${afterBlack.state.hp[0]} 白=${afterBlack.state.hp[1]}  ascend_status=${String(afterBlack.state.ascend_status)}`);
showAscends('黑落(9,4)后 · 黑方可成打点', afterBlack, S.BLACK);
showAscends('黑落(9,4)后 · 白方可成打点', afterBlack, S.WHITE);

// ---------- 搜索 ----------
const WIN = 100000;
const memo = new Map();
let nodes = 0;
const deadline = Date.now() + 120000;

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
    const foeAsc = self === R.BLACK ? S.WHITE_ASCEND : S.BLACK_ASCEND;

    // 着法排序：成打 > 反击/卖血(落敌打子) > 堵敌打点 > 其他
    const ordered = legal.map((a) => {
        const x = a % 9, y = Math.floor(a / 9);
        const asc = game.board.get_ascend(x, y, selfStone);
        let pri = 0;
        if (asc) pri += 1000;
        if (game.board.get_stone(x, y) === foeAsc) pri += 500;
        const foeStone = self === R.BLACK ? S.WHITE : S.BLACK;
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

const evalWhiteMove = (whiteMove, depth) => {
    const g = buildGame();
    applyMove(g, [9, 4]);
    const res = applyMove(g, whiteMove);
    if (!res.legal) return null;
    if (res.winner !== undefined) return { winner: res.winner, value: res.winner === R.WHITE ? WIN : -WIN, hp: [...g.state.hp] };
    const value = search(g, depth, -Infinity, Infinity);
    return { winner: undefined, value, hp: [...g.state.hp] };
};

console.log('\n=== 黑落(9,4)后，白方各着法评估（迭代加深，value>0 白优 / <0 黑优）===');
const depth = Number(process.argv[2] || 4);
const legalWhite = RulesRuntime.legalMoves(afterBlack);
const rows = [];
for (const a of legalWhite) {
    const x = a % 9, y = Math.floor(a / 9);
    const d = B2D([x, y]);
    const ev = evalWhiteMove(d, depth);
    if (!ev) continue;
    const asc = afterBlack.board.get_ascend(x, y, S.WHITE);
    const p = asc ? tactics.powerOf(asc) : null;
    rows.push({ d, a, value: ev.value, hp: ev.hp, M: p ? p.M : 0, MN: p ? p.MN : 0, isAsc: Boolean(asc) });
}
rows.sort((u, v) => v.value - u.value || v.MN - u.MN || u.a - v.a);
rows.slice(0, 14).forEach((row) => {
    const tag = row.value >= WIN ? '白胜' : row.value <= -WIN ? '黑胜' : row.value > 0 ? '白优' : row.value < 0 ? '黑优' : '未定';
    console.log(`  白${fmtD(row.d)}  成打=${row.isAsc ? `M=${row.M} M+N=${row.MN}` : '否'}  → ${tag} (value=${row.value}, HP 黑=${row.hp[0]}/白=${row.hp[1]})`);
});
console.log(`\n(节点数 ${nodes}, 深度 ${depth})`);

// ---------- 现有 AI 的选择 ----------
const ai = tactics.chooseMove(afterBlack);
if (ai) {
    console.log(`\n=== 现有残局 AI 选择: reason=${ai.reason} display${fmtD(B2D([ai.x, ai.y]))} detail=${JSON.stringify(ai.detail)} ===`);
}