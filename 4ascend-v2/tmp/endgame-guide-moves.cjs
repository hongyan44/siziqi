/*
 * 残局「引导落子」回归：作者定义的引导落子点（guide_moves）编解码与提示控制器。
 * 运行： node tmp/endgame-guide-moves.cjs
 *
 * 覆盖：
 *   A. 存档格式 V5：带引导点 / 空引导点 / 重复坐标往返；非法数据拒绝；
 *   B. 向后兼容：HEAD 的旧编码器产出的存档仍可被新版解码，且 guide_moves 回退为空；
 *   C. create_guide 控制器：命中推进、未命中取消后续全部引导、走完全部、reset；
 *   D. 页面接线守卫：submit.html / challenge.html 必须接入引导落子功能。
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

const { EndgameArchive, create_guide } = evaluate(path.join(globalDir, 'endgame.cjs')).window.EndgameExports;

// ---------- A. 存档格式 V4 ----------
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

const withGuide = { ...base, guideMoves: [[4, 4], [5, 5], [5, 5]] };
const guideLoaded = EndgameArchive.decode(EndgameArchive.encode(withGuide));
assert.equal(guideLoaded.version, 5, 'V5 存档版本号必须为 5');
same(guideLoaded.guide_moves, [[4, 4], [5, 5], [5, 5]], '引导落子点往返必须完全一致（含重复坐标）');
same(guideLoaded.black_book, [[4, 4], [5, 5]], '正着记录不得被引导段影响');
same(guideLoaded.white_turns, [[4, 5], [5, 3]], '白方预案不得被引导段影响');
assert.equal(guideLoaded.cells[5 * boardSize + 4].plant, 2, '草数不得被引导段影响');

const emptyLoaded = EndgameArchive.decode(EndgameArchive.encode(base));
same(emptyLoaded.guide_moves, [], '未定义引导落子点时应为空数组');

const reject = (label, data) => {
    let thrown = false;
    try { EndgameArchive.encode(data); } catch (_) { thrown = true; }
    assert.ok(thrown, `${label} 应被拒绝`);
};
reject('非数组引导点', { ...base, guideMoves: 'nope' });
reject('非法引导点坐标', { ...base, guideMoves: [[9, 0]] });
reject('引导点坐标位数不足', { ...base, guideMoves: [[1]] });
reject('引导点条数超上限', { ...base, guideMoves: Array.from({ length: 256 }, () => [0, 0]) });

// ---------- B. 向后兼容旧版本（HEAD 编码器产出的既有存档） ----------
const legacyText = execSync('git show HEAD:4ascend-v2/js/global/endgame.cjs', { cwd: repoRoot, encoding: 'utf8' });
const legacyArchive = evaluate(path.join(globalDir, '__legacy_endgame.cjs'), legacyText).window.EndgameExports.EndgameArchive;
const legacyLoaded = EndgameArchive.decode(legacyArchive.encode(base));
assert.ok(legacyLoaded.version < 5, '旧版存档仍必须可解码，且版本低于当前写入版本 5');
same(legacyLoaded.guide_moves, [], '旧版存档未定义引导落子段，应回退为空数组');
same(legacyLoaded.black_book, [[4, 4], [5, 5]], '旧版正着仍需保留');

// ---------- C. create_guide 控制器 ----------
// C1: 命中当前引导点应推进到下一个
let guide = create_guide([[1, 1], [2, 2], [3, 3]]);
assert.equal(guide.active(), true, '有引导点时应处于激活状态');
same(guide.current(), [1, 1], '首个引导点应为首个坐标');
let step = guide.advance(1, 1);
assert.equal(step.matched, true, '命中引导点应判定为命中');
assert.equal(step.active, true, '命中后仍有后续引导点');
assert.equal(step.done, false, '命中后不应判定为走完');
same(guide.current(), [2, 2], '命中后应推进到下一个引导点');

// C2: 走完全部引导点后不再激活
step = guide.advance(2, 2);
assert.equal(step.matched, true, '第二个引导点应命中');
assert.equal(step.active, true, '仍有最后一个引导点');
step = guide.advance(3, 3);
assert.equal(step.done, true, '走完全部引导点后应判定为完成');
assert.equal(step.active, false, '走完后不应继续激活');
assert.equal(guide.current(), null, '走完后不应再有当前引导点');
assert.equal(guide.advance(0, 0).matched, false, '走完后再次落子不应命中引导');

// C3: 未按引导落子应取消后续全部引导
guide = create_guide([[1, 1], [2, 2], [3, 3]]);
step = guide.advance(5, 5);
assert.equal(step.matched, false, '偏离引导点不应判定为命中');
assert.equal(step.cancelled, true, '偏离引导点必须取消引导');
assert.equal(step.active, false, '取消后不应继续激活');
assert.equal(guide.active(), false, '取消状态必须保持');
assert.equal(guide.current(), null, '取消后不应再有当前引导点');
// 取消后即使命中后续坐标也不恢复
step = guide.advance(2, 2);
assert.equal(step.active, false, '取消后命中后续坐标也不得恢复引导');
assert.equal(step.cancelled, true, '取消状态必须保持');

// C4: 先命中一次再偏离，也必须取消剩下的全部引导
guide = create_guide([[1, 1], [2, 2], [3, 3]]);
guide.advance(1, 1);
assert.equal(guide.active(), true, '命中首点后应仍有引导');
guide.advance(9, 9);
assert.equal(guide.active(), false, '中途偏离必须取消后续引导');
assert.equal(guide.current(), null, '中途偏离后不应再有当前引导点');

// C5: reset 恢复初始状态
guide.reset();
assert.equal(guide.active(), true, 'reset 后应重新激活');
same(guide.current(), [1, 1], 'reset 后应回到首个引导点');

// C6: 重复坐标按顺序逐次命中（允许重叠/多个）
guide = create_guide([[4, 4], [4, 4]]);
assert.equal(guide.advance(4, 4).matched, true, '首次命中重复坐标应推进');
assert.equal(guide.active(), true, '重复坐标应各计一次');
assert.equal(guide.advance(4, 4).done, true, '第二次相同坐标应走完');
assert.equal(guide.active(), false, '重复坐标走完后不应继续激活');

// C7: 空引导点与非法坐标过滤
guide = create_guide([]);
assert.equal(guide.active(), false, '空引导点不应激活');
assert.equal(guide.current(), null, '空引导点不应有当前点');
assert.equal(guide.advance(0, 0).matched, false, '空引导点落子不应命中');
guide = create_guide([[0, 0], [9, 9], [1, 1]]);
same(guide.current(), [0, 0], '非法坐标应被过滤，首个合法点仍是当前点');
guide.advance(0, 0);
same(guide.current(), [1, 1], '过滤后应直接指向下一个合法点');
guide.advance(1, 1);
assert.equal(guide.active(), false, '过滤非法坐标后应正常走完');

// ---------- D. 页面接线守卫 ----------
const submitHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'submit.html'), 'utf8');
assert.ok(submitHtml.includes('guideMoves'), 'submit.html 导出数据必须包含 guideMoves');
assert.ok(submitHtml.includes('renderGuide'), 'submit.html 必须渲染引导落子点列表');
assert.ok(submitHtml.includes('draw_guide'), 'submit.html 必须在棋盘上绘制引导落子点');
assert.ok(submitHtml.includes("tool === 'guide'"), 'submit.html 必须提供引导落子工具分支');
assert.ok(submitHtml.includes('guide_moves'), 'submit.html 载入残局码时必须读取 guide_moves');
assert.ok(submitHtml.includes("border:1.5px dashed #ff2d2d"), 'submit.html 引导落子点必须用红色虚线表示');

const challengeHtml = fs.readFileSync(path.join(globalDir, '..', '..', 'html', 'endgame', 'challenge.html'), 'utf8');
assert.ok(challengeHtml.includes("id='canvas_guide'"), 'challenge.html 必须提供引导落子覆盖画布');
assert.ok(challengeHtml.includes('create_guide'), 'challenge.html 必须使用 create_guide 控制器');
assert.ok(challengeHtml.includes('guide_moves'), 'challenge.html 必须读取残局码里的 guide_moves');
assert.ok(challengeHtml.includes('advanceGuide'), 'challenge.html 玩家落子后必须推进/取消引导');
assert.ok(challengeHtml.includes('lineDashOffset'), 'challenge.html 引导虚线圈必须旋转动画');
assert.ok(challengeHtml.includes('archiveMoveToBoard'), 'challenge.html 引导点坐标必须按显示坐标翻转到棋盘坐标');

console.log('endgame-guide-moves: PASS');
