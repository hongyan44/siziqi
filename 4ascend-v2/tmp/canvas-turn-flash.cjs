/*
 * @Description: 回归测试 —— 轮到自己回合时棋盘外缘淡绿色呼吸光晕
 *
 * 覆盖：
 *  - Canvas.set_turn_flash / start_turn_flash / tick_turn_flash / stop_turn_flash / draw_turn_flash 行为
 *  - 淡绿色与无色之间按正弦曲线平滑过渡（非 0/1 硬切换）
 *  - 单次呼吸周期 4960ms（较上一版再减半）
 *  - 光晕绘制在独立层上，不污染棋盘层
 *  - 停止后取消 rAF 并清空光晕层
 *  - 各模式集成点接线（core 四文件 + 残局挑战页 + 剧情对局页）
 *  - 构建产物已包含呼吸光晕实现
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const BASE = path.resolve(__dirname, '..');

let pass = 0;
const ok = (name) => { pass += 1; console.log(`  ✔ ${name}`); };

// ---------------- 可控时钟与 rAF ----------------
let clock = 0;
let rafSeq = 0;
let rafPending = null;
const rafMap = {};

const sandbox = {
    window: { devicePixelRatio: 1 },
    document: { getElementById: () => null, createElement: () => makeCanvas() },
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => { const id = ++rafSeq; rafMap[id] = fn; rafPending = id; return id; },
    cancelAnimationFrame: (id) => { delete rafMap[id]; if (rafPending === id) rafPending = null; },
    performance: { now: () => clock },
};

// 执行当前挂起的一帧 rAF
const frame = (now) => {
    clock = now;
    const id = rafPending;
    rafPending = null;
    if (id != null && rafMap[id]) {
        const fn = rafMap[id];
        delete rafMap[id];
        fn(now);
    }
};
const hasPendingRaf = () => rafPending != null && !!rafMap[rafPending];

// ---------------- 模块加载器（把 ESM export 改写为 CommonJS） ----------------
const runModule = (file, sandbox) => {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'(\.[^']*)';/g, (m, names, p) => `const {${names}} = require('${p}');`);
    src = src.replace(/export\s*\{([\s\S]*?)\};/g, (m, names) => `module.exports = {${names}};`);
    const module = { exports: {} };
    const requireFn = (p) => (p.startsWith('.') ? runModule(path.resolve(path.dirname(file), p), sandbox) : require(p));
    const fn = new Function(
        'module', 'exports', 'require',
        'window', 'document',
        'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
        src,
    );
    fn(module, module.exports, requireFn, sandbox.window, sandbox.document,
        sandbox.setInterval, sandbox.clearInterval, sandbox.requestAnimationFrame,
        sandbox.cancelAnimationFrame, sandbox.performance);
    return module.exports;
};

// ---------------- 假 canvas / ctx ----------------
const makeCtx = () => {
    const ops = [];
    const target = { strokeStyle: '', lineWidth: 0, globalAlpha: 1, fillStyle: '', font: '', textAlign: '', textBaseline: '' };
    const proxy = new Proxy(target, {
        get(t, prop) {
            if (prop in t) return t[prop];
            return (...args) => { ops.push({ fn: prop, args, strokeStyle: t.strokeStyle, lineWidth: t.lineWidth }); };
        },
        set(t, prop, value) { t[prop] = value; return true; },
    });
    return { ctx: proxy, ops };
};

const makeCanvas = () => {
    const paint = makeCtx();
    return {
        ops: paint.ops,
        ctx: paint.ctx,
        width: 0,
        height: 0,
        style: {},
        addEventListener() {},
        removeEventListener() {},
        getContext: () => paint.ctx,
    };
};

const buildUi = (size = 360) => {
    const canvases = Array.from({ length: 7 }, () => makeCanvas());
    const { Canvas } = runModule(path.join(BASE, 'js/global/game/canvas.cjs'), sandbox);
    const ui = new Canvas(
        canvases[0], canvases[1], canvases[2], canvases[3],
        canvases[4], canvases[5], canvases[6],
        9, 9, 0.41, 0.12, 0.062, size,
    );
    // 呼吸光晕层通常由 init() 动态创建，测试中直接注入以规避 DOM 依赖
    const glow = makeCanvas();
    ui.canvas_turn_glow = glow;
    return { ui, board: canvases[0], glow };
};

const lastStroke = (canvas) => canvas.ops.filter((op) => op.fn === 'strokeRect').at(-1);

// ============================ 1. Canvas 行为 ============================
{
    const { ui, board, glow } = buildUi();
    board.ops.length = 0;
    glow.ops.length = 0;

    // 默认不开
    assert.strictEqual(ui.turn_flash_on, false, '默认不闪烁');
    ok('默认状态下 turn_flash_on = false');

    // 开启：仅排一帧 rAF，起始相位为 0（无色）
    ui.set_turn_flash(true);
    assert.strictEqual(ui.turn_flash_on, true, '开启后 turn_flash_on = true');
    assert.strictEqual(hasPendingRaf(), true, '开启后注册一帧 rAF');
    assert.strictEqual(ui.turn_flash_start, 0, '以 performance.now() 记录起始时间');
    ok('开启后进入呼吸循环，起始相位无色');

    // 幂等：重复开启不重排 rAF
    ui.set_turn_flash(true);
    assert.strictEqual(ui.turn_flash_on, true, '重复开启仍为开启');
    ok('重复开启为幂等操作');

    // t=0 无色：光晕层只清空，不描边
    glow.ops.length = 0;
    frame(0);
    assert.strictEqual(ui.turn_flash_phase, 0, 't=0 相位为无色');
    assert.strictEqual(glow.ops.filter((op) => op.fn === 'strokeRect').length, 0, '无色相位不描边');
    assert.strictEqual(hasPendingRaf(), true, '帧循环持续排下一帧');
    ok('t=0 停留在无色相位');

    // t=1240（1/4 周期）平滑过渡到半亮；若为硬切换则只会是 0 或 1
    glow.ops.length = 0;
    frame(1240);
    assert.ok(Math.abs(ui.turn_flash_phase - 0.5) < 1e-9, 't=1240 相位约为 0.5（平滑过渡）');
    const mid = lastStroke(glow);
    assert.strictEqual(mid.strokeStyle, '#86efac', '光晕为淡绿色');
    assert.strictEqual(mid.lineWidth, 4, '光晕线宽为 4');
    assert.deepStrictEqual(mid.args, [0, 0, 360, 360], '光晕绘制在棋盘最外缘');
    ok('t=1240 平滑过渡到半亮淡绿色光晕（非硬切换）');

    // t=2480（1/2 周期）到达淡绿色峰值
    frame(2480);
    assert.ok(Math.abs(ui.turn_flash_phase - 1) < 1e-9, 't=2480 相位为淡绿色峰值');
    ok('t=2480 到达淡绿色峰值');

    // t=3720（3/4 周期）平滑回落
    frame(3720);
    assert.ok(Math.abs(ui.turn_flash_phase - 0.5) < 1e-9, 't=3720 相位回落为 0.5');
    ok('t=3720 平滑回落至半亮');

    // t=4960 回到无色，完成一个周期（周期 4960ms）
    glow.ops.length = 0;
    frame(4960);
    assert.strictEqual(ui.turn_flash_phase, 0, 't=4960 回到无色');
    assert.strictEqual(glow.ops.filter((op) => op.fn === 'strokeRect').length, 0, '回到无色后不再描边');
    ok('t=4960 完成一次呼吸周期（4960ms，频率再减半）');

    // 棋盘层未受影响：光晕只在独立层绘制
    assert.strictEqual(board.ops.filter((op) => op.fn === 'strokeRect').length, 0, '光晕不绘制在棋盘层');
    ok('光晕与棋盘内容分层，互不干扰');

    // 停止：取消 rAF 并清空光晕层
    glow.ops.length = 0;
    ui.set_turn_flash(false);
    assert.strictEqual(ui.turn_flash_on, false, '停止后 turn_flash_on = false');
    assert.strictEqual(hasPendingRaf(), false, '停止后 rAF 已取消');
    assert.ok(glow.ops.filter((op) => op.fn === 'clearRect').length >= 1, '停止后清空光晕层');
    assert.strictEqual(ui.turn_flash_phase, 0, '停止后相位归零');
    ok('停止呼吸光晕并清空光晕层');

    // 停止后不再有帧输出
    glow.ops.length = 0;
    frame(6000);
    assert.strictEqual(glow.ops.filter((op) => op.fn === 'strokeRect').length, 0, '停止后不再绘制');
    ok('停止后回到无光晕状态');
}

// ============================ 2. 各模式接线 ============================
{
    const mustHave = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少接线: ${snippet}`);
        ok(`${label} 接线正确`);
    };

    for (const core of ['ai', 'local', 'ranked', 'online']) {
        mustHave(`js/core/${core}.cjs`, 'gl_ui.set_turn_flash(my_turn);', `core/${core}.cjs 我方回合开启光晕`);
        mustHave(`js/core/${core}.cjs`, 'gl_ui.set_turn_flash(false);', `core/${core}.cjs` + ' 对局结束停止光晕');
    }

    mustHave('html/endgame/challenge.html', 'ui.set_turn_flash(Boolean(playerTurn) && !challengeOver);', '残局挑战页');
    mustHave('html/docs/story-play.html', 'ui.set_turn_flash(Boolean(playerTurn) && !gameOver);', '剧情对局页');
}

// ============================ 3. 构建产物已更新 ============================
{
    const builtGame = fs.readFileSync(path.join(BASE, 'root/js/global/game.min.js'), 'utf8');
    assert.ok(builtGame.includes('tick_turn_flash') && builtGame.includes('#86efac'), 'game.min.js 已包含呼吸光晕实现');
    ok('root/js/global/game.min.js 已包含呼吸光晕实现');

    for (const core of ['ai', 'local', 'ranked', 'online']) {
        const built = fs.readFileSync(path.join(BASE, `root/js/core/${core}.min.js`), 'utf8');
        assert.ok(built.includes('set_turn_flash'), `root/js/core/${core}.min.js 已包含光晕调用`);
    }
    ok('root/js/core/{ai,local,ranked,online}.min.js 均已包含光晕调用');
}

console.log(`\nPASS （共 ${pass} 项断言）`);
