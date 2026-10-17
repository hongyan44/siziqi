/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情对局：作者可定义刷草点
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { GameNormal } = require('./game_normal.cjs');

const { STONE_ENUM, PLANT_ENUM, ASCEND_ENUM } = require('./enum.cjs');


class GameStory extends GameNormal {
    /**
     * @description: 剧情对局游戏
     * @param {Board} board
     * @param {State} state
     * @param {RandAIC} rand_aic
     * @param {RandUnity} rand_unity
     * @return {GameStory}
     */
    constructor(board, state, rand_aic, rand_unity) {
        super(board, state, rand_aic, rand_unity);
        /** @type {[number, number][]} 作者定义的刷草点队列（有序消费） */
        this.plant_points = [];
        /** @type {{turn: number, cells: [number, number][]}[]} 作者定义的刷草计划（按回合触发） */
        this.plant_schedule = [];
        /** @type {Set<number>} 已触发的刷草计划下标 */
        this.plant_fired = new Set();
        // 必须保留自然刷草开关，否则 ed_pl_1 会在生成前提前返回，队列永远不会被消费。
        this.natural_plant = true;
    };

    /**
     * @description: 按回合触发刷草计划，返回可落草的交叉点
     * 触发条件为 当前回合数 >= 计划回合；每条计划只触发一次，宿主非法（被占/已二草）的点跳过。
     * @return {import('./pos.cjs').Pos[]}
     */
    schedule_plants() {
        if (!Array.isArray(this.plant_schedule) || this.plant_schedule.length === 0) return [];
        // ASCEND 发起阶段棋子被抬起，与父类一致，不在此阶段刷草（未触发者留到之后回合）
        if (this.state.ascend_status === ASCEND_ENUM.START) return [];

        const result = [];

        this.plant_schedule.forEach((entry, index) => {
            if (!entry || this.plant_fired.has(index)) return;
            if (this.state.turn_count < Number(entry.turn)) return;

            this.plant_fired.add(index);

            (entry.cells || []).forEach((cell) => {
                if (!Array.isArray(cell) || cell.length < 2) return;

                const x = Number(cell[0]);
                const y = Number(cell[1]);
                if (!Number.isInteger(x) || !Number.isInteger(y) || !this.board.in_bounds(x, y)) return;

                const pos = this.board.get_pos(x, y);

                // 刷草宿主只允许空格或 ASCEND 用子，且不能已经是二草（与自然刷草规则一致）
                const empty = pos.stone === STONE_ENUM.NONE
                    || pos.stone === STONE_ENUM.BLACK_USED
                    || pos.stone === STONE_ENUM.WHITE_USED;
                if (!empty || pos.plant === PLANT_ENUM.TWO) return;

                result.push(pos);
            });
        });

        return result;
    };

    /**
     * @description: 生成植物：先按计划定时刷草，再走父类自然刷草，结果合并
     * 只重写选点步骤：冷却推进 / 超载判定 / 反升变蓄力等记账逻辑全部沿用父类 ed_pl_1。
     * @return {import('./pos.cjs').Pos[] | void}
     */
    ed_pl_1() {
        const natural = super.ed_pl_1();
        const forced = this.schedule_plants();

        forced.forEach((pos) => {
            const plant = pos.plant === PLANT_ENUM.NONE ? PLANT_ENUM.ONE : PLANT_ENUM.TWO;
            this.board.set_plant(pos.x, pos.y, plant);
        });

        const merged = [...(natural || []), ...forced];
        return merged.length > 0 ? merged : void 0;
    };

    /**
     * @description: 按作者定义的刷草点生成植物
     * 只重写选点步骤：冷却推进 / 超载判定 / 反升变蓄力等记账逻辑全部沿用父类 ed_pl_1。
     * @param {number} count 引擎建议数量；剧情模式忽略，每次刷草只落一株
     * @return {import('./pos.cjs').Pos[] | void}
     */
    p_create(count) {
        if (!Array.isArray(this.plant_points)) return;

        const result = [];

        while (this.plant_points.length > 0) {
            const point = this.plant_points.shift();
            if (!Array.isArray(point) || point.length < 2) continue;

            const x = Number(point[0]);
            const y = Number(point[1]);
            if (!Number.isInteger(x) || !Number.isInteger(y) || !this.board.in_bounds(x, y)) continue;

            const pos = this.board.get_pos(x, y);

            // 刷草宿主只允许空格或 ASCEND 用子，且不能已经是二草（与自然刷草规则一致）
            const empty = pos.stone === STONE_ENUM.NONE
                || pos.stone === STONE_ENUM.BLACK_USED
                || pos.stone === STONE_ENUM.WHITE_USED;
            if (!empty || pos.plant === PLANT_ENUM.TWO) continue;

            result.push(pos);
            break;
        }

        return result.length > 0 ? result : void 0;
    };
};


export { GameStory };
