/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 本机皮肤（棋子 / 反曲点）缓存读取与绘制，供对局、动画与编辑器共用
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

// 已购皮肤（由商店页与账号信息写入）与本地启用开关（由本地设置写入）
const SKINS_KEY = '4a_skins';
const SKIN_PREFS_KEY = '4a_skin_prefs';

// 风格 UI 在 html 上挂载的主题类名，所有页面共用同一套蓝黑配色
const THEME_CLASS = 'theme-void';
// 风格 UI「黑派」：黑石 + 亮金装饰，与幽蓝时空互斥
const THEME_CLASS_BLACK = 'theme-black';
// 风格 UI「留青」：白纸 + 青绿晕染，清爽干净的新主题
const THEME_CLASS_LIUQING = 'theme-liuqing';

// 棋子皮肤只替换标准黑白子；ASCEND 红/蓝位置标记等保持不变
const STONE_COLORS = ['#ecf0f1', '#2c3e50'];

const skins_none = () => ({ piece: false, piece_rouge: false, piece_atlantis: false, grass: false, grass_gold: false, grass_jade: false, grass_firesteel: false, board: false, board_gold: false, board_atlantis: false, theme: false, theme_black: false, theme_liuqing: false });

/**
 * @description: 读取本机已购皮肤缓存（仅自己可见）
 * @return {{piece:boolean, piece_rouge:boolean, grass:boolean, grass_gold:boolean, board:boolean, board_gold:boolean, theme:boolean, theme_black:boolean}}
 */
const skins_owned_read = () => {
    try {
        const raw = window.localStorage.getItem(SKINS_KEY);
        if (!raw) return skins_none();
        const data = JSON.parse(raw);
        return {
            // 兼容旧缓存：曾经分开购买的黑白子合并为同一套棋子皮肤
            piece: !!data.piece || (!!data.stone_white && !!data.stone_black),
            // 高级定制棋子（Le Rouge et Le Noir）：后加的皮肤，旧缓存视为未拥有
            piece_rouge: !!data.piece_rouge,
            // 亚特兰蒂斯棋子（番茄 / 洋葱）：后加的皮肤，旧缓存视为未拥有
            piece_atlantis: !!data.piece_atlantis,
            grass: !!data.grass,
            // 金菱草皮肤：后加的皮肤，旧缓存没有该字段时视为未拥有
            grass_gold: !!data.grass_gold,
            // 白玉玲珑草皮肤：后加的皮肤，旧缓存没有该字段时视为未拥有
            grass_jade: !!data.grass_jade,
            // 火与钢草皮肤：后加的皮肤，旧缓存没有该字段时视为未拥有
            grass_firesteel: !!data.grass_firesteel,
            board: !!data.board,
            // 玄金棋盘：后加的皮肤，旧缓存没有该字段时视为未拥有
            board_gold: !!data.board_gold,
            // 亚特兰蒂斯棋盘：后加的皮肤，旧缓存视为未拥有
            board_atlantis: !!data.board_atlantis,
            theme: !!data.theme,
            // 黑派风格 UI：后加的皮肤，旧缓存没有该字段时视为未拥有
            theme_black: !!data.theme_black,
            // 留青风格 UI：后加的皮肤，旧缓存没有该字段时视为未拥有
            theme_liuqing: !!data.theme_liuqing,
        };
    } catch (_) {
        return skins_none();
    }
};

/**
 * @description: 读取本地启用开关（未设置时默认全部启用）
 * @return {{piece:boolean, piece_rouge:boolean, grass:boolean, grass_gold:boolean, board:boolean, board_gold:boolean, theme:boolean}}
 */
const skins_prefs_read = () => {
    const all_on = { piece: true, piece_rouge: true, piece_atlantis: true, grass: true, grass_gold: true, grass_jade: true, grass_firesteel: true, board: true, board_gold: true, board_atlantis: true, theme: true, theme_black: true, theme_liuqing: true };
    try {
        const raw = window.localStorage.getItem(SKIN_PREFS_KEY);
        if (!raw) return all_on;
        const data = JSON.parse(raw);
        return {
            piece: data.piece !== false,
            piece_rouge: data.piece_rouge !== false,
            piece_atlantis: data.piece_atlantis !== false,
            grass: data.grass !== false,
            grass_gold: data.grass_gold !== false,
            grass_jade: data.grass_jade !== false,
            grass_firesteel: data.grass_firesteel !== false,
            board: data.board !== false,
            board_gold: data.board_gold !== false,
            board_atlantis: data.board_atlantis !== false,
            theme: data.theme !== false,
            theme_black: data.theme_black !== false,
            theme_liuqing: data.theme_liuqing !== false,
        };
    } catch (_) {
        return all_on;
    }
};

/**
 * @description: 实际生效的皮肤（已购且本地启用）
 * @return {{piece:boolean, piece_rouge:boolean, grass:boolean, grass_gold:boolean, board:boolean, board_gold:boolean, theme:boolean, owned:object}}
 */
const skins_read = () => {
    const owned = skins_owned_read();
    const prefs = skins_prefs_read();
    // 四套草皮肤互斥：火与钢 > 白玉玲珑 > 黄金 > 反曲点，同一时间只生效一套
    const grass_firesteel = owned.grass_firesteel && prefs.grass_firesteel;
    const grass_jade = owned.grass_jade && prefs.grass_jade && !grass_firesteel;
    const grass_gold = owned.grass_gold && prefs.grass_gold && !grass_firesteel && !grass_jade;
    const grass = owned.grass && prefs.grass && !grass_firesteel && !grass_jade && !grass_gold;
    // 三套棋盘皮肤互斥：亚特兰蒂斯 > 玄金 > 青玉，同一时间只生效一套
    const board_atlantis = owned.board_atlantis && prefs.board_atlantis;
    const board_gold = owned.board_gold && prefs.board_gold && !board_atlantis;
    const board = owned.board && prefs.board && !board_atlantis && !board_gold;
    // 三套棋子皮肤互斥：亚特兰蒂斯 > 高级定制 > 基础棋子皮肤
    const piece_atlantis = owned.piece_atlantis && prefs.piece_atlantis;
    const piece_rouge = owned.piece_rouge && prefs.piece_rouge && !piece_atlantis;
    const piece = owned.piece && prefs.piece && !piece_atlantis && !piece_rouge;
    // 三套风格 UI 互斥：留青 > 黑派 > 幽蓝时空，靠前者启用时后者自动让位
    const theme_liuqing = owned.theme_liuqing && prefs.theme_liuqing;
    const theme_black = owned.theme_black && prefs.theme_black && !theme_liuqing;
    const theme = owned.theme && prefs.theme && !theme_black && !theme_liuqing;
    return {
        piece,
        piece_rouge,
        piece_atlantis,
        grass,
        grass_gold,
        grass_jade,
        grass_firesteel,
        board,
        board_gold,
        board_atlantis,
        theme,
        theme_black,
        theme_liuqing,
        owned,
    };
};

/**
 * @description: 保存本地启用开关
 * @param {{piece:boolean, piece_rouge:boolean, grass:boolean, grass_gold:boolean, board:boolean, board_gold:boolean, theme:boolean}} prefs
 * @return {void}
 */
const skins_prefs_write = (prefs) => {
    try {
        window.localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({
            piece: prefs.piece !== false,
            piece_rouge: prefs.piece_rouge !== false,
            piece_atlantis: prefs.piece_atlantis !== false,
            grass: prefs.grass !== false,
            grass_gold: prefs.grass_gold !== false,
            grass_jade: prefs.grass_jade !== false,
            grass_firesteel: prefs.grass_firesteel !== false,
            board: prefs.board !== false,
            board_gold: prefs.board_gold !== false,
            board_atlantis: prefs.board_atlantis !== false,
            theme: prefs.theme !== false,
            theme_black: prefs.theme_black !== false,
            theme_liuqing: prefs.theme_liuqing !== false,
        }));
    } catch (_) {
        // 隐私模式下 localStorage 可能不可用，忽略即可
    }
};

/**
 * @description: 当前生效的风格 UI（三套主题互斥，留青 > 黑派 > 幽蓝时空）
 * @return {'liuqing'|'black'|'void'|''}
 */
const theme_kind = () => {
    const skins = skins_read();
    if (skins.theme_liuqing) return 'liuqing';
    if (skins.theme_black) return 'black';
    if (skins.theme) return 'void';
    return '';
};

/**
 * @description: 风格 UI 是否生效（已购且本地开关打开）
 * @return {boolean}
 */
const theme_active = () => theme_kind() !== '';

/**
 * @description: 把风格 UI 主题挂到 html 上（所有页面共用；关闭时移除）
 * @return {void}
 */
const theme_apply = () => {
    if (!document.documentElement) return;
    const kind = theme_kind();
    const active = kind !== '';
    document.documentElement.classList.toggle(THEME_CLASS, kind === 'void');
    document.documentElement.classList.toggle(THEME_CLASS_BLACK, kind === 'black');
    document.documentElement.classList.toggle(THEME_CLASS_LIUQING, kind === 'liuqing');
    // 通知动态星景按最新主题状态挂载/移除
    document.dispatchEvent(new CustomEvent('void-theme-change', { detail: { active, kind } }));
};

// 皮肤模块随 ui/game bundle 在各页最早加载，直接按本机缓存决定主题，避免首屏闪白
theme_apply();

// 虚空舰队棋盘：固定种子保证星点每次重绘位置一致
const VOID_BOARD_STAR_SEED = 20261029;

