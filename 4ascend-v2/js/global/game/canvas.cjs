/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 绘制
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
import { Effect } from './effect.cjs';
import { AscendFx } from './ascendfx.cjs';
import { Skins } from './skin.cjs';

class Canvas {
    /**
     * @description: 游戏绘制
     * @param {HTMLCanvasElement} canvas_board
     * 
     * @param {HTMLCanvasElement} canvas_stone_fill
     * @param {HTMLCanvasElement} canvas_stone_ascend
     * 
     * @param {HTMLCanvasElement} canvas_plant
     * 
     * @param {HTMLCanvasElement} canvas_view_turn
     * @param {HTMLCanvasElement} canvas_view_ascend
     * @param {HTMLCanvasElement} canvas_view_move
     * 
     * @param {number} w
     * @param {number} h
     * 
     * @param {number} stone_radius
     * @param {number} plant_radius
     * 
     * @param {number} pad
     * @param {number} size
     * @return {Canvas}
     */
    constructor(
        canvas_board,

        canvas_stone_fill,
        canvas_stone_ascend,

        canvas_plant,

        canvas_view_turn,
        canvas_view_ascend,
        canvas_view_move,

        w, h,

        stone_radius,
        plant_radius,

        pad,
        size
    ) {
        this.canvas_board = canvas_board;

        this.canvas_stone_fill = canvas_stone_fill;
        this.canvas_stone_ascend = canvas_stone_ascend;

        this.canvas_plant = canvas_plant;

        this.canvas_view_turn = canvas_view_turn;
        this.canvas_view_ascend = canvas_view_ascend;
        this.canvas_view_move = canvas_view_move;

        this.w = w;
        this.h = h;

        this.stone_radius = stone_radius;
        this.plant_radius = plant_radius;

        this.pad = pad;
        this.size = size;

        this.dpr = window.devicePixelRatio || 1;

        this.effect = new Effect();
        this.canvas_effect = null;

        this.ascendfx = new AscendFx();
        this.canvas_ascendfx = null;
        this.canvas_ascend_marker = null;

        this.waiters_click = new Set();
        this.waiters_move = new Set();

        this.handler_click_ = this.handler_click.bind(this);
        this.handler_move_ = this.handler_move.bind(this);

        // 轮到自己回合时，棋盘外缘呼吸光晕（蓝色与无色之间平滑过渡）
        this.canvas_turn_glow = null;
        this.turn_flash_on = false;
        this.turn_flash_timer = null;
        this.turn_flash_phase = 0;
        this.turn_flash_start = null;

        // 已购皮肤：只改变本机渲染，双方棋子与草都按皮肤绘制
        this.skins = Skins.read();
        // 动画层与棋盘共用同一份皮肤状态，避免动画期间重复读取缓存
        this.ascendfx.skins = this.skins;
    };

    set_sound(sound) {
        this.sound = sound;
        if (this.ascendfx) this.ascendfx.sound = sound;
    };

