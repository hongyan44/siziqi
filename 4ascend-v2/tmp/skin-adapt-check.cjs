/*
 * @Description: 回归测试 —— 棋子 / 反曲点皮肤全适配
 *
 * 覆盖：
 *  - skin.cjs：已购缓存、本地开关、旧缓存兼容、皮肤绘制有效性
 *  - Canvas：常态棋子、草、ASCEND 原位草点按皮肤绘制
 *  - AscendFx：盘旋棋子、草粒按皮肤绘制
 *  - 残局投稿编辑器与残局入口预览接入皮肤
 *  - 本地设置新增皮肤开关并持久化到 4a_skin_prefs
 *  - 构建产物已包含皮肤实现
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const BASE = path.resolve(__dirname, '..');

let pass = 0;
const ok = (name) => { pass += 1; console.log(`  ✔ ${name}`); };

// ---------------- 假 localStorage ----------------
const makeStorage = () => {
    const map = new Map();
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: (key) => map.delete(key),
    };
};

let storage = makeStorage();

// ---------------- 假 canvas / ctx ----------------
const makeCtx = () => {
    const ops = [];
    const target = {
        strokeStyle: '', lineWidth: 0, globalAlpha: 1, fillStyle: '', font: '',
        textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0, lineCap: 'butt',
    };
    const gradient = () => ({
        stops: [],
        addColorStop(offset, color) { this.stops.push([offset, color]); },
    });
    const proxy = new Proxy(target, {
        get(t, prop) {
            if (prop in t) return t[prop];
            if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
                return (...args) => { const g = gradient(); ops.push({ fn: prop, args, gradient: g }); return g; };
            }
            if (prop === 'createImageData') {
                return (width, height) => {
                    const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
                    ops.push({ fn: prop, args: [width, height], image });
                    return image;
                };
            }
            if (prop === 'fill') return (...args) => { ops.push({ fn: prop, args, fillStyle: t.fillStyle }); };
            if (prop === 'stroke') return (...args) => { ops.push({ fn: prop, args, strokeStyle: t.strokeStyle }); };
            if (prop === 'strokeRect') return (...args) => { ops.push({ fn: prop, args, strokeStyle: t.strokeStyle }); };
            return (...args) => { ops.push({ fn: prop, args }); };
        },
        set(t, prop, value) { t[prop] = value; return true; },
    });
    return { ctx: proxy, ops, target };
};

// 记录 createElement 生成的画布，便于检查皮肤预渲染纹理
const madeCanvases = [];

const makeCanvas = () => {
    const paint = makeCtx();
    const canvas = {
        ops: paint.ops,
        ctx: paint.ctx,
        paint,
        width: 0,
        height: 0,
        style: {},
        addEventListener() {},
        removeEventListener() {},
        getContext: () => paint.ctx,
    };
    madeCanvases.push(canvas);
    return canvas;
};

// ---------------- 模块加载器（ESM → CommonJS） ----------------
const loadModule = (file, win) => {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'(\.[^']*)';/g, (m, names, p) => `const {${names}} = require('${p}');`);
    src = src.replace(/export\s*\{([\s\S]*?)\};/g, (m, names) => `module.exports = {${names}};`);
    const module = { exports: {} };
    const requireFn = (p) => (p.startsWith('.') ? loadModule(path.resolve(path.dirname(file), p), win) : require(p));
    const fn = new Function(
        'module', 'exports', 'require', 'window', 'document',
        'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        src,
    );
    fn(module, module.exports, requireFn, win,
        { getElementById: () => null, createElement: () => makeCanvas() },
        () => 0, () => {}, { now: () => 0 },
        setTimeout, clearTimeout, setInterval, clearInterval);
    return module.exports;
};

const win = { devicePixelRatio: 1, localStorage: storage };
const { Skins } = loadModule(path.join(BASE, 'js/global/game/skin.cjs'), win);

// ============================ 1. skin.cjs 读取与开关 ============================
{
    assert.deepStrictEqual(Skins.owned(), { piece: false, piece_rouge: false, piece_atlantis: false, grass: false, grass_gold: false, grass_jade: false, grass_firesteel: false, board: false, board_gold: false, board_atlantis: false, theme: false, theme_black: false, theme_liuqing: false }, '空缓存时未拥有任何皮肤');
    assert.deepStrictEqual(Skins.prefs(), { piece: true, piece_rouge: true, piece_atlantis: true, grass: true, grass_gold: true, grass_jade: true, grass_firesteel: true, board: true, board_gold: true, board_atlantis: true, theme: true, theme_black: true, theme_liuqing: true }, '未设置开关时默认全部启用');
    const read = Skins.read();
    assert.deepStrictEqual(
        { piece: read.piece, grass: read.grass, board: read.board },
        { piece: false, grass: false, board: false },
        '未拥有时实际不生效',
    );
    ok('空缓存：未拥有皮肤、开关默认开启、实际不生效');

    storage.setItem('4a_skins', JSON.stringify({ piece: true, grass: true, board: false }));
    assert.deepStrictEqual(Skins.owned(), { piece: true, piece_rouge: false, piece_atlantis: false, grass: true, grass_gold: false, grass_jade: false, grass_firesteel: false, board: false, board_gold: false, board_atlantis: false, theme: false, theme_black: false, theme_liuqing: false }, '已购缓存正确读取');
    storage.setItem('4a_skin_prefs', JSON.stringify({ piece: false, grass: true, board: false }));
    assert.deepStrictEqual(Skins.prefs(), { piece: false, piece_rouge: true, piece_atlantis: true, grass: true, grass_gold: true, grass_jade: true, grass_firesteel: true, board: false, board_gold: true, board_atlantis: true, theme: true, theme_black: true, theme_liuqing: true }, '本地开关正确读取');
    const read2 = Skins.read();
    assert.deepStrictEqual(
        { piece: read2.piece, grass: read2.grass, board: read2.board },
        { piece: false, grass: true, board: false },
        '已购且启用才实际生效',
    );
    assert.strictEqual(read2.owned.piece, true, 'read() 同时带出已购信息供设置页使用');
    ok('已购与本地开关独立，只有两者同时满足才生效');

    storage.setItem('4a_skin_prefs', JSON.stringify({ grass: false }));
    assert.deepStrictEqual(Skins.prefs(), { piece: true, piece_rouge: true, piece_atlantis: true, grass: false, grass_gold: true, grass_jade: true, grass_firesteel: true, board: true, board_gold: true, board_atlantis: true, theme: true, theme_black: true, theme_liuqing: true }, '缺失字段按默认开启');
    ok('开关缓存缺字段时按默认开启');

    storage.setItem('4a_skins', JSON.stringify({ stone_white: true, stone_black: true }));
    assert.strictEqual(Skins.owned().piece, true, '旧版黑白子缓存合并为棋子皮肤');
    ok('兼容旧版 stone_white/stone_black 缓存');

    storage = makeStorage();
    win.localStorage = storage;
    Skins.write_prefs({ piece: false, grass: true, board: false });
    assert.deepStrictEqual(
        JSON.parse(storage.getItem('4a_skin_prefs')),
        { piece: false, piece_rouge: true, piece_atlantis: true, grass: true, grass_gold: true, grass_jade: true, grass_firesteel: true, board: false, board_gold: true, board_atlantis: true, theme: true, theme_black: true, theme_liuqing: true },
        'write_prefs 写入本地开关',
    );
    ok('write_prefs 持久化本地开关');
}

// ============================ 2. 绘制函数 ============================
{
    const paint = makeCtx();
    assert.strictEqual(Skins.draw_stone(paint.ctx, 50, 50, 18, '#ecf0f1', {}), false, '未启用时不接管棋子绘制');
    assert.strictEqual(paint.ops.length, 0, '未启用时不产生任何绘制指令');
    assert.strictEqual(Skins.draw_grass(paint.ctx, 50, 50, 5, {}), false, '未启用时不接管草绘制');
    ok('未启用皮肤时不接管默认绘制');

    storage.setItem('4a_skins', JSON.stringify({ piece: true, grass: true }));
    storage.removeItem('4a_skin_prefs');
    const skins = Skins.read();

    const stonePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(stonePaint.ctx, 50, 50, 18, '#ecf0f1', { skins }), true, '白子走皮肤绘制');
    const gradientOp = stonePaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(gradientOp, '棋子皮肤使用径向渐变绘制球体');
    assert.strictEqual(gradientOp.gradient.stops.length, 4, '棋子渐变含 4 个色标');
    assert.ok(stonePaint.ops.some((op) => op.fn === 'ellipse'), '棋子皮肤绘制右上角高光');
    ok('棋子皮肤：渐变球体 + 高光');

    const blackPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(blackPaint.ctx, 50, 50, 18, '#2c3e50', { skins }), true, '黑子走皮肤绘制');
    assert.notDeepStrictEqual(
        stonePaint.ops.find((op) => op.fn === 'createRadialGradient').gradient.stops,
        blackPaint.ops.find((op) => op.fn === 'createRadialGradient').gradient.stops,
        '黑白子使用不同渐变',
    );
    ok('黑白子各自使用对应渐变');

    const markerPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(markerPaint.ctx, 50, 50, 18, '#e74c3c', { skins }), false, '非标准棋子颜色保持原样');
    assert.strictEqual(Skins.draw_stone(markerPaint.ctx, 50, 50, 18, '#3498db', { skins }), false, 'ASCEND 蓝标保持原样');
    ok('红/蓝位置标记等非标准色不被皮肤覆盖');

    const grassPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(grassPaint.ctx, 50, 50, 6, { skins }), true, '草走皮肤绘制');
    const ringDraw = grassPaint.ops.find((op) => op.fn === 'drawImage');
    assert.ok(ringDraw, '外圈使用预渲染纹理绘制');
    assert.ok(Math.abs(ringDraw.args[3] - 6 * 2 * 1.15) < 0.01, '外环外径保持原总大小');
    const coreArc = grassPaint.ops.find((op) => op.fn === 'arc');
    assert.ok(Math.abs(coreArc.args[2] - 6 * 0.88) < 0.01, '蓝色高光半径放大到 0.88');
    assert.strictEqual(grassPaint.ops.filter((op) => op.fn === 'stroke').length, 0, '外圈不再分段描边');
    assert.ok(grassPaint.ops.some((op) => op.fn === 'createRadialGradient'), '中心使用蓝色径向渐变');
    ok('反曲点皮肤：预渲染宽环线 + 放大的蓝色高光');

    // 纹理：黑红交界必须有平滑过渡，且相邻角度不出现颜色跳变
    const texCanvas = madeCanvases[madeCanvases.length - 1];
    const texImage = texCanvas.paint.ops.find((op) => op.fn === 'createImageData').image;
    const texSize = texImage.width;
    const texCenter = texSize / 2;
    const sampleRadius = texCenter * 0.85;
    const redWeights = [];
    for (let degree = 0; degree < 360; degree++) {
        const rad = (degree * Math.PI) / 180;
        const px = Math.floor(texCenter + Math.cos(rad) * sampleRadius);
        const py = Math.floor(texCenter + Math.sin(rad) * sampleRadius);
        const offset = (py * texSize + px) * 4;
        redWeights.push((texImage.data[offset] - 36) / (230 - 36));
    }
    const maxStep = redWeights.reduce((m, v, i) => Math.max(m, Math.abs(v - redWeights[(i + 1) % 360])), 0);
    const blends = redWeights.filter((v) => v > 0.15 && v < 0.85).length;
    assert.ok(maxStep < 0.15, `黑红交界无硬边（最大相邻跳变 ${maxStep.toFixed(3)}）`);
    assert.ok(blends >= 30, `交界存在平滑过渡色（${blends}/360 采样点处于过渡区）`);
    assert.ok(redWeights.some((v) => v > 0.97) && redWeights.some((v) => v < 0.03), '仍保留红/黑纯色区');
    ok('外环纹理：黑红交界羽化平滑，红黑交替保留');
}

// ============================ 3. Canvas 集成 ============================
{
    const { Canvas } = loadModule(path.join(BASE, 'js/global/game/canvas.cjs'), win);

    const build = () => {
        const canvases = Array.from({ length: 7 }, () => makeCanvas());
        const ui = new Canvas(
            canvases[0], canvases[1], canvases[2], canvases[3],
            canvases[4], canvases[5], canvases[6],
            9, 9, 0.41, 0.12, 0.062, 360,
        );
        ui.offset = 0;
        ui.spacing = 40;
        ui.size = 360;
        ui.canvas_ascend_marker = makeCanvas();
        return { ui, board: canvases[0], stoneFill: canvases[1], plant: canvases[3], marker: ui.canvas_ascend_marker };
    };

    // 已购棋子 + 草，且开关默认开启
    storage = makeStorage();
    win.localStorage = storage;
    storage.setItem('4a_skins', JSON.stringify({ piece: true, grass: true }));
    {
        const { ui, stoneFill, plant, marker } = build();
        assert.strictEqual(ui.skins.piece, true, 'Canvas 构造时读取棋子皮肤');
        stoneFill.ops.length = 0;
        ui.draw_stone_fill(2, 2, '#2c3e50');
        assert.ok(stoneFill.ops.some((op) => op.fn === 'createRadialGradient'), '常态棋子走皮肤绘制');
        plant.ops.length = 0;
        ui.draw_plant(3, 3);
        assert.ok(plant.ops.some((op) => op.fn === 'arc' && op.args[2] > 2), '草走皮肤绘制');
        marker.ops.length = 0;
        ui.draw_ascend_marker(4, 4, '#e74c3c', 2);
        const markerGrass = marker.ops.filter((op) => op.fn === 'drawImage');
        assert.strictEqual(markerGrass.length, 2, 'ASCEND 原位两草各绘制一次外环纹理');
        assert.ok(marker.ops.some((op) => op.fn === 'createRadialGradient'), '原位草点使用反曲点皮肤');
        ok('Canvas：常态棋子、草、ASCEND 原位草点均走皮肤');
    }

    // 关闭本地开关后回到默认绘制
    storage.setItem('4a_skin_prefs', JSON.stringify({ piece: false, grass: false }));
    {
        const { ui, stoneFill, plant } = build();
        assert.strictEqual(ui.skins.piece, false, '本地关闭后棋子皮肤不生效');
        stoneFill.ops.length = 0;
        ui.draw_stone_fill(2, 2, '#2c3e50');
        assert.strictEqual(stoneFill.ops.filter((op) => op.fn === 'createRadialGradient').length, 0, '关闭后不绘制皮肤棋子');
        assert.ok(stoneFill.ops.some((op) => op.fn === 'fill'), '关闭后仍绘制默认棋子');
        plant.ops.length = 0;
        ui.draw_plant(3, 3);
        assert.strictEqual(plant.ops.filter((op) => op.fn === 'createRadialGradient').length, 0, '关闭后不绘制皮肤草');
        assert.ok(plant.ops.some((op) => op.fn === 'fill'), '关闭后仍绘制默认草');
        ok('Canvas：本地关闭开关后回退默认绘制');
    }

    // 动画层与棋盘共用同一份皮肤状态
    storage.setItem('4a_skin_prefs', JSON.stringify({ piece: true, grass: true }));
    {
        const { ui } = build();
        assert.deepStrictEqual(ui.ascendfx.skins, ui.skins, 'AscendFx 与 Canvas 共享皮肤状态');
        ok('Canvas 注入 AscendFx 皮肤状态');
    }
}

// ============================ 3.5 虚空舰队棋盘 ============================
{
    const { Canvas } = loadModule(path.join(BASE, 'js/global/game/canvas.cjs'), win);
    const build = () => {
        const canvases = Array.from({ length: 7 }, () => makeCanvas());
        const ui = new Canvas(
            canvases[0], canvases[1], canvases[2], canvases[3],
            canvases[4], canvases[5], canvases[6],
            9, 9, 0.41, 0.12, 0.062, 360,
        );
        ui.offset = 0;
        ui.spacing = 40;
        ui.size = 360;
        ui.canvas_ascend_marker = makeCanvas();
        return { ui, board: canvases[0] };
    };
    const paint = makeCtx();
    storage = makeStorage();
    win.localStorage = storage;
    assert.strictEqual(Skins.draw_board_void(paint.ctx, 360), false, '主题未开启时不接管棋盘绘制');
    assert.strictEqual(paint.ops.length, 0, '主题未开启时不产生绘制指令');
    ok('虚空棋盘：主题未开启时不接管');

    // 仅拥有风格 UI（未购买青玉棋盘皮肤）也应自动使用虚空棋盘
    storage.setItem('4a_skins', JSON.stringify({ theme: true }));
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme: true }));
    {
        const { ui, board } = build();
        board.ops.length = 0;
        ui.draw_board();
        const baseGradient = board.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#0a1a2e', '虚空棋盘使用黑蓝渐变底色');
        assert.ok(baseGradient.gradient.stops.length >= 4, '底色为多段渐变而非纯色');
        assert.ok(board.ops.filter((op) => op.fn === 'createRadialGradient').length >= 3, '叠加多层冷光/警示光/暗角');
        const grid = board.ops.filter((op) => op.fn === 'stroke');
        assert.strictEqual(grid.length, 1, '网格线一次成组描边');
        assert.ok(String(grid[0].strokeStyle).includes('255, 255, 255'), '网格线使用白色');
        assert.ok(!board.ops.some((op) => op.fn === 'createLinearGradient' && op.gradient.stops[0][1] === '#f1f9f2'), '不再绘制青玉底色');
        ok('虚空棋盘：黑蓝渐变底 + 冷光 + 白色网格线');
    }

    // 同时拥有青玉棋盘皮肤时，棋盘皮肤覆盖虚空主题
    storage.setItem('4a_skins', JSON.stringify({ theme: true, board: true }));
    {
        const { ui, board } = build();
        board.ops.length = 0;
        ui.draw_board();
        const baseGradient = board.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#f1f9f2', '青玉棋盘皮肤覆盖主题棋盘');
        assert.ok(!board.ops.some((op) => op.fn === 'createLinearGradient' && op.gradient.stops[0][1] === '#0a1a2e'), '不再绘制虚空棋盘底色');
        ok('虚空棋盘：棋盘皮肤覆盖主题棋盘');
    }

    // 关闭主题后回退青玉棋盘
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme: false }));
    {
        const { ui, board } = build();
        board.ops.length = 0;
        ui.draw_board();
        const baseGradient = board.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#f1f9f2', '关闭主题后回到青玉棋盘');
        ok('虚空棋盘：关闭主题后回退青玉棋盘');
    }

    const mustHaveVoid = (file) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes('draw_board_void'), `${file} 未接入虚空棋盘`);
    };
    mustHaveVoid('html/endgame/submit.html');
    mustHaveVoid('html/endgame/index.html');
    ok('残局编辑器与残局预览已接入虚空棋盘');
}

// ============================ 3.5b 虚空舰队棋子与反曲点 ============================
{
    storage = makeStorage();
    win.localStorage = storage;
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme: true }));

    // 未拥有主题时不接管
    assert.strictEqual(Skins.draw_stone(makeCtx().ctx, 50, 50, 18, '#ecf0f1', {}), false, '未拥有主题时棋子仍走默认绘制');
    assert.strictEqual(Skins.draw_grass(makeCtx().ctx, 50, 50, 6, {}), false, '未拥有主题时草仍走默认绘制');
    ok('虚空棋子/反曲点：主题未开启时不接管');

    // 启用主题后自动接管棋子与草
    storage.setItem('4a_skins', JSON.stringify({ theme: true }));
    const whitePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(whitePaint.ctx, 50, 50, 18, '#ecf0f1', {}), true, '白子走虚空能量棋子');
    const whiteGradient = whitePaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(whiteGradient && whiteGradient.gradient.stops[1][1] === '#e4f7ff', '白子为冰白星核渐变');
    assert.ok(whitePaint.ops.some((op) => op.fn === 'ellipse'), '白子带赤道冷光弧与高光');
    assert.ok(whitePaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('120, 196, 255')), '白子带冷蓝镀环');

    const blackPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(blackPaint.ctx, 50, 50, 18, '#2c3e50', {}), true, '黑子走虚空能量棋子');
    const blackGradient = blackPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(blackGradient && blackGradient.gradient.stops[0][1] === '#274a70', '黑子为深空星核渐变');
    assert.ok(blackPaint.ops.some((op) => op.fn === 'fill' && op.fillStyle === 'rgba(214, 240, 255, 0.85)'), '黑子表面带星点');
    assert.ok(blackPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('88, 170, 255')), '黑子带亮青镀环保证轮廓');
    ok('虚空棋子：白子冰白星核 / 黑子深空星核，均带冷蓝镀环');

    const grassPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(grassPaint.ctx, 50, 50, 6, {}), true, '草走虚空能量环');
    assert.strictEqual(grassPaint.ops.filter((op) => op.fn === 'stroke').length >= 4, true, '外环为四段脉冲弧');
    const grassCore = grassPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(grassCore && grassCore.gradient.stops.some(([, color]) => color === '#2f9be8'), '草核心为冷蓝能量球');
    assert.ok(grassPaint.ops.some((op) => op.fn === 'fill' && op.fillStyle === 'rgba(236, 248, 255, 0.95)'), '环缺口处绘制航灯');
    assert.ok(!grassPaint.ops.some((op) => op.fn === 'drawImage'), '虚空草不依赖黑红环纹理');
    ok('虚空反曲点：四段脉冲环 + 航灯 + 星核');

    // 已购皮肤优先：棋子皮肤覆盖虚空棋子
    storage.setItem('4a_skins', JSON.stringify({ theme: true, piece: true }));
    const piecePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(piecePaint.ctx, 50, 50, 18, '#ecf0f1', {}), true, '棋子皮肤与主题同时启用时仍走棋子皮肤');
    const pieceGradient = piecePaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.strictEqual(pieceGradient.gradient.stops[0][1], '#f6f2e9', '使用半写实奶白棋子而非虚空棋子');
    assert.ok(!piecePaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('120, 196, 255')), '不再叠加虚空镀环');
    ok('虚空棋子：已购棋子皮肤优先');

    // 已购草皮肤优先：反曲点经典黑红环覆盖虚空能量环
    storage.setItem('4a_skins', JSON.stringify({ theme: true, grass: true }));
    const ringPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(ringPaint.ctx, 50, 50, 6, {}), true, '草皮肤与主题同时启用时仍走经典反曲点');
    assert.ok(ringPaint.ops.some((op) => op.fn === 'drawImage'), '经典反曲点使用预渲染黑红环纹理');
    assert.ok(!ringPaint.ops.some((op) => op.fn === 'fill' && op.fillStyle === 'rgba(236, 248, 255, 0.95)'), '不再绘制虚空航灯');
    ok('虚空反曲点：已购草皮肤优先');

    // 关闭主题且未拥有任何皮肤时回退默认
    storage.setItem('4a_skins', JSON.stringify({}));
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme: false }));
    assert.strictEqual(Skins.draw_stone(makeCtx().ctx, 50, 50, 18, '#ecf0f1', {}), false, '关闭主题后棋子回到默认');
    assert.strictEqual(Skins.draw_grass(makeCtx().ctx, 50, 50, 6, {}), false, '关闭主题后草回到默认');
    ok('虚空棋子/反曲点：关闭主题后回退默认');
}

// ============================ 3.5c 黑派主题 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    // 未拥有时不接管
    assert.strictEqual(Skins.theme_kind(), '', '未拥有任何 UI 主题时无主题');
    assert.strictEqual(Skins.draw_board_black(makeCtx().ctx, 360), false, '未拥有黑派时不接管棋盘');
    assert.strictEqual(Skins.draw_stone_black(makeCtx().ctx, 50, 50, 18, '#ecf0f1', {}), false, '未拥有黑派时不接管棋子');
    assert.strictEqual(Skins.draw_grass_black(makeCtx().ctx, 50, 50, 6, {}), false, '未拥有黑派时不接管反曲点');
    ok('黑派：未拥有时不接管');

    // 拥有黑派后主题生效，棋盘 / 棋子 / 反曲点自动接管
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true }));
    const black = Skins.read();
    assert.strictEqual(black.theme_black, true, '黑派已购且启用');
    assert.strictEqual(black.theme, false, '两套 UI 主题互斥：黑派启用时幽蓝让位');
    assert.strictEqual(Skins.theme_kind(), 'black', 'theme_kind 返回黑派');
    ok('黑派：主题生效并与幽蓝互斥');

    const boardPaint = makeCtx();
    assert.strictEqual(Skins.draw_board_black(boardPaint.ctx, 360), true, '黑派接管棋盘绘制');
    const boardBase = boardPaint.ops.find((op) => op.fn === 'createLinearGradient');
    assert.ok(boardBase && boardBase.gradient.stops[0][1] === '#1c1c22', '棋盘为深炭黑大理石渐变');
    assert.ok(boardBase.gradient.stops.length >= 4, '棋盘底色多段渐变而非纯色');
    assert.ok(boardPaint.ops.filter((op) => op.fn === 'createRadialGradient').length >= 2, '叠加中心暖金光与四周暗角');
    assert.strictEqual(boardPaint.ops.filter((op) => op.fn === 'stroke').length, 13, '八道放射金线 + 五层同心菱形');
    assert.strictEqual(boardPaint.ops.filter((op) => op.fn === 'strokeRect').length, 2, '绘制内缘双金线');
    ok('黑派棋盘：炭黑大理石 + 日轮金光 + 放射金线与菱形纹');

    // 棋盘皮肤优先于黑派主题棋盘
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true, board: true }));
    assert.strictEqual(Skins.draw_board_black(makeCtx().ctx, 360), false, '青玉棋盘启用时黑派棋盘让位');
    assert.strictEqual(Skins.board_style(), 'jade', '棋盘皮肤优先于黑派主题');
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true }));
    assert.strictEqual(Skins.board_style(), 'black', '没有棋盘皮肤时使用黑派棋盘');
    ok('黑派棋盘：棋盘皮肤优先，board_style 正确');

    const whitePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(whitePaint.ctx, 50, 50, 18, '#ecf0f1', {}), true, '黑派自动接管白子');
    const whiteGradient = whitePaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(whiteGradient && whiteGradient.gradient.stops[0][1] === '#fffdf4', '白子为象牙石渐变');
    assert.strictEqual(whitePaint.ops.filter((op) => op.fn === 'stroke').length, 2, '白子带双圈亮金镀环');
    assert.ok(whitePaint.ops.some((op) => op.fn === 'ellipse'), '白子带右上角高光');

    const stoneBlackPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(stoneBlackPaint.ctx, 50, 50, 18, '#2c3e50', {}), true, '黑派自动接管黑子');
    const stoneBlackGradient = stoneBlackPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(stoneBlackGradient && stoneBlackGradient.gradient.stops[0][1] === '#3a3a42', '黑子为抛光黑曜石渐变');
    assert.ok(
        stoneBlackPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('240, 199, 112')),
        '黑子镀环为更亮的金色以保证轮廓',
    );
    ok('黑派棋子：象牙石 / 黑曜石 + 双圈金镀环');

    // 已购棋子皮肤优先于黑派棋子
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true, piece: true }));
    const piecePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(piecePaint.ctx, 50, 50, 18, '#ecf0f1', {}), true, '棋子皮肤优先');
    assert.strictEqual(
        piecePaint.ops.find((op) => op.fn === 'createRadialGradient').gradient.stops[0][1],
        '#f6f2e9',
        '使用半写实奶白棋子而非黑派象牙石',
    );
    ok('黑派棋子：已购棋子皮肤优先');

    const grassPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(grassPaint.ctx, 50, 50, 6, {}), true, '黑派自动接管反曲点');
    assert.strictEqual(grassPaint.ops.filter((op) => op.fn === 'stroke').length, 9, '亮金日冕环 + 八道放射金芒');
    const grassCore = grassPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(grassCore && grassCore.gradient.stops[0][1] === '#fffdf2', '内核为暖白石核');
    assert.ok(!grassPaint.ops.some((op) => op.fn === 'drawImage'), '黑派反曲点不依赖黑红环纹理');
    ok('黑派反曲点：亮金日冕环 + 八道金芒 + 暖白石核');

    storage.setItem('4a_skins', JSON.stringify({ theme_black: true, grass: true }));
    const ringPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(ringPaint.ctx, 50, 50, 6, {}), true, '草皮肤与黑派同时启用时仍走经典反曲点');
    assert.ok(ringPaint.ops.some((op) => op.fn === 'drawImage'), '经典反曲点使用预渲染黑红环纹理');
    ok('黑派反曲点：已购草皮肤优先');

    // 本地开关关闭后回退
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true }));
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme_black: false }));
    assert.strictEqual(Skins.theme_kind(), '', '本地关闭黑派后无主题');
    assert.strictEqual(Skins.board_style(), 'none', '关闭黑派后棋盘回到默认');
    assert.strictEqual(Skins.draw_stone(makeCtx().ctx, 50, 50, 18, '#ecf0f1', {}), false, '关闭黑派后棋子回到默认');
    assert.strictEqual(Skins.draw_grass(makeCtx().ctx, 50, 50, 6, {}), false, '关闭黑派后草回到默认');
    ok('黑派：遵守本地开关');

    // 两套 UI 主题互斥：同时拥有时黑派优先
    storage = makeStorage();
    win.localStorage = storage;
    storage.setItem('4a_skins', JSON.stringify({ theme: true, theme_black: true }));
    const both = Skins.read();
    assert.strictEqual(both.theme_black, true, '两套同时拥有时黑派生效');
    assert.strictEqual(both.theme, false, '幽蓝自动让位');
    assert.strictEqual(Skins.theme_kind(), 'black', 'theme_kind 为黑派');
    storage.setItem('4a_skins', JSON.stringify({ theme: true }));
    assert.strictEqual(Skins.theme_kind(), 'void', '只有幽蓝时为幽蓝');
    ok('黑派：两套 UI 主题互斥且优先');

    // 商店与设置接线
    const mustHaveBlack = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHaveBlack('js/main/shop.cjs', "id: 'theme_black', price: 4999", '商店黑派 UI 定价 4999');
    mustHaveBlack('js/main/shop.cjs', 'theme_black: list.includes', '商店购买后写入本机皮肤');
    mustHaveBlack('js/main/index.cjs', "id: 'theme_black'", '本地设置黑派 UI 开关');
    mustHaveBlack('js/main/index.cjs', "theme_black: skins.includes('theme_black')", '账号信息同步已购黑派');
    mustHaveBlack('html/index.html', "id='switch_skin_theme_black'", '本地设置黑派 UI 开关 DOM');
    mustHaveBlack('js/global/game/skin.cjs', "const THEME_CLASS_BLACK = 'theme-black';", '黑派主题类');
    mustHaveBlack('html/endgame/submit.html', 'blackTheme', '残局编辑器接入黑派棋盘');
    mustHaveBlack('html/endgame/index.html', 'blackTheme', '残局预览接入黑派棋盘');
    ok('黑派：商店定价 4999、设置与账号接线');
}

// ============================ 3.5 留青主题 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    assert.strictEqual(Skins.theme_kind(), '', '未拥有留青时无主题');
    assert.strictEqual(Skins.draw_board_liuqing(makeCtx().ctx, 360), false, '未拥有留青时不接管棋盘');
    assert.strictEqual(Skins.draw_stone_liuqing(makeCtx().ctx, 50, 50, 18, '#ecf0f1', {}), false, '未拥有留青时不接管棋子');
    assert.strictEqual(Skins.draw_grass_liuqing(makeCtx().ctx, 50, 50, 6, {}), false, '未拥有留青时不接管草');
    ok('留青：未拥有时不接管');

    storage.setItem('4a_skins', JSON.stringify({ theme_liuqing: true }));
    const read = Skins.read();
    assert.strictEqual(read.theme_liuqing, true, '留青已购且启用');
    assert.strictEqual(Skins.theme_kind(), 'liuqing', 'theme_kind 返回留青');
    assert.strictEqual(Skins.board_style(), 'liuqing', '没有棋盘皮肤时使用留青棋盘');
    ok('留青：主题生效');

    const boardPaint = makeCtx();
    assert.strictEqual(Skins.draw_board_liuqing(boardPaint.ctx, 360), true, '留青接管棋盘绘制');
    const base = boardPaint.ops.find((op) => op.fn === 'createLinearGradient');
    assert.ok(base && base.gradient.stops[0][1] === '#fdfefb', '棋盘为纸白到极淡青绿渐变');
    assert.ok(base.gradient.stops.length >= 3, '棋盘底色为多段渐变');
    assert.strictEqual(boardPaint.ops.filter((op) => op.fn === 'createRadialGradient').length, 3, '叠加三团青绿水洗');
    assert.ok(boardPaint.ops.filter((op) => op.fn === 'stroke').length >= 46, '绘制纸纤维细线');
    assert.ok(boardPaint.ops.some((op) => op.fn === 'strokeRect'), '绘制内缘装裱细线');
    ok('留青棋盘：纸白青晕 + 水洗 + 纸纤维 + 装裱线');

    storage.setItem('4a_skins', JSON.stringify({ theme_liuqing: true, board: true }));
    assert.strictEqual(Skins.draw_board_liuqing(makeCtx().ctx, 360), false, '青玉棋盘启用时留青棋盘让位');
    assert.strictEqual(Skins.board_style(), 'jade', '棋盘皮肤优先于留青主题');
    ok('留青棋盘：棋盘皮肤优先');

    storage.setItem('4a_skins', JSON.stringify({ theme_liuqing: true }));
    const whitePaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(whitePaint.ctx, 50, 50, 18, '#ecf0f1', {}), true, '留青自动接管白子');
    const whiteGradient = whitePaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(whiteGradient && whiteGradient.gradient.stops[0][1] === '#ffffff', '白子为青白瓷石渐变');
    assert.ok(whitePaint.ops.some((op) => op.fn === 'ellipse'), '白子带左上柔光');
    assert.ok(whitePaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('96, 150, 118')), '白子带极细青线');

    const blackPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(blackPaint.ctx, 50, 50, 18, '#2c3e50', {}), true, '留青自动接管黑子');
    const blackGradient = blackPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(blackGradient && blackGradient.gradient.stops[0][1] === '#6d9380', '黑子为深松绿墨石渐变');
    assert.ok(blackPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('12, 28, 20')), '黑子带深松绿细边');
    ok('留青棋子：青白瓷石 / 深松绿墨石 + 细青线 + 柔光');

    const grassPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(grassPaint.ctx, 50, 50, 6, {}), true, '留青自动接管草');
    const leafGradients = grassPaint.ops.filter((op) => op.fn === 'createLinearGradient');
    assert.strictEqual(leafGradients.length, 3, '每片叶子各用一条浅绿渐变');
    assert.ok(leafGradients.every((op) => op.gradient.stops[0][1] === '#c6f2d3'), '叶片由浅绿渐变到嫩绿');
    assert.ok(!leafGradients.some((op) => op.gradient.stops[0][1] === '#b7e6c6'), '不再保留旧外环渐变');
    assert.ok(!grassPaint.ops.some((op) => op.fn === 'createRadialGradient'), '不再绘制白心圆');
    assert.ok(!grassPaint.ops.some((op) => op.fn === 'arc'), '不再绘制任何外圈');
    assert.ok(!grassPaint.ops.some((op) => op.fn === 'drawImage'), '留青草不依赖黑红环纹理');
    const leafEllipses = grassPaint.ops.filter((op) => op.fn === 'ellipse');
    assert.ok(leafEllipses.length >= 3 && leafEllipses[0].args[3] >= 6 * 0.4, '嫩叶已放大');
    assert.strictEqual(grassPaint.ops.filter((op) => op.fn === 'fill').length, 3, '只绘制三片放大嫩叶');
    ok('留青草：放大三叶草 + 浅绿渐变 + 无外圈');

    storage.setItem('4a_skins', JSON.stringify({ theme_liuqing: true, grass: true }));
    assert.strictEqual(Skins.draw_grass(makeCtx().ctx, 50, 50, 6, {}), true, '留青下已购草皮肤仍优先');
    assert.ok(makeCtx().ops.length === 0, '草皮肤绘制不污染其它上下文');
    ok('留青草：已购草皮肤优先');

    storage.setItem('4a_skins', JSON.stringify({ theme_liuqing: true }));
    storage.setItem('4a_skin_prefs', JSON.stringify({ theme_liuqing: false }));
    assert.strictEqual(Skins.theme_kind(), '', '本地关闭留青后无主题');
    assert.strictEqual(Skins.board_style(), 'none', '关闭留青后棋盘回到默认');
    assert.strictEqual(Skins.draw_board_liuqing(makeCtx().ctx, 360), false, '关闭留青后不接管棋盘');
    ok('留青：遵守本地开关');

    storage = makeStorage();
    win.localStorage = storage;
    storage.setItem('4a_skins', JSON.stringify({ theme: true, theme_black: true, theme_liuqing: true }));
    const all = Skins.read();
    assert.strictEqual(all.theme_liuqing, true, '三套同时拥有时留青生效');
    assert.strictEqual(all.theme_black, false, '黑派让位');
    assert.strictEqual(all.theme, false, '幽蓝让位');
    assert.strictEqual(Skins.theme_kind(), 'liuqing', 'theme_kind 为留青');
    ok('留青：三套 UI 主题互斥且优先级最高');

    // 商店、设置、场景、样式与资源接线
    const must = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    must('js/main/shop.cjs', "id: 'theme_liuqing', price: 1399", '商店留青定价 1399');
    must('js/main/shop.cjs', "desc: '于是万物更新。'", '商店描述只有一句');
    must('js/main/shop.cjs', 'theme_liuqing: list.includes', '商店购买后写入本机皮肤');
    must('js/main/index.cjs', "id: 'theme_liuqing'", '本地设置留青开关');
    must('js/main/index.cjs', "theme_liuqing: skins.includes('theme_liuqing')", '账号信息同步已购留青');
    must('html/index.html', "id='switch_skin_theme_liuqing'", '本地设置留青开关 DOM');
    must('html/index.html', 'liuqing-backdrop', '主页留青背景层');
    must('html/index.html', 'lqf-leaves', '主页留青飘叶层');
    must('js/global/ui/voidscene.cjs', 'LQ_SCENE_ID', '分页面留青场景挂载');
    must('js/global/game/skin.cjs', "const THEME_CLASS_LIUQING = 'theme-liuqing';", '留青主题类');
    must('css/global.css', "url('/image/theme/liuqing-home.jpg", '主页留青背景图');
    must('css/global.css', "url('/image/theme/liuqing-play.jpg", '对局页留青背景图');
    must('css/global.css', "url('/image/theme/liuqing-event.jpg", '赛事页留青背景图');
    must('css/global.css', "url('/image/theme/liuqing-lore.jpg", '剧情页留青背景图');
    must('css/global.css', "url('/image/theme/liuqing-honor.jpg", '成就页留青背景图');
    must('css/global.css', '@media (prefers-reduced-motion: reduce)', '减弱动态效果适配');
    ['liuqing-home', 'liuqing-play', 'liuqing-event', 'liuqing-lore', 'liuqing-honor'].forEach((name) => {
        const file = path.join(BASE, 'root/image/theme', `${name}.jpg`);
        assert.ok(fs.existsSync(file), `缺少背景资源: ${name}.jpg`);
    });
    ok('留青：商店 1399、一句描述、设置/场景/五张背景/减弱动态接线');
}

// ============================ 3.6 玄金棋盘 ============================
{
    // 罗马数字换算
    assert.strictEqual(Skins.to_roman(1), 'I', '1 → I');
    assert.strictEqual(Skins.to_roman(4), 'IV', '4 → IV');
    assert.strictEqual(Skins.to_roman(9), 'IX', '9 → IX');
    assert.strictEqual(Skins.to_roman('3'), 'III', '字符串数字也能换算');
    assert.strictEqual(Skins.to_roman(0), '0', '越界数字保持原样');
    ok('玄金棋盘：罗马数字换算');

    storage = makeStorage();
    win.localStorage = storage;
    const paint = makeCtx();
    assert.strictEqual(Skins.draw_board_gold(paint.ctx, 360), false, '未拥有时不接管棋盘绘制');
    assert.strictEqual(paint.ops.length, 0, '未拥有时不产生绘制指令');
    ok('玄金棋盘：未拥有时不接管');

    storage.setItem('4a_skins', JSON.stringify({ board_gold: true }));
    {
        const goldPaint = makeCtx();
        assert.strictEqual(Skins.draw_board_gold(goldPaint.ctx, 360), true, '已购且启用时接管棋盘绘制');
        const base = goldPaint.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(base && base.gradient.stops[0][1] === '#5f646d', '黑石底色使用石板灰渐变');
        assert.ok(base.gradient.stops.length >= 4, '黑石底色为多段渐变而非纯色');
        assert.ok(goldPaint.ops.filter((op) => op.fn === 'fill').length >= 100, '铺满低浮雕菱形切面');
        assert.ok(goldPaint.ops.some((op) => op.fillStyle === 'rgba(255, 255, 255, 0.042)'), '受光面为极淡白光');
        assert.ok(goldPaint.ops.some((op) => op.fillStyle === 'rgba(0, 0, 0, 0.06)'), '背光面为极淡暗面');
        assert.ok(!goldPaint.ops.some((op) => String(op.strokeStyle).includes('238, 202, 126')), '不再绘制杂乱的裂线');
        assert.ok(goldPaint.ops.filter((op) => op.fn === 'createRadialGradient').length >= 1, '四周暗角');
        assert.ok(goldPaint.ops.some((op) => op.fn === 'strokeRect'), '绘制内缘细线');
        assert.ok(String(goldPaint.target.strokeStyle).includes('226, 190, 106'), '内缘细线为金色');
        ok('玄金棋盘：石板灰渐变 + 低浮雕切面纹理 + 暗角 + 金内缘');
    }

    // 本地开关关闭后不再接管
    storage.setItem('4a_skin_prefs', JSON.stringify({ board_gold: false }));
    assert.strictEqual(Skins.draw_board_gold(makeCtx().ctx, 360), false, '本地关闭后不接管棋盘');
    ok('玄金棋盘：遵守本地开关');

    // 风格优先级：棋盘皮肤（玄金 / 青玉）> 黑派主题 > 虚空主题 > 默认
    storage = makeStorage();
    win.localStorage = storage;
    storage.setItem('4a_skins', JSON.stringify({ theme: true, board_gold: true, board: true }));
    assert.strictEqual(Skins.board_style(), 'gold', '棋盘皮肤覆盖主题棋盘，且两套棋盘互斥时玄金生效');
    storage.setItem('4a_skins', JSON.stringify({ theme: true, board: true }));
    assert.strictEqual(Skins.board_style(), 'jade', '青玉棋盘覆盖主题棋盘');
    storage.setItem('4a_skins', JSON.stringify({ theme: true }));
    assert.strictEqual(Skins.board_style(), 'void', '没有棋盘皮肤时回退虚空主题');
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true, board_gold: true }));
    assert.strictEqual(Skins.board_style(), 'gold', '玄金棋盘覆盖黑派主题棋盘');
    storage.setItem('4a_skins', JSON.stringify({ theme_black: true }));
    assert.strictEqual(Skins.board_style(), 'black', '黑派主题棋盘优先于虚空主题');
    storage.setItem('4a_skins', JSON.stringify({ board_gold: true, board: true }));
    assert.strictEqual(Skins.board_style(), 'gold', '玄金优先于青玉');
    storage.setItem('4a_skins', JSON.stringify({ board: true }));
    assert.strictEqual(Skins.board_style(), 'jade', '仅有青玉时为青玉');
    storage.removeItem('4a_skins');
    assert.strictEqual(Skins.board_style(), 'none', '未拥有时为默认白底');
    ok('玄金棋盘：board_style 优先级正确');

    // 两套棋盘皮肤互斥：即便旧缓存两套都开启，实际也只生效一套
    storage.setItem('4a_skins', JSON.stringify({ board: true, board_gold: true }));
    {
        const both = Skins.read();
        assert.strictEqual(both.board_gold, true, '两套同时开启时玄金生效');
        assert.strictEqual(both.board, false, '青玉自动让位，不与玄金同时启用');
        const jadeCtx = makeCtx();
        assert.strictEqual(Skins.draw_board_jade(jadeCtx.ctx, 360), false, '玄金启用时青玉不接管棋盘');
        assert.strictEqual(jadeCtx.ops.length, 0, '青玉让位时不产生绘制指令');
        ok('棋盘皮肤互斥：同一时间只启用一套');
    }

    // Canvas 集成：金色网格 + 罗马数字坐标
    const { Canvas } = loadModule(path.join(BASE, 'js/global/game/canvas.cjs'), win);
    const build = () => {
        const canvases = Array.from({ length: 7 }, () => makeCanvas());
        const ui = new Canvas(
            canvases[0], canvases[1], canvases[2], canvases[3],
            canvases[4], canvases[5], canvases[6],
            9, 9, 0.41, 0.12, 0.062, 360,
        );
        ui.offset = 0;
        ui.spacing = 40;
        ui.size = 360;
        ui.canvas_ascend_marker = makeCanvas();
        return { ui, board: canvases[0] };
    };

    storage.setItem('4a_skins', JSON.stringify({ board_gold: true }));
    {
        const { ui, board } = build();
        board.ops.length = 0;
        ui.draw_board();
        const baseGradient = board.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#5f646d', 'Canvas 使用黑石底');
        assert.ok(board.ops.some((op) => op.fn === 'strokeRect' && op.strokeStyle === '#e6c16a'), '最外层使用亮金描边');
        const grid = board.ops.filter((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('8, 10, 13'));
        assert.strictEqual(grid.length, 1, '网格线先压一道暗缝');
        const goldCore = board.ops.filter((op) => op.fn === 'stroke' && op.strokeStyle === '#f1cb72');
        assert.strictEqual(goldCore.length, 1, '网格线再叠亮金芯（镌刻双线）');
        const texts = board.ops.filter((op) => op.fn === 'fillText').map((op) => op.args[0]);
        assert.ok(texts.includes('IX') && texts.includes('IV') && texts.includes('I'), '坐标使用罗马数字');
        assert.ok(!texts.some((text) => /^\d/.test(text)), '不再出现阿拉伯数字坐标');
        assert.strictEqual(texts.length, 17, '9x9 棋盘共 8 + 9 个坐标');
        assert.ok(String(board.paint.target.font).includes('Times New Roman'), '坐标使用衬线字体');
        assert.strictEqual(board.paint.target.fillStyle, '#ffd77a', '坐标文字为亮金色');
        assert.ok(board.paint.target.shadowBlur > 0, '坐标带有金色辉光');
        ok('玄金棋盘：Canvas 黑石底 + 亮金网格 + 罗马数字坐标');
    }

    // 与青玉棋盘同时拥有时玄金优先，关闭玄金后回退青玉
    storage.setItem('4a_skins', JSON.stringify({ board_gold: true, board: true }));
    {
        const { ui, board } = build();
        board.ops.length = 0;
        ui.draw_board();
        const baseGradient = board.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#5f646d', '玄金优先于青玉');
        storage.setItem('4a_skin_prefs', JSON.stringify({ board_gold: false }));
        const { ui: ui2, board: board2 } = build();
        board2.ops.length = 0;
        ui2.draw_board();
        const jadeGradient = board2.ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(jadeGradient && jadeGradient.gradient.stops[0][1] === '#f1f9f2', '关闭玄金后回退青玉棋盘');
        ok('玄金棋盘：Canvas 风格优先级与回退');
    }

    // 残局页面接入
    const mustHaveGold = (file, needRoman) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes('draw_board_gold'), `${file} 未接入玄金棋盘`);
        // 残局入口预览不绘制坐标数字，只有编辑器需要罗马数字
        if (needRoman) assert.ok(text.includes('to_roman'), `${file} 未使用罗马数字坐标`);
    };
    mustHaveGold('html/endgame/submit.html', true);
    mustHaveGold('html/endgame/index.html', false);
    const mustHaveJade = (file) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes('draw_board_jade'), `${file} 未接入青玉棋盘`);
    };
    mustHaveJade('html/endgame/submit.html');
    mustHaveJade('html/endgame/index.html');
    ok('玄金棋盘：残局编辑器与残局预览已接入');

    // 本地设置与背包内的棋盘皮肤互斥
    const index_text = fs.readFileSync(path.join(BASE, 'js/main/index.cjs'), 'utf8');
    assert.ok(index_text.includes("[['board_atlantis', switch_skin_board_atlantis], ['board_gold', switch_skin_board_gold]"), '保存设置时三套棋盘皮肤互斥');
    assert.ok(index_text.includes("['board', 'board_gold', 'board_atlantis']"), '背包开关切换时三套棋盘皮肤互斥');
    assert.ok(index_text.includes('const active = Skins.read()'), '设置与背包按实际生效状态回显棋盘开关');
    ok('棋盘皮肤互斥：本地设置与背包接线正确');

    // 商店与本地设置接线
    const mustHave2 = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHave2('js/main/shop.cjs', "id: 'board_gold', price: 799", '商店玄金棋盘定价 799');
    mustHave2('js/main/shop.cjs', 'board_gold: list.includes', '商店购买后写入本机皮肤');
    mustHave2('js/main/index.cjs', "id: 'board_gold'", '本地设置玄金棋盘开关');
    mustHave2('js/main/index.cjs', "board_gold: skins.includes('board_gold')", '账号信息同步已购玄金棋盘');
    mustHave2('html/index.html', "id='switch_skin_board_gold'", '本地设置玄金棋盘开关 DOM');
    ok('玄金棋盘：商店定价 799 与设置接线');
}

// ============================ 3.7 金菱草皮肤 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    // 未拥有时不接管
    const nonePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_gold(nonePaint.ctx, 50, 50, 6, {}), false, '未拥有时不接管金菱草绘制');
    assert.strictEqual(nonePaint.ops.length, 0, '未拥有时不产生绘制指令');
    ok('金菱草：未拥有时不接管');

    // 已购后绘制金色菱形：四顶点 + 斜向渐变 + 中心高光
    storage.setItem('4a_skins', JSON.stringify({ grass: true, grass_gold: true }));
    const skins = Skins.read();
    assert.strictEqual(skins.grass_gold, true, '金菱草已购且启用');
    assert.strictEqual(skins.grass, false, '两套草皮肤互斥：金菱草启用时反曲点让位');
    ok('金菱草：与反曲点皮肤互斥');

    const goldPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_gold(goldPaint.ctx, 50, 50, 6, { skins }), true, '金菱草走皮肤绘制');
    const moves = goldPaint.ops.filter((op) => op.fn === 'moveTo');
    const lines = goldPaint.ops.filter((op) => op.fn === 'lineTo');
    assert.strictEqual(moves.length, 1, '菱形从顶部顶点起笔');
    assert.strictEqual(lines.length, 3, '菱形经右、下、左三个顶点连成轮廓');
    assert.ok(Math.abs(moves[0].args[1] - (50 - 6 * 1.28)) < 0.01, '顶部顶点位于草中心正上方');
    assert.ok(Math.abs(lines[0].args[0] - (50 + 6 * 1.28)) < 0.01, '右侧顶点距中心为 1.28 倍草半径');
    const goldGradient = goldPaint.ops.find((op) => op.fn === 'createLinearGradient');
    assert.ok(goldGradient && goldGradient.gradient.stops.length === 5, '菱形使用 5 段金色斜向渐变');
    assert.ok(goldGradient.gradient.stops[0][1] === '#fff4c9' && goldGradient.gradient.stops[4][1] === '#70500e', '渐变由亮金过渡到深金');
    const coreGradient = goldPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(coreGradient, '中心高光使用径向渐变');
    assert.ok(coreGradient.gradient.stops[0][1].includes('255, 255, 255'), '高光中心为白色');
    assert.ok(goldPaint.ops.some((op) => op.fn === 'stroke'), '菱形有浅金描边');
    assert.strictEqual(goldPaint.ops.filter((op) => op.fn === 'drawImage').length, 0, '金菱草不绘制黑红外环纹理');
    ok('金菱草：菱形轮廓 + 斜向渐变 + 中心高光');

    // Skins.draw_grass 统一入口自动切换到菱形
    const unified = makeCtx();
    assert.strictEqual(Skins.draw_grass(unified.ctx, 50, 50, 6, { skins }), true, '统一草绘制入口接管');
    assert.ok(unified.ops.some((op) => op.fn === 'createLinearGradient'), '统一入口走金菱草');
    assert.strictEqual(unified.ops.filter((op) => op.fn === 'drawImage').length, 0, '统一入口不再绘制反曲点外环');
    ok('金菱草：Skins.draw_grass 统一入口生效');

    // 关闭金菱草开关后回退反曲点皮肤
    storage.setItem('4a_skin_prefs', JSON.stringify({ grass_gold: false }));
    const fallback = Skins.read();
    assert.strictEqual(fallback.grass_gold, false, '本地关闭金菱草');
    assert.strictEqual(fallback.grass, true, '反曲点恢复生效');
    const ringPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(ringPaint.ctx, 50, 50, 6, { skins: fallback }), true, '关闭金菱草后走反曲点');
    assert.ok(ringPaint.ops.some((op) => op.fn === 'drawImage'), '回退后绘制反曲点外环纹理');
    storage.removeItem('4a_skin_prefs');
    ok('金菱草：关闭后回退反曲点');

    // 草生成特效光晕：金菱草为金色，反曲点为蓝色
    const { Effect } = loadModule(path.join(BASE, 'js/global/game/effect.cjs'), win);
    const fx = new Effect();
    const plantPaint = makeCtx();
    fx.plant(100, 100, 8, 1, 'gold');
    [...fx.effects].forEach((entry) => entry.draw(plantPaint.ctx, 0));
    assert.ok(plantPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('255, 209, 102')), '金菱草生成光晕为金色');
    const fx2 = new Effect();
    const plantPaint2 = makeCtx();
    fx2.plant(100, 100, 8, 1, true);
    [...fx2.effects].forEach((entry) => entry.draw(plantPaint2.ctx, 0));
    assert.ok(plantPaint2.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('74, 166, 255')), '反曲点生成光晕仍为蓝色');
    ok('金菱草：生成特效光晕颜色区分');

    // 商店与本地设置接线
    const mustHaveGold = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHaveGold('js/main/shop.cjs', "id: 'grass_gold', price: 325", '商店金菱草定价 325');
    mustHaveGold('js/main/shop.cjs', 'grass_gold: list.includes', '商店购买后写入本机皮肤');
    mustHaveGold('js/main/index.cjs', "id: 'grass_gold'", '本地设置金菱草开关');
    mustHaveGold('js/main/index.cjs', "grass_gold: skins.includes('grass_gold')", '账号信息同步已购金菱草');
    mustHaveGold('html/index.html', "id='switch_skin_grass_gold'", '本地设置金菱草开关 DOM');
    ok('金菱草：商店定价 325 与设置接线');
}

// ============================ 3.8 白玉玲珑草皮肤 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    // 未拥有时不接管
    const nonePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_jade(nonePaint.ctx, 50, 50, 6, {}), false, '未拥有时不接管白玉玲珑绘制');
    assert.strictEqual(nonePaint.ops.length, 0, '未拥有时不产生绘制指令');
    ok('白玉玲珑：未拥有时不接管');

    // 三套草皮肤互斥：白玉玲珑优先级最高
    storage.setItem('4a_skins', JSON.stringify({ grass: true, grass_gold: true, grass_jade: true }));
    const skins = Skins.read();
    assert.strictEqual(skins.grass_jade, true, '白玉玲珑已购且启用');
    assert.strictEqual(skins.grass_gold, false, '三套草皮肤互斥：白玉玲珑启用时黄金让位');
    assert.strictEqual(skins.grass, false, '三套草皮肤互斥：白玉玲珑启用时反曲点让位');
    ok('白玉玲珑：与黄金、反曲点皮肤互斥');

    // 玉底纹理：中心白玉 → 四周翠绿 → 外缘墨绿，且圆片含釉面高光与玉纹
    const jadePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_jade(jadePaint.ctx, 50, 50, 6, { skins }), true, '白玉玲珑走皮肤绘制');
    const jadeDraw = jadePaint.ops.find((op) => op.fn === 'drawImage');
    assert.ok(jadeDraw, '玉片使用预渲染纹理绘制');
    assert.ok(Math.abs(jadeDraw.args[3] - 6 * 1.12 * 2) < 0.01, '玉片外径为草半径的 1.12 倍');
    assert.ok(jadePaint.ops.some((op) => op.fn === 'arc'), '玉片为圆形轮廓');
    const jadeTex = madeCanvases.find((c) => c.ops.some((op) => op.fn === 'createRadialGradient'
        && op.gradient && op.gradient.stops.some(([, color]) => color === '#0d3a28')));
    assert.ok(jadeTex, '玉底使用径向渐变且最外缘为墨绿');
    const jadeStops = jadeTex.ops.find((op) => op.fn === 'createRadialGradient' && op.gradient.stops.some(([, color]) => color === '#0d3a28')).gradient.stops.map(([, color]) => color);
    assert.ok(jadeStops[0] === '#fdfefb', '玉底中心为白玉色');
    assert.ok(jadeStops.includes('#63af82') && jadeStops.includes('#2c7350'), '玉底由翠绿逐渐加深至墨绿');
    assert.ok(jadeTex.ops.some((op) => op.fn === 'quadraticCurveTo'), '玉片绘制玉纹脉络');
    assert.ok(jadeTex.ops.some((op) => op.fn === 'ellipse') || jadeTex.ops.some((op) => op.fn === 'createRadialGradient'), '玉片绘制釉面高光');
    ok('白玉玲珑：玉底渐变 + 玉纹 + 釉面质感');

    // 统一入口自动切换到白玉玲珑
    const unified = makeCtx();
    assert.strictEqual(Skins.draw_grass(unified.ctx, 50, 50, 6, { skins }), true, '统一草绘制入口接管');
    assert.ok(unified.ops.some((op) => op.fn === 'drawImage'), '统一入口走白玉玲珑纹理');
    assert.strictEqual(unified.ops.filter((op) => op.fn === 'moveTo').length, 0, '统一入口不再绘制菱形轮廓');
    ok('白玉玲珑：Skins.draw_grass 统一入口生效');

    // 关闭白玉玲珑后按优先级回退黄金，再关闭黄金回退反曲点
    storage.setItem('4a_skin_prefs', JSON.stringify({ grass_jade: false }));
    const fallbackGold = Skins.read();
    assert.strictEqual(fallbackGold.grass_jade, false, '本地关闭白玉玲珑');
    assert.strictEqual(fallbackGold.grass_gold, true, '白玉玲珑关闭后黄金恢复生效');
    const goldPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(goldPaint.ctx, 50, 50, 6, { skins: fallbackGold }), true, '回退后走金菱草');
    assert.ok(goldPaint.ops.some((op) => op.fn === 'createLinearGradient'), '回退后绘制金色菱形');
    storage.setItem('4a_skin_prefs', JSON.stringify({ grass_jade: false, grass_gold: false }));
    const fallbackGrass = Skins.read();
    assert.strictEqual(fallbackGrass.grass, true, '再关闭黄金后反曲点恢复生效');
    const ringPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(ringPaint.ctx, 50, 50, 6, { skins: fallbackGrass }), true, '最终回退反曲点');
    assert.ok(ringPaint.ops.some((op) => op.fn === 'drawImage'), '回退后绘制反曲点外环纹理');
    storage.removeItem('4a_skin_prefs');
    ok('白玉玲珑：关闭后按优先级回退');

    // 草生成特效光晕：白玉玲珑为玉青色
    const { Effect } = loadModule(path.join(BASE, 'js/global/game/effect.cjs'), win);
    const fx = new Effect();
    const plantPaint = makeCtx();
    fx.plant(100, 100, 8, 1, 'jade');
    [...fx.effects].forEach((entry) => entry.draw(plantPaint.ctx, 0));
    assert.ok(plantPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('143, 216, 180')), '白玉玲珑生成光晕为玉青色');
    ok('白玉玲珑：生成特效光晕颜色区分');

    // 商店与本地设置接线
    const mustHaveJade = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHaveJade('js/main/shop.cjs', "id: 'grass_jade', price: 899", '商店白玉玲珑定价 899');
    mustHaveJade('js/main/shop.cjs', '草皮肤：白玉玲珑', '商店白玉玲珑商品名称');
    mustHaveJade('js/main/shop.cjs', 'grass_jade: list.includes', '商店购买后写入本机皮肤');
    mustHaveJade('js/main/index.cjs', "id: 'grass_jade'", '本地设置白玉玲珑开关');
    mustHaveJade('js/main/index.cjs', "grass_jade: skins.includes('grass_jade')", '账号信息同步已购白玉玲珑');
    mustHaveJade('html/index.html', "id='switch_skin_grass_jade'", '本地设置白玉玲珑开关 DOM');
    ok('白玉玲珑：商店定价 899 与设置接线');
}

// ============================ 3.8.1 火与钢草皮肤 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    // 未拥有时不接管，也不产生任何绘制指令
    const nonePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_firesteel(nonePaint.ctx, 50, 50, 6, {}), false, '未拥有时不接管火与钢绘制');
    assert.strictEqual(nonePaint.ops.length, 0, '未拥有时不产生绘制指令');
    ok('火与钢：未拥有时不接管');

    // 四套草皮肤互斥：火与钢优先级最高
    storage.setItem('4a_skins', JSON.stringify({ grass: true, grass_gold: true, grass_jade: true, grass_firesteel: true }));
    const skins = Skins.read();
    assert.strictEqual(skins.grass_firesteel, true, '火与钢已购且启用');
    assert.strictEqual(skins.grass_jade, false, '火与钢启用时白玉玲珑让位');
    assert.strictEqual(skins.grass_gold, false, '火与钢启用时黄金让位');
    assert.strictEqual(skins.grass, false, '火与钢启用时反曲点让位');
    ok('火与钢：与白玉玲珑、黄金、反曲点皮肤互斥');

    // 空草点：单草为红色三角，不带圆形边框
    const emptyPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(emptyPaint.ctx, 50, 50, 6, { skins, occupied: false }), true, '空草点走火与钢绘制');
    assert.ok(emptyPaint.ops.some((op) => op.fn === 'createLinearGradient'
        && op.gradient.stops.some(([, color]) => color === '#e11f26')), '三角主体使用猩红渐变');
    assert.ok(emptyPaint.ops.some((op) => op.fn === 'lineTo'), '单草绘制三角轮廓');
    assert.strictEqual(emptyPaint.ops.filter((op) => op.fn === 'arc').length, 0, '单草不带圆形边框');
    ok('火与钢：空草点为红色三角');

    // 空草点：双草为「圆形边框 + 三角 + 中心刀纹」
    const doublePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_double(doublePaint.ctx, 50, 50, 6, { skins, occupied: false }), true, '双草走火与钢专用绘制');
    assert.ok(doublePaint.ops.filter((op) => op.fn === 'arc').length >= 2, '双草绘制圆形边框与内衬暗圈');
    assert.ok(doublePaint.ops.filter((op) => op.fn === 'lineTo').length >= 6, '双草保留三角并叠加径向刻度');
    assert.ok(doublePaint.ops.some((op) => op.fn === 'quadraticCurveTo'), '双草绘制刀身');
    assert.ok(doublePaint.ops.some((op) => op.fn === 'rect'), '双草绘制刀柄');
    ok('火与钢：双草为圆形边框 + 三角 + 中心刀纹');

    // 被棋子占据：火焰环绕，中心镂空不遮挡棋子
    const occupiedPaint = makeCtx();
    assert.strictEqual(Skins.draw_grass(occupiedPaint.ctx, 50, 50, 6, { skins, occupied: true, stone_radius: 24 }), true, '有子占据时改画火焰');
    const glow = occupiedPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(glow, '火焰使用径向渐变打底');
    assert.strictEqual(glow.gradient.stops[0][1], 'rgba(255, 110, 40, 0)', '火焰中心透明，棋子本体完整露出');
    assert.ok(occupiedPaint.ops.some((op) => op.fn === 'quadraticCurveTo'), '火焰由多条火舌组成');
    assert.ok(occupiedPaint.ops.some((op) => op.fn === 'arc' && Math.abs(op.args[2] - 24 * 1.34 * 1.16) < 0.01), '火焰外缘以棋子半径为基准');
    assert.strictEqual(occupiedPaint.ops.filter((op) => op.fn === 'lineTo').length, 0, '被占据时不再绘制三角');
    ok('火与钢：有子占据时火焰环绕棋子');

    // 双草被占据：火焰更炽烈猩红（火舌更多、带爆散火星）
    const intensePaint = makeCtx();
    assert.strictEqual(Skins.draw_grass_double(intensePaint.ctx, 50, 50, 6, { skins, occupied: true, stone_radius: 24 }), true, '双草被占据走炽烈火焰');
    const normalFills = occupiedPaint.ops.filter((op) => op.fn === 'fill').length;
    const intenseFills = intensePaint.ops.filter((op) => op.fn === 'fill').length;
    assert.ok(intenseFills > normalFills, '双草被占据时火焰层数更多');
    assert.ok(intensePaint.ops.some((op) => op.fn === 'fill' && op.fillStyle === '#ff5a24'), '双草带爆散的火星');
    ok('火与钢：双草被占据时火焰更炽烈猩红');

    // Canvas 按棋子的真实占位切换形态
    {
        const { Canvas } = loadModule(path.join(BASE, 'js/global/game/canvas.cjs'), win);
        const canvases = Array.from({ length: 7 }, () => makeCanvas());
        const ui = new Canvas(
            canvases[0], canvases[1], canvases[2], canvases[3],
            canvases[4], canvases[5], canvases[6],
            9, 9, 0.41, 0.12, 0.062, 360,
        );
        ui.offset = 0;
        ui.spacing = 40;
        ui.size = 360;
        ui.canvas_ascend_marker = makeCanvas();
        const plant = canvases[3];

        plant.ops.length = 0;
        ui.draw_plant(4, 4);
        assert.strictEqual(plant.ops.filter((op) => op.fn === 'arc').length, 0, '空草点绘制三角而非火焰');

        ui.draw_stone_fill(3, 3, '#2c3e50');
        plant.ops.length = 0;
        ui.draw_plant(3, 3);
        assert.ok(plant.ops.some((op) => op.fn === 'createRadialGradient'), '同点有子后重绘为火焰');
        assert.ok(plant.ops.some((op) => op.fn === 'arc'), '火焰环按棋子半径展开');

        ui.clear_stone_fill(3, 3);
        plant.ops.length = 0;
        ui.draw_plant(3, 3);
        assert.strictEqual(plant.ops.filter((op) => op.fn === 'arc').length, 0, '棋子移除后草恢复为三角');
        ok('火与钢：Canvas 依据棋子占位切换三角 / 火焰');
    }

    // 商店、本地设置与背包接线
    const mustHaveFiresteel = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHaveFiresteel('js/main/shop.cjs', "id: 'grass_firesteel', price: 1299", '商店火与钢定价 1299');
    mustHaveFiresteel('js/main/shop.cjs', '草皮肤：火与钢', '商店火与钢商品名称');
    mustHaveFiresteel('js/main/shop.cjs', '利刃出鞘，重铸起源。', '商店火与钢文案');
    mustHaveFiresteel('js/main/shop.cjs', 'grass_firesteel: list.includes', '商店购买后写入本机皮肤');
    mustHaveFiresteel('js/main/index.cjs', "id: 'grass_firesteel'", '本地设置火与钢开关');
    mustHaveFiresteel('js/main/index.cjs', "grass_firesteel: skins.includes('grass_firesteel')", '账号信息同步已购火与钢');
    mustHaveFiresteel('html/index.html', "id='switch_skin_grass_firesteel'", '本地设置火与钢开关 DOM');
    ok('火与钢：商店定价 1299 与设置接线');
}

// ============================ 3.9 亚特兰蒂斯棋盘与棋子 ============================
{
    storage = makeStorage();
    win.localStorage = storage;

    // 三套棋盘 / 三套棋子互斥：亚特兰蒂斯优先级最高
    storage.setItem('4a_skins', JSON.stringify({
        board: true, board_gold: true, board_atlantis: true,
        piece: true, piece_rouge: true, piece_atlantis: true,
    }));
    const skins = Skins.read();
    assert.strictEqual(skins.board_atlantis, true, '亚特兰蒂斯棋盘已购且启用');
    assert.strictEqual(skins.board_gold, false, '亚特兰蒂斯棋盘启用时玄金让位');
    assert.strictEqual(skins.board, false, '亚特兰蒂斯棋盘启用时青玉让位');
    assert.strictEqual(skins.piece_atlantis, true, '亚特兰蒂斯棋子已购且启用');
    assert.strictEqual(skins.piece_rouge, false, '亚特兰蒂斯棋子启用时高级定制让位');
    assert.strictEqual(skins.piece, false, '亚特兰蒂斯棋子启用时基础棋子皮肤让位');
    assert.strictEqual(Skins.board_style(), 'atlantis', 'board_style 返回 atlantis');
    ok('亚特兰蒂斯：三套棋盘与三套棋子正确互斥');

    // 深海渐变的棋盘底色与金色花纹
    const boardPaint = makeCtx();
    assert.strictEqual(Skins.draw_board_atlantis(boardPaint.ctx, 360), true, '亚特兰蒂斯棋盘接管绘制');
    const baseGradient = boardPaint.ops.find((op) => op.fn === 'createLinearGradient');
    assert.ok(baseGradient && baseGradient.gradient.stops[0][1] === '#07182f', '棋盘从深海蓝起笔');
    assert.ok(baseGradient.gradient.stops.length >= 5, '底色为多段深海渐变');
    assert.ok(boardPaint.ops.filter((op) => op.fn === 'createRadialGradient').length >= 6, '叠加水光、中心辉光、星芒与暗角');
    assert.ok(boardPaint.ops.filter((op) => op.fn === 'stroke').length >= 9, '绘制多层金色圆弧');
    assert.strictEqual(boardPaint.ops.filter((op) => op.fn === 'strokeRect').length, 2, '内缘双金线');
    assert.ok(boardPaint.ops.some((op) => op.fn === 'fill' && op.fillStyle.includes('255, 214, 138')), '金点使用暖金色');
    ok('亚特兰蒂斯棋盘：深海渐变 + 金色星点 + 金色圆弧');

    // 黑子番茄 / 白子洋葱
    const tomatoPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(tomatoPaint.ctx, 50, 50, 18, '#2c3e50', { skins }), true, '黑子走番茄棋子');
    const tomatoGradient = tomatoPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(tomatoGradient && tomatoGradient.gradient.stops[1][1] === '#f05a38', '黑子使用番茄红渐变');
    assert.ok(tomatoPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('48, 5, 3')), '番茄有深红外描边');
    assert.ok(tomatoPaint.ops.some((op) => op.fn === 'ellipse'), '未解码照片时以简笔眼睛占位');

    const onionPaint = makeCtx();
    assert.strictEqual(Skins.draw_stone(onionPaint.ctx, 50, 50, 18, '#ecf0f1', { skins }), true, '白子走洋葱棋子');
    const onionGradient = onionPaint.ops.find((op) => op.fn === 'createRadialGradient');
    assert.ok(onionGradient && onionGradient.gradient.stops[0][1] === '#fffdf3', '白子使用洋葱奶白渐变');
    assert.ok(onionPaint.ops.some((op) => op.fn === 'stroke' && String(op.strokeStyle).includes('92, 72, 40')), '洋葱有暖棕外描边');
    ok('亚特兰蒂斯棋子：黑子番茄 / 白子洋葱，均贴一对眼睛');

    // Canvas 全盘联动：金色网格 + 金色宋体阿拉伯数字
    {
        const { Canvas } = loadModule(path.join(BASE, 'js/global/game/canvas.cjs'), win);
        const canvases = Array.from({ length: 7 }, () => makeCanvas());
        const ui = new Canvas(
            canvases[0], canvases[1], canvases[2], canvases[3],
            canvases[4], canvases[5], canvases[6],
            9, 9, 0.41, 0.12, 0.062, 360,
        );
        ui.offset = 0;
        ui.spacing = 40;
        ui.size = 360;
        ui.canvas_ascend_marker = makeCanvas();
        canvases[0].ops.length = 0;
        ui.draw_board();
        const base = canvases[0].ops.find((op) => op.fn === 'createLinearGradient');
        assert.ok(base && base.gradient.stops[0][1] === '#07182f', 'Canvas 使用亚特兰蒂斯棋盘');
        const borders = canvases[0].ops.filter((op) => op.fn === 'strokeRect');
        assert.ok(borders.some((op) => op.strokeStyle === '#e9c67c'), '外框改为金色');
        const texts = canvases[0].ops.filter((op) => op.fn === 'fillText').map((op) => op.args[0]);
        assert.ok(texts.includes(9) && texts.includes(5), '坐标保留阿拉伯数字');
        assert.ok(!texts.includes('IX'), '坐标不再使用罗马数字');
        const painted = canvases[0].paint.target;
        assert.strictEqual(painted.fillStyle, '#ffd77a', '坐标为亮金色');
        assert.ok(String(painted.font).includes('Songti SC'), '坐标使用宋体字族');
        ok('亚特兰蒂斯：Canvas 金色网格 + 宋体金色数字');
    }

    // 商店、设置、账号与残局预览接线
    const mustHaveAtlantis = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };
    mustHaveAtlantis('js/main/shop.cjs', "id: 'board_atlantis', price: 1999", '商店亚特兰蒂斯棋盘定价 1999');
    mustHaveAtlantis('js/main/shop.cjs', "id: 'piece_atlantis', price: 1499", '商店亚特兰蒂斯棋子定价 1499');
    mustHaveAtlantis('js/main/shop.cjs', "棋子皮肤：亚拉弥赛亚的遗留", '商店棋子商品名称');
    mustHaveAtlantis('js/main/shop.cjs', 'O Fortuna velut luna statu variabilis', '商店棋盘文案');
    mustHaveAtlantis('js/main/shop.cjs', 'board_atlantis: list.includes', '商店购买后写入本机棋盘皮肤');
    mustHaveAtlantis('js/main/shop.cjs', 'piece_atlantis: list.includes', '商店购买后写入本机棋子皮肤');
    mustHaveAtlantis('js/main/index.cjs', "id: 'board_atlantis'", '本地设置亚特兰蒂斯棋盘开关');
    mustHaveAtlantis('js/main/index.cjs', "board_atlantis: skins.includes('board_atlantis')", '账号信息同步已购棋盘');
    mustHaveAtlantis('js/main/index.cjs', "piece_atlantis: skins.includes('piece_atlantis')", '账号信息同步已购棋子');
    mustHaveAtlantis('html/index.html', "id='switch_skin_board_atlantis'", '本地设置棋盘开关 DOM');
    mustHaveAtlantis('html/index.html', "id='switch_skin_piece_atlantis'", '本地设置棋子开关 DOM');
    mustHaveAtlantis('html/user/shop.html', '.art-board-atlantis', '商店棋盘专属卡面样式');
    mustHaveAtlantis('html/user/shop.html', '.art-piece-atlantis', '商店棋子专属卡面样式');
    mustHaveAtlantis('html/endgame/index.html', 'atlantisTheme', '残局预览接入亚特兰蒂斯棋盘');
    mustHaveAtlantis('html/endgame/levels.html', 'atlantisTheme', '残局关卡预览接入亚特兰蒂斯棋盘');
    ok('亚特兰蒂斯：商店 1999 / 1499、设置、账号与预览接线');
}

// ============================ 4. AscendFx 集成 ============================
{
    const { AscendFx } = loadModule(path.join(BASE, 'js/global/game/ascendfx.cjs'), win);
    storage = makeStorage();
    win.localStorage = storage;

    const fx = new AscendFx();
    fx.spacing = 40;
    fx.stone_radius = 0.41;

    storage.setItem('4a_skins', JSON.stringify({ piece: true, grass: true }));
    fx.skins = Skins.read();
    const paint = makeCtx();
    paint.ops.length = 0;
    fx.draw_stone(paint.ctx, { x: 100, y: 100, color: '#ecf0f1', power: 2, alpha: 1 });
    assert.ok(paint.ops.some((op) => op.fn === 'createRadialGradient'), '盘旋棋子走皮肤绘制');
    assert.ok(paint.ops.some((op) => op.fn === 'ellipse'), '盘旋棋子保留高光');
    // 棋子皮肤 1 次描边 + power=2 的 1 枚草粒走预渲染外环纹理
    assert.strictEqual(paint.ops.filter((op) => op.fn === 'stroke').length, 1, '盘旋棋子与草粒均走皮肤');
    assert.strictEqual(paint.ops.filter((op) => op.fn === 'drawImage').length, 1, '草粒使用平滑外环纹理');
    ok('AscendFx：盘旋棋子与草粒走皮肤');

    storage.removeItem('4a_skins');
    storage.removeItem('4a_skin_prefs');
    fx.skins = Skins.read();
    const plain = makeCtx();
    fx.draw_stone(plain.ctx, { x: 100, y: 100, color: '#ecf0f1', power: 1, alpha: 1 });
    assert.strictEqual(plain.ops.filter((op) => op.fn === 'createRadialGradient').length, 0, '未启用时不绘制皮肤棋子');
    assert.ok(plain.ops.some((op) => op.fn === 'fill'), '未启用时绘制默认发光棋子');
    ok('AscendFx：未启用时回退默认发光棋子');

    storage.setItem('4a_skins', JSON.stringify({ piece: true, grass: true }));
    storage.setItem('4a_skin_prefs', JSON.stringify({ piece: false, grass: false }));
    fx.skins = Skins.read();
    const off = makeCtx();
    fx.draw_stone(off.ctx, { x: 100, y: 100, color: '#2c3e50', power: 0, alpha: 1 });
    assert.strictEqual(off.ops.filter((op) => op.fn === 'createRadialGradient').length, 0, '本地关闭后动画层回退默认绘制');
    ok('AscendFx 遵守本地皮肤开关');
}

// ============================ 5. 残局页面与本地设置接线 ============================
{
    const mustHave = (file, snippet, label) => {
        const text = fs.readFileSync(path.join(BASE, file), 'utf8');
        assert.ok(text.includes(snippet), `${label} 缺少: ${snippet}`);
    };

    mustHave('html/endgame/submit.html', 'Skins.draw_grass', '残局编辑器草');
    mustHave('html/endgame/submit.html', 'Skins.draw_stone', '残局编辑器棋子');
    mustHave('html/endgame/index.html', 'previewSkins.draw_stone', '残局入口预览棋子');
    mustHave('html/endgame/index.html', 'previewSkins.draw_grass', '残局入口预览草');
    ok('残局编辑器与入口预览已接入皮肤');

    mustHave('html/index.html', "id='switch_skin_piece'", '本地设置棋子开关');
    mustHave('html/index.html', "id='switch_skin_grass'", '本地设置反曲点开关');
    mustHave('html/index.html', "id='switch_skin_board'", '本地设置棋盘开关');
    mustHave('js/main/index.cjs', 'render_skin_settings', '本地设置渲染皮肤开关');
    mustHave('js/main/index.cjs', 'Skins.write_prefs', '本地设置保存皮肤开关');
    mustHave('js/main/index.cjs', '4a_skins', '账号信息同步已购皮肤');
    ok('本地设置新增皮肤开关并持久化');
}

// ============================ 6. 构建产物 ============================
{
    const builtGame = fs.readFileSync(path.join(BASE, 'root/js/global/game.min.js'), 'utf8');
    assert.ok(builtGame.includes('4a_skin_prefs') && builtGame.includes('#e63448'), 'game.min.js 已包含皮肤实现');
    assert.ok(builtGame.includes('#0a1a2e'), 'game.min.js 已包含虚空棋盘底色渐变');
    assert.ok(builtGame.includes('#5f646d') && builtGame.includes('board_gold'), 'game.min.js 已包含玄金棋盘');
    assert.ok(builtGame.includes('#1c1c22') && builtGame.includes('theme_black'), 'game.min.js 已包含黑派主题实现');
    assert.ok(builtGame.includes('#ff6a44') && builtGame.includes('grass_firesteel'), 'game.min.js 已包含火与钢草皮肤');
    const builtUi = fs.readFileSync(path.join(BASE, 'root/js/global/ui.min.js'), 'utf8');
    assert.ok(builtUi.includes('4a_skin_prefs'), 'ui.min.js 已导出皮肤模块');
    assert.ok(builtUi.includes('grass_firesteel'), 'ui.min.js 已包含火与钢草皮肤');
    assert.ok(builtUi.includes('#0a1a2e'), 'ui.min.js 已包含虚空棋盘实现');
    assert.ok(builtUi.includes('#5f646d') && builtUi.includes('board_gold'), 'ui.min.js 已包含玄金棋盘');
    assert.ok(builtUi.includes('black-scene') && builtUi.includes('theme_black'), 'ui.min.js 已包含黑派分页面场景');
    const builtMain = fs.readFileSync(path.join(BASE, 'root/js/main/index.min.js'), 'utf8');
    assert.ok(builtMain.includes('switch_skin_piece') && builtMain.includes('write_prefs'), 'main/index.min.js 已包含皮肤开关');
    assert.ok(builtMain.includes('switch_skin_board_gold'), 'main/index.min.js 已包含玄金棋盘开关');
    assert.ok(builtMain.includes('switch_skin_theme_black'), 'main/index.min.js 已包含黑派 UI 开关');
    assert.ok(builtMain.includes('switch_skin_grass_firesteel'), 'main/index.min.js 已包含火与钢草皮肤开关');
    const builtShop = fs.readFileSync(path.join(BASE, 'root/js/main/shop.min.js'), 'utf8');
    assert.ok(builtShop.includes('board_gold') && builtShop.includes('黑派'), 'main/shop.min.js 已包含黑派棋盘商品');
    assert.ok(builtShop.includes('grass_gold') && builtShop.includes('草皮肤：黄金'), 'main/shop.min.js 已包含草皮肤：黄金商品');
    assert.ok(builtShop.includes('4999') && builtShop.includes('UI替换：保存神域'), 'main/shop.min.js 已包含保存神域 UI 商品 4999');
    assert.ok(builtShop.includes('grass_firesteel') && builtShop.includes('1299') && builtShop.includes('火与钢'), 'main/shop.min.js 已包含火与钢草皮肤商品 1299');
    ok('构建产物已包含皮肤实现');

    const builtCss = fs.readFileSync(path.join(BASE, 'root/css/global.min.css'), 'utf8');
    assert.ok(builtCss.includes('theme-black') && builtCss.includes('black-backdrop'), 'global.min.css 已包含黑派主题样式');
    assert.ok(builtCss.includes('black-scene') && builtCss.includes('black-lamp-breathe'), 'global.min.css 已包含黑派动态场景');
    const htmlIndex = fs.readFileSync(path.join(BASE, 'root/index.html'), 'utf8');
    assert.ok(htmlIndex.includes('switch_skin_piece'), '发布版主页含皮肤开关');
    assert.ok(htmlIndex.includes('switch_skin_board_gold'), '发布版主页含玄金棋盘开关');
    assert.ok(htmlIndex.includes('switch_skin_theme_black'), '发布版主页含黑派 UI 开关');
    assert.ok(htmlIndex.includes('black-backdrop') && htmlIndex.includes('black-fx'), '发布版主页含黑派插画与装饰');
    assert.ok(htmlIndex.includes('switch_skin_grass_firesteel'), '发布版主页含火与钢草皮肤开关');
    assert.ok(!htmlIndex.includes('?v=replace'), '版本号已刷新');
    const htmlShop = fs.readFileSync(path.join(BASE, 'root/pages/user/shop.html'), 'utf8');
    assert.ok(htmlShop.includes('art-board-gold'), '发布版商店页含玄金棋盘卡面样式');
    assert.ok(htmlShop.includes('art-grass-gold'), '发布版商店页含金菱草卡面样式');
    assert.ok(htmlShop.includes('art-ui-black'), '发布版商店页含黑派 UI 卡面样式');
    assert.ok(htmlShop.includes('art-grass-firesteel'), '发布版商店页含火与钢草皮肤卡面样式');
    assert.ok(!htmlShop.includes('?v=replace'), '发布版商店页版本号已刷新');
    const htmlSubmit = fs.readFileSync(path.join(BASE, 'root/pages/endgame/submit.html'), 'utf8');
    assert.ok(htmlSubmit.includes('previewSkins') || htmlSubmit.includes('draw_grass'), '发布版编辑器已接入皮肤');
    assert.ok(!htmlSubmit.includes('?v=replace'), '发布版编辑器版本号已刷新');
    ok('发布版 HTML 已更新并刷新版本号');
}

console.log(`\nPASS （共 ${pass} 项断言）`);