/**
 * @description: 绘制虚空舰队棋盘底（黑蓝多层渐变 + 冷光 + 星点）；主题未开启时返回 false
 *                只负责盘面底色与大边框内衬，网格白线由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_void = (ctx, size) => {
    if (!theme_active()) return false;
    // 棋盘皮肤优先于主题棋盘：任一棋盘皮肤启用时让位
    const skins = skins_read();
    if (skins.board_atlantis || skins.board_gold || skins.board) return false;

    // 底色：斜向黑蓝渐变，左上偏蓝、右下偏黑，避免出现纯色平面
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#0a1a2e');
    base.addColorStop(0.28, '#0d2135');
    base.addColorStop(0.55, '#081527');
    base.addColorStop(0.78, '#060f1c');
    base.addColorStop(1, '#03070e');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 左上冷蓝星云辉光
    const nebula = ctx.createRadialGradient(
        size * 0.26, size * 0.2, 0,
        size * 0.26, size * 0.2, size * 0.95
    );
    nebula.addColorStop(0, 'rgba(66, 142, 226, 0.30)');
    nebula.addColorStop(0.42, 'rgba(34, 86, 158, 0.13)');
    nebula.addColorStop(1, 'rgba(3, 7, 14, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, size, size);

    // 右下警示红微光，呼应主题装饰色
    const signal = ctx.createRadialGradient(
        size * 0.9, size * 0.92, 0,
        size * 0.9, size * 0.92, size * 0.62
    );
    signal.addColorStop(0, 'rgba(198, 42, 66, 0.16)');
    signal.addColorStop(1, 'rgba(3, 7, 14, 0)');
    ctx.fillStyle = signal;
    ctx.fillRect(0, 0, size, size);

    // 中心冷光：让棋盘中段更通透
    const core = ctx.createRadialGradient(
        size * 0.5, size * 0.5, 0,
        size * 0.5, size * 0.5, size * 0.62
    );
    core.addColorStop(0, 'rgba(96, 176, 255, 0.14)');
    core.addColorStop(0.6, 'rgba(48, 110, 190, 0.05)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    // 星点：固定种子线性同余，重绘时位置与亮度保持一致
    let seed = VOID_BOARD_STAR_SEED;
    const next = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    ctx.save();
    for (let index = 0; index < 46; index++) {
        const x = next() * size;
        const y = next() * size;
        const radius = size * (0.0012 + next() * 0.0022);
        const alpha = 0.18 + next() * 0.42;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 232, 255, ${alpha.toFixed(3)})`;
        ctx.fill();
        ctx.closePath();
    }
    ctx.restore();

    // 暗角 + 内缘冷光，模拟舰桥玻璃质感
    const vignette = ctx.createRadialGradient(
        size * 0.5, size * 0.5, size * 0.28,
        size * 0.5, size * 0.5, size * 0.78
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(1, 4, 9, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    const bevel = size * 0.012;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(120, 186, 255, 0.34)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.restore();

    return true;
};

/**
 * @description: 绘制玄金棋盘底（黑石材质：石板灰渐变 + 低浮雕菱形切面纹理 + 抛光斜光 + 暗角）
 *                只负责盘面底色，亮金色网格线与罗马数字由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_gold = (ctx, size) => {
    const skins = skins_read();
    if (!skins.board_gold) return false;

    // 底色：偏冷的石板灰，明度整体抬高，保留金属灰调又不至于抢掉金线
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#5f646d');
    base.addColorStop(0.32, '#4b5058');
    base.addColorStop(0.66, '#3d424a');
    base.addColorStop(1, '#33383f');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 低浮雕几何纹理：错位排列的菱形切面，同一菱形左上受光、右下背光
    // 采用极低透明度叠加，让纹理与底色融为一体，不抢亮金网格线
    const facet_w = size / 7;
    const facet_h = facet_w * 0.62;
    const facet_rows = Math.ceil(size / facet_h) + 2;
    const facet_cols = Math.ceil(size / facet_w) + 2;
    for (let row = 0; row < facet_rows; row++) {
        const cy = row * facet_h;
        const offset = (row % 2) * facet_w * 0.5;
        for (let col = -1; col < facet_cols; col++) {
            const cx = col * facet_w + offset;
            // 受光面：菱形的上半部
            ctx.beginPath();
            ctx.moveTo(cx, cy - facet_h * 0.5);
            ctx.lineTo(cx - facet_w * 0.5, cy);
            ctx.lineTo(cx, cy);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.042)';
            ctx.fill();
            // 背光面：菱形的下半部
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + facet_w * 0.5, cy);
            ctx.lineTo(cx, cy + facet_h * 0.5);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
            ctx.fill();
        }
    }

    // 抛光石面的斜向反光：覆盖在纹理之上，把切面与底色统一成一块打磨过的石板
    const sheen = ctx.createLinearGradient(0, 0, size, size * 0.9);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
    sheen.addColorStop(0.3, 'rgba(226, 234, 245, 0.07)');
    sheen.addColorStop(0.66, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);

    // 四周暗角：轻压边缘，保留板材厚度但不吞噬纹理
    const vignette = ctx.createRadialGradient(
        size * 0.5, size * 0.5, size * 0.36,
        size * 0.5, size * 0.5, size * 0.88
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // 内缘金色细线，与盘面亮金网格呼应
    const bevel = size * 0.012;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(226, 190, 106, 0.46)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.restore();

    return true;
};

/**
 * @description: 绘制青玉棋盘底（温润玉底 + 云雾色斑 + 石纹脉络 + 内缘高光）
 *                只负责盘面底色，网格线与坐标由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_jade = (ctx, size) => {
    const skins = skins_read();
    // 棋盘皮肤互斥：玄金启用时青玉不再接管
    if (!skins.board) return false;

    // 玉底：左上受光的青玉渐变
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#f1f9f2');
    base.addColorStop(0.32, '#e0f1e4');
    base.addColorStop(0.62, '#c8e5d3');
    base.addColorStop(0.85, '#b3d6bf');
    base.addColorStop(1, '#9cc6ab');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 云雾状色斑：让玉面呈现温润的深浅层次
    const patches = [
        { x: 0.24, y: 0.18, r: 0.46, color: 'rgba(255, 255, 255, 0.55)' },
        { x: 0.8, y: 0.32, r: 0.34, color: 'rgba(226, 246, 232, 0.6)' },
        { x: 0.38, y: 0.86, r: 0.44, color: 'rgba(150, 200, 168, 0.28)' },
        { x: 0.88, y: 0.82, r: 0.3, color: 'rgba(255, 255, 255, 0.32)' },
    ];
    patches.forEach((patch) => {
        const glow = ctx.createRadialGradient(
            size * patch.x,
            size * patch.y,
            0,
            size * patch.x,
            size * patch.y,
            size * patch.r
        );
        glow.addColorStop(0, patch.color);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);
    });

    // 石纹脉络：固定种子，保证每次重绘的纹理保持一致
    let seed = 20260928;
    const next = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    ctx.save();
    ctx.lineCap = 'round';
    for (let index = 0; index < 7; index++) {
        const x0 = next() * size * 0.7;
        const y0 = next() * size;
        const x1 = x0 + size * (0.25 + next() * 0.45);
        const y1 = y0 + size * (next() - 0.5) * 0.28;
        const c1x = x0 + (x1 - x0) * 0.35;
        const c1y = y0 + size * (next() - 0.5) * 0.16;
        const c2x = x0 + (x1 - x0) * 0.7;
        const c2y = y0 + size * (next() - 0.5) * 0.16;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
        ctx.strokeStyle = index % 3 === 0 ? 'rgba(255, 255, 255, 0.34)' : 'rgba(96, 150, 118, 0.16)';
        ctx.lineWidth = size * (0.0016 + next() * 0.0022);
        ctx.stroke();
    }
    ctx.restore();

    // 内缘高光 + 右下暗角：勾勒玉石厚度
    const bevel = size * 0.012;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.restore();
    const edge = ctx.createLinearGradient(0, 0, size, size);
    edge.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    edge.addColorStop(1, 'rgba(46, 96, 70, 0.16)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);

    return true;
};

/**
 * @description: 绘制留青棋盘底（白纸青晕：暖白纸面 + 青绿水洗 + 细纸纤维 + 淡绿斜光）
 *                只负责盘面底色，深青网格线与坐标由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_liuqing = (ctx, size) => {
    const skins = skins_read();
    if (!skins.theme_liuqing) return false;
    // 棋盘皮肤优先于主题棋盘：任一棋盘皮肤启用时让位
    if (skins.board || skins.board_gold || skins.board_atlantis) return false;

    // 纸底：留白的暖白到极淡青绿
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#fdfefb');
    base.addColorStop(0.48, '#f6fbf5');
    base.addColorStop(1, '#eaf5ec');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 青绿水洗：两团极淡的晕染，模拟宣纸吸墨
    const washes = [
        { x: 0.16, y: 0.14, r: 0.52, color: 'rgba(126, 190, 152, 0.14)' },
        { x: 0.86, y: 0.86, r: 0.56, color: 'rgba(104, 176, 136, 0.12)' },
        { x: 0.72, y: 0.18, r: 0.3, color: 'rgba(188, 226, 199, 0.18)' },
    ];
    washes.forEach((wash) => {
        const glow = ctx.createRadialGradient(
            size * wash.x,
            size * wash.y,
            0,
            size * wash.x,
            size * wash.y,
            size * wash.r
        );
        glow.addColorStop(0, wash.color);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);
    });

    // 纸纤维：固定种子，保证重绘一致
    let seed = 20261104;
    const next = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    ctx.save();
    ctx.lineCap = 'butt';
    for (let index = 0; index < 46; index++) {
        const x0 = next() * size;
        const y0 = next() * size;
        const length = size * (0.01 + next() * 0.035);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + length, y0 + (next() - 0.5) * size * 0.006);
        ctx.strokeStyle = next() > 0.5 ? 'rgba(96, 132, 108, 0.05)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = size * (0.0005 + next() * 0.0008);
        ctx.stroke();
    }
    ctx.restore();

    // 淡绿斜光：一道很轻的斜向纸面反光
    const sheen = ctx.createLinearGradient(0, size * 0.75, size, 0);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.28)');
    sheen.addColorStop(0.78, 'rgba(142, 202, 164, 0.1)');
    sheen.addColorStop(1, 'rgba(142, 202, 164, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);

    // 内缘细线：让纸面有轻微的装裱感
    const bevel = size * 0.01;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(47, 107, 77, 0.14)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.restore();

    return true;
};

/**
 * @description: 绘制黑派棋盘底（黑石材质：深炭黑大理石渐变 + 亮金内嵌菱形纹 + 放射金线 + 抛光斜光 + 暗角）
 *                只负责盘面底色，亮金网格线与罗马数字由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_black = (ctx, size) => {
    const skins = skins_read();
    if (!skins.theme_black) return false;
    // 棋盘皮肤优先于主题棋盘：任一棋盘皮肤启用时让位
    if (skins.board_atlantis || skins.board_gold || skins.board) return false;

    // 底色：深炭黑大理石，左上略受光、右下收黑
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#1c1c22');
    base.addColorStop(0.3, '#141419');
    base.addColorStop(0.62, '#0d0d11');
    base.addColorStop(0.86, '#08080b');
    base.addColorStop(1, '#040405');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 中心暖金光：呼应大厅顶部的日轮灯，让盘面中部通透
    const core = ctx.createRadialGradient(
        size * 0.5, size * 0.5, 0,
        size * 0.5, size * 0.5, size * 0.72
    );
    core.addColorStop(0, 'rgba(226, 186, 98, 0.14)');
    core.addColorStop(0.5, 'rgba(180, 138, 60, 0.06)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    // 放射金线：八条极淡的金线由中心射向边缘，模拟黑派大厅地面的拼花
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 196, 115, 0.1)';
    ctx.lineWidth = Math.max(1, size * 0.0025);
    for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4 + Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.5);
        ctx.lineTo(size * (0.5 + Math.cos(angle) * 0.78), size * (0.5 + Math.sin(angle) * 0.78));
        ctx.stroke();
        ctx.closePath();
    }
    ctx.restore();

    // 内嵌菱形纹：多层同心的亮金细框，中心最密、向外渐疏
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = 'rgba(232, 196, 115, 0.2)';
    for (let index = 0; index < 5; index++) {
        const half = size * (0.14 + index * 0.085);
        ctx.lineWidth = Math.max(1, size * (index === 0 ? 0.004 : 0.0022));
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.5 - half);
        ctx.lineTo(size * 0.5 + half, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.5 + half);
        ctx.lineTo(size * 0.5 - half, size * 0.5);
        ctx.closePath();
        ctx.stroke();
    }
    ctx.restore();

    // 抛光石面的斜向反光
    const sheen = ctx.createLinearGradient(0, 0, size, size * 0.9);
    sheen.addColorStop(0, 'rgba(255, 246, 222, 0.11)');
    sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0.04)');
    sheen.addColorStop(0.68, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);

    // 四周暗角
    const vignette = ctx.createRadialGradient(
        size * 0.5, size * 0.5, size * 0.34,
        size * 0.5, size * 0.5, size * 0.9
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // 内缘双金线，与盘面亮金网格呼应
    const bevel = size * 0.012;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(232, 196, 115, 0.52)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.lineWidth = Math.max(1, bevel / 3);
    ctx.strokeStyle = 'rgba(255, 226, 154, 0.34)';
    ctx.strokeRect(bevel * 2, bevel * 2, size - bevel * 4, size - bevel * 4);
    ctx.restore();

    return true;
};

// 亚特兰蒂斯棋盘：深海渐变 + 金色星点 + 金色圆弧暗纹，固定种子保证重绘一致
const ATLANTIS_BOARD_SEED = 20261103;

/**
 * @description: 绘制亚特兰蒂斯棋盘底（深海蓝渐变 + 金色星点 + 金色圆弧花纹 + 暗角）
 *                只负责盘面底色，金色网格线与宋体金色坐标由各调用方自行绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size 棋盘边长（正方形）
 * @return {boolean}
 */
