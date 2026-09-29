/*
 * 诊断：在黑方(9,4)落子后的盘面上，逐项打印 pickNukeLogic 的分支条件。
 * 用法： node tmp/debug-nuke.cjs "B:..." "W:..." "9,4" [黑hp] [白hp]
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

const parse = (s) => (s.length <= 2 ? [] : s.slice(2).split(';').map((t) => t.split(',').map(Number)));
const BLACK = parse(process.argv[2] || 'B:');
const WHITE = parse(process.argv[3] || 'W:');
const BLACK_MOVE = (process.argv[4] || '9,4').split(',').map(Number);
const HP_BLACK = Number(process.argv[5] ?? 1);
const HP_WHITE = Number(process.argv[6] ?? 1);
const U2B = ([Rr, C] = []) => [Rr - 1, 9 - C];
const B2U = ([x, y]) => [x + 1, 9 - y];

const board = new Board(9, 9);
BLACK.forEach(([Rr, C]) => { const [x, y] = U2B([Rr, C]); board.set_pos(x, y, S.BLACK, P.NONE); });
WHITE.forEach(([Rr, C]) => { const [x, y] = U2B([Rr, C]); board.set_pos(x, y, S.WHITE, P.NONE); });
const state = new State();
state.hp = [HP_BLACK, HP_WHITE];
state.turn_player = R.BLACK;
state.turn_count = 0;
state.ascend_status = A.NONE;
state.pending_damage = null;
state.unascend_charge = 25;
state.unascend_chargef = [9, 9];
state.grow_count = 11;
state.just_unascend = false;
state.over_status = O.NONE;
const game = new GameNormal(board, state, new RandAIC(0x4A534B31), new RandUnity(0x4A534B32));
game.natural_plant = false;
game.first_player = R.BLACK;
game.history_boards = [];
game.board.turns = [];
RulesRuntime.initialize(game, R.BLACK);

const [bx, by] = U2B(BLACK_MOVE);
game.board.set_stone(bx, by, S.BLACK);
game.state.turn_player = R.WHITE;

const legal = RulesRuntime.legalMoves(game);
const analysis = tactics.analyzeBoard(game, legal);
const moves = analysis.moves.filter((m) => m.legal);
const self = analysis.selfStone;
const foe = analysis.foeStone;

const P2 = (p) => (p ? `M=${p.M} MN=${p.MN}@(${B2U([p.x, p.y]).join(',')})` : '-');

console.log('X(玩家血量)=', analysis.X, ' Y(AI血量)=', analysis.Y);
console.log('mustAnswer=', analysis.mustAnswer, ' pendingThreat=', P2(analysis.pendingThreat));
console.log('foeBest(maxAscendNow 黑)=', P2(tactics.maxAscendNow(game, foe)));
console.log('selfBestResp(白本手最大 MN)=', moves.reduce((b, m) => (m.formsAscend && m.selfPower.MN > b ? m.selfPower.MN : b), 0));
console.log('foeHasUnstoppableAscend=', tactics.foeHasUnstoppableAscend(game, foe, self));

const foeBest = tactics.maxAscendNow(game, foe);
const selfBestResp = moves.reduce((b, m) => (m.formsAscend && m.selfPower.MN > b ? m.selfPower.MN : b), 0);
const foeIsNuke = Boolean((foeBest && foeBest.M >= 7) || (analysis.pendingThreat && analysis.pendingThreat.M >= 7));
const unblockable = tactics.foeHasUnstoppableAscend(game, foe, self);
const canReachNuke = moves.some((m) => m.formsAscend && !m.losesNow && !m.suicidalAscend && m.selfPower && m.selfPower.M >= 7);
console.log('foeIsNuke=', foeIsNuke, ' gap=', (foeBest ? foeBest.MN : 0) - selfBestResp, ' canReachNuke=', canReachNuke);

const killNow = moves.filter((m) => m.winsNow || m.isKill);
console.log('killNow 数量=', killNow.length, killNow.slice(0, 5).map((m) => `${m.reason || ''}(${B2U([m.x, m.y]).join(',')}) winsNow=${m.winsNow} isKill=${m.isKill}`));
const blockSeeds = moves.filter((m) => m.blockPoint && !m.losesNow && !m.suicidalAscend);
console.log('blockSeeds=', blockSeeds.length, blockSeeds.slice(0, 8).map((m) => `(${B2U([m.x, m.y]).join(',')})`));
const expands = moves.filter((m) => m.formsAscend && !m.losesNow && !m.suicidalAscend);
console.log('expands=', expands.length, expands.slice(0, 8).map((m) => `(${B2U([m.x, m.y]).join(',')})M${m.selfPower.M}`));

const nm = tactics.pickNukeLogic(game, analysis, moves);
console.log('pickNukeLogic →', nm ? `${nm.reason}(${B2U([nm.x, nm.y]).join(',')})` : 'null');
const chosen = tactics.pickByLogic(game, analysis);
console.log('pickByLogic →', chosen ? `${chosen.reason}(${B2U([chosen.x, chosen.y]).join(',')})` : 'null');

// desperate-offense 候选排序
const blocks = moves.filter((m) => m.blockPoint);
const offense = moves.filter((m) => !m.losesNow && !m.suicidalAscend && (m.formsAscend || m.selfAlign >= 3 || m.landsOnFoeAscend));
console.log('desperate-offense: blocks=', blocks.length, ' offense=', offense.length);
console.log('  offense 明细(前 12):', offense.slice(0, 12).map((m) => `(${B2U([m.x, m.y]).join(',')}) asc=${m.formsAscend ? m.selfPower.M : 0} align=${m.selfAlign} lands=${m.landsOnFoeAscend}`));
