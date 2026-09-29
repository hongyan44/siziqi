/*
 * 调试：黑落 display(9,4) 后，白方各候选点的战术标志 + 分支命中。
 * 运行: node tmp/debug-position.cjs
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

const game = buildGame();
const [bmx, bmy] = D2B([9, 4]);
game.board.set_stone(bmx, bmy, S.BLACK);
game.board.turns.push([bmx, bmy]);
game.state.turn_player = R.WHITE;
game.state.turn_count += 1;

const legal = RulesRuntime.legalMoves(game);
const analysis = tactics.analyzeBoard(game, legal);
console.log('X(白/我方血量)=', analysis.X, ' Y(黑/对方血量)=', analysis.Y, ' mustAnswer=', analysis.mustAnswer, ' pendingThreat=', analysis.pendingThreat);

const rows = analysis.moves.map((m) => ({ ...m, d: B2D([m.x, m.y]) }));
const interesting = rows.filter((m) => m.formsAscend || m.selfAlign >= 3 || m.blockPoint || m.landsOnFoeAscend || m.isKill || m.winsNow);
console.log('\n候选点（白方，显示系）:');
console.log('display   formsAscend M  N  MN  selfAlign blockPoint landsOnFoeA losesNow suicidal isKill winsNow');
interesting.sort((a, b) => (b.formsAscend - a.formsAscend) || (b.selfPower.MN - a.selfPower.MN) || (a.d[1] - b.d[1]) || (a.d[0] - b.d[0]));
interesting.forEach((m) => {
    console.log(`(${m.d[0]},${m.d[1]})`.padEnd(9),
        String(m.formsAscend).padEnd(11), String(m.selfPower.M).padEnd(2), String(m.selfPower.N).padEnd(2), String(m.selfPower.MN).padEnd(3),
        String(m.selfAlign).padEnd(9), String(m.blockPoint).padEnd(10), String(m.landsOnFoeAscend).padEnd(11),
        String(m.losesNow).padEnd(8), String(m.suicidalAscend).padEnd(8), String(m.isKill).padEnd(6), String(m.winsNow));
});

const res = tactics.pickByLogic(game, analysis);
console.log('\npickByLogic →', res ? `${res.reason} display(${B2D([res.x, res.y])})` : 'null');

// 手工验证：白落 (7,2) 与 (2,9) 后，黑方最强应打
function bestReplyAfterWhite(wdx, wdy) {
    const g = buildGame();
    g.board.set_stone(bmx, bmy, S.BLACK); g.board.turns.push([bmx, bmy]);
    const [wx, wy] = D2B([wdx, wdy]);
    g.board.set_stone(wx, wy, S.WHITE); g.board.turns.push([wx, wy]);
    g.state.turn_player = R.BLACK;
    const whiteAsc = g.board.get_ascend(wx, wy, S.WHITE);
    const wp = whiteAsc ? tactics.powerOf(whiteAsc) : null;
    const r = tactics.bestReplyAscend(g, S.BLACK, S.WHITE_ASCEND);
    let cancel = null;
    if (wp && r) cancel = tactics.cancelDamage(wp.powers, r.powers);
    return { whiteAsc: wp && { M: wp.M, N: wp.N, MN: wp.MN }, reply: r && { action: r.action, d: B2D([r.x, r.y]), M: r.M, N: r.N, MN: r.MN }, cancel };
}
for (const [wx, wy] of [[7, 2], [3, 7], [2, 9], [3, 2]]) {
    const o = bestReplyAfterWhite(wx, wy);
    console.log(`白落(${wx},${wy}): 白打=${o.whiteAsc ? `M${o.whiteAsc.M}N${o.whiteAsc.N}MN${o.whiteAsc.MN}` : '不成打'} | 黑最强应打=${o.reply ? `display(${o.reply.d}) M${o.reply.M}N${o.reply.N}MN${o.reply.MN}` : '无'} | 抵消→伤白${o.cancel ? o.cancel.damageToSelf : '-'} 伤黑${o.cancel ? o.cancel.damageToFoe : '-'}`);
}