    /**
     * @description: 初始化
     * @return {void}
     */
    init() {
        const size = this.size;


        // 设置尺寸
        this.canvas_board.width = size;
        this.canvas_board.height = size;

        this.canvas_stone_fill.width = size;
        this.canvas_stone_fill.height = size;

        this.canvas_stone_ascend.width = size;
        this.canvas_stone_ascend.height = size;

        this.canvas_plant.width = size;
        this.canvas_plant.height = size;

        this.canvas_view_turn.width = size;
        this.canvas_view_turn.height = size;

        this.canvas_view_ascend.width = size;
        this.canvas_view_ascend.height = size;

        this.canvas_view_move.width = size;
        this.canvas_view_move.height = size;


        // 清晰度提升
        const dpr = this.dpr;

        this.canvas_board.width = size * dpr;
        this.canvas_board.height = size * dpr;
        this.canvas_board.style.width = size + 'px';
        this.canvas_board.style.height = size + 'px';
        this.canvas_board.getContext('2d').scale(dpr, dpr);

        this.canvas_stone_fill.width = size * dpr;
        this.canvas_stone_fill.height = size * dpr;
        this.canvas_stone_fill.style.width = size + 'px';
        this.canvas_stone_fill.style.height = size + 'px';
        this.canvas_stone_fill.getContext('2d').scale(dpr, dpr);

        this.canvas_stone_ascend.width = size * dpr;
        this.canvas_stone_ascend.height = size * dpr;
        this.canvas_stone_ascend.style.width = size + 'px';
        this.canvas_stone_ascend.style.height = size + 'px';
        this.canvas_stone_ascend.getContext('2d').scale(dpr, dpr);

        this.canvas_plant.width = size * dpr;
        this.canvas_plant.height = size * dpr;
        this.canvas_plant.style.width = size + 'px';
        this.canvas_plant.style.height = size + 'px';
        this.canvas_plant.getContext('2d').scale(dpr, dpr);

        this.canvas_view_turn.width = size * dpr;
        this.canvas_view_turn.height = size * dpr;
        this.canvas_view_turn.style.width = size + 'px';
        this.canvas_view_turn.style.height = size + 'px';
        this.canvas_view_turn.getContext('2d').scale(dpr, dpr);

        this.canvas_view_ascend.width = size * dpr;
        this.canvas_view_ascend.height = size * dpr;
        this.canvas_view_ascend.style.width = size + 'px';
        this.canvas_view_ascend.style.height = size + 'px';
        this.canvas_view_ascend.getContext('2d').scale(dpr, dpr);

        this.canvas_view_move.width = size * dpr;
        this.canvas_view_move.height = size * dpr;
        this.canvas_view_move.style.width = size + 'px';
        this.canvas_view_move.style.height = size + 'px';
        this.canvas_view_move.getContext('2d').scale(dpr, dpr);


        // 特效层（动态创建的最顶层画布，无需改动 HTML）
        if (!this.canvas_effect) {
            this.canvas_effect = document.createElement('canvas');
            this.canvas_effect.id = 'canvas_effect';
            this.canvas_effect.className = this.canvas_view_move.className;
            this.canvas_view_move.parentElement.appendChild(this.canvas_effect);
        }

        this.canvas_effect.width = size * dpr;
        this.canvas_effect.height = size * dpr;
        this.canvas_effect.style.width = size + 'px';
        this.canvas_effect.style.height = size + 'px';
        this.canvas_effect.style.zIndex = '10';
        this.canvas_effect.getContext('2d').scale(dpr, dpr);

        this.effect.bind(this.canvas_effect, size);


        // ASCEND 抵消动画层（最顶层，动态创建）
        if (!this.canvas_ascendfx) {
            this.canvas_ascendfx = document.createElement('canvas');
            this.canvas_ascendfx.id = 'canvas_ascendfx';
            this.canvas_ascendfx.className = this.canvas_view_move.className;
            this.canvas_ascendfx.style.zIndex = '100';
            this.canvas_view_move.parentElement.appendChild(this.canvas_ascendfx);
        }

        this.canvas_ascendfx.width = size * dpr;
        this.canvas_ascendfx.height = size * dpr;
        this.canvas_ascendfx.style.width = size + 'px';
        this.canvas_ascendfx.style.height = size + 'px';
        this.canvas_ascendfx.style.zIndex = '100';
        this.canvas_ascendfx.getContext('2d').scale(dpr, dpr);

        this.ascendfx.bind(this.canvas_ascendfx, size, this.effect, this.sound);

        // 原棋盘位置标记层：独立于动画层，确保红/蓝位置提示持续存在
        if (!this.canvas_ascend_marker) {
            this.canvas_ascend_marker = document.createElement('canvas');
            this.canvas_ascend_marker.id = 'canvas_ascend_marker';
            this.canvas_ascend_marker.className = this.canvas_view_move.className;
            this.canvas_ascend_marker.style.zIndex = '20';
            this.canvas_view_move.parentElement.appendChild(this.canvas_ascend_marker);
        }
        this.canvas_ascend_marker.width = size * dpr;
        this.canvas_ascend_marker.height = size * dpr;
        this.canvas_ascend_marker.style.width = size + 'px';
        this.canvas_ascend_marker.style.height = size + 'px';
        this.canvas_ascend_marker.getContext('2d').scale(dpr, dpr);
        this.clear_ascend_marker();

        // 回合呼吸光晕层（最外缘柔光，独立层以便逐帧淡入淡出，不污染棋盘内容）
        if (!this.canvas_turn_glow) {
            this.canvas_turn_glow = document.createElement('canvas');
            this.canvas_turn_glow.id = 'canvas_turn_glow';
            this.canvas_turn_glow.className = this.canvas_view_move.className;
            this.canvas_turn_glow.style.zIndex = '6';
            this.canvas_view_move.parentElement.appendChild(this.canvas_turn_glow);
        }

        this.canvas_turn_glow.width = size * dpr;
        this.canvas_turn_glow.height = size * dpr;
        this.canvas_turn_glow.style.width = size + 'px';
        this.canvas_turn_glow.style.height = size + 'px';
        this.canvas_turn_glow.getContext('2d').scale(dpr, dpr);

        this.rect = this.canvas_board.getBoundingClientRect();
    };


    // /**
    //  * @description: 绘制棋盘
    //  * @return {void}
    //  */
    // draw_board() {
    //     const ctx = this.canvas_board.getContext('2d');


    //     // 清空背景
    //     ctx.fillStyle = '#ffffff';
    //     ctx.fillRect(0, 0, this.size, this.size);

    //     // 绘制最外层粗描边
    //     ctx.strokeStyle = '#333333';
    //     ctx.lineWidth = 4;
    //     ctx.strokeRect(0, 0, this.size, this.size);


