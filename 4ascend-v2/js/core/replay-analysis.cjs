/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 回放局势分析（静态胜率评估 + 着手质量判定）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

// 与 STONE_ENUM 对应的数字编码，仅用于分析，不参与渲染。
const BLACK = 1;
const WHITE = 2;

const SIZE = 9;
const CELLS = SIZE * SIZE;

// 四子棋的四个轴线方向。
const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]];

const CONFIG = Object.freeze({
    // 评估分（约等于“血量差 + 结构差”）转胜率的温度，越大曲线越平缓。
    'temperature': 2.2,

    // 血量差权重：1 点血 = 1 个评估单位。
    'hp': 1.0,

    // 最大可成打子数（M）的权重，以及用于估值的上限，防止极端连子把胜率拉爆。
    'maxM': 0.22,
    'maxMCap': 10,

    // 可成打点数量权重与上限：代表进攻主动权。
    'threat': 0.12,
    'threatCap': 3,

    // 中心控制与潜在草点（抵消力）的微弱权重。
    'center': 0.008,
    'plant': 0.08,

    // 对方已存在“能一次打穿我方血量”的点位时的危险扣分。
    'danger': 0.6,
    'nukeDanger': 0.4,

    // 着手标识阈值（百分点比例，均为行棋方视角的胜率差）。
    // 与最优解的差距：tie 以内视为同一档；达到 dubious 明显劣于替代；
    // 达到 mistake 显著劣于多数替代；达到 blunder 则视为大漏。
    'tieRegret': 0.02,
    'dubiousRegret': 0.06,
    'mistakeRegret': 0.14,

    // 同一档内的正向收益：妙手 / 好棋。
    'brilliantGain': 0.07,
    'goodGain': 0.035,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class ReplayAnalysis {
    /**
     * @description: 空棋盘
     * @return {Uint8Array}
     */
    static empty_grid() {
        return new Uint8Array(CELLS);
    }

    /**
     * @description: 空草点
     * @return {Uint8Array}
     */
    static empty_plants() {
        return new Uint8Array(CELLS);
    }

    /**
     * @description: 沿一个方向统计连续己方棋子
     * @param {Uint8Array} grid
     * @param {number} x
     * @param {number} y
     * @param {number} dx
     * @param {number} dy
     * @param {number} stone
     * @return {number}
     */
    static run(grid, x, y, dx, dy, stone) {
        let count = 0;
        let cx = x + dx;
        let cy = y + dy;
        while (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && grid[cy * SIZE + cx] === stone) {
            count++;
            cx += dx;
            cy += dy;
        }
        return count;
    }

    /**
     * @description: 与该点成打时拿起的子数（与 Board.get_ascend 的统计口径一致）
     * @param {Uint8Array} grid
     * @param {number} x
     * @param {number} y
     * @param {number} stone
     * @return {number}
     */
    static ascend_size(grid, x, y, stone) {
        let size = 0;
        for (let i = 0; i < AXES.length; i++) {
            const dx = AXES[i][0];
            const dy = AXES[i][1];
            const length = 1 + this.run(grid, x, y, dx, dy, stone) + this.run(grid, x, y, -dx, -dy, stone);
            if (length >= 4) size += length;
        }
        return size;
    }

    /**
     * @description: 统计双方的结构特征
     * @param {Uint8Array} grid
     * @param {Uint8Array} plants
     * @return {object}
     */
    static stats(grid, plants) {
        const stats = {
            [BLACK]: { 'maxM': 0, 'points': 0, 'center': 0, 'plant': 0 },
            [WHITE]: { 'maxM': 0, 'points': 0, 'center': 0, 'plant': 0 },
        };

        for (let i = 0; i < CELLS; i++) {
            const stone = grid[i];
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);

            if (stone === BLACK || stone === WHITE) {
                // 中心控制：越靠近棋盘中心越容易形成多方向连线。
                stats[stone].center += 4 - Math.abs(x - 4) - Math.abs(y - 4);
                continue;
            }

            const black = this.ascend_size(grid, x, y, BLACK);
            if (black >= 4) {
                const item = stats[BLACK];
                item.points++;
                if (black > item.maxM) item.maxM = black;
                if (plants) item.plant += plants[i];
            }

            const white = this.ascend_size(grid, x, y, WHITE);
            if (white >= 4) {
                const item = stats[WHITE];
                item.points++;
                if (white > item.maxM) item.maxM = white;
                if (plants) item.plant += plants[i];
            }
        }

        return stats;
    }

    /**
     * @description: 对单个局面做静态评估，返回黑方胜率（0~1）
     * @param {Uint8Array} grid
     * @param {Uint8Array} plants
     * @param {[number, number]} hp
     * @param {0 | 1 | null} winner
     * @return {number}
     */
    static evaluate_grid(grid, plants, hp, winner) {
        if (winner === 0) return 1;
        if (winner === 1) return 0;

        const hpBlack = Math.max(0, Number(hp[0]) || 0);
        const hpWhite = Math.max(0, Number(hp[1]) || 0);

        const stats = this.stats(grid, plants);
        const black = stats[BLACK];
        const white = stats[WHITE];

        let score = (hpBlack - hpWhite) * CONFIG.hp;
        score += (Math.min(black.maxM, CONFIG.maxMCap) - Math.min(white.maxM, CONFIG.maxMCap)) * CONFIG.maxM;
        score += (Math.min(black.points, CONFIG.threatCap) - Math.min(white.points, CONFIG.threatCap)) * CONFIG.threat;
        score += (black.center - white.center) * CONFIG.center;
        score += (black.plant - white.plant) * CONFIG.plant;

        if (hpBlack > 0 && white.maxM >= hpBlack) {
            score -= CONFIG.danger;
            if (white.maxM >= 7) score -= CONFIG.nukeDanger;
        }
        if (hpWhite > 0 && black.maxM >= hpWhite) {
            score += CONFIG.danger;
            if (black.maxM >= 7) score += CONFIG.nukeDanger;
        }

        const rate = 1 / (1 + Math.exp(-score / CONFIG.temperature));
        return clamp(rate, 0.01, 0.99);
    }

    /**
     * @description: 局面帧评估
     * @param {object} frame
     * @return {number}
     */
    static evaluate_frame(frame) {
        return this.evaluate_grid(frame.grid, frame.plants, frame.hp, frame.winner);
    }

    /**
     * @description: 在落子前的局面上枚举所有落点，按行棋方视角的胜率排序取前 N 个
     * @param {object} frame 落子前的盘面
     * @param {0 | 1} mover 0=黑 1=白
     * @param {[number, number]} hp
     * @param {number} limit 返回数量（1~3）
     * @param {[number, number] | null} exclude 需要排除的落点（通常是实际落子）
     * @return {{x: number, y: number, rate: number, view: number}[]}
     */
    static best_moves(frame, mover, hp, limit = 3, exclude = null) {
        const stone = mover === 0 ? BLACK : WHITE;
        const list = [];

        for (let i = 0; i < CELLS; i++) {
            if (frame.grid[i] !== 0) continue;

            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            if (exclude && exclude[0] === x && exclude[1] === y) continue;

            const grid = Uint8Array.from(frame.grid);
            grid[i] = stone;

            const rate = this.evaluate_grid(grid, frame.plants, hp, null);
            list.push({
                'x': x,
                'y': y,
                'rate': rate,
                'view': mover === 0 ? rate : 1 - rate,
            });
        }

        list.sort((a, b) => b.view - a.view);

        const count = Math.max(1, Math.min(3, Number(limit) || 1));
        return list.slice(0, count);
    }

    /**
     * @description: 在落子前的局面上枚举所有落点，取行棋方的最优静态胜率
     * @param {object} frame
     * @param {0 | 1} mover 0=黑 1=白
     * @param {[number, number]} hp
     * @return {number} 行棋方视角的最优胜率
     */
    static best_alternative(frame, mover, hp) {
        const list = this.best_moves(frame, mover, hp, 1);
        return list.length ? list[0].view : 0.5;
    }

    /**
     * @description: 按“相对最优解的损失”与“自身收益”判定国际象棋式着手标识
     * @param {number} delta 相对落子前的胜率变化
     * @param {number} regret 相对本回合最优落点的差距
     * @return {'brilliant' | 'good' | 'interesting' | 'dubious' | 'mistake' | 'blunder'}
     */
    static classify(delta, regret) {
        if (regret >= CONFIG.mistakeRegret) return 'blunder';
        if (regret >= CONFIG.dubiousRegret) return 'mistake';
        if (regret >= CONFIG.tieRegret) return 'dubious';

        // 与最优解同档：按自身收益细分妙手 / 好棋，其余属于“优于替代但不显著”。
        if (delta >= CONFIG.brilliantGain) return 'brilliant';
        if (delta >= CONFIG.goodGain) return 'good';
        return 'interesting';
    }

    /**
     * @description: 逐帧分析整盘回放
     * @param {object[]} frames [{ grid, plants, hp, turn(下一手 0黑/1白), winner(0黑/1白/null) }]
     * @return {{rates: number[], moves: object[], counts: object}}
     */
    static analyze(frames) {
        const rates = frames.map((frame) => this.evaluate_frame(frame));
        const moves = [];
        const counts = {
            'brilliant': 0,
            'good': 0,
            'interesting': 0,
            'dubious': 0,
            'mistake': 0,
            'blunder': 0,
        };

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            // frame.turn 记录的是落子后的轮到方，因此落子方是它的对手。
            const mover = frame.turn === 1 ? 0 : 1;

            const before = i > 0
                ? frames[i - 1]
                : { 'grid': this.empty_grid(), 'plants': this.empty_plants(), 'hp': frame.hp };

            const prevRate = i > 0 ? rates[i - 1] : 0.5;
            const prevView = mover === 0 ? prevRate : 1 - prevRate;
            const actualView = mover === 0 ? rates[i] : 1 - rates[i];
            const bestView = this.best_alternative(before, mover, before.hp || frame.hp);

            const delta = actualView - prevView;
            const regret = Math.max(0, bestView - actualView);
            const winner = frame.winner;

            const label = (winner !== null && winner !== undefined && winner === mover)
                ? 'brilliant'
                : this.classify(delta, regret);

            counts[label]++;
            moves.push({
                'index': i,
                'mover': mover,
                'delta': delta,
                'regret': regret,
                'label': label,
            });
        }

        return { rates, moves, counts };
    }
}


export { ReplayAnalysis };
