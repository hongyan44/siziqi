/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: ASCEND 抵消动画（升起 → 盘旋 → 碰撞抵消 → 打血）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
import { Skins } from './skin.cjs';

/**
 * @description: 缓动函数
 */
const ease_out_cubic = (k) => 1 - Math.pow(1 - k, 3);
const ease_in_cubic = (k) => k * k * k;
const ease_in_out = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

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

/**
 * @description: 补间动画 Promise
 * @param {number} dur
 * @param {Function} frame (k) => void，返回 false 可提前结束
 * @return {Promise<void>}
 */
const tween = (dur, frame) => new Promise((resolve) => {
    const t0 = performance.now();

    const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        if (frame(k) === false || k >= 1) return resolve();
        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
});

/**
 * @description: 延时
 * @param {number} ms
 * @return {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


class AscendFx {
    /**
     * @description: ASCEND 抵消动画引擎（独立顶层画布，常驻 rAF）
     * @return {AscendFx}
     */
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.size = 0;

        // 由 Canvas 注入
        this.effect = null;      // Effect 引擎（碰撞粒子/冲击环）
        this.sound = null;       // Sound 引擎（ASCEND 专用音效）
        this.skins = null;       // 本机皮肤状态（棋子 / 反曲点）
        this.offset = 0;
        this.spacing = 1;
        this.stone_radius = 0.41;

        // 盘旋中的棋子：{ gx, gy, power, color, side, x, y, dead, countered }
        this.stones = [];

        // 原棋盘拿起位置：红色代表黑子，蓝色代表白子，持续显示
        this.markers = [];

        // 固定等待圆环尺寸：不随棋子数量变化
        this.orbit_radius = 0;
        this.orbit_corner_inset = 1.65;

        this.texts = [];         // 浮动文字 { x, y, vy, text, color, t0, dur }
        this.running = false;
        this.settling = false;

        this.queue = Promise.resolve();
    };

    /**
     * @description: 绑定/重绑画布
     * @param {HTMLCanvasElement} canvas
     * @param {number} size
     * @param {Effect} effect
     * @param {Sound} sound
     * @return {void}
     */
    bind(canvas, size, effect, sound) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = size;
        this.effect = effect;
        this.sound = sound;
    };

    /**
     * @description: 同步棋盘几何参数
     * @param {number} offset
     * @param {number} spacing
     * @param {number} stone_radius
     * @return {void}
     */
    geometry(offset, spacing, stone_radius) {
        this.offset = offset;
        this.spacing = spacing;
        this.stone_radius = stone_radius;
        // 略微缩小圆圈，并固定在棋盘左上角区域
        this.orbit_radius = spacing * 1.35;
        this.orbit_corner_inset = spacing * 1.65;
    };

    /**
     * @description: 清空全部状态（新对局）
     * @return {void}
     */
    reset() {
        this.stones = [];
        this.markers = [];
        this.texts = [];
        this.settling = false;
        this.queue = Promise.resolve();
        if (this.ctx) this.ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 逻辑坐标转像素
     */
    gx2px(gx) { return this.offset + gx * this.spacing; };
    gy2py(gy) { return this.offset + gy * this.spacing; };

    /**
     * @description: 某点是否存在盘旋中的棋子
     * @param {number} gx
     * @param {number} gy
     * @return {boolean}
     */
    is_lifted(gx, gy) {
        return this.stones.some((s) => !s.dead && !s.countered && s.gx === gx && s.gy === gy);
    };

    /**
     * @description: 盘旋中心
     * @param {string} side 'left' | 'right'
     * @return {[number, number]}
     */
    orbit_center(side) {
        // 等候圆分别位于棋盘左上角和右上角
        const inset = this.orbit_corner_inset;
        const cx = side === 'left'
            ? this.offset + inset
            : this.size - this.offset - inset;
        const cy = this.offset + inset;
        return [cx, cy];
    };

    /**
     * @description: 某侧存活棋子（战力降序，同战力按加入顺序）
     * @param {string} side
     * @return {object[]}
     */
    alive(side) {
        return this.stones
            .filter((s) => !s.dead && !s.countered && s.side === side)
            .sort((a, b) => b.power - a.power || a.seq - b.seq);
    };


    // ==================== 渲染循环 ====================

    /**
     * @description: 唤醒渲染循环
     * @return {void}
     */
    wake() {
        if (this.running) return;
        this.running = true;
        requestAnimationFrame((now) => this.tick(now));
    };

    /**
     * @description: 渲染帧
     * @param {number} now
     * @return {void}
     */
    tick(now) {
        const ctx = this.ctx;

        if (!ctx || (this.stones.every((s) => s.dead) && this.texts.length === 0)) {
            this.running = false;
            if (ctx) ctx.clearRect(0, 0, this.size, this.size);
            this.stones = this.stones.filter((s) => !s.dead);
            return;
        }

        ctx.clearRect(0, 0, this.size, this.size);

        // 盘旋中的棋子：等待与结算阶段都继续沿原轨迹旋转
        {
            ['left', 'right'].forEach((side) => {
                const group = this.alive(side).filter((s) => !s.hold);
                const n = group.length;
                if (!n) return;

                const [cx, cy] = this.orbit_center(side);
                const radius = this.orbit_radius;

                // 快速绕固定圆心旋转：约每 2.5 秒一圈（不绘制灰色轨道）
                const speed = side === 'left' ? 0.0025 : -0.0025;

                group.forEach((s) => {
                    if (s.hold || s.flying) return;
                    // 使用拿起时的固定等分索引：有棋子离场后，剩余棋子仍沿原来的轨迹旋转
                    const total = s.orbit_total || n;
                    const index = s.orbit_index || 0;
                    const phase = s.orbit_phase === undefined ? (Math.PI * 2 * index) / total : s.orbit_phase;
                    const angle = phase + now * speed;
                    s.x = cx + Math.cos(angle) * radius;
                    s.y = cy + Math.sin(angle) * radius;
                });
            });
        }

        // 绘制所有存活棋子
        this.stones.forEach((s) => {
            if (s.dead) return;
            this.draw_stone(ctx, s);
        });

        // 所有 ASCEND 浮动文字已移除，只保留棋子、光效和粒子
        this.texts.length = 0;

        requestAnimationFrame((t) => this.tick(t));
    };

    /**
     * @description: 绘制一枚盘旋棋子（带草粒标识）
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} s
     * @return {void}
     */
    draw_stone(ctx, s) {
        const r = this.spacing * this.stone_radius;
        const skins = this.skins || Skins.read();

        ctx.save();
        ctx.globalAlpha = s.alpha === undefined ? 1 : s.alpha;

        // 已购棋子皮肤：盘旋中的棋子同样替换（保留发光效果）
        // ascend: true 表示这枚棋子正在成打盘旋，高级定制棋子会切换为「打」的强化纹理
        if (!Skins.draw_stone(ctx, s.x, s.y, r, s.color, { skins, glow: true, glow_blur: 10, ascend: true })) {
            // 发光棋子
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.closePath();

            ctx.shadowBlur = 0;

            // 描边
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.closePath();
        }

        // 草粒（power-1 个，标示额外战力）：反曲点皮肤启用时同步替换
        const pips = s.power - 1;
        for (let i = 0; i < pips; i++) {
            const px = s.x + (i - (pips - 1) / 2) * r * 0.85;
            if (Skins.draw_grass(ctx, px, s.y, r * 0.26, { skins })) continue;
            ctx.beginPath();
            ctx.arc(px, s.y, r * 0.26, 0, Math.PI * 2);
            ctx.fillStyle = '#2ecc71';
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.closePath();
        }

        ctx.restore();
    };

    /**
     * @description: 浮动文字
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {string} color
     * @param {number} vy
     * @param {number} dur
     * @return {void}
     */
    float_text() {
        // 保留兼容接口，但不再显示任何浮动文字
    };


    // ==================== 阶段一：升起盘旋 ====================

    /**
     * @description: 一批棋子从棋盘升起，在一侧盘旋（队列执行）
     * @param {object[]} metas [{ gx, gy, power, color }]
     * @param {string} side 'left' | 'right'
     * @param {Function} clear_cell (gx, gy) => void 清除棋盘静态棋子
     * @return {Promise<void>}
     */
    lift(metas, side, clear_cell) {
        const job = async () => {
            const news = metas.map((m, i) => ({
                'gx': m.gx,
                'gy': m.gy,
                'power': m.power,
                'plant': m.plant || 0,
                // 盘旋棋子使用双方真实棋色；红蓝只用于原棋盘的拿起位置提示
                'color': m.stone_color || m.color,
                'side': side,
                'x': this.gx2px(m.gx),
                'y': this.gy2py(m.gy),
                'dead': false,
                'hold': true,   // 升起到位前不并入轨道
                // 固定等分索引，抵消时保留原轨迹相位
                'orbit_index': i,
                'orbit_total': metas.length,
                'bob': 0,
                'seq': (this.seq = (this.seq || 0) + 1)
            }));

            this.stones.push(...news);
            this.sound && this.sound.play_orbit();
            this.wake();

            // 错峰升起：先向上腾起，再滑向盘旋中心
            await Promise.all(news.map((s, i) => (async () => {
                await delay(i * 35);

                const [cx, cy] = this.orbit_center(side);
                const start_x = s.x;
                const start_y = s.y;
                const orbit_index = s.orbit_index || 0;
                const orbit_total = s.orbit_total || metas.length;
                const orbit_angle = (Math.PI * 2 * orbit_index) / orbit_total;
                const orbit_speed = side === 'left' ? 0.0025 : -0.0025;
                const target_x = cx + Math.cos(orbit_angle) * this.orbit_radius;
                const target_y = cy + Math.sin(orbit_angle) * this.orbit_radius;
                // 用当前时间校准相位，释放到旋转循环时不会跳动
                s.orbit_phase = orbit_angle - performance.now() * orbit_speed;

                if (clear_cell) clear_cell(s.gx, s.gy);
                if (this.effect) this.effect.flash(start_x, start_y, this.spacing * this.stone_radius, s.color, 300);

                // 从原棋盘位置直接滑向自己的圆周槽位，抵达时自然接入旋转
                await tween(520, (k) => {
                    const e = ease_in_out(k);
                    s.x = start_x + (target_x - start_x) * e;
                    s.y = start_y + (target_y - start_y) * e;
                    s.alpha = 0.78 + e * 0.22;
                });

                s.hold = false;
            })()));
        };

        this.queue = this.queue.then(job);
        return this.queue;
    };


    // ==================== 反击：击落盘旋棋子 ====================

    /**
     * @description: 反击/卖血：击落指定位置的盘旋棋子（立即执行）
     * @param {number} gx
     * @param {number} gy
     * @return {boolean} 是否击中
     */
    counter(gx, gy) {
        const s = this.stones.find((t) => !t.dead && t.gx === gx && t.gy === gy);
        if (!s) return false;

        s.hold = true;
        s.countered = true;
        if (!this.alive('left').length && !this.alive('right').length && this.sound) this.sound.stop_orbit();

        (async () => {
            const start_x = s.x;
            const start_y = s.y;

            // 被击中：颤抖后坠落消散
            if (this.effect) {
                this.effect.ring(start_x, start_y, this.spacing * this.stone_radius, '#f39c12', 0, 380, 2.0);
                this.effect.burst(start_x, start_y, this.spacing * this.stone_radius, '#f39c12', 10, 480);
            }
            this.float_text(start_x, start_y, '反击!', '#f39c12', -40, 800);

            await tween(420, (k) => {
                s.x = start_x + Math.sin(k * 28) * (1 - k) * 4;
                s.y = start_y + ease_in_cubic(k) * this.spacing * 2.2;
                s.alpha = 1 - k;
            });

            s.dead = true;
            this.wake();
        })();

        return true;
    };


    // ==================== 阶段二/三：碰撞抵消 + 打血 ====================

    /**
     * @description: 结算：双方盘旋棋子碰撞抵消，剩余棋子打血（队列执行）
     * @param {object} targets { left: HTMLElement, right: HTMLElement } 两侧 HP 元素
     * @param {Function} on_damage_start 飞血开始时提交伤害并刷新 HP
     * @param {Function} on_summary 动画结束前切换顶部剩余血量提示
     * @return {Promise<{damageLeft: number, damageRight: number}>} damageX = X 侧受到的伤害
     */
    settle(targets, on_damage_start, on_summary) {
        let result = { 'damageLeft': 0, 'damageRight': 0 };

        const job = async () => {
            this.settling = true;
            if (this.sound) this.sound.stop_orbit();

            const lefts = this.alive('left');
            const rights = this.alive('right');

            // ---------- 碰撞抵消（镜像 ATK.parse：队首互撞，d=min 互扣） ----------
            const A = [...lefts];
            const B = [...rights];
            const return_jobs = [];

            // 抵消点固定在棋盘最上方中央，不与棋盘中部棋子重叠
            const collision_x = this.size / 2;
            const collision_y = this.offset + this.spacing * 1.5;

            while (A.length > 0 && B.length > 0) {
                const a = A[0];
                const b = B[0];

                a.hold = true;
                b.hold = true;
                // 取消上一组未完成的返还补间，避免它覆盖当前碰撞坐标
                a.motion_token = (a.motion_token || 0) + 1;
                b.motion_token = (b.motion_token || 0) + 1;

                const ax = a.x, ay = a.y;
                const bx = b.x, by = b.y;

                // 双方队首加速冲向中心
                await tween(240, (k) => {
                    const e = ease_in_cubic(k);
                    a.x = ax + (collision_x - this.spacing * 0.5 - ax) * e;
                    a.y = ay + (collision_y - ay) * e;
                    b.x = bx + (collision_x + this.spacing * 0.5 - bx) * e;
                    b.y = by + (collision_y - by) * e;
                });

                // 碰撞！
                const d = Math.min(a.power, b.power);
                a.power -= d;
                b.power -= d;

                const a_die = a.power <= 0;
                const b_die = b.power <= 0;
                const annihilated = a_die && b_die;

                // 草被消耗后，返还棋子的绿点数量同步减少
                a.plant = Math.max(0, a.power - 1);
                b.plant = Math.max(0, b.power - 1);

                if (this.effect) {
                    const r = this.spacing * this.stone_radius;
                    if (annihilated) {
                        this.sound && this.sound.play_annihilation();
                        // 同归于尽：白热发光 + 金色湮灭环 + 双色碎片爆散
                        this.effect.flash(collision_x, collision_y, r * 2.0, '#ffffff', 180);
                        this.effect.flash(collision_x, collision_y, r * 1.35, '#f1c40f', 340);
                        this.effect.ring(collision_x, collision_y, r * 0.8, '#ffffff', 0, 300, 2.8);
                        this.effect.ring(collision_x, collision_y, r, '#f1c40f', 35, 480, 3.0);
                    } else {
                        // 有棋子返回：碰撞闪光，但幸存棋子保留实体，仅减少草点
                        this.effect.flash(collision_x, collision_y, r * 1.4, '#f1c40f', 220);
                        this.effect.ring(collision_x, collision_y, r, '#f1c40f', 0, 360, 2.4);
                    }
                    this.effect.burst(collision_x, collision_y, r, a.color, annihilated ? 16 : 10, annihilated ? 620 : 420);
                    this.effect.burst(collision_x, collision_y, r, b.color, annihilated ? 16 : 10, annihilated ? 620 : 420);
                }

                // 湮灭仅使用光效和粒子表现，不显示文字

                // 碎裂消散 / 幸存返回
                const backs = [];

                if (a_die) {
                    A.shift();
                    backs.push((async () => {
                        await tween(300, (k) => { a.alpha = 1 - k; a.y = collision_y + ease_in_cubic(k) * this.spacing; });
                        a.dead = true;
                    })());
                } else {
                    // 返还棋子（如 2战力 vs 1战力 → 剩 1 战力普通子），最优先参与抵消
                    backs.push((async () => {
                        const hx = ax, hy = ay;
                        const sx = a.x, sy = a.y;
                        const token = a.motion_token || 0;
                        await tween(160, (k) => {
                            if (a.motion_token !== token) return false;
                            const e = ease_out_cubic(k);
                            a.x = sx + (hx - sx) * e;
                            a.y = sy + (hy - sy) * e;
                        });
                        // 没有被下一组抢先接管时，返回后重新加入原圆周轨迹
                        if (a.motion_token === token) a.hold = false;
                    })());
                }

                if (b_die) {
                    B.shift();
                    backs.push((async () => {
                        await tween(300, (k) => { b.alpha = 1 - k; b.y = collision_y + ease_in_cubic(k) * this.spacing; });
                        b.dead = true;
                    })());
                } else {
                    backs.push((async () => {
                        const hx = bx, hy = by;
                        const sx = b.x, sy = b.y;
                        const token = b.motion_token || 0;
                        await tween(160, (k) => {
                            if (b.motion_token !== token) return false;
                            const e = ease_out_cubic(k);
                            b.x = sx + (hx - sx) * e;
                            b.y = sy + (hy - sy) * e;
                        });
                        // 没有被下一组抢先接管时，返回后重新加入原圆周轨迹
                        if (b.motion_token === token) b.hold = false;
                    })());
                }

                // 返还动画不阻塞下一组抵消；幸存棋子保持 hold，下一组会从当前碰撞点直接衔接
                return_jobs.push(...backs);
                await delay(35);
            }

            // 所有碰撞已经连续完成，再等待返还/消散补间收尾
            await Promise.all(return_jobs);

            // ---------- 打血：幸存方剩余棋子依次轰击对方血量 ----------
            const strikers = A.length > 0 ? A : B;
            const loser_side = A.length > 0 ? 'right' : 'left';
            const loser_elem = targets ? targets[loser_side] : null;
            result.damageLeft = loser_side === 'left' ? strikers.length : 0;
            result.damageRight = loser_side === 'right' ? strikers.length : 0;
            const summary_timer = strikers.length > 0 ? setTimeout(() => on_summary && on_summary(), Math.max(0, strikers.length * 420 - 1000)) : null;

            if (strikers.length > 0) {
                // 第一枚棋子起飞前提交完整伤害，HP 不会在抵消阶段提前变化
                if (on_damage_start) on_damage_start(result);
                if (on_summary && !summary_timer) on_summary();

                // 命中点：盘旋中心上方（飞向屏幕顶端对方一侧）
                const [tx] = this.orbit_center(loser_side);
                const ty = -this.spacing * 0.5;

                for (const s of strikers) {
                    this.sound && this.sound.play_fly();
                    const sx = s.x, sy = s.y;
                    // 飞血期间暂停圆周定位，但保留在顶层画布绘制
                    s.flying = true;

                    await tween(300, (k) => {
                        const e = ease_in_cubic(k);
                        s.x = sx + (tx - sx) * e;
                        s.y = sy + (ty - sy) * e;
                        s.alpha = 1 - k * 0.4;
                    });

                    // 命中前始终保持可见；到达血量目标点后才消失
                    s.dead = true;
                    s.flying = false;

                    const hit_x = tx;
                    const hit_y = this.spacing * 0.6;

                    if (this.sound) this.sound.play_hit();
                    if (this.effect) {
                        const r = this.spacing * this.stone_radius;
                        this.effect.flash(hit_x, hit_y, r * 1.3, s.color, 280);
                        this.effect.ring(hit_x, hit_y, r, s.color, 0, 400, 2.2);
                        this.effect.burst(hit_x, hit_y, r, s.color, 12, 520);
                    }
                    await delay(120);
                }

                // 仅保留 HP 卡片震动，不再创建任何浮动文字
                if (loser_elem) this.dom_damage_shake(loser_elem);
            }

            if (summary_timer) clearTimeout(summary_timer);

            // 清理残骸
            this.stones = this.stones.filter((s) => !s.dead);
            this.settling = false;
            this.wake();

            await delay(240);
        };

        this.queue = this.queue.then(job).then(() => result);
        return this.queue;
    };

    /**
     * @description: 在 HP 元素上弹出伤害数字并震动
     * @param {HTMLElement} elem
     * @param {string} text
     * @return {void}
     */
    dom_damage_shake(elem) {
        try {
            elem.animate(
                [{ 'transform': 'translateX(0)' }, { 'transform': 'translateX(-5px)' }, { 'transform': 'translateX(5px)' }, { 'transform': 'translateX(-3px)' }, { 'transform': 'translateX(0)' }],
                { 'duration': 380, 'iterations': 2 }
            );
        } catch (e) { /* DOM 动画失败不影响画布动画 */ }
    };
}


export { AscendFx };