    //     // 计算内部棋盘逻辑
    //     // 为了给棋子留空，我们需要从总宽度中减去两边的“安全区”
    //     // 安全区大小至少要等于棋子的实际像素半径
    //     const cell_w = this.w - 1;
    //     const cell_h = this.h - 1;

    //     // 填充，约 0.4 棋子 为 0.062填充
    //     const padding = this.size * this.pad;
    //     const draw_size = this.size - (padding * 2);

    //     // 计算网格间距
    //     const spacing_w = draw_size / cell_w;
    //     const spacing_h = draw_size / cell_h;


    //     // 绘制内部封闭网格线
    //     ctx.strokeStyle = '#cccccc';
    //     ctx.lineWidth = 1;


    //     ctx.beginPath();

    //     // 绘制所有横线与纵线
    //     for (let i = 0; i < this.w; i++) {
    //         const x = padding + i * spacing_w;
    //         ctx.moveTo(x, padding);
    //         ctx.lineTo(x, padding + draw_size);
    //     }

    //     for (let j = 0; j < this.h; j++) {
    //         const y = padding + j * spacing_h;
    //         ctx.moveTo(padding, y);
    //         ctx.lineTo(padding + draw_size, y);
    //     }

    //     ctx.stroke();
    //     ctx.closePath();


    //     // 储存计算数值
    //     this.spacing = spacing_w;
    //     this.offset = padding;
    // };


