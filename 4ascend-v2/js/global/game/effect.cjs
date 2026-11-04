/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 落子特效（冲击环 / 粒子迸发 / 落点闪光 / ASCEND 强化）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

/**
 * @description: 缓动函数
 */
const ease_out_cubic = (k) => 1 - Math.pow(1 - k, 3);
const ease_out_back = (k) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

/**
 * @description: #rrggbb 转 rgba()
 * @param {string} hex
 * @param {number} alpha
 * @return {string}
 */
const rgba = (hex, alpha) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};


class Effect {
    /**
     * @description: 特效动画引擎（绑定一块画布，按需驱动 rAF）
     * @return {Effect}
     */
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.size = 0;

        this.effects = new Set();
        this.running = false;
    };

    /**
     * @description: 绑定/重绑画布（尺寸变化时重复调用）
     * @param {HTMLCanvasElement} canvas
     * @param {number} size
     * @return {void}
     */
    bind(canvas, size) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = size;
    };

    /**
     * @description: 清空全部特效并停止循环
     * @return {void}
     */
    clear() {
        this.effects.clear();
        // 重绘棋盘前停止旧的调度状态；否则下一次 add() 会误以为仍有动画帧在运行，导致新草特效不再启动。
        this.running = false;
        if (this.ctx) this.ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 注册特效并唤醒渲染循环
     * @param {object} fx
     * @return {void}
     */
    add(fx) {
        this.effects.add(fx);
        if (!this.running) {
            this.running = true;
            requestAnimationFrame((now) => this.tick(now));
        }
    };

    /**
     * @description: 渲染循环
     * @param {number} now
     * @return {void}
     */
    tick(now) {
        const ctx = this.ctx;
        if (!ctx) { this.running = false; return; }

        ctx.clearRect(0, 0, this.size, this.size);

        this.effects.forEach((fx) => {
            const k = (now - fx.t0) / fx.dur;
            if (k >= 1) { this.effects.delete(fx); return; }
            if (k < 0) return; // 延迟中的特效
            fx.draw(ctx, k);
        });

        if (this.effects.size === 0) {
            this.running = false;
            ctx.clearRect(0, 0, this.size, this.size);
            return;
        }

        requestAnimationFrame((t) => this.tick(t));
    };


    /**
     * @description: 冲击环
     * @param {number} x
     * @param {number} y
     * @param {number} r 棋子半径
     * @param {string} color
     * @param {number} delay
     * @param {number} dur
     * @param {number} spread 扩散倍数
     * @return {void}
     */
    ring(x, y, r, color, delay, dur, spread) {
        this.add({
            't0': performance.now() + delay,
            'dur': dur,
            'draw': (ctx, k) => {
                const e = ease_out_cubic(k);

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, r * (1 + e * spread), 0, Math.PI * 2);
                ctx.strokeStyle = rgba(color, (1 - k) * 0.85);
                ctx.lineWidth = Math.max(1, r * 0.18 * (1 - k));
                ctx.stroke();
                ctx.closePath();
                ctx.restore();
            }
        });
    };

    /**
     * @description: 落点闪光
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @param {string} color
     * @param {number} dur
     * @return {void}
     */
    flash(x, y, r, color, dur = 260) {
        this.add({
            't0': performance.now(),
            'dur': dur,
            'draw': (ctx, k) => {
                const radius = r * (0.6 + k * 1.1);
                const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);

                grad.addColorStop(0, rgba(color, (1 - k) * 0.55));
                grad.addColorStop(1, rgba(color, 0));

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.closePath();
                ctx.restore();
            }
        });
    };

    /**
     * @description: 粒子迸发
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @param {string} color
     * @param {number} count
     * @param {number} dur
     * @return {void}
     */
    burst(x, y, r, color, count = 12, dur = 520) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                'angle': (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6,
                'speed': r * (1.6 + Math.random() * 1.4),
                'size': r * (0.09 + Math.random() * 0.09)
            });
        }

        this.add({
            't0': performance.now(),
            'dur': dur,
            'draw': (ctx, k) => {
                const e = ease_out_cubic(k);

                ctx.save();
                particles.forEach((p) => {
                    const d = r * 0.9 + p.speed * e;

                    ctx.beginPath();
                    ctx.arc(x + Math.cos(p.angle) * d, y + Math.sin(p.angle) * d, p.size * (1 - k * 0.6), 0, Math.PI * 2);
                    ctx.fillStyle = rgba(color, (1 - k) * 0.9);
                    ctx.fill();
                    ctx.closePath();
                });
                ctx.restore();
            }
        });
    };

    /**
     * @description: 星芒闪光（ASCEND 专用）
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @param {string} color
     * @return {void}
     */
    sparkle(x, y, r, color) {
        this.add({
            't0': performance.now(),
            'dur': 420,
            'draw': (ctx, k) => {
                const e = ease_out_cubic(k);
                const len = r * (0.8 + e * 2.0);

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(e * Math.PI * 0.25);

                ctx.strokeStyle = rgba(color, (1 - k) * 0.9);
                ctx.lineWidth = Math.max(1, r * 0.1 * (1 - k));
                ctx.lineCap = 'round';

                for (let i = 0; i < 4; i++) {
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(len * 0.35, 0);
                    ctx.lineTo(len, 0);
                    ctx.stroke();
                    ctx.closePath();
                    ctx.rotate(Math.PI / 4);
                }

                ctx.restore();
            }
        });
    };


    /**
     * @description: 草生成特效（圆圈向内收缩）
     * @param {number} x 像素坐标
     * @param {number} y 像素坐标
     * @param {number} r 草的绘制半径
     * @param {number} count 草的数量
     * @param {boolean|'gold'|'jade'|'qing'} skinned 草皮肤标识：true 为反曲点（蓝色光晕），'gold' 为金菱草（金色光晕），'jade' 为白玉玲珑（玉青光晕），'qing' 为留青新芽（青绿光晕）
     * @return {void}
     */
    plant(x, y, r, count = 1, skinned = false) {
        const pip_count = Math.min(2, Math.max(1, Number(count) || 1));
        // 未启用草皮肤时沿用绿色；启用后按对应皮肤取光晕颜色
        const color = skinned === 'gold'
            ? '#ffd166'
            : (skinned === 'jade'
                ? '#8fd8b4'
                : (skinned === 'qing' ? '#7ed3a1' : (skinned ? '#4aa6ff' : '#2ecc71')));
        const centers = pip_count === 2
            ? [x - r * 1.3, x + r * 1.3]
            : [x];

        centers.forEach((center_x, index) => {
            const delay = pip_count === 2 ? index * 55 : 0;
            this.add({
                't0': performance.now() + delay,
                'dur': 560,
                'draw': (ctx, k) => {
                    const e = ease_out_cubic(k);
                    const radius = r * (2.2 - e * 1.28);
                    const alpha = (1 - k) * 0.9;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(center_x, y, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(color, alpha);
                    ctx.lineWidth = Math.max(1.5, r * 0.18 * (1 - k * 0.35));
                    ctx.shadowColor = rgba(color, alpha);
                    ctx.shadowBlur = r * 0.35;
                    ctx.stroke();
                    ctx.closePath();
                    ctx.restore();
                }
            });
        });
    };

    /**
     * @description: 普通落子特效
     * @param {number} x 像素坐标
     * @param {number} y 像素坐标
     * @param {number} r 棋子半径
     * @param {string} color 特效主色
     * @return {void}
     */
    place(x, y, r, color) {
        this.flash(x, y, r, color);
        this.ring(x, y, r, color, 0, 420, 1.8);
        this.ring(x, y, r, color, 90, 380, 1.4);
        this.burst(x, y, r, color, 12, 520);
    };

    /**
     * @description: ASCEND 落子特效（强化版）
     * @param {number} x
     * @param {number} y
     * @param {number} r
     * @param {string} color
     * @return {void}
     */
    ascend(x, y, r, color) {
        this.flash(x, y, r, color, 380);
        this.ring(x, y, r, color, 0, 620, 2.6);
        this.ring(x, y, r, color, 120, 500, 2.0);
        this.ring(x, y, r, '#FFD700', 220, 460, 1.6);
        this.burst(x, y, r, color, 18, 680);
        this.sparkle(x, y, r, color);
    };
}


export { Effect };