const draw_board_atlantis = (ctx, size) => {
    const skins = skins_read();
    if (!skins.board_atlantis) return false;

    // 底色：自上而下由深海蓝压入近黑，保留一点青绿暗示沉没的城邦
    const base = ctx.createLinearGradient(0, 0, size * 0.86, size);
    base.addColorStop(0, '#07182f');
    base.addColorStop(0.22, '#0a2748');
    base.addColorStop(0.46, '#07223d');
    base.addColorStop(0.72, '#04152b');
    base.addColorStop(1, '#020a18');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 左上冷青水光：模拟海面透下来的光柱
    const caustic = ctx.createRadialGradient(
        size * 0.22, size * 0.12, 0,
        size * 0.22, size * 0.12, size * 0.92
    );
    caustic.addColorStop(0, 'rgba(86, 196, 208, 0.24)');
    caustic.addColorStop(0.4, 'rgba(38, 106, 156, 0.12)');
    caustic.addColorStop(1, 'rgba(2, 10, 24, 0)');
    ctx.fillStyle = caustic;
    ctx.fillRect(0, 0, size, size);

    // 中心幽蓝辉光：让棋盘中部不显得死黑
    const core = ctx.createRadialGradient(
        size * 0.5, size * 0.52, 0,
        size * 0.5, size * 0.52, size * 0.62
    );
    core.addColorStop(0, 'rgba(110, 168, 220, 0.1)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    // 金色圆弧花纹：大圆弧沉在左下与右上，像沉没神殿的残环
    const arcs = [
        { x: 0.16, y: 0.84, r: 0.44, start: -1.15, end: 0.62, w: 0.006, a: 0.34 },
        { x: 0.16, y: 0.84, r: 0.54, start: -1.02, end: 0.48, w: 0.0035, a: 0.24 },
        { x: 0.16, y: 0.84, r: 0.66, start: -0.9, end: 0.3, w: 0.0025, a: 0.15 },
        { x: 0.86, y: 0.15, r: 0.30, start: 1.9, end: 4.0, w: 0.0045, a: 0.3 },
        { x: 0.86, y: 0.15, r: 0.40, start: 2.05, end: 3.82, w: 0.003, a: 0.2 },
        { x: 0.86, y: 0.15, r: 0.52, start: 2.2, end: 3.55, w: 0.0022, a: 0.12 },
    ];
    ctx.save();
    arcs.forEach((arc) => {
        ctx.beginPath();
        ctx.arc(size * arc.x, size * arc.y, size * arc.r, arc.start, arc.end);
        ctx.strokeStyle = `rgba(238, 199, 122, ${arc.a})`;
        ctx.lineWidth = Math.max(1, size * arc.w);
        ctx.stroke();
        ctx.closePath();
    });
    // 同心细弧：靠近中心的半圈，加强花纹层次
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.33, Math.PI * 0.18, Math.PI * 1.18);
    ctx.strokeStyle = 'rgba(238, 199, 122, 0.1)';
    ctx.lineWidth = Math.max(1, size * 0.002);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // 金色星点 / 微光尘埃：固定种子分布，亮星带十字光芒
    let seed = ATLANTIS_BOARD_SEED;
    const next = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    ctx.save();
    for (let index = 0; index < 88; index++) {
        const x = next() * size;
        const y = next() * size;
        const radius = size * (0.001 + next() * 0.0028);
        const alpha = 0.22 + next() * 0.58;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 214, 138, ${alpha.toFixed(3)})`;
        ctx.fill();
        ctx.closePath();
    }
    // 八颗较亮的金星：十字光晕 + 光点
    for (let index = 0; index < 8; index++) {
        const x = size * (0.12 + next() * 0.76);
        const y = size * (0.1 + next() * 0.8);
        const flare = size * (0.006 + next() * 0.012);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, flare * 2.4);
        glow.addColorStop(0, 'rgba(255, 234, 176, 0.95)');
        glow.addColorStop(0.4, 'rgba(255, 208, 120, 0.35)');
        glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, flare * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.moveTo(x - flare * 2.2, y);
        ctx.lineTo(x + flare * 2.2, y);
        ctx.moveTo(x, y - flare * 2.2);
        ctx.lineTo(x, y + flare * 2.2);
        ctx.strokeStyle = 'rgba(255, 226, 160, 0.5)';
        ctx.lineWidth = Math.max(0.6, size * 0.0016);
        ctx.stroke();
        ctx.closePath();
    }
    ctx.restore();

    // 四周暗角：向边缘压暗，突出中央金色星点
    const vignette = ctx.createRadialGradient(
        size * 0.5, size * 0.5, size * 0.3,
        size * 0.5, size * 0.5, size * 0.85
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 5, 14, 0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // 内缘双金线：与金色网格呼应，同时勾出棋盘厚度
    const bevel = size * 0.012;
    ctx.save();
    ctx.lineWidth = bevel;
    ctx.strokeStyle = 'rgba(232, 193, 113, 0.55)';
    ctx.strokeRect(bevel / 2, bevel / 2, size - bevel, size - bevel);
    ctx.lineWidth = Math.max(1, bevel / 3);
    ctx.strokeStyle = 'rgba(255, 226, 158, 0.3)';
    ctx.strokeRect(bevel * 2, bevel * 2, size - bevel * 4, size - bevel * 4);
    ctx.restore();

    return true;
};

// 罗马数字表：棋盘坐标只有 1~9，静态查表即可
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/**
 * @description: 阿拉伯数字转罗马数字（棋盘坐标范围 1~9）
 * @param {number} number
 * @return {string}
 */
const to_roman = (number) => {
    const value = Math.trunc(Number(number) || 0);
    return ROMAN_NUMERALS[value - 1] || String(value);
};

/**
 * @description: 当前生效的棋盘风格（棋盘皮肤（青玉 / 玄金）> 留青主题 > 黑派主题 > 虚空舰队主题 > 默认白底）
 * @return {'void'|'black'|'liuqing'|'gold'|'jade'|'none'}
 */
const board_style = () => {
    const skins = skins_read();
    // 棋盘皮肤覆盖主题棋盘；三套棋盘皮肤互斥，由 skins_read 保证只有一套生效
    if (skins.board_atlantis) return 'atlantis';
    if (skins.board_gold) return 'gold';
    if (skins.board) return 'jade';
    if (skins.theme_liuqing) return 'liuqing';
    if (skins.theme_black) return 'black';
    if (skins.theme) return 'void';
    return 'none';
};

/**
 * @description: 判断颜色是否为标准黑白子
 * @param {string} color
 * @return {boolean}
 */
const is_stone_color = (color) => STONE_COLORS.includes(color);

/**
 * @description: 绘制虚空舰队棋子（冷光能量球：白子冰白星核、黑子深空星核，双方均带冷蓝镀环）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{glow?:boolean, glow_blur?:number}} [opts]
 * @return {boolean}
 */
const draw_stone_void = (ctx, x, y, radius, color, opts = {}) => {
    const is_white = color === '#ecf0f1';

    ctx.save();
    if (opts.glow) {
        ctx.shadowColor = is_white ? 'rgba(150, 220, 255, 0.9)' : 'rgba(96, 168, 255, 0.85)';
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : radius * 0.75;
    }

    // 球体：白子为冰白行星，黑子为深空星核
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
        x + radius * 0.32,
        y - radius * 0.4,
        radius * 0.04,
        x,
        y,
        radius * 1.02
    );
    if (is_white) {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.28, '#e4f7ff');
        gradient.addColorStop(0.62, '#a9d8f2');
        gradient.addColorStop(0.88, '#5c93bf');
        gradient.addColorStop(1, '#2b5277');
    } else {
        gradient.addColorStop(0, '#274a70');
        gradient.addColorStop(0.3, '#132c47');
        gradient.addColorStop(0.66, '#08182c');
        gradient.addColorStop(1, '#020711');
    }
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 黑子表面星点：固定相对坐标，保证每次重绘外观一致
    if (!is_white) {
        const stars = [
            [0.18, -0.24, 0.9], [-0.3, 0.1, 1.1], [0.36, 0.3, 0.8],
            [0.02, 0.4, 0.7], [-0.15, -0.38, 1.0], [0.52, -0.1, 0.6],
        ];
        stars.forEach(([sx, sy, sr]) => {
            ctx.beginPath();
            ctx.arc(x + radius * sx, y + radius * sy, Math.max(0.5, radius * sr * 0.045), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(214, 240, 255, 0.85)';
            ctx.fill();
            ctx.closePath();
        });
    }

    // 冷蓝镀环：黑子靠这圈亮边在深色虚空棋盘上保持清晰轮廓
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.98, 0, Math.PI * 2);
    ctx.strokeStyle = is_white ? 'rgba(120, 196, 255, 0.55)' : 'rgba(88, 170, 255, 0.85)';
    ctx.lineWidth = Math.max(0.7, radius * 0.085);
    ctx.stroke();
    ctx.closePath();

    // 右上角高光
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.38, y - radius * 0.42, radius * 0.24, radius * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = is_white ? 'rgba(255, 255, 255, 0.9)' : 'rgba(148, 206, 255, 0.5)';
    ctx.fill();
    ctx.closePath();

    // 白子赤道冷光弧：强化行星/舷窗质感
    if (is_white) {
        ctx.beginPath();
        ctx.ellipse(x, y + radius * 0.08, radius * 0.82, radius * 0.3, 0, 0.18 * Math.PI, 0.82 * Math.PI);
        ctx.strokeStyle = 'rgba(126, 214, 255, 0.32)';
        ctx.lineWidth = Math.max(0.6, radius * 0.06);
        ctx.stroke();
        ctx.closePath();
    }

    ctx.restore();
    return true;
};

/**
 * @description: 绘制黑派棋子（白子为象牙石、黑子为黑曜石，双方均带双圈亮金镀环）；未启用时返回 false
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{skins?:object, glow?:boolean, glow_blur?:number}} [opts]
 * @return {boolean}
 */
const draw_stone_black = (ctx, x, y, radius, color, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.theme_black || !is_stone_color(color)) return false;

    const is_white = color === '#ecf0f1';
    const r = radius;

    ctx.save();
    if (opts.glow) {
        ctx.shadowColor = is_white ? 'rgba(255, 214, 132, 0.85)' : 'rgba(226, 184, 96, 0.9)';
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : r * 0.8;
    }

    // 球体：白子为象牙石，黑子为抛光黑曜石
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const base = ctx.createRadialGradient(x + r * 0.34, y - r * 0.42, r * 0.05, x, y, r * 1.05);
    if (is_white) {
        base.addColorStop(0, '#fffdf4');
        base.addColorStop(0.3, '#f7edd6');
        base.addColorStop(0.64, '#dcc79a');
        base.addColorStop(0.88, '#a68c5c');
        base.addColorStop(1, '#6f5a34');
    } else {
        base.addColorStop(0, '#3a3a42');
        base.addColorStop(0.32, '#222228');
        base.addColorStop(0.68, '#101015');
        base.addColorStop(1, '#040406');
    }
    ctx.fillStyle = base;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 双圈亮金镀环：黑派棋子的识别符，黑子靠它保持轮廓
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = is_white ? 'rgba(226, 186, 106, 0.72)' : 'rgba(240, 199, 112, 0.92)';
    ctx.lineWidth = Math.max(0.8, r * 0.1);
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = is_white ? 'rgba(190, 148, 74, 0.34)' : 'rgba(255, 222, 150, 0.34)';
    ctx.lineWidth = Math.max(0.5, r * 0.035);
    ctx.stroke();
    ctx.closePath();

    // 右上角高光
    ctx.beginPath();
    ctx.ellipse(x + r * 0.38, y - r * 0.42, r * 0.24, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = is_white ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 226, 168, 0.42)';
    ctx.fill();
    ctx.closePath();

    ctx.restore();
    return true;
};

// 亚特兰蒂斯棋子：黑子为番茄、白子为洋葱，双方都贴一对从照片裁切的眼睛
// 眼睛以 base64 内置，保证离线对局与首帧绘制都能直接使用，不依赖外部图片加载
const ATLANTIS_EYES_SRC = 'data:image/png;base64,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';
let atlantis_eyes_image = null;
try {
    if (typeof Image !== 'undefined') {
        atlantis_eyes_image = new Image();
        atlantis_eyes_image.src = ATLANTIS_EYES_SRC;
    }
} catch (_) {
    atlantis_eyes_image = null;
}

/**
 * @description: 判断内置眼睛图是否已解码完成（未完成时改画简笔眼睛，避免棋子短暂无眼）
 * @return {boolean}
 */
const atlantis_eyes_ready = () => !!(atlantis_eyes_image && atlantis_eyes_image.complete && atlantis_eyes_image.naturalWidth > 0);

/**
 * @description: 绘制一对简笔眼睛（内置照片未解码时的退路，保持构图位置一致）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @return {void}
 */
const draw_atlantis_eyes_fallback = (ctx, x, y, r) => {
    ctx.save();
    for (const side of [-1, 1]) {
        const cx = x + side * r * 0.34;
        const cy = y - r * 0.04;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.24, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(246, 242, 234, 0.95)';
        ctx.fill();
        ctx.closePath();
        ctx.beginPath();
        ctx.arc(cx + side * r * 0.02, cy, r * 0.088, 0, Math.PI * 2);
        ctx.fillStyle = '#17120f';
        ctx.fill();
        ctx.closePath();
        ctx.beginPath();
        ctx.ellipse(cx, cy - r * 0.1, r * 0.26, r * 0.1, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = 'rgba(38, 20, 16, 0.75)';
        ctx.lineWidth = Math.max(0.7, r * 0.04);
        ctx.stroke();
        ctx.closePath();
    }
    ctx.restore();
};

/**
 * @description: 绘制亚特兰蒂斯棋子（黑子番茄 / 白子洋葱，双方贴同一对眼睛）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{skins?:object, glow?:boolean, glow_blur?:number, ascend?:boolean}} [opts]
 * @return {boolean}
 */
const draw_stone_atlantis = (ctx, x, y, radius, color, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.piece_atlantis || !is_stone_color(color)) return false;

    const r = radius;
    const onion = color === '#ecf0f1';

    ctx.save();
    if (opts.glow) {
        ctx.shadowColor = onion ? 'rgba(255, 238, 198, 0.8)' : 'rgba(255, 96, 62, 0.85)';
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : r * 0.8;
    }

    // 果实主体：番茄略扁、洋葱偏圆，但都保持在棋子圆内
    const body_rx = onion ? r * 0.98 : r * 1.02;
    const body_ry = onion ? r * 0.98 : r * 0.94;
    ctx.beginPath();
    ctx.ellipse(x, y, body_rx, body_ry, 0, 0, Math.PI * 2);
    const base = ctx.createRadialGradient(
        x + r * 0.32, y - r * 0.42, r * 0.05,
        x, y, r * 1.05
    );
    if (onion) {
        base.addColorStop(0, '#fffdf3');
        base.addColorStop(0.28, '#fbf2da');
        base.addColorStop(0.58, '#ecdcb8');
        base.addColorStop(0.82, '#cdb887');
        base.addColorStop(1, '#9c8659');
    } else {
        base.addColorStop(0, '#ff9569');
        base.addColorStop(0.24, '#f05a38');
        base.addColorStop(0.58, '#cc2f1c');
        base.addColorStop(0.84, '#941509');
        base.addColorStop(1, '#5c0a05');
    }
    ctx.fillStyle = base;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 纹理只画在果实内部
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, body_rx, body_ry, 0, 0, Math.PI * 2);
    ctx.clip();

    if (onion) {
        // 洋葱：纵向纸质感条纹 + 同心层理 + 顶部青芽
        ctx.save();
        for (let index = -5; index <= 5; index++) {
            const offset = index * r * 0.19;
            ctx.beginPath();
            ctx.moveTo(x + offset, y - r);
            ctx.quadraticCurveTo(x + offset * 1.32, y, x + offset, y + r);
            ctx.strokeStyle = index % 2 === 0 ? 'rgba(196, 152, 142, 0.16)' : 'rgba(255, 252, 236, 0.24)';
            ctx.lineWidth = Math.max(1, r * (index % 2 === 0 ? 0.05 : 0.035));
            ctx.stroke();
            ctx.closePath();
        }
        for (let index = 0; index < 4; index++) {
            ctx.beginPath();
            ctx.arc(x, y + r * 0.1, r * (0.28 + index * 0.2), Math.PI * 0.86, Math.PI * 2.14);
            ctx.strokeStyle = 'rgba(160, 126, 84, 0.16)';
            ctx.lineWidth = Math.max(0.7, r * 0.018);
            ctx.stroke();
            ctx.closePath();
        }
        ctx.restore();
    } else {
        // 番茄：六道浅色瓣缝 + 底部压暗，形成果实体积
        ctx.save();
        for (let index = 0; index < 6; index++) {
            const angle = (index * Math.PI) / 3 + 0.18;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * r * 0.1, y + Math.sin(angle) * r * 0.1);
            ctx.quadraticCurveTo(
                x + Math.cos(angle + 0.12) * r * 0.62,
                y + Math.sin(angle + 0.12) * r * 0.62,
                x + Math.cos(angle + 0.03) * r * 1.02,
                y + Math.sin(angle + 0.03) * r * 1.02
            );
            ctx.strokeStyle = index % 2 === 0 ? 'rgba(255, 190, 150, 0.18)' : 'rgba(90, 8, 4, 0.2)';
            ctx.lineWidth = Math.max(0.8, r * 0.045);
            ctx.stroke();
            ctx.closePath();
        }
        ctx.restore();
    }

    // 右上角果皮高光
    ctx.beginPath();
    ctx.ellipse(x + r * 0.36, y - r * 0.44, r * 0.26, r * 0.15, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = onion ? 'rgba(255, 255, 250, 0.92)' : 'rgba(255, 230, 208, 0.72)';
    ctx.fill();
    ctx.closePath();

    // 顶部果蒂 / 青芽：只露一截在圆边，避免遮住眼睛
    if (onion) {
        ctx.save();
        ctx.strokeStyle = 'rgba(112, 148, 92, 0.9)';
        ctx.lineCap = 'round';
        [[-0.16, -0.5, -0.34, -1.18], [0.06, -0.52, 0.22, -1.3], [0.22, -0.48, 0.48, -1.06]].forEach(([x0, y0, x1, y1]) => {
            ctx.beginPath();
            ctx.moveTo(x + r * x0, y + r * y0);
            ctx.quadraticCurveTo(x + r * x1 * 0.6, y + r * y1 * 0.55, x + r * x1, y + r * y1);
            ctx.lineWidth = Math.max(1, r * 0.09);
            ctx.stroke();
            ctx.closePath();
        });
        ctx.restore();
    } else {
        ctx.save();
        ctx.translate(x, y - r * 0.82);
        for (let index = 0; index < 5; index++) {
            ctx.rotate((Math.PI * 2) / 5);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(r * 0.2, -r * 0.16, r * 0.4, -r * 0.05);
            ctx.quadraticCurveTo(r * 0.2, r * 0.06, 0, 0);
            ctx.fillStyle = 'rgba(72, 128, 68, 0.88)';
            ctx.fill();
            ctx.closePath();
        }
        ctx.restore();
    }

    // 眼睛：照片裁切的一对眼睛；未解码时用简笔眼睛占位
    if (atlantis_eyes_ready()) {
        const eye_w = r * (onion ? 1.46 : 1.52);
        const eye_h = eye_w * (270 / 620);
        ctx.drawImage(
            atlantis_eyes_image,
            x - eye_w / 2,
            y - eye_h / 2 - r * 0.04,
            eye_w,
            eye_h
        );
    } else {
        draw_atlantis_eyes_fallback(ctx, x, y, r);
    }

    // 底缘暗部：让果实看起来是实心球体
    const rim = ctx.createRadialGradient(x, y, r * 0.72, x, y, r);
    rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rim.addColorStop(1, onion ? 'rgba(70, 52, 24, 0.26)' : 'rgba(46, 4, 2, 0.46)');
    ctx.fillStyle = rim;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();

    // 外圈描边：深海棋盘上保证棋子轮廓清晰
    ctx.beginPath();
    ctx.ellipse(x, y, body_rx, body_ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = onion ? 'rgba(92, 72, 40, 0.72)' : 'rgba(48, 5, 3, 0.85)';
    ctx.lineWidth = Math.max(0.7, r * 0.06);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
    return true;
};

// 高级定制棋子：白子为红皮革层叠，黑子为黑布料镶金；打状态使用更重的纹理
const ROUGE_HIT_SEED = 20261030;

/**
 * @description: 绘制高级定制棋子（Le Rouge et Le Noir，皮革层叠 / 布料镶金）
 *                成打（opts.ascend）时切换为深色缠线与亮金纹样；未启用时返回 false
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{skins?:object, glow?:boolean, glow_blur?:number, ascend?:boolean}} [opts]
 * @return {boolean}
 */
const draw_stone_rouge = (ctx, x, y, radius, color, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.piece_rouge || !is_stone_color(color)) return false;

    const r = radius;
    const hit = !!opts.ascend;
    const is_red = color === '#ecf0f1';

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);

    if (opts.glow) {
        ctx.shadowColor = is_red ? (hit ? '#8e1a27' : '#c33a46') : (hit ? '#c9971f' : '#2f3542');
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : r * 0.75;
    }

    const base = ctx.createRadialGradient(x + r * 0.34, y - r * 0.42, r * 0.05, x, y, r * 1.05);
    if (is_red) {
        if (hit) {
            base.addColorStop(0, '#a4313f');
            base.addColorStop(0.4, '#791522');
            base.addColorStop(0.78, '#450a13');
            base.addColorStop(1, '#1c0307');
        } else {
            base.addColorStop(0, '#e15a64');
            base.addColorStop(0.34, '#c33a46');
            base.addColorStop(0.72, '#8e1c29');
            base.addColorStop(1, '#4a0d15');
        }
    } else if (hit) {
        base.addColorStop(0, '#2b3038');
        base.addColorStop(0.4, '#191c22');
        base.addColorStop(0.78, '#0b0d11');
        base.addColorStop(1, '#030406');
    } else {
        base.addColorStop(0, '#33383f');
        base.addColorStop(0.36, '#22262c');
        base.addColorStop(0.74, '#121418');
        base.addColorStop(1, '#05070a');
    }
    ctx.fillStyle = base;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 纹理只画在棋子圆内
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (is_red && !hit) {
        // 皮革分层：斜向宽条 + 条间缝线
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.66);
        const band = r * 0.44;
        for (let index = -3; index <= 3; index++) {
            const top = index * band;
            ctx.fillStyle = index % 2 === 0 ? 'rgba(255, 240, 235, 0.07)' : 'rgba(24, 4, 8, 0.16)';
            ctx.fillRect(-r * 1.5, top, r * 3, band * 0.96);
            ctx.fillStyle = 'rgba(20, 3, 6, 0.5)';
            ctx.fillRect(-r * 1.5, top, r * 3, Math.max(1, r * 0.022));
            ctx.fillStyle = 'rgba(255, 226, 220, 0.14)';
            ctx.fillRect(-r * 1.5, top + Math.max(1, r * 0.022), r * 3, Math.max(1, r * 0.016));
        }
        ctx.restore();
    } else if (is_red) {
        // 打状态：压暗后叠加交错缠线，形成密度更高的皮革层
        let seed = ROUGE_HIT_SEED;
        const next = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let index = 0; index < 26; index++) {
            const angle = next() * Math.PI * 2;
            const offset = (next() - 0.5) * r * 1.45;
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            const cx = x - ny * offset;
            const cy = y + nx * offset;
            const half = r * 1.05;
            ctx.beginPath();
            ctx.moveTo(cx - nx * half, cy - ny * half);
            ctx.lineTo(cx + nx * half, cy + ny * half);
            ctx.strokeStyle = index % 5 === 0 ? 'rgba(255, 208, 200, 0.22)' : 'rgba(255, 176, 168, 0.1)';
            ctx.lineWidth = Math.max(0.5, r * (index % 4 === 0 ? 0.038 : 0.016));
            ctx.stroke();
            ctx.closePath();
        }
    } else {
        // 布料：极细经纬织纹
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 1;
        for (let gx = -r; gx <= r; gx += r * 0.16) {
            ctx.beginPath();
            ctx.moveTo(x + gx, y - r);
            ctx.lineTo(x + gx, y + r);
            ctx.stroke();
            ctx.closePath();
        }
        for (let gy = -r; gy <= r; gy += r * 0.16) {
            ctx.beginPath();
            ctx.moveTo(x - r, y + gy);
            ctx.lineTo(x + r, y + gy);
            ctx.stroke();
            ctx.closePath();
        }
    }

    // 底缘暗部，维持球体体积感
    const rim = ctx.createRadialGradient(x, y, r * 0.68, x, y, r);
    rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rim.addColorStop(1, hit ? 'rgba(6, 2, 4, 0.8)' : 'rgba(14, 4, 8, 0.55)');
    ctx.fillStyle = rim;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // 镶金线：正常为细金纹，打状态加粗成满盘金构
    if (!is_red) {
        const gold = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        gold.addColorStop(0, '#ffe9a8');
        gold.addColorStop(0.5, '#f0c25a');
        gold.addColorStop(1, '#a9761f');
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 8;
        ctx.strokeStyle = gold;
        ctx.shadowColor = 'rgba(255, 202, 84, 0.85)';
        ctx.shadowBlur = r * (hit ? 0.5 : 0.28);
        ctx.lineWidth = Math.max(1, r * (hit ? 0.1 : 0.05));
        if (hit) {
            // 打状态：竖直与水平两条直径把圆四等分，连接圆周四个交点画出内接菱形
            [[x, y - r, x, y + r],
                [x - r, y, x + r, y]].forEach(([x0, y0, x1, y1]) => {
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.closePath();
            });
            ctx.beginPath();
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
            ctx.stroke();
            // Y=X 对角线：左下到右上，与菱形两条对角线同交于圆心，两端落在圆周上
            const diag = r * Math.SQRT1_2;
            ctx.beginPath();
            ctx.moveTo(x - diag, y + diag);
            ctx.lineTo(x + diag, y - diag);
            ctx.stroke();
            ctx.closePath();
        } else {
            // 常态：中间竖直直径 + 东北 45° 斜线 + 右下水平线（垂直于中间竖线），线端全部落在圆周上
            const diag = r * Math.SQRT1_2;
            [[x, y - r, x, y + r],
                [x, y, x + diag, y - diag],
                [x, y, x + r, y]].forEach(([x0, y0, x1, y1]) => {
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.closePath();
            });
        }
        ctx.restore();
    }

    ctx.restore();

    // 外圈描边
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = is_red ? 'rgba(30, 4, 8, 0.85)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = Math.max(0.7, r * 0.05);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
    return true;
};

/**
 * @description: 绘制棋子皮肤（半写实球体，光源在右上角）；未启用或非标准棋子时返回 false
 *                未购买棋子皮肤但开启虚空主题时，自动使用虚空能量棋子
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{skins?:object, glow?:boolean, glow_blur?:number, ascend?:boolean}} [opts]
 * @return {boolean}
 */
const draw_stone_skin = (ctx, x, y, radius, color, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!is_stone_color(color)) return false;
    // 皮肤优先级：亚特兰蒂斯 > 高级定制棋子 > 基础棋子皮肤 > 主题棋子（黑派 / 虚空） > 默认棋子
    if (skins.piece_atlantis) return draw_stone_atlantis(ctx, x, y, radius, color, opts);
    if (skins.piece_rouge) return draw_stone_rouge(ctx, x, y, radius, color, opts);
    if (!skins.piece) {
        if (skins.theme_liuqing) return draw_stone_liuqing(ctx, x, y, radius, color, opts);
        if (skins.theme_black) return draw_stone_black(ctx, x, y, radius, color, opts);
        return skins.theme ? draw_stone_void(ctx, x, y, radius, color, opts) : false;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (opts.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : radius * 0.75;
    }

    // 类纯色渐变球体，光源在右上角
    const gradient = ctx.createRadialGradient(
        x + radius * 0.34,
        y - radius * 0.42,
        radius * 0.05,
        x,
        y,
        radius * 1.05
    );
    if (color === '#ecf0f1') {
        // 白子：低亮度奶白，避免纯白刺眼
        gradient.addColorStop(0, '#f6f2e9');
        gradient.addColorStop(0.35, '#e8e2d6');
        gradient.addColorStop(0.72, '#cdc5b6');
        gradient.addColorStop(1, '#b1a898');
    } else {
        // 黑子：深灰渐变而非纯黑
        gradient.addColorStop(0, '#4a505a');
        gradient.addColorStop(0.36, '#33373f');
        gradient.addColorStop(0.74, '#1a1d23');
        gradient.addColorStop(1, '#0a0c10');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();

    // 右上角高光
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.4, y - radius * 0.44, radius * 0.27, radius * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = color === '#ecf0f1' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(186, 203, 224, 0.55)';
    ctx.fill();
    ctx.closePath();
    ctx.restore();
    return true;
};

/**
 * @description: 绘制留青棋子（温润鹅卵石质感：白子为青白瓷石、黑子为深松绿墨石，边缘极细青线）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color 标准黑白子颜色
 * @param {{glow?:boolean, glow_blur?:number}} [opts]
 * @return {boolean}
 */
const draw_stone_liuqing = (ctx, x, y, radius, color, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.theme_liuqing) return false;
    const is_white = color === '#ecf0f1';

    ctx.save();
    if (opts.glow) {
        ctx.shadowColor = is_white ? 'rgba(186, 232, 202, 0.85)' : 'rgba(96, 170, 126, 0.7)';
        ctx.shadowBlur = typeof opts.glow_blur === 'number' ? opts.glow_blur : radius * 0.7;
    }

    // 石体：柔和球面渐变，光源留在左上，干净不抢眼
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
        x - radius * 0.32,
        y - radius * 0.38,
        radius * 0.05,
        x,
        y,
        radius * 1.05
    );
    if (is_white) {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.42, '#f6fbf6');
        gradient.addColorStop(0.78, '#e1efe3');
        gradient.addColorStop(1, '#c7ddcc');
    } else {
        gradient.addColorStop(0, '#6d9380');
        gradient.addColorStop(0.4, '#436753');
        gradient.addColorStop(0.78, '#2c4a3b');
        gradient.addColorStop(1, '#1b3126');
    }
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 细边：白子淡青线，黑子更深的松绿线
    ctx.strokeStyle = is_white ? 'rgba(96, 150, 118, 0.55)' : 'rgba(12, 28, 20, 0.6)';
    ctx.lineWidth = Math.max(0.8, radius * 0.045);
    ctx.stroke();
    ctx.closePath();

    // 内侧一线浅环，像石头被水磨过的痕迹
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = is_white ? 'rgba(255, 255, 255, 0.5)' : 'rgba(150, 190, 164, 0.16)';
    ctx.lineWidth = Math.max(0.6, radius * 0.03);
    ctx.stroke();
    ctx.closePath();

    // 左上高光
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.36, y - radius * 0.4, radius * 0.26, radius * 0.16, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = is_white ? 'rgba(255, 255, 255, 0.9)' : 'rgba(196, 232, 208, 0.35)';
    ctx.fill();
    ctx.closePath();

    ctx.restore();
    return true;
};

// 反曲点外环：黑红交替、交界羽化，外观是一条宽环线；整体亮度较旧版提高
const GRASS_RING_SIZE = 256;
const GRASS_RING_OUTER = 1.15;                                  // 外沿相对草半径（总体大小不变）
const GRASS_RING_WIDTH = 0.29;                                  // 环线宽度（相对草半径）
const GRASS_RING_INNER = GRASS_RING_OUTER - GRASS_RING_WIDTH;   // 内沿 0.86
const GRASS_CORE_RADIUS = GRASS_RING_INNER + 0.02;              // 蓝色高光半径 0.88
const GRASS_RING_RED = [230, 52, 72];    // #e63448
const GRASS_RING_DARK = [36, 20, 25];    // #241419

// 缓存纹理画布；false 表示当前环境无法生成纹理（回退到分段纯色环）
let grass_ring_texture_cache = null;

/**
 * @description: 生成/复用反曲点外环纹理（黑红交界做 smoothstep 羽化，避免硬边）
 * @return {HTMLCanvasElement|false}
 */
const grass_ring_texture = () => {
    if (grass_ring_texture_cache !== null) return grass_ring_texture_cache || false;

    try {
        if (typeof document === 'undefined' || !document.createElement) throw new Error('no document');
        const canvas = document.createElement('canvas');
        canvas.width = GRASS_RING_SIZE;
        canvas.height = GRASS_RING_SIZE;
        const tex = canvas.getContext('2d');
        const image = tex.createImageData(GRASS_RING_SIZE, GRASS_RING_SIZE);
        if (!image || !image.data) throw new Error('no image data');

        const size = GRASS_RING_SIZE;
        const data = image.data;
        const center = size / 2;
        const outer_px = center - 0.5;
        const inner_px = outer_px * (GRASS_RING_INNER / GRASS_RING_OUTER);
        const quarter = Math.PI / 2;   // 每 1/4 圈为一个红→黑周期
        const half_band = 0.25;        // 红色带中心到边界的归一化距离
        const feather = 0.12;          // 交界羽化半宽（归一化角度）

        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                const dx = px + 0.5 - center;
                const dy = py + 0.5 - center;
                const dist = Math.hypot(dx, dy);
                if (dist > outer_px + 0.5 || dist < inner_px - 0.5) continue;

                const alpha = Math.min(1, outer_px + 0.5 - dist, dist - inner_px + 0.5);
                if (alpha <= 0) continue;

                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += Math.PI * 2;
                const u = (angle % quarter) / quarter;

                // 红色权重：带内为 1，跨过交界时在 feather 宽度内 smoothstep 到 0
                let near = Math.abs(u - half_band);
                if (near > 0.5) near = 1 - near;
                let red = 1;
                const edge = near - (half_band - feather);
                if (edge > 0) {
                    const t = Math.min(1, edge / (feather * 2));
                    red = 1 - t * t * (3 - 2 * t);
                }

                const offset = (py * size + px) * 4;
                data[offset] = Math.round(GRASS_RING_DARK[0] + (GRASS_RING_RED[0] - GRASS_RING_DARK[0]) * red);
                data[offset + 1] = Math.round(GRASS_RING_DARK[1] + (GRASS_RING_RED[1] - GRASS_RING_DARK[1]) * red);
                data[offset + 2] = Math.round(GRASS_RING_DARK[2] + (GRASS_RING_RED[2] - GRASS_RING_DARK[2]) * red);
                data[offset + 3] = Math.round(alpha * 255);
            }
        }

        tex.putImageData(image, 0, 0);
        grass_ring_texture_cache = canvas;
        return canvas;
    } catch (_) {
        grass_ring_texture_cache = false;
        return false;
    }
};

/**
 * @description: 绘制金菱草皮肤（金色菱形 + 斜向渐变 + 中心高光）；未启用时返回 false
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object}} [opts]
 * @return {boolean}
 */
const draw_grass_gold = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.grass_gold) return false;

    // 菱形半对角线略大于原草半径，让金色轮廓在棋盘上更醒目
    const half = radius * 1.28;
    ctx.save();

    // 菱形轮廓：上下左右四点为顶点
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);

    // 斜向金色渐变：左上亮金受光，右下深金收暗
    const gradient = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
    gradient.addColorStop(0, '#fff4c9');
    gradient.addColorStop(0.24, '#f7d873');
    gradient.addColorStop(0.56, '#dcae45');
    gradient.addColorStop(0.82, '#a97a1f');
    gradient.addColorStop(1, '#70500e');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(250, 206, 106, 0.85)';
    ctx.shadowBlur = radius * 1.05;
    ctx.fill();

    // 描边：浅金细线勾勒菱角
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 240, 186, 0.9)';
    ctx.lineWidth = Math.max(0.6, radius * 0.1);
    ctx.stroke();
    ctx.closePath();

    // 中心高光：偏左上的白色光斑向外淡出，形成金属反光
    const core = ctx.createRadialGradient(
        x - half * 0.16,
        y - half * 0.2,
        0,
        x,
        y,
        half * 0.66
    );
    core.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    core.addColorStop(0.34, 'rgba(255, 247, 214, 0.6)');
    core.addColorStop(1, 'rgba(255, 232, 158, 0)');
    ctx.beginPath();
    ctx.arc(x, y, half * 0.66, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
    return true;
};

/**
 * @description: 绘制虚空舰队反曲点（四段冷蓝脉冲环 + 环上航灯 + 星核中心）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @return {boolean}
 */
const draw_grass_void = (ctx, x, y, radius) => {
    const ring_radius = radius * ((GRASS_RING_INNER + GRASS_RING_OUTER) / 2);
    const ring_width = radius * GRASS_RING_WIDTH;
    const core_radius = radius * GRASS_CORE_RADIUS;
    const segments = 4;
    const gap = Math.PI / 12;

    ctx.save();

    // 外环：四段脉冲弧，段间留缺口；亮暗交替模拟能量流动
    ctx.shadowColor = 'rgba(80, 170, 255, 0.85)';
    ctx.shadowBlur = radius * 1.1;
    for (let index = 0; index < segments; index++) {
        const start = (index * Math.PI * 2) / segments + gap;
        const end = ((index + 1) * Math.PI * 2) / segments - gap;
        ctx.beginPath();
        ctx.arc(x, y, ring_radius, start, end);
        ctx.strokeStyle = index % 2 === 0 ? 'rgba(120, 214, 255, 0.95)' : 'rgba(58, 128, 210, 0.9)';
        ctx.lineWidth = ring_width;
        ctx.stroke();
        ctx.closePath();
    }

    // 缺口处航灯：四颗亮星，呼应舷窗边缘指示灯
    ctx.shadowBlur = 0;
    for (let index = 0; index < segments; index++) {
        const angle = (index * Math.PI * 2) / segments;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * ring_radius, y + Math.sin(angle) * ring_radius, Math.max(0.5, radius * 0.055), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(236, 248, 255, 0.95)';
        ctx.fill();
        ctx.closePath();
    }

    // 核心：冷蓝能量球，外沿过渡到深空底色
    const core = ctx.createRadialGradient(
        x - radius * 0.12,
        y - radius * 0.16,
        radius * 0.02,
        x,
        y,
        core_radius
    );
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.22, '#9fe2ff');
    core.addColorStop(0.5, '#2f9be8');
    core.addColorStop(0.78, '#123f6c');
    core.addColorStop(1, 'rgba(4, 12, 24, 0.15)');
    ctx.beginPath();
    ctx.arc(x, y, core_radius, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.shadowColor = 'rgba(96, 190, 255, 0.9)';
    ctx.shadowBlur = radius * 1.15;
    ctx.fill();
    ctx.closePath();

    // 四芒星高光：十字星芒，强化星核辨识度
    ctx.shadowBlur = 0;
    const spike = core_radius * 0.55;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = Math.max(0.5, radius * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - spike, y);
    ctx.lineTo(x + spike, y);
    ctx.moveTo(x, y - spike);
    ctx.lineTo(x, y + spike);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
    return true;
};

/**
 * @description: 绘制黑派反曲点（亮金日冕环 + 八道放射金芒 + 暖白石核）；未启用时返回 false
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object}} [opts]
 * @return {boolean}
 */
const draw_grass_black = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.theme_black) return false;

    const ring_radius = radius * 0.98;
    const ring_width = radius * 0.24;

    ctx.save();

    // 外圈亮金环：对应大厅顶部的日轮灯圈
    ctx.beginPath();
    ctx.arc(x, y, ring_radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240, 200, 118, 0.95)';
    ctx.lineWidth = ring_width;
    ctx.shadowColor = 'rgba(255, 208, 120, 0.85)';
    ctx.shadowBlur = radius * 0.9;
    ctx.stroke();
    ctx.closePath();
    ctx.shadowBlur = 0;

    // 八道放射金芒：短促的光针，让节点呈现日冕质感
    for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        const inner = ring_radius + ring_width * 0.4;
        const outer = inner + radius * (index % 2 === 0 ? 0.42 : 0.28);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.strokeStyle = index % 2 === 0 ? 'rgba(255, 220, 146, 0.72)' : 'rgba(232, 190, 106, 0.45)';
        ctx.lineWidth = Math.max(0.5, radius * (index % 2 === 0 ? 0.075 : 0.05));
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.closePath();
    }

    // 内核：暖白石核，边缘过渡到深金
    const core_radius = radius * 0.72;
    const core = ctx.createRadialGradient(
        x - radius * 0.14,
        y - radius * 0.18,
        radius * 0.03,
        x,
        y,
        core_radius
    );
    core.addColorStop(0, '#fffdf2');
    core.addColorStop(0.34, '#ffe9b8');
    core.addColorStop(0.68, '#dcae54');
    core.addColorStop(1, '#7a5416');
    ctx.beginPath();
    ctx.arc(x, y, core_radius, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
    return true;
};

// 白玉玲珑：草皮肤（玉质圆片）预渲染纹理，中心白玉向四周渐绿、外缘墨绿
const GRASS_JADE_SIZE = 256;
const GRASS_JADE_SEED = 20261031;
let grass_jade_texture_cache = null;

/**
 * @description: 生成/复用白玉玲珑纹理（玉底渐变 + 云雾絮斑 + 玉纹脉络 + 釉面高光 + 墨绿外缘）
 * @return {HTMLCanvasElement|false}
 */
const grass_jade_texture = () => {
    if (grass_jade_texture_cache !== null) return grass_jade_texture_cache || false;

    try {
        if (typeof document === 'undefined' || !document.createElement) throw new Error('no document');
        const canvas = document.createElement('canvas');
        canvas.width = GRASS_JADE_SIZE;
        canvas.height = GRASS_JADE_SIZE;
        const tex = canvas.getContext('2d');
        const size = GRASS_JADE_SIZE;
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 1;

        // 玉底：中心白玉，向外逐渐转绿，最外缘收成墨绿；光源略偏左上
        const base = tex.createRadialGradient(cx - size * 0.05, cy - size * 0.07, 0, cx, cy, r);
        base.addColorStop(0, '#fdfefb');
        base.addColorStop(0.12, '#f7fcf4');
        base.addColorStop(0.28, '#eaf6e9');
        base.addColorStop(0.42, '#d5ecda');
        base.addColorStop(0.56, '#b7dfc2');
        base.addColorStop(0.68, '#8fcaa4');
        base.addColorStop(0.78, '#63af82');
        base.addColorStop(0.86, '#418f65');
        base.addColorStop(0.92, '#2c7350');
        base.addColorStop(0.97, '#1a563c');
        base.addColorStop(1, '#0d3a28');
        tex.beginPath();
        tex.arc(cx, cy, r, 0, Math.PI * 2);
        tex.fillStyle = base;
        tex.fill();

        tex.save();
        tex.beginPath();
        tex.arc(cx, cy, r, 0, Math.PI * 2);
        tex.clip();

        // 云雾状絮斑：让白玉区通透、绿区有深浅层次，避免死板的纯渐变
        const patches = [
            { x: 0.3, y: 0.24, r: 0.34, color: 'rgba(255, 255, 255, 0.55)' },
            { x: 0.62, y: 0.4, r: 0.26, color: 'rgba(255, 255, 255, 0.35)' },
            { x: 0.22, y: 0.7, r: 0.3, color: 'rgba(226, 246, 233, 0.3)' },
            { x: 0.76, y: 0.78, r: 0.26, color: 'rgba(92, 168, 124, 0.22)' },
        ];
        patches.forEach((patch) => {
            const px = cx + size * (patch.x - 0.5);
            const py = cy + size * (patch.y - 0.5);
            const glow = tex.createRadialGradient(px, py, 0, px, py, size * patch.r);
            glow.addColorStop(0, patch.color);
            glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            tex.fillStyle = glow;
            tex.fillRect(0, 0, size, size);
        });

        // 玉纹脉络：固定种子曲线，青白两色交织，模拟玉料天然纹路
        let seed = GRASS_JADE_SEED;
        const next = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        tex.save();
        tex.lineCap = 'round';
        for (let index = 0; index < 7; index++) {
            const angle = next() * Math.PI * 2;
            const start = r * (0.35 + next() * 0.35);
            const x0 = cx + Math.cos(angle) * start;
            const y0 = cy + Math.sin(angle) * start;
            const endAngle = angle + (next() - 0.5) * 1.4;
            const x1 = cx + Math.cos(endAngle) * r * 0.98;
            const y1 = cy + Math.sin(endAngle) * r * 0.98;
            const bend = (next() - 0.5) * r * 0.55;
            const mx = (x0 + x1) / 2 - Math.sin(angle) * bend;
            const my = (y0 + y1) / 2 + Math.cos(angle) * bend;
            tex.beginPath();
            tex.moveTo(x0, y0);
            tex.quadraticCurveTo(mx, my, x1, y1);
            tex.strokeStyle = index % 3 === 0
                ? 'rgba(255, 255, 255, 0.42)'
                : (index % 3 === 1 ? 'rgba(86, 160, 120, 0.28)' : 'rgba(255, 255, 255, 0.22)');
            tex.lineWidth = size * (0.0025 + next() * 0.0035);
            tex.stroke();
        }
        tex.restore();

        // 细小絮点：模拟玉料中的天然棉絮
        for (let index = 0; index < 30; index++) {
            const angle = next() * Math.PI * 2;
            const dist = Math.sqrt(next()) * r * 0.9;
            tex.beginPath();
            tex.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, Math.max(0.6, size * (0.002 + next() * 0.004)), 0, Math.PI * 2);
            tex.fillStyle = 'rgba(255, 255, 255, 0.28)';
            tex.fill();
        }

        // 釉面高光：左上大范围斜光，营造瓷质表面
        const sheen = tex.createRadialGradient(cx - r * 0.38, cy - r * 0.44, 0, cx - r * 0.38, cy - r * 0.44, r * 1.05);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.46)');
        sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.14)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        tex.fillStyle = sheen;
        tex.fillRect(0, 0, size, size);

        // 右下暗部：塑造玉片的厚度与球面感
        const shade = tex.createRadialGradient(cx + r * 0.25, cy + r * 0.3, r * 0.2, cx, cy, r * 1.02);
        shade.addColorStop(0, 'rgba(8, 44, 30, 0)');
        shade.addColorStop(1, 'rgba(6, 34, 24, 0.5)');
        tex.fillStyle = shade;
        tex.fillRect(0, 0, size, size);

        // 内缘釉光圈：勾勒瓷面弧度，与外圈墨绿自然衔接
        tex.beginPath();
        tex.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
        tex.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        tex.lineWidth = size * 0.008;
        tex.stroke();
        tex.restore();

        // 外缘墨绿描边：压住轮廓，保证在浅色棋盘上依然清晰
        tex.beginPath();
        tex.arc(cx, cy, r, 0, Math.PI * 2);
        tex.strokeStyle = 'rgba(7, 44, 30, 0.9)';
        tex.lineWidth = Math.max(2, size * 0.014);
        tex.stroke();

        grass_jade_texture_cache = canvas;
        return canvas;
    } catch (_) {
        grass_jade_texture_cache = false;
        return false;
    }
};

/**
 * @description: 绘制白玉玲珑草皮肤（玉质圆片：中心白玉 → 四周翠绿 → 外缘墨绿）；未启用时返回 false
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object}} [opts]
 * @return {boolean}
 */
const draw_grass_jade = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.grass_jade) return false;

    // 略大于原草半径，保证玉片轮廓在棋盘上清晰可辨
    const r = radius * 1.12;
    const texture = grass_jade_texture();

    ctx.save();
    if (texture) {
        // 底层墨绿投影：让玉片略微浮起，与棋盘分层
        ctx.save();
        ctx.shadowColor = 'rgba(26, 96, 66, 0.5)';
        ctx.shadowBlur = r * 0.55;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#0d3a28';
        ctx.fill();
        ctx.restore();
        ctx.drawImage(texture, x - r, y - r, r * 2, r * 2);
    } else {
        // 无纹理环境：直接绘制径向渐变玉片，保证外观一致
        const gradient = ctx.createRadialGradient(x - r * 0.12, y - r * 0.16, 0, x, y, r);
        gradient.addColorStop(0, '#fdfefb');
        gradient.addColorStop(0.45, '#d5ecda');
        gradient.addColorStop(0.72, '#8fcaa4');
        gradient.addColorStop(0.9, '#2c7350');
        gradient.addColorStop(1, '#0d3a28');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(7, 44, 30, 0.9)';
        ctx.lineWidth = Math.max(0.6, r * 0.06);
        ctx.stroke();
    }
    ctx.restore();
    return true;
};

/**
 * @description: 火与钢——单片火焰舌（由内向外收尖的水滴形）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} angle 火舌朝向
 * @param {number} half 火舌半张角
 * @param {number} inner 内沿半径
 * @param {number} tip 舌尖半径
 * @param {string} color 填充色
 * @return {void}
 */
const firesteel_tongue = (ctx, x, y, angle, half, inner, tip, color) => {
    const at = (rad, radius) => [x + Math.cos(rad) * radius, y + Math.sin(rad) * radius];
    const left = at(angle - half, inner);
    const right = at(angle + half, inner);
    const peak = at(angle, tip);
    // 两侧控制点：贴近火焰外缘，形成向外收束的尖舌
    const cl = at(angle - half * 0.86, inner + (tip - inner) * 0.58);
    const cr = at(angle + half * 0.86, inner + (tip - inner) * 0.58);

    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    ctx.quadraticCurveTo(cl[0], cl[1], peak[0], peak[1]);
    ctx.quadraticCurveTo(cr[0], cr[1], right[0], right[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
};

/**
 * @description: 火与钢——环绕棋子的火焰环（中心镂空，避免遮挡棋子本体）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} stone_radius 棋子半径，火焰环以其为基准向外燃烧
 * @param {boolean} intense 双草被占据时使用更炽烈、更猩红的火焰
 * @return {void}
 */
const firesteel_flame_ring = (ctx, x, y, stone_radius, intense) => {
    const inner = stone_radius * 0.95;
    const outer = stone_radius * (intense ? 1.6 : 1.34);
    const count = intense ? 16 : 12;

    ctx.save();

    // 底层炽光：中心半径内完全透明，让棋子本身完整露出
    const glow = ctx.createRadialGradient(x, y, inner * 0.88, x, y, outer * 1.16);
    glow.addColorStop(0, 'rgba(255, 110, 40, 0)');
    glow.addColorStop(0.2, intense ? 'rgba(255, 92, 36, 0.36)' : 'rgba(255, 132, 56, 0.24)');
    glow.addColorStop(0.62, intense ? 'rgba(206, 20, 22, 0.24)' : 'rgba(196, 36, 28, 0.14)');
    glow.addColorStop(1, 'rgba(120, 8, 12, 0)');
    ctx.beginPath();
    ctx.arc(x, y, outer * 1.16, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.closePath();

    // 先算好每条火舌参数，再按「外层 → 中层 → 内芯」分层绘制，避免相邻火舌相互覆盖
    const tongues = [];
    for (let index = 0; index < count; index++) {
        const angle = (index * Math.PI * 2) / count - Math.PI / 2;
        const tall = index % 2 === 0 ? 1 : 0.72;
        const half = (Math.PI / count) * 0.64;
        const tip = inner + (outer - inner) * tall;
        tongues.push({ angle, half, tip });
    }

    // 外层：猩红主焰
    tongues.forEach(({ angle, half, tip }, index) => {
        firesteel_tongue(
            ctx,
            x,
            y,
            angle + (index % 3 === 0 ? 0.05 : -0.04),
            half,
            inner,
            tip,
            intense
                ? (index % 2 === 0 ? '#b40f18' : '#8c0a12')
                : (index % 2 === 0 ? '#a31017' : '#7d0c13')
        );
    });

    // 中层：橙红
    tongues.forEach(({ angle, half, tip }) => {
        firesteel_tongue(ctx, x, y, angle, half * 0.72, inner * 1.02, inner + (tip - inner) * 0.68, intense ? '#f1281b' : '#dc301a');
    });

    // 内芯：亮焰
    tongues.forEach(({ angle, half, tip }) => {
        firesteel_tongue(ctx, x, y, angle, half * 0.4, inner * 1.04, inner + (tip - inner) * 0.38, intense ? '#ff9a30' : '#ffb14a');
    });

    // 双草：额外迸出的猩红火星
    if (intense) {
        const embers = 8;
        for (let index = 0; index < embers; index++) {
            const angle = (index * Math.PI * 2) / embers + Math.PI / 8;
            const radius = outer * (index % 2 === 0 ? 0.92 : 0.76);
            ctx.beginPath();
            ctx.arc(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius,
                Math.max(0.7, stone_radius * 0.035),
                0,
                Math.PI * 2
            );
            ctx.fillStyle = index % 3 === 0 ? '#ffe0a0' : '#ff5a24';
            ctx.fill();
            ctx.closePath();
        }
    }

    ctx.restore();
};

/**
 * @description: 火与钢——红色三角徽记（双草额外叠加圆形边框与中心刀纹）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius 草的绘制半径
 * @param {boolean} double 是否为双草
 * @return {void}
 */
const firesteel_sigil = (ctx, x, y, radius, double) => {
    // 三角外接圆半径：双草整体更大，以容纳外圈与刀纹
    const R = radius * (double ? 1.7 : 1.46);
    const half_w = R * 0.866;
    const bottom = R * 0.5;

    ctx.save();

    // 双草：三角之外再套一层圆形边框，附四条径向刻度
    if (double) {
        const ring = R * 1.28;
        ctx.beginPath();
        ctx.arc(x, y, ring, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(196, 26, 34, 0.95)';
        ctx.lineWidth = Math.max(1, radius * 0.16);
        ctx.shadowColor = 'rgba(255, 64, 42, 0.8)';
        ctx.shadowBlur = radius * 0.9;
        ctx.stroke();
        ctx.closePath();
        ctx.shadowBlur = 0;

        // 内衬暗线，让圆框更立体
        ctx.beginPath();
        ctx.arc(x, y, ring - Math.max(1, radius * 0.24), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(86, 8, 12, 0.9)';
        ctx.lineWidth = Math.max(0.7, radius * 0.055);
        ctx.stroke();
        ctx.closePath();

        // 四条径向刻度：钢铁仪典感
        ctx.strokeStyle = 'rgba(255, 120, 80, 0.8)';
        ctx.lineWidth = Math.max(0.8, radius * 0.08);
        for (let index = 0; index < 4; index++) {
            const angle = (index * Math.PI) / 2 + Math.PI / 4;
            const r1 = ring + Math.max(0.8, radius * 0.1);
            const r2 = ring + Math.max(2, radius * 0.34);
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * r1, y + Math.sin(angle) * r1);
            ctx.lineTo(x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
            ctx.stroke();
            ctx.closePath();
        }
    }

    // 红色三角主体：上亮下暗的猩红渐变
    ctx.beginPath();
    ctx.moveTo(x, y - R);
    ctx.lineTo(x + half_w, y + bottom);
    ctx.lineTo(x - half_w, y + bottom);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(x - half_w, y - R, x + half_w, y + bottom);
    gradient.addColorStop(0, '#ff6a44');
    gradient.addColorStop(0.42, '#e11f26');
    gradient.addColorStop(1, '#87090f');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(255, 60, 36, 0.85)';
    ctx.shadowBlur = radius * 0.95;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#420509';
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.stroke();
    ctx.closePath();

    // 内层倒角细线
    const inner = R * 0.72;
    ctx.beginPath();
    ctx.moveTo(x, y - inner);
    ctx.lineTo(x + inner * 0.866, y + inner * 0.5);
    ctx.lineTo(x - inner * 0.866, y + inner * 0.5);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 180, 140, 0.5)';
    ctx.lineWidth = Math.max(0.6, radius * 0.035);
    ctx.stroke();

    // 双草：中心刀纹
    if (double) {
        const s = R * 0.52;
        ctx.save();
        ctx.translate(x, y);

        // 刀身：浅钢色向橙红过渡
        const blade = ctx.createLinearGradient(0, -s, 0, s * 0.5);
        blade.addColorStop(0, '#fff2da');
        blade.addColorStop(0.45, '#ffbe72');
        blade.addColorStop(1, '#e8763a');
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.34, -s * 0.22, s * 0.24, s * 0.12);
        ctx.lineTo(-s * 0.24, s * 0.12);
        ctx.quadraticCurveTo(-s * 0.34, -s * 0.22, 0, -s);
        ctx.closePath();
        ctx.fillStyle = blade;
        ctx.fill();
        ctx.strokeStyle = '#3c0508';
        ctx.lineWidth = Math.max(0.7, radius * 0.05);
        ctx.stroke();
        ctx.closePath();

        // 护手
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, s * 0.16);
        ctx.lineTo(s * 0.4, s * 0.16);
        ctx.strokeStyle = '#2f0406';
        ctx.lineWidth = Math.max(0.8, s * 0.12);
        ctx.stroke();
        ctx.closePath();

        // 刀柄
        ctx.beginPath();
        ctx.rect(-s * 0.11, s * 0.2, s * 0.22, s * 0.34);
        ctx.fillStyle = '#2b0407';
        ctx.fill();
        ctx.closePath();

        ctx.restore();
    }

    ctx.restore();
};

/**
 * @description: 绘制火与钢草皮肤；未启用时返回 false
 *                未被棋子占据：红色三角徽记（双草额外加圆框与刀纹）
 *                被棋子占据：环绕棋子的火焰（双草改为更炽烈猩红的火焰）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object, occupied?:boolean, double?:boolean, stone_radius?:number}} [opts]
 * @return {boolean}
 */
const draw_grass_firesteel = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.grass_firesteel) return false;

    if (opts.occupied) {
        // 棋子占据草点：火焰贴在棋子外缘燃烧
        const stone_radius = Number(opts.stone_radius) > 0 ? Number(opts.stone_radius) : radius * 3.4167;
        firesteel_flame_ring(ctx, x, y, stone_radius, !!opts.double);
        return true;
    }

    firesteel_sigil(ctx, x, y, radius, !!opts.double);
    return true;
};

/**
 * @description: 双草专用的火与钢绘制入口；其他草皮肤返回 false，继续走原有的双草绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object, occupied?:boolean, stone_radius?:number}} [opts]
 * @return {boolean}
 */
const draw_grass_double_skin = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.grass_firesteel) return false;
    return draw_grass_firesteel(ctx, x, y, radius, {
        skins,
        occupied: !!opts.occupied,
        double: true,
        stone_radius: opts.stone_radius,
    });
};

/**
 * @description: 绘制反曲点皮肤（放大的蓝色高光 + 外圈黑红交替的宽环线）；未启用时返回 false
 *                火与钢 / 白玉玲珑 / 金菱草皮肤启用时改走对应绘制，四套草皮肤互斥；未购买草皮肤但开启虚空主题时走能量环
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {{skins?:object, occupied?:boolean, double?:boolean, stone_radius?:number}} [opts]
 * @return {boolean}
 */
const draw_grass_skin = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (skins.grass_firesteel) {
        return draw_grass_firesteel(ctx, x, y, radius, {
            skins,
            occupied: opts.occupied,
            double: opts.double,
            stone_radius: opts.stone_radius,
        });
    }
    if (skins.grass_jade) return draw_grass_jade(ctx, x, y, radius, { skins });
    if (skins.grass_gold) return draw_grass_gold(ctx, x, y, radius, { skins });
    // 皮肤优先级：已购草皮肤 > 主题反曲点（黑派日冕 / 虚空能量环） > 默认草
    if (!skins.grass) {
        if (skins.theme_liuqing) return draw_grass_liuqing(ctx, x, y, radius, { skins });
        if (skins.theme_black) return draw_grass_black(ctx, x, y, radius, { skins });
        return skins.theme ? draw_grass_void(ctx, x, y, radius) : false;
    }

    const ring_radius = radius * ((GRASS_RING_INNER + GRASS_RING_OUTER) / 2);
    const ring_width = radius * GRASS_RING_WIDTH;
    const segments = 8;
    const texture = grass_ring_texture();
    const ring_outer = radius * GRASS_RING_OUTER;

    ctx.save();

    if (texture) {
        // 外圈：预渲染的黑红交替环，交界处已羽化，缩放绘制即可保持一致
        ctx.drawImage(texture, x - ring_outer, y - ring_outer, ring_outer * 2, ring_outer * 2);
    } else {
        // 退路：无纹理环境仍按分段纯色环绘制
        ctx.lineCap = 'butt';
        for (let index = 0; index < segments; index++) {
            const start = (index * Math.PI * 2) / segments;
            const end = ((index + 1) * Math.PI * 2) / segments;
            ctx.beginPath();
            ctx.arc(x, y, ring_radius, start, end);
            ctx.strokeStyle = index % 2 === 0 ? '#e63448' : '#241419';
            ctx.lineWidth = ring_width;
            ctx.stroke();
            ctx.closePath();
        }
    }

    // 中心：放大的蓝色高光（整体提亮）
    const core_radius = radius * GRASS_CORE_RADIUS;
    const gradient = ctx.createRadialGradient(
        x - radius * 0.18,
        y - radius * 0.2,
        radius * 0.05,
        x,
        y,
        core_radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#a8e0ff');
    gradient.addColorStop(0.62, '#3fa8f5');
    gradient.addColorStop(1, '#124a80');
    ctx.beginPath();
    ctx.arc(x, y, core_radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(96, 178, 255, 0.92)';
    ctx.shadowBlur = radius * 1.2;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
    return true;
};

/**
 * @description: 绘制留青反曲点（只保留放大的三叶草，浅绿渐变，干净轻盈）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @return {boolean}
 */
const draw_grass_liuqing = (ctx, x, y, radius, opts = {}) => {
    const skins = opts.skins || skins_read();
    if (!skins.theme_liuqing) return false;
    ctx.save();

    // 三片放大的嫩叶：去掉所有外环与白心，只留叶片本身
    ctx.translate(x, y);
    for (let index = 0; index < 3; index++) {
        ctx.save();
        ctx.rotate((index * Math.PI * 2) / 3);
        // 叶尖朝外、叶柄朝心，浅绿渐变让叶片更通透
        const leaf = ctx.createLinearGradient(0, -radius * 0.84, 0, radius * 0.08);
        leaf.addColorStop(0, '#c6f2d3');
        leaf.addColorStop(0.55, '#8fdaa8');
        leaf.addColorStop(1, '#63c98c');
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.4, radius * 0.27, radius * 0.44, 0, 0, Math.PI * 2);
        ctx.fillStyle = leaf;
        ctx.shadowColor = 'rgba(126, 211, 161, 0.42)';
        ctx.shadowBlur = radius * 0.28;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
        // 极细浅绿描边，白盘上也不糊
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.4, radius * 0.27, radius * 0.44, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 174, 116, 0.35)';
        ctx.lineWidth = Math.max(0.6, radius * 0.02);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }

    ctx.restore();
    return true;
};

const Skins = {
    read: skins_read,
    owned: skins_owned_read,
    prefs: skins_prefs_read,
    write_prefs: skins_prefs_write,
    theme_active,
    theme_kind,
    apply_theme: theme_apply,
    is_stone_color,
    draw_stone: draw_stone_skin,
    draw_stone_atlantis,
    draw_stone_rouge,
    draw_stone_void,
    draw_stone_black,
    draw_stone_liuqing,
    draw_grass: draw_grass_skin,
    draw_grass_double: draw_grass_double_skin,
    draw_grass_jade,
    draw_grass_gold,
    draw_grass_firesteel,
    draw_grass_void,
    draw_grass_black,
    draw_grass_liuqing,
    draw_board_void,
    draw_board_gold,
    draw_board_jade,
    draw_board_atlantis,
    draw_board_black,
    draw_board_liuqing,
    board_style,
    to_roman,
    atlantis_eyes_src: ATLANTIS_EYES_SRC,
};

export {
    Skins,
    skins_read,
    skins_owned_read,
    skins_prefs_read,
    skins_prefs_write,
    theme_active,
    theme_kind,
    theme_apply,
    is_stone_color,
    draw_stone_skin,
    draw_stone_atlantis,
    draw_stone_rouge,
    draw_stone_void,
    draw_stone_black,
    draw_stone_liuqing,
    draw_grass_skin,
    draw_grass_double_skin,
    draw_grass_jade,
    draw_grass_gold,
    draw_grass_firesteel,
    draw_grass_void,
    draw_grass_black,
    draw_grass_liuqing,
    draw_board_void,
    draw_board_gold,
    draw_board_jade,
    draw_board_atlantis,
    draw_board_black,
    draw_board_liuqing,
    board_style,
    to_roman,
};
