/*
 * 残局「AI 预设」回归：作者定义的白方 AI 无条件落子队列（ai_preset）编解码与控制语义。
 * 运行： node tmp/endgame-ai-preset.cjs
 *
 * 覆盖：
 *   A. 存档格式 V5：带 AI 预设 / 空预设 / 重复坐标往返；非法数据拒绝；
 *   B. 向后兼容：HEAD 的旧编码器产出的存档仍可被新版解码，且 ai_preset 回退为空；
 *   C. create_ai_preset 控制器：依序取值、每一步都消耗（含不可落子步）、走完、reset、非法坐标过滤；
 *   D. 页面接线守卫：submit.html / challenge.html 必须接入 AI 预设功能。
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

const { EndgameArchive, create_ai_preset } = evaluate(path.join(globalDir, 'endgame.cjs')).window.EndgameExports;

// ---------- A. 存档格式 V5 ----------
const base = {
    cells,
    player: 'black',
    first: 'black',
    natural_plant: false,
    hp: { black: 8, white: 3 },
    blackBook: [[4, 4], [5, 5]],
    whiteTurns: [[4, 5], [5, 3]],
    guideMoves: [[1, 1]],
    fallback: { level: 2 },
};

const withAi = { ...base, aiPreset: [[6, 6], [6, 6], [7, 7]] };
const aiLoaded = EndgameArchive.decode(EndgameArchive.encode(withAi));
assert.equal(aiLoaded.version, 5, 'V5 存档版本号必须为 5');
same(aiLoaded.ai_preset, [[6, 6], [6, 6], [7, 7]], 'AI 预设往返必须完全一致（含重复坐标）');
same(aiLoaded.guide_moves, [[1, 1]], '引导落子段不得被 AI 预设段影响');
same(aiLoaded.black_book, [[4, 4], [5, 5]], '正着记录不得被 AI 预设段影响');
same(aiLoaded.white_turns, [[4, 5], [5, 3]], '白方预案不得被 AI 预设段影响');
assert.equal(aiLoaded.cells[5 * boardSize + 4].plant, 2, '草数不得被 AI 预设段影响');

const emptyLoaded = EndgameArchive.decode(EndgameArchive.encode(base));
same(emptyLoaded.ai_preset, [], '未定义 AI 预设时应为空数组');

const reject = (label, data) => {
    let thrown = false;
    try { EndgameArchive.encode(data); } catch (_) { thrown = true; }
    assert.ok(thrown, `${label} 应被拒绝`);
};
reject('非数组 AI 预设', { ...base, aiPreset: 'nope' });
reject('非法 AI 预设坐标', { ...base, aiPreset: [[9, 0]] });
reject('AI 预设坐标位数不足', { ...base, aiPreset: [[1]] });
reject('AI 预设条数超上限', { ...base, aiPreset: Array.from({ length: 256 }, () => [0, 0]) });

// ---------- B. 向后兼容旧版本（HEAD 编码器产出的既有存档） ----------
const legacyText = execSync('git show HEAD:4ascend-v2/js/global/endgame.cjs', { cwd: repoRoot, encoding: 'utf8' });
const legacyArchive = evaluate(path.join(globalDir, '__legacy_endgame.cjs'), legacyText).window.EndgameExports.EndgameArchive;
const legacyLoaded = EndgameArchive.decode(legacyArchive.encode(base));
assert.ok(legacyLoaded.version < 5, '旧版存档仍必须可解码，且版本低于当前写入版本 5');
same(legacyLoaded.ai_preset, [], '旧版存档没有 AI 预设段，应回退为空数组');
same(legacyLoaded.guide_moves, [[1, 1]], '旧版已有的引导落子段必须保留');
same(legacyLoaded.black_book, [[4, 4], [5, 5]], '旧版正着仍需保留');

// ---------- C. create_ai_preset 控制器 ----------
// C1: 依序取值，每一步都消耗
let preset = create_ai_preset([[1, 1], [2, 2], [3, 3]]);
assert.equal(preset.active(), true, '有预设时应处于激活状态');
same(preset.next(), [1, 1], '首个预设步应为首个坐标');
preset.advance();
same(preset.next(), [2, 2], '推进后应指向下一步');
preset.advance();
same(preset.next(), [3, 3], '再次推进后应指向最后一步');
preset.advance();
assert.equal(preset.active(), false, '走完全部预设后不应继续激活');
assert.equal(preset.next(), null, '走完后不应再有当前预设步');

// C2: 不可落子步同样消耗（advance 与是否可落子无关）
preset = create_ai_preset([[1, 1], [2, 2]]);
same(preset.next(), [1, 1], '首步应为 [1,1]');
preset.advance();
same(preset.next(), [2, 2], '即使 [1,1] 不可落子也应消耗并推进到 [2,2]');

// C3: reset 恢复初始状态
preset = create_ai_preset([[1, 1], [2, 2]]);
preset.advance();
preset.reset();
assert.equal(preset.active(), true, 'reset 后应重新激活');
same(preset.next(), [1, 1], 'reset 后应回到首个预设步');

// C4: 空预设与非法坐标过滤
preset = create_ai_preset([]);
assert.equal(preset.active(), false, '空预设不应激活');
assert.equal(preset.next(), null, '空预设不应有当前步');
assert.equal(preset.advance(), 0, '空预设推进不应报错');
preset = create_ai_preset([[0, 0], [9, 9], [1, 1]]);
same(preset.next(), [0, 0], '非法坐标应被过滤，首个合法步仍是当前步');
preset.advance();
same(preset.next(), [1, 1], '过滤后应直接指向下一个合法步');
assert.equal(preset.snapshot().total, 2, '非法坐标不应计入预设总步数');

// ---------- D. 页面接线守卫 ----------
const submitHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'submit.html'), 'utf8');
assert.ok(submitHtml.includes('aiPreset'), 'submit.html 导出数据必须包含 aiPreset');
assert.ok(submitHtml.includes('renderAiPreset'), 'submit.html 必须渲染 AI 预设列表');
assert.ok(submitHtml.includes('draw_ai_preset'), 'submit.html 必须在棋盘上绘制 AI 预设');
assert.ok(submitHtml.includes("tool === 'ai'"), 'submit.html 必须提供 AI 预设工具分支');
assert.ok(submitHtml.includes('data.ai_preset'), 'submit.html 载入残局码时必须读取 ai_preset');
assert.ok(submitHtml.includes('border:1.5px dashed #2563eb'), 'submit.html AI 预设必须用蓝色虚线表示');
assert.ok(submitHtml.includes("id='tool_ai'"), 'submit.html 必须提供 AI 预设工具按钮');

const challengeHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'challenge.html'), 'utf8');
assert.ok(challengeHtml.includes('create_ai_preset'), 'challenge.html 必须使用 create_ai_preset 控制器');
assert.ok(challengeHtml.includes('challengeData.ai_preset'), 'challenge.html 必须读取残局码里的 ai_preset');
assert.ok(challengeHtml.includes('presetActive'), 'challenge.html 白方回合必须优先判断 AI 预设');
assert.ok(challengeHtml.includes('aiPreset'), 'challenge.html 必须持有 AI 预设控制器状态');

console.log('endgame-ai-preset: PASS');
