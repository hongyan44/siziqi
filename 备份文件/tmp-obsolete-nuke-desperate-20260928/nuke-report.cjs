/*
 * 核弹报告：解码残局码 → 以用户坐标系(列1..9左→右, 行1..9下→上)打印盘面
 * → 统计白方每个空点落子后的 ASCEND 力度 M / 触发点 → 找出能成核弹(M>=7)的点。
 * 运行： node tmp/nuke-report.cjs "tmp/endgame-code.txt"
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
const { EndgameTactics } = load('endgame_tactics.cjs');
const { RulesRuntime } = load('runtime.cjs');
const { STONE_ENUM: S, PLANT_ENUM: P } = load('enum.cjs');
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
loadGlobal('endgame.cjs');

const codePath = process.argv[2] || path.resolve(__dirname, 'endgame-code.txt');
const rawCode = fs.readFileSync(codePath, 'utf8').trim();
const data = globalThis.EndgameExports.EndgameArchive.decode(rawCode);
const snap = data.snapshot || {};
const hp = Array.isArray(snap.hp) ? snap.hp : [data.hp.black, data.hp.white];

// 用户坐标系：列 R(1..9) 左→右；行 C(1..9) 下→上。
// board API（左上原点）坐标 (x, y) ⇄ 用户坐标 (x+1, 9-y)
const B2U = ([x, y]) => [x + 1, 9 - y];
const U2B = ([R, C]) => [R - 1, 9 - C];
const U = (p) => `(${B2U([p.x, p.y]).join(',')})`;

const name = (s) => ({ 'black': 'B', 'white': 'W', 'black-ascend': 'b', 'white-ascend': 'w', 'black-used': 'x', 'white-used': 'y' }[s] || '.');

// 解码盘面：archive 行 y=0 在底部（编辑器显示系左下原点）
// index = (C-1)*9 + (R-1)  →  用户坐标 (R, C)
const toStoneName = (code) => {
    if (typeof code === 'string') return code;
    return ['none', 'black', 'white', 'black-ascend', 'white-ascend', 'black-used', 'white-used'][Number(code)] || 'none';
};
const stoneAt = (R, C) => toStoneName(snap.stones[(C - 1) * 9 + (R - 1)]);
const plantAt = (R, C) => Number((snap.plants || [])[(C - 1) * 9 + (R - 1)]) || 0;

const build = (extraBlack) => {
    const board = new Board(9, 9);
    for (let C = 1; C <= 9; C++) for (let R = 1; R <= 9; R++) {
        const n = stoneAt(R, C);
        const st = ({ 'black': S.BLACK, 'white': S.WHITE, 'black-ascend': S.BLACK_ASCEND, 'white-ascend': S.WHITE_ASCEND })[n] || S.NONE;
        const [x, y] = U2B([R, C]);
        const pv = plantAt(R, C);
        board.set_pos(x, y, st, pv === 2 ? P.TWO : pv === 1 ? P.ONE : P.NONE);
    }
    if (extraBlack) { const [x, y] = U2B(extraBlack); board.set_pos(x, y, S.BLACK, P.NONE); }
    return board;
};

console.log(`=== 残局码 ${path.basename(codePath)} ===  hp 黑/白 = ${hp[0]}/${hp[1]}  轮到 = ${snap.turnPlayer === 1 ? '白' : '黑'}`);
console.log('=== 盘面（列1..9 左→右；行1..9 下→上）===');
console.log('      列1 列2 列3 列4 列5 列6 列7 列8 列9');
for (let C = 9; C >= 1; C--) {
    let line = `行${C}  `;
    for (let R = 1; R <= 9; R++) line += '  ' + name(stoneAt(R, C)) + ' ';
    console.log(line);
}

const bestM = (board, stone) => {
    let best = null;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        if (board.get_stone(x, y) !== S.NONE) continue;
        const pts = board.get_ascend(x, y, stone);
        if (!pts) continue;
        const p = tactics.powerOf(pts);
        if (!best || p.M > best.M || (p.M === best.M && p.MN > best.MN)) best = { M: p.M, MN: p.MN, x, y };
    }
    return best;
};

const report = (label, board) => {
    console.log(`\n===== ${label} =====`);
    const rows = [];
    for (let C = 1; C <= 9; C++) for (let R = 1; R <= 9; R++) {
        const [x, y] = U2B([R, C]);
        if (board.get_stone(x, y) !== S.NONE) continue;
        const pts = board.get_ascend(x, y, S.WHITE);
        if (!pts) { rows.push({ R, C, M: 0, MN: 0, nuke: false }); continue; }
        const p = tactics.powerOf(pts);
        rows.push({ R, C, M: p.M, MN: p.MN, nuke: p.M >= 7 });
    }
    rows.sort((a, b) => (b.M - a.M) || (b.MN - a.MN));
    console.log('  白方落子 → 该手形成的 ASCEND 力度（M 降序前 12）：');
    rows.slice(0, 12).forEach((r) => {
        console.log(`    用户坐标(${r.R},${r.C})  M=${r.M} MN=${r.MN}${r.nuke ? '   <<< 核弹(M>=7)' : ''}`);
    });
    const nukes = rows.filter((r) => r.nuke);
    console.log(`  >>> 本手可直接成核弹的落点：${nukes.length ? nukes.map((r) => `(${r.R},${r.C})`).join(' ') : '无'}`);

    // 二步潜力：白落子后，白方下一手最大可成 M
    const plan = [];
    for (let C = 1; C <= 9; C++) for (let R = 1; R <= 9; R++) {
        const [x, y] = U2B([R, C]);
        if (board.get_stone(x, y) !== S.NONE) continue;
        const b2 = build();
        const [bx, by] = [x, y];
        // 复制当前 board（含可能的黑方试应手）状态
        for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 9; xx++) {
            const st = board.get_stone(xx, yy);
            if (st !== S.NONE) b2.set_pos(xx, yy, st, board.get_pos(xx, yy).plant);
        }
        b2.set_pos(bx, by, S.WHITE, P.NONE);
        const after = bestM(b2, S.WHITE);
        plan.push({ R, C, afterM: after ? after.M : 0, at: after ? B2U([after.x, after.y]).join(',') : '-' });
    }
    plan.sort((a, b) => b.afterM - a.afterM);
    console.log('  白方落子 → 落子后白方下一手最大可成 M（降序前 8）：');
    plan.slice(0, 8).forEach((r) => console.log(`    用户坐标(${r.R},${r.C})  → 之后白方最大 M=${r.afterM}${r.afterM >= 7 ? '  <<< 下一手可成核弹' : ''}  触发点(${r.at})`));
};

const base = build(null);
report('黑方未落子（残局初始，黑方行棋）', base);

const after94 = build([9, 4]);
report('黑方落子(9,4)后（白方行棋）', after94);

// 指定点核对
console.log('\n===== 指定点核对（白方落子后该手 ASCEND 力度）=====');
for (const pt of [[4, 5], [1, 9], [2, 9], [4, 6], [3, 7], [4, 7]]) {
    const [x, y] = U2B(pt);
    const board = build([9, 4]);
    const st = board.get_stone(x, y);
    if (st !== S.NONE) { console.log(`  用户坐标(${pt.join(',')})  已被占用(${name(snap.stones[(pt[1] - 1) * 9 + (pt[0] - 1)])})`); continue; }
    const pts = board.get_ascend(x, y, S.WHITE);
    const p = pts ? tactics.powerOf(pts) : null;
    console.log(`  用户坐标(${pt.join(',')})  白方落子 → ${p ? `M=${p.M} MN=${p.MN}${p.M >= 7 ? '  <<< 核弹' : ''}` : '不构成 ASCEND(四方向无满足≥3的连线)'}`);
}
