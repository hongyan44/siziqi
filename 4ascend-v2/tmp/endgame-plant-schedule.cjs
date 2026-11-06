/*
 * 残局「刷草编辑」回归：作者定义的定时刷草计划（plant_schedule）编解码与运行时调度。
 * 运行： node tmp/endgame-plant-schedule.cjs
 *
 * 覆盖：
 *   A. 存档格式 V3：带刷草计划 / 空计划往返；非法计划拒绝；
 *   B. 向后兼容：用 HEAD 的 V2 编码器产出的存档仍可被新版解码；
 *   C. RulesRuntime.applyScheduledPlants：
 *      回合触发、只触发一次、宿主过滤（棋子/二草跳过，USED 空位可落）、
 *      ASCEND START 不落草且保持待触发；
 *   D. 快照往返与 fork：plant_schedule / plant_fired 不丢失、不重复触发。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const globalDir = path.resolve(__dirname, '..', 'js', 'global');

// 加载器：js/global 下依赖文件用 ESM `export {}`，需改写为 CommonJS 后执行。
const moduleCache = new Map();
function evaluate(file, textOverride) {
    if (!textOverride && moduleCache.has(file)) return moduleCache.get(file);
    const module = { exports: {} };
    const record = { module, window: {} };
    moduleCache.set(file, record);
    const raw = textOverride || fs.readFileSync(file, 'utf8');
    const text = raw.replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    const sandbox = {
        module,
        exports: module.exports,
        window: record.window,
        console,
        require: (p) => (p.startsWith('.') ? evaluate(path.resolve(path.dirname(file), p)).module.exports : require(p)),
        __dirname: path.dirname(file),
        __filename: file,
        Uint8Array, Uint16Array, Int8Array, ArrayBuffer,
        Array, Number, Math, Boolean, String, Map, Set, WeakMap, Object, Symbol, JSON, Date, RegExp,
        TypeError, RangeError, Error, Promise, Infinity, NaN, isNaN, parseInt, parseFloat, Buffer,
    };
    vm.runInNewContext(text, sandbox, { filename: file });
    return record;
}

const boardSize = 9;
// vm 沙盒内产生的数组/对象属于另一个 realm，先转成本 realm 的纯数据再比较。
const plain = (value) => JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message);
const cells = Array.from({ length: boardSize * boardSize }, () => ({ stone: 'none', plant: 0 }));
cells[4 * boardSize + 4] = { stone: 'black', plant: 1 };
cells[5 * boardSize + 4] = { stone: 'white', plant: 2 };
cells[3 * boardSize + 3] = { stone: 'none', plant: 1 };

const { EndgameArchive } = evaluate(path.join(globalDir, 'endgame.cjs')).window.EndgameExports;

// ---------- A. 存档格式 V3 ----------
const base = {
    cells,
    player: 'black',
    first: 'black',
    natural_plant: false,
    hp: { black: 8, white: 3 },
    blackBook: [[4, 4], [5, 5]],
    whiteTurns: [[4, 5], [5, 3]],
    fallback: { level: 2 },
};

const withSchedule = { ...base, plantSchedule: [{ turn: 1, cells: [[0, 0], [8, 8]] }, { turn: 5, cells: [[4, 0]] }] };
const scheduleText = EndgameArchive.encode(withSchedule);
const scheduleLoaded = EndgameArchive.decode(scheduleText);
assert.equal(scheduleLoaded.version, 5, 'V5 存档版本号必须为 5');
same(
    scheduleLoaded.plant_schedule,
    [{ turn: 1, cells: [[0, 0], [8, 8]] }, { turn: 5, cells: [[4, 0]] }],
    '刷草计划往返必须完全一致'
);
assert.equal(scheduleLoaded.cells[4 * boardSize + 4].stone, 'black', '棋子不得被刷草段影响');
same(scheduleLoaded.black_book, [[4, 4], [5, 5]], '正着记录不得被刷草段影响');

const emptyLoaded = EndgameArchive.decode(EndgameArchive.encode(base));
same(emptyLoaded.plant_schedule, [], '未定义刷草计划时应为空数组');

const reject = (label, data) => {
    let thrown = false;
    try { EndgameArchive.encode(data); } catch (_) { thrown = true; }
    assert.ok(thrown, `${label} 应被拒绝`);
};
reject('非数组刷草计划', { ...base, plantSchedule: 'nope' });
reject('非法刷草点坐标', { ...base, plantSchedule: [{ turn: 1, cells: [[9, 0]] }] });
reject('刷草点非数组', { ...base, plantSchedule: [{ turn: 1, cells: 'x' }] });
reject('回合超范围', { ...base, plantSchedule: [{ turn: 70000, cells: [] }] });
reject('计划条数超上限', { ...base, plantSchedule: Array.from({ length: 256 }, () => ({ turn: 1, cells: [] })) });

// ---------- B. 向后兼容旧版本（HEAD 编码器产出的既有存档） ----------
const legacyText = execSync('git show HEAD:4ascend-v2/js/global/endgame.cjs', { cwd: repoRoot, encoding: 'utf8' });
const legacyArchive = evaluate(path.join(globalDir, '__legacy_endgame.cjs'), legacyText).window.EndgameExports.EndgameArchive;
const legacyText2 = legacyArchive.encode(base);
const legacyLoaded = EndgameArchive.decode(legacyText2);
assert.ok(legacyLoaded.version < 5, '旧版存档仍必须可解码，且版本低于当前写入版本 5');
same(legacyLoaded.guide_moves, [], '旧版存档未定义引导落子段，应回退为空数组');
same(legacyLoaded.ai_preset, [], '旧版存档没有 AI 预设段，应回退为空数组');
same(legacyLoaded.plant_schedule, [], '旧版存档没有刷草计划时应回退为空数组');
assert.equal(legacyLoaded.hp.black, 8, '旧版 hp 必须保留');
assert.equal(legacyLoaded.cells[5 * boardSize + 4].plant, 2, '旧版草数必须保留');
same(legacyLoaded.white_turns, [[4, 5], [5, 3]], '旧版白方预案必须保留');

// ---------- C/D. 运行时调度 ----------
const { RulesRuntime } = evaluate(path.join(globalDir, 'fascend', 'runtime.cjs')).module.exports;
const { STONE_ENUM, PLANT_ENUM, ASCEND_ENUM } = evaluate(path.join(globalDir, 'fascend', 'enum.cjs')).module.exports;

const makeSnapshot = (over) => Object.assign({
    version: 2, mode: 'normal', width: 9, height: 9,
    stones: new Array(81).fill(0),
    plants: new Array(81).fill(0),
    turns: [], turnPlayer: 0, firstPlayer: 0,
    turnCount: 0, turnPos: [0, 0], ascendStatus: 0,
    hp: [6, 6], pendingDamage: null, unascendCharge: 25,
    fastUnascendCharge: [9, 9], growCount: 11, justUnascend: false, overStatus: 0,
    history: [], randAic: { seed: 1, states: [1, 2, 3, 4] }, randUnity: { seed: 100, states: [1, 2, 3, 4] },
    naturalPlant: false, alwaysOverload: false, plantSchedule: [], plantFired: [],
}, over || {});

const at = (x, y) => y * 9 + x;

// C1: 回合触发 + 只触发一次
let game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }];
const first = RulesRuntime.applyScheduledPlants(game);
assert.equal(first.length, 1, '第 1 回合应落 1 草');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.ONE, '落草点应为 1 草');
same(RulesRuntime.applyScheduledPlants(game), [], '同一条计划不得重复触发');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.ONE, '重复调用不得叠加为 2 草');

// C2: turn_count < turn 不触发，达到后触发
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 3, cells: [[2, 2]] }];
same(RulesRuntime.applyScheduledPlants(game), [], '未到回合不得触发');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.NONE, '未到回合不得落草');
game.state.turn_count = 3;
assert.equal(RulesRuntime.applyScheduledPlants(game).length, 1, '到达回合后必须触发');

// C3: 棋子占位跳过（但仍标记已触发）
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }];
game.board.set_stone(2, 2, STONE_ENUM.BLACK);
same(RulesRuntime.applyScheduledPlants(game), [], '棋子占位时应跳过');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.NONE, '棋子占位时不得落草');
assert.ok(game.plant_fired.has(0), '跳过的条目也应标记已触发，避免后续回合反复尝试');

// C4: 二草占位跳过
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }];
game.board.set_plant(2, 2, PLANT_ENUM.TWO);
same(RulesRuntime.applyScheduledPlants(game), [], '二草点应跳过');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.TWO, '二草点草数不得变化');

// C5: USED 空位可以落草
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }];
game.board.set_stone(2, 2, STONE_ENUM.BLACK_USED);
assert.equal(RulesRuntime.applyScheduledPlants(game).length, 1, 'USED 空位应可落草');
assert.equal(game.board.get_plant(2, 2), PLANT_ENUM.ONE, 'USED 空位应落 1 草');

// C6: ASCEND START 阶段不落草且不消耗触发
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1, ascendStatus: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }];
same(RulesRuntime.applyScheduledPlants(game), [], 'ASCEND START 阶段不得落草');
assert.equal(game.plant_fired.size, 0, 'ASCEND START 阶段不得消耗触发标记');
game.state.ascend_status = ASCEND_ENUM.NONE;
assert.equal(RulesRuntime.applyScheduledPlants(game).length, 1, 'ASCEND 结束后应补落');

// D: 快照往返 + fork
game = RulesRuntime.fromSnapshot(makeSnapshot({ turnCount: 1 }));
game.plant_schedule = [{ turn: 1, cells: [[2, 2]] }, { turn: 4, cells: [[6, 6]] }];
RulesRuntime.applyScheduledPlants(game);
const restored = RulesRuntime.fromSnapshot(RulesRuntime.snapshot(game));
same(
    restored.plant_schedule.map((e) => ({ turn: e.turn, cells: e.cells })),
    [{ turn: 1, cells: [[2, 2]] }, { turn: 4, cells: [[6, 6]] }],
    '快照往返必须保留刷草计划'
);
assert.ok(restored.plant_fired.has(0), '快照往返必须保留已触发标记');
same(RulesRuntime.applyScheduledPlants(restored), [], '恢复后不得重复触发旧条目');

const forked = RulesRuntime.fork(game);
same(
    forked.plant_schedule.map((e) => ({ turn: e.turn, cells: e.cells })),
    restored.plant_schedule.map((e) => ({ turn: e.turn, cells: e.cells })),
    'fork 必须复制刷草计划'
);
assert.ok(forked.plant_fired.has(0), 'fork 必须复制已触发标记');
assert.notEqual(forked.plant_fired, game.plant_fired, 'fork 的已触发集合必须是独立副本');

// ---------- 页面接线守卫 ----------
const challengeHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'challenge.html'), 'utf8');
assert.ok(challengeHtml.includes('applyScheduledPlants'), 'challenge.html 必须调用 applyScheduledPlants 应用定时刷草');
assert.ok(challengeHtml.includes('plant_schedule'), 'challenge.html 必须读取残局码里的 plant_schedule');
assert.ok(challengeHtml.includes('archiveMoveToBoard'), 'challenge.html 刷草点必须按显示坐标翻转到棋盘坐标');

const submitHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'submit.html'), 'utf8');
assert.ok(submitHtml.includes('plantSchedule'), 'submit.html 导出数据必须包含 plantSchedule');
assert.ok(submitHtml.includes('renderSchedule'), 'submit.html 必须渲染刷草计划列表');
assert.ok(submitHtml.includes("tool === 'schedule'"), 'submit.html 必须提供刷草点工具分支');

console.log('endgame-plant-schedule: PASS');