    /**
     * @description: 绘制棋盘（保留完美布局，追加自适应数字坐标）
     * @return {void}
     */
    draw_board() {
        const ctx = this.canvas_board.getContext('2d');

        // 棋盘风格优先级：棋盘皮肤（青玉 / 玄金）> 风格 UI（黑派 / 虚空舰队）> 默认白底
        // 两套棋盘皮肤互斥，Skins.read() 已保证同一时间最多只有一套生效
        const gold_board = this.skins.board_gold;
        const jade_board = this.skins.board;
        const black_theme = !gold_board && !jade_board && Boolean(this.skins.theme_black);
        const void_theme = !gold_board && !jade_board && !black_theme && Skins.theme_active();
        // 黑派棋盘的网格、坐标与描边沿用玄金棋盘的镌刻金线规则
        const gold_style = gold_board || black_theme;

        if (black_theme) {
            // 风格 UI 黑派：黑石盘面 + 亮金网格（仅本机可见）
            Skins.draw_board_black(ctx, this.size);
        } else if (void_theme) {
            Skins.draw_board_void(ctx, this.size);
        } else if (gold_board) {
            // 已购玄金棋盘：黑石材质 + 亮金网格（仅本机可见）
            Skins.draw_board_gold(ctx, this.size);
        } else if (jade_board) {
            // 已购棋盘皮肤：半写实青玉桌面（仅本机可见）
            Skins.draw_board_jade(ctx, this.size);
        } else {
            // 清空背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, this.size, this.size);
        }

        // 绘制最外层粗描边（玄金 / 黑派棋盘使用亮金描边 + 内侧暗线，仿镌刻金边）
        // 黑派主题的画面整体偏暗，金线相应收敛，避免抢过棋子与坐标
        ctx.strokeStyle = void_theme
            ? 'rgba(255, 255, 255, 0.9)'
            : (gold_board ? '#e6c16a' : (black_theme ? 'rgba(190, 152, 76, 0.62)' : (jade_board ? '#1f4a37' : '#333333')));
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, this.size, this.size);
        if (gold_style) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(2, 2, this.size - 4, this.size - 4);
        }


        // 计算内部棋盘逻辑
        const cell_w = this.w - 1;
        const cell_h = this.h - 1;

        // 填充，约 0.4 棋子 为 0.062填充
        const padding = this.size * this.pad;
        const draw_size = this.size - (padding * 2);

        // 计算网格间距
        const spacing_w = draw_size / cell_w;
        const spacing_h = draw_size / cell_h;


        // 网格金芯：玄金保持亮金，黑派用低饱和暗金，避免盘面线条过亮
        const gold_core = gold_board ? '#f1cb72' : 'rgba(180, 144, 74, 0.52)';
        // 绘制内部封闭网格线（玄金 / 黑派棋盘为“暗缝 + 亮金芯”的镌刻双线）
        ctx.strokeStyle = void_theme
            ? 'rgba(255, 255, 255, 0.62)'
            : (gold_style ? gold_core : (jade_board ? 'rgba(31, 74, 55, 0.42)' : '#cccccc'));
        ctx.lineWidth = 1;

        ctx.beginPath();

        // 绘制所有横线与纵线
        for (let i = 0; i < this.w; i++) {
            const x = padding + i * spacing_w;
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + draw_size);
        }

        for (let j = 0; j < this.h; j++) {
            const y = padding + j * spacing_h;
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + draw_size, y);
        }

        if (gold_style) {
            // 底衬暗缝：先压一道深色粗线，再叠金细芯，形成凹陷的金线
            ctx.lineWidth = 2.6;
            ctx.strokeStyle = black_theme ? 'rgba(8, 10, 13, 0.62)' : 'rgba(8, 10, 13, 0.5)';
            ctx.stroke();
            ctx.lineWidth = 1.1;
            ctx.strokeStyle = gold_core;
            ctx.stroke();
        } else {
            ctx.stroke();
        }
        ctx.closePath();


        // 储存计算数值
        this.spacing = spacing_w;
        this.offset = padding;

        // 同步给 ASCEND 动画引擎
        this.ascendfx.geometry(padding, spacing_w, this.stone_radius);


        // ==================== 以下为新增的纯动态坐标提示绘制 ====================
        
        // 1. 动态计算字号：让字体大小完美契合安全留白区域（留白的 80%，确保不压边）
        //    玄金 / 黑派棋盘的罗马数字更宽，字号单独收小，避免贴边或溢出
        const font_size = Math.floor(padding * (gold_style ? 0.48 : 0.8));

        // 玄金 / 黑派棋盘使用衬线字体 + 金色坐标；黑派降低亮度与辉光
        ctx.save();
        if (gold_style) {
            ctx.shadowColor = black_theme ? 'rgba(255, 196, 82, 0.28)' : 'rgba(255, 196, 82, 0.55)';
            ctx.shadowBlur = Math.max(1, font_size * (black_theme ? 0.1 : 0.2));
        }
        ctx.font = gold_style
            ? `bold ${font_size}px "Times New Roman", "Songti SC", Georgia, serif`
            : `bold ${font_size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = void_theme
            ? 'rgba(226, 238, 255, 0.72)'
            : (gold_board ? '#ffd77a' : (black_theme ? 'rgba(226, 186, 110, 0.78)' : (jade_board ? 'rgba(24, 58, 43, 0.62)' : 'rgba(0, 0, 0, 0.55)')));

        // 2. 动态计算文字居中的轴线位置
        // 左侧文字中轴线：死死居中在最外框 (0) 到 棋盘线起点 (padding) 的中间
        const text_left_x = padding / 2;  
        // 底部文字中轴线：死死居中在棋盘线终点 (padding + draw_size) 到 最外框 (this.size) 的中间
        const text_bottom_y = (padding + draw_size + this.size) / 2;

        // 3. 复现 HTML 示例的对齐与排布逻辑（左侧上下界微调校准）
        const left_start_y = padding;
        const left_end_y = padding + (this.h - 2) * spacing_h;
        const left_spacing = (left_end_y - left_start_y) / (this.h - 2);

        // 底部第一个“1”往左探出的安全位移（动态关联格子大小，取格子宽度的 10%）
        const first_num_offset = spacing_w * 0.1;

        for (let i = 0; i < this.w; i++) {
            // --- A. 左侧数字绘制（从下到上递增，去掉最下方的 1 以防与底部重叠） ---
            const display_num = this.h - i;
            // 玄金 / 黑派棋盘改用罗马数字（I、II、…、IX）
            const display_label = gold_style ? Skins.to_roman(display_num) : display_num;
            if (display_num !== 1) {
                const left_y = left_start_y + i * left_spacing;
                ctx.fillText(display_label, text_left_x, left_y);
            }

            // --- B. 底部数字绘制（1 到 N 严格对齐纵线坐标） ---
            const line_pos = padding + i * spacing_w;
            const bottom_label = gold_style ? Skins.to_roman(i + 1) : i + 1;
            if (i === 0) {
                // 第一个数字“1”应用安全位移
                ctx.fillText(bottom_label, line_pos - first_num_offset, text_bottom_y);
            } else {
                ctx.fillText(bottom_label, line_pos, text_bottom_y);
            }
        }
        ctx.restore();
        // ====================================================================

    };

    /**
     * @description: 开关“轮到自己回合”的棋盘外缘呼吸光晕。
     * @param {boolean} active
     * @return {void}
     */
    set_turn_flash(active) {
        const next = Boolean(active);
        if (next === this.turn_flash_on) return;
        this.turn_flash_on = next;
        if (next) this.start_turn_flash();
        else this.stop_turn_flash();
    };

    /**
     * @description: 启动外缘呼吸光晕（蓝色与无色之间平滑过渡，单次呼吸周期 4960ms）。
     * @return {void}
     */
    start_turn_flash() {
        if (this.turn_flash_timer !== null) return;
        this.turn_flash_phase = 0;
        this.turn_flash_start = performance.now();
        this.turn_flash_timer = requestAnimationFrame((now) => this.tick_turn_flash(now));
    };

    /**
     * @description: 呼吸光晕帧循环，按正弦曲线在蓝色（1）与无色（0）之间平滑过渡。
     * @param {number} now rAF 提供的时间戳
     * @return {void}
     */
    tick_turn_flash(now) {
        if (!this.turn_flash_on) return;
        // 频率较上一版再减半：单次呼吸周期 4960ms
        const period = 4960;
        const progress = ((now - this.turn_flash_start) % period) / period;
        // 平滑呼吸：0 -> 1 -> 0，避免生硬跳变
        this.turn_flash_phase = (1 - Math.cos(progress * Math.PI * 2)) / 2;
        this.draw_turn_flash();
        this.turn_flash_timer = requestAnimationFrame((t) => this.tick_turn_flash(t));
    };

    /**
     * @description: 停止外缘呼吸光晕并清空光晕层，还原棋盘原本边框。
     * @return {void}
     */
    stop_turn_flash() {
        if (this.turn_flash_timer !== null) {
            cancelAnimationFrame(this.turn_flash_timer);
            this.turn_flash_timer = null;
        }
        this.turn_flash_phase = 0;
        this.turn_flash_start = null;
        // 光晕绘制在独立层上，直接清空即可还原棋盘原本边框。
        if (this.canvas_turn_glow) {
            this.canvas_turn_glow.getContext('2d').clearRect(0, 0, this.size, this.size);
        }
    };

    /**
     * @description: 在当前相位绘制最外缘淡绿色呼吸光晕（0 = 无色，1 = 淡绿色）。
     * @return {void}
     */
    draw_turn_flash() {
        if (!this.turn_flash_on || !this.canvas_turn_glow) return;
        const ctx = this.canvas_turn_glow.getContext('2d');
        // 每帧先清空光晕层，避免半透明描边逐帧叠加、导致无法淡出
        ctx.clearRect(0, 0, this.size, this.size);
        // 无色相位不绘制任何内容，保留棋盘原本的深色外框
        if (this.turn_flash_phase <= 0) return;
        ctx.save();
        const color = '#86efac'; // 淡绿色光晕
        ctx.globalAlpha = this.turn_flash_phase * 0.85;
        ctx.lineWidth = 4; // 保持细线
        ctx.strokeStyle = color;
        // 边缘模糊：用同色阴影做柔光扩散，形成呼吸光效
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeRect(0, 0, this.size, this.size);
        ctx.restore();
    };


    /**
     * @description: 绘制常态棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_stone_fill(gx, gy, color) {
        const ctx = this.canvas_stone_fill.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;

        // 棋子皮肤为一套：黑白子同时替换
        if (Skins.draw_stone(ctx, x, y, radius, color, { skins: this.skins })) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        ctx.fill();

        // 绘制细描边
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1; // 细线
        ctx.stroke();

        ctx.closePath();
        ctx.restore();
        return;
    };

    /**
     * @description: 绘制ASCEND棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_stone_ascend(gx, gy, color) {
        const ctx = this.canvas_stone_ascend.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        // ctx.shadowColor = p.color === 'black' ? '#e74c3c' : '#3498db';
        ctx.shadowBlur = 9;
        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制移动虚线棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_stone_move(gx, gy, color) {
        const ctx = this.canvas_view_move.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius + this.spacing * this.stone_radius * 0.1;

        ctx.save(); // 保存当前画布状态
        ctx.beginPath();

        // 设置虚线样式：[实线长度, 间隙长度]
        // 这里设置为 [5, 5]，你可以根据视觉效果微调
        ctx.setLineDash([5, 5]);

        // 绘制圆弧
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // 设置描边属性
        ctx.strokeStyle = color; // 使用传入的颜色
        ctx.lineWidth = 2;       // 虚线建议稍微粗一点（比如2），否则看不清

        // 仅描边，不填充 (no ctx.fill)
        ctx.stroke();

        ctx.closePath();
        ctx.restore(); // 恢复状态，避免 setLineDash 影响后续其他绘制
    };

    /**
     * @description: 普通落子特效（冲击环 + 粒子 + 闪光）
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_effect_place(gx, gy, color) {
        if (!this.effect || !this.canvas_effect) return;

        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        this.effect.place(x, y, this.spacing * this.stone_radius, color);
    };

    /**
     * @description: ASCEND 落子特效（强化版）
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_effect_ascend(gx, gy, color) {
        if (!this.effect || !this.canvas_effect) return;

        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        this.effect.ascend(x, y, this.spacing * this.stone_radius, color);
    };

    /**
     * @description: ASCEND 棋子升起盘旋
     * @param {object[]} metas [{ gx, gy, power, color, stone_color }]
     * @param {string} side 'left' | 'right'
     * @return {Promise<void>}
     */
    ascend_lift(metas, side) {
        if (!this.ascendfx || !this.canvas_ascendfx) return Promise.resolve();

        // 先清除这一批棋子在原棋盘上的实体绘制；红/蓝位置提示单独保留
        metas.forEach((meta) => {
            this.clear_stone_fill(meta.gx, meta.gy);
            this.clear_plant(meta.gx, meta.gy);
            this.draw_ascend_marker(meta.gx, meta.gy, meta.marker_color, meta.plant || 0);
        });

        // 黑/白实体棋子在顶层动画层中升起
        return this.ascendfx.lift(metas, side);
    };

    /**
     * @description: 持续绘制原棋盘拿起位置标记
     * @param {number} gx
     * @param {number} gy
     * @param {string} color 红色=黑子，蓝色=白子
     * @param {number} plant 0=无草，1=一草，2=两草
     * @return {void}
     */
    draw_ascend_marker(gx, gy, color, plant = 0) {
        if (!this.canvas_ascend_marker) return;
        const ctx = this.canvas_ascend_marker.getContext('2d');
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;
        const radius = this.spacing * this.stone_radius;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.closePath();

        // 只在原位标记上显示草：无草不画绿色圈；一草/两草显示对应草点
        const pip_count = Math.min(2, Number(plant) || 0);
        for (let i = 0; i < pip_count; i++) {
            const px = x + (i - (pip_count - 1) / 2) * radius * 0.82;
            // 已购草皮肤：原位标记上的草点同样替换
            if (Skins.draw_grass(ctx, px, y, radius * 0.45, { skins: this.skins })) continue;
            ctx.beginPath();
            ctx.arc(px, y, radius * 0.24, 0, Math.PI * 2);
            ctx.fillStyle = '#2ecc71';
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.closePath();
        }
        ctx.restore();
    };

    /**
     * @description: 清除所有原棋盘拿起位置标记
     * @return {void}
     */
    clear_ascend_marker(gx, gy) {
        if (!this.canvas_ascend_marker) return;
        const ctx = this.canvas_ascend_marker.getContext('2d');
        if (gx === undefined || gy === undefined) {
            ctx.clearRect(0, 0, this.size, this.size);
            return;
        }
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;
        const clear = this.spacing * this.stone_radius * 1.4;
        ctx.clearRect(x - clear, y - clear, clear * 2, clear * 2);
    };

    /**
     * @description: 反击/卖血：击落指定位置的盘旋棋子
     * @param {number} gx
     * @param {number} gy
     * @return {boolean}
     */
    ascend_counter(gx, gy) {
        if (!this.ascendfx || !this.canvas_ascendfx) return false;
        const hit = this.ascendfx.counter(gx, gy);
        if (hit) this.clear_ascend_marker(gx, gy);
        return hit;
    };

    /**
     * @description: ASCEND 结算动画：碰撞抵消 + 打血
     * @param {object} targets { left: HTMLElement, right: HTMLElement }
     * @return {Promise<{damageLeft: number, damageRight: number}>}
     */
    ascend_settle(targets, on_damage_start, on_summary) {
        if (!this.ascendfx || !this.canvas_ascendfx) return Promise.resolve({ 'damageLeft': 0, 'damageRight': 0 });
        return this.ascendfx.settle(targets, on_damage_start, on_summary).then((result) => {
            // 抵消动画完成后再移除原棋盘上的红/蓝位置标记
            this.clear_ascend_marker();
            return result;
        });
    };

    /**
     * @description: 某点是否存在盘旋中的棋子
     * @param {number} gx
     * @param {number} gy
     * @return {boolean}
     */
    ascend_is_lifted(gx, gy) {
        if (!this.ascendfx) return false;
        return this.ascendfx.is_lifted(gx, gy);
    };

    /**
     * @description: 绘制回合棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @param {number} line
     * @return {void}
     */
    draw_stone_turn(gx, gy, color, line) {
        const ctx = this.canvas_view_turn.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius + this.spacing * this.stone_radius * 0.1;

        ctx.save(); // 保存当前画布状态
        ctx.beginPath();

        // 设置虚线样式：[实线长度, 间隙长度]
        // 这里设置为 [5, 5]，你可以根据视觉效果微调
        ctx.setLineDash([5, 5]);

        // 绘制圆弧
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // 设置描边属性
        ctx.strokeStyle = color; // 使用传入的颜色
        ctx.lineWidth = line;       // 虚线建议稍微粗一点（比如2），否则看不清

        // 仅描边，不填充 (no ctx.fill)
        ctx.stroke();

        ctx.closePath();
        ctx.restore(); // 恢复状态，避免 setLineDash 影响后续其他绘制
    };

    /**
     * @description: 绘制ASCEND确认棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_stone_validate(gx, gy, color) {
        const ctx = this.canvas_view_ascend.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        // ctx.fillStyle = '#2c3e50';
        // ctx.fillStyle = '#ecf0f1';
        ctx.fill();

        // 绘制细描边
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1; // 细线
        ctx.stroke();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 草生成特效
     * @param {number} gx
     * @param {number} gy
     * @param {number} count 生成的草数量
     * @return {void}
     */
    draw_effect_plant(gx, gy, count = 1) {
        if (!this.effect || !this.canvas_effect) return;

        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;
        const radius = this.spacing * this.plant_radius;

        // 草生成特效：草皮肤启用时同步使用对应光晕（白玉玲珑为玉青，金菱草为金色，反曲点为蓝色）
        this.effect.plant(x, y, radius, count, this.skins.grass_jade ? 'jade' : (this.skins.grass_gold ? 'gold' : this.skins.grass));
    };

    /**
     * @description: 绘制植物
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_plant(gx, gy, color = '#2ecc71') {
        const ctx = this.canvas_plant.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.plant_radius;

        // 已购草皮肤：仅改变本机渲染
        if (Skins.draw_grass(ctx, x, y, radius, { skins: this.skins })) return;

        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 7;
        ctx.shadowColor = color;

        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制双植物
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_2plant(gx, gy, color = '#2ecc71') {
        const ctx = this.canvas_plant.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.plant_radius;

        // 已购草皮肤：仅改变本机渲染，双草同样替换
        if (Skins.draw_grass(ctx, x - radius * 1.3, y, radius, { skins: this.skins })) {
            Skins.draw_grass(ctx, x + radius * 1.3, y, radius, { skins: this.skins });
            return;
        }

        ctx.beginPath();
        ctx.save();

        ctx.arc(x - radius * 1.3, y, radius, 0, Math.PI * 2);

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 7;
        ctx.shadowColor = color;

        ctx.fill();

        ctx.closePath();


        ctx.beginPath();

        ctx.arc(x + radius * 1.3, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 2;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };


    /**
     * @description: 擦除常态棋子
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_stone_fill(gx, gy) {
        const ctx = this.canvas_stone_fill.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius + this.spacing * (this.stone_radius * 0.3);

        ctx.clearRect(x - clear, y - clear, clear * 2, clear * 2);
    };

    /**
     * @description: 擦除ASCEND棋子
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_stone_ascend(gx, gy) {
        const ctx = this.canvas_stone_ascend.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius + this.spacing * (this.stone_radius * 0.35);

        ctx.clearRect(x - clear, y - clear, clear * 2, clear * 2);
    };

    /**
     * @description: 擦除移动落子预览
     * @return {void}
     */
    clear_view_move() {
        const ctx = this.canvas_view_move.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除回合落子预览
     * @return {void}
     */
    clear_view_turn() {
        const ctx = this.canvas_view_turn.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除回合落子预览
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_view_turnp(gx, gy) {
        const ctx = this.canvas_view_turn.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius + this.spacing * (this.stone_radius * 0.3);

        ctx.clearRect(x - clear, y - clear, clear * 2, clear * 2);
    };

    /**
     * @description: 擦除ASCEND确认预览
     * @return {void}
     */
    clear_stone_validate() {
        const ctx = this.canvas_view_ascend.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除植物
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_plant(gx, gy) {
        const ctx = this.canvas_plant.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius;

        ctx.clearRect(
            x - clear,
            y - clear,
            clear * 2,
            clear * 2
        );
    };

    /**
     * @description: 擦除棋盘
     * @return {void}
     */
    clear_board() {
        const ctx = this.canvas_board.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 清除正在运行的动画与动态画布内容，但保留棋盘和棋子层
     * @return {void}
     */
    clear_animations() {
        if (this.effect) this.effect.clear();
        if (this.ascendfx) this.ascendfx.reset();
        if (this.sound) this.sound.stop_orbit();

        [this.canvas_view_ascend, this.canvas_view_move, this.canvas_view_turn, this.canvas_turn_glow].forEach((canvas) => {
            if (canvas) canvas.getContext('2d').clearRect(0, 0, this.size, this.size);
        });
        if (this.canvas_effect) this.canvas_effect.getContext('2d').clearRect(0, 0, this.size, this.size);
        if (this.canvas_ascendfx) this.canvas_ascendfx.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.clear_ascend_marker();
    };

    /**
     * @description: 擦除全部层级
     * @return {void}
     */
    clear() {
        this.canvas_board.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.canvas_stone_fill.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.canvas_stone_ascend.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.canvas_view_ascend.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.canvas_view_move.getContext('2d').clearRect(0, 0, this.size, this.size);
        this.canvas_view_turn.getContext('2d').clearRect(0, 0, this.size, this.size);

        this.effect.clear();
        if (this.canvas_effect) {
            this.canvas_effect.style.width = 0;
            this.canvas_effect.style.height = 0;
        }

        this.ascendfx.reset();
        if (this.sound) this.sound.stop_orbit();
        this.clear_ascend_marker();
        if (this.canvas_ascendfx) {
            this.canvas_ascendfx.style.width = 0;
            this.canvas_ascendfx.style.height = 0;
        }
        if (this.canvas_ascend_marker) {
            this.canvas_ascend_marker.style.width = 0;
            this.canvas_ascend_marker.style.height = 0;
        }
        if (this.canvas_turn_glow) {
            this.canvas_turn_glow.getContext('2d').clearRect(0, 0, this.size, this.size);
            this.canvas_turn_glow.style.width = 0;
            this.canvas_turn_glow.style.height = 0;
        }
        this.canvas_board.style.width = 0;
        this.canvas_board.style.height = 0;

        this.canvas_stone_fill.style.width = 0;
        this.canvas_stone_fill.style.height = 0;

        this.canvas_stone_ascend.style.width = 0;
        this.canvas_stone_ascend.style.height = 0;

        this.canvas_view_ascend.style.width = 0;
        this.canvas_view_ascend.style.height = 0;

        this.canvas_view_move.style.width = 0;
        this.canvas_view_move.style.height = 0;

        this.canvas_view_turn.style.width = 0;
        this.canvas_view_turn.style.height = 0;
    };


    /**
     * @description: 点击坐标转换为点位
     * @param {number} cx
     * @param {number} cy
     * @return {[number, number] | void}
     */
    cxcy2grid(cx, cy) {
        const ox = this.offset;
        // 建议：spW 和 spH 最好在初始化棋盘时计算好，不要每次点击都算
        const spW = this.spacing;
        const spH = this.spacing; // 通常棋盘格子是正方形

        // 1. 减去边距，得到相对于第一个交叉点 (0,0) 的偏移
        const dx = cx - ox;
        const dy = cy - ox;

        // 2. 计算浮点索引
        const floatX = dx / spW;
        const floatY = dy / spH;

        // 3. 四舍五入到最近的交叉点
        const gridX = Math.round(floatX);
        const gridY = Math.round(floatY);

        // 4. 边界过滤
        if (gridX >= 0 && gridX < this.w && gridY >= 0 && gridY < this.h) {
            // 5. 校验点击是否在“感应圆”内
            const centerX = gridX * spW;
            const centerY = gridY * spH;

            // 计算点击点到交叉点的欧氏距离
            const distSq = Math.pow(dx - centerX, 2) + Math.pow(dy - centerY, 2);
            const radius = spW * this.stone_radius;

            if (distSq < radius * radius) return [gridX, gridY];
        }

        return;
    };


    /**
     * @description: 点击
     * @param {PointerEvent} event
     * @return {void}
     */
    handler_click(event) {
        this.rect = this.canvas_board.getBoundingClientRect(); // ？

        const rect = this.rect;
        const size = this.size;

        const cssx = event.clientX - rect.left;
        const cssy = event.clientY - rect.top;

        const scalex = size / rect.width;
        const scaley = size / rect.height;

        const drawx = cssx * scalex;
        const drawy = cssy * scaley;

        this.notify_click(this.cxcy2grid(drawx, drawy));
    };

    /**
     * @description: 移动
     * @param {PointerEvent} event
     * @return {void}
     */
    handler_move(event) {
        if (this.moveing) return;

        this.moveing = true;
        requestAnimationFrame(() => {
            this.rect = this.canvas_board.getBoundingClientRect(); // ？

            const rect = this.rect;
            const size = this.size;

            const cssx = event.clientX - rect.left;
            const cssy = event.clientY - rect.top;

            const scalex = size / rect.width;
            const scaley = size / rect.height;

            const drawx = cssx * scalex;
            const drawy = cssy * scaley;

            this.notify_move(this.cxcy2grid(drawx, drawy));
            this.moveing = false;
        });
    };


    /**
     * @description: 开始监听点击与移动
     * @return {void}
     */
    start_click2move() {
        this.canvas_board.addEventListener('pointerdown', this.handler_click_);
        this.canvas_board.addEventListener('pointermove', this.handler_move_);
    };

    /**
     * @description: 停止监听点击与移动
     * @return {void}
     */
    stop_click2move() {
        this.canvas_board.removeEventListener('pointerdown', this.handler_click_);
        this.canvas_board.removeEventListener('pointermove', this.handler_move_);

        this.notify_move('$', null);
        // this.notify_click('$', null);

        this.moveing = false;
    };


    /**
     * @description: 分发响应
     * @param {[number, number, boolean] | void} pos
     * @return {void}
     */
    notify_click(pos) {
        const current_waiters = Array.from(this.waiters_click);
        this.waiters_click.clear();
        current_waiters.forEach((resolve) => resolve(pos));
    };

    /**
     * @description: 分发响应
     * @param {[number, number] | void} pos
     * @return {void}
     */
    notify_move(pos) {
        const current_waiters = Array.from(this.waiters_move);
        this.waiters_move.clear();
        current_waiters.forEach((resolve) => resolve(pos));
    };


    /**
     * @description: 生成器 点击
     * @return {Promise<void>}
     */
    async *iterator_click() {
        while (true) yield await new Promise((resolve) => this.waiters_click.add(resolve));
    };

    /**
     * @description: 生成器 移动
     * @return {Promise<void>}
     */
    async *iterator_move() {
        while (true) yield await new Promise((resolve) => this.waiters_move.add(resolve));
    };
}


export { Canvas };