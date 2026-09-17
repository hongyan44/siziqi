/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 游戏
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { STONE_ENUM, PLANT_ENUM, OVER_ENUM, ASCEND_ENUM, PLAYER_ENUM } = require('./enum.cjs');

const { ATK, AIC, CsharpSort } = require('./utils.cjs');


/** @typedef {import('./board.cjs').Board} Board */
/** @typedef {import('./state.cjs').State} State */
/** @typedef {import('./rand.cjs').RandAIC} RandAIC */
/** @typedef {import('./rand.cjs').RandUnity} RandUnity */


class GameNormal {
    /**
     * @description: 游戏
     * @param {Board} board
     * @param {State} state
     * @param {RandAIC} rand_aic
     * @param {RandUnity} rand_unity
     * @return {GameNormal}
     */
    constructor(board, state, rand_aic, rand_unity) {
        /** @type {State} */
        this.state = state;
        /** @type {Board} */
        this.board = board;
        /** @type {RandAIC} */
        this.rand_aic = rand_aic;
        /** @type {RandUnity} */
        this.rand_unity = rand_unity;
        /** @type {boolean} 是否启用自然刷草；残局挑战会显式关闭 */
        this.natural_plant = true;
    };

    /**
     * @description: 验证落子是否合法
     * @param {number} x
     * @param {number} y
     * @param {STONE_ENUM} stone
     * @return {boolean}
     */
    valid(x, y, stone) {
        const v = this.board.get_stone(x, y);
        const ascend = stone === STONE_ENUM.BLACK ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND;

        return v === STONE_ENUM.NONE || v === ascend;
    };

    /**
     * @description: 1. 落子
     * @param {number} x
     * @param {number} y
     * @return {boolean} 是否落子成功
     */
    ed_tr_1(x, y) {
        const stone = this.state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const v = this.board.get_stone(x, y);
        const ascend = stone === STONE_ENUM.BLACK ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND;

        // 必须是敌方ASCEND棋子或者没有棋子
        if (v !== STONE_ENUM.NONE && v !== ascend) return false;

        // 落子
        this.board.set_stone(x, y, stone);

        // 状态改变
        this.state.turn_pos[0] = x;
        this.state.turn_pos[1] = y;

        // 数组
        this.board.turns.push([x, y]);

        return true;
    };

    /**
     * @description: 4. 改变回合
     * @return {void}
     */
    ed_tr_2() {
        this.state.turn_player = this.state.turn_player === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
        this.state.turn_count++;
    };


    /**
     * @description: 2. ASCEND棋子搜素
     * @return {Pos[] | void}
     */
    ed_as_1() {
        const points = this.board.get_ascend(
            this.state.turn_pos[0],
            this.state.turn_pos[1],
            this.state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE
        );
        if (!points && this.state.ascend_status === ASCEND_ENUM.NONE) return; // 发起必须进行ASCEND，回应允许不进行ASCEND

        // 升级棋子
        if (points) points.forEach((pos) => pos.stone = pos.stone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND);

        // 改变ASCEND状态
        if (this.state.ascend_status === ASCEND_ENUM.NONE) this.state.ascend_status = ASCEND_ENUM.START;
        else if (this.state.ascend_status === ASCEND_ENUM.START) this.state.ascend_status = ASCEND_ENUM.END;

        return points;
    };

    /**
     * @description: 3. ASCEND结算
     * @return {[number[], number[]][] | void}
     */
    ed_as_2(defer_damage = false) {
        if (this.state.ascend_status !== ASCEND_ENUM.END) return;


        // 收集子力，并且标记棋子使用
        const power_black = [];
        const power_white = [];

        this.board.data.forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;

            let power = 1;
            if (pos.plant === PLANT_ENUM.ONE) power += 1;
            else if (pos.plant === PLANT_ENUM.TWO) power += 2;

            pos.stone === STONE_ENUM.BLACK_ASCEND ? power_black.push(power) : power_white.push(power);
            pos.stone = pos.stone === STONE_ENUM.BLACK_ASCEND ? STONE_ENUM.BLACK_USED : STONE_ENUM.WHITE_USED;

            // 直接在此去除草，防止后面生成再次去除
            pos.plant = PLANT_ENUM.NONE;
        });


        // 进行算法抵消，返回抵消过程
        const fs = ATK.parse(power_black, power_white);

        // 动画结算时先记录伤害，实际 HP 延后到飞血开始时提交
        this.state.pending_damage = [power_white.length, power_black.length];
        if (!defer_damage) {
            this.state.hp[0] -= this.state.pending_damage[0];
            this.state.hp[1] -= this.state.pending_damage[1];
            this.state.pending_damage = null;
        }

        return fs;
    };

    /**
     * @description: 6. ASCEND清理
     * @return {void}
     */
    ed_as_3() {
        if (this.state.ascend_status !== ASCEND_ENUM.END) return;
        this.state.ascend_status = ASCEND_ENUM.NONE;


        this.board.data.forEach((pos) => {
            if (pos.stone === STONE_ENUM.BLACK_USED || pos.stone === STONE_ENUM.WHITE_USED) pos.stone = STONE_ENUM.NONE;
        });
    };


    /**
     * @description: 5. 生成植物
     * @return {Pos[] | void}
     */
    ed_pl_1() {
        if (this.state.ascend_status === ASCEND_ENUM.START) return;
        if (!this.natural_plant) return;


        const atk = this.state.ascend_status === ASCEND_ENUM.END;

        if (!atk) {
            if (this.state.unascend_charge > 0) this.state.unascend_charge--;

            if (this.state.unascend_chargef[1] > 0) this.state.unascend_chargef[1]--;
            if (this.state.unascend_chargef[0] > 0) this.state.unascend_chargef[0]--;

            this.state.just_unascend = false;
        }


        this.state.grow_count--;
        if (this.state.grow_count > 0 && !(atk && !this.state.just_unascend)) return;

        const self_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 0 : 1;
        const foe_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 1 : 0;

        const stone_count = this.board.stone_count;
        const plant_count = this.state.turn_count >= 65 ? 3 : 2;


        // 最低7回合，最大11回合，每22回合减少2最大回合数（11）
        this.state.grow_count = Math.max(7, 11 - Math.trunc(Math.trunc(this.state.turn_count / 22) * 2));


        // 超载判定：永夜模式跳过棋子数量和血量条件，始终直接执行超载
        if (this.always_overload) this.state.over_status = OVER_ENUM.EXECUTE;
        else {
            // 44子则超载，若我方血量少于或者等于敌方，进入超载EX
            // 22子以下，则取消所有超载状态
            if (stone_count >= 44 && this.state.over_status === OVER_ENUM.NONE) this.state.over_status = OVER_ENUM.ENABLE;
            if (this.state.over_status === OVER_ENUM.ENABLE && this.state.hp[self_index] <= this.state.hp[foe_index]) this.state.over_status = OVER_ENUM.EXECUTE;
            if (this.state.over_status !== OVER_ENUM.NONE && stone_count < 22) this.state.over_status = OVER_ENUM.NONE;
        }


        // 生成草
        const result = this.p_create(plant_count);

        // 创建草
        if (result) result.forEach((pos) => {
            const plant = pos.plant === PLANT_ENUM.NONE ? PLANT_ENUM.ONE : PLANT_ENUM.TWO;
            this.board.set_plant(pos.x, pos.y, plant);
        });


        // 若超载，减少50%冷却
        // 若冷却为偶数，减少1，变为奇数（保证轮流生成草）
        if (this.state.over_status !== OVER_ENUM.NONE) this.state.grow_count = Math.trunc(this.state.grow_count / 2);
        if (this.state.grow_count % 2 == 0) this.state.grow_count--;


        // 完整ASCEND后改变数据
        if (atk) {
            // this.state.unascend_charge = Math.ceil(AIC.mmx(
            //     12.5,
            //     this.state.unascend_charge + (25 - this.state.unascend_charge) * 0.4,
            //     25
            // )); 
            this.state.unascend_charge = Math.ceil(AIC.mmx(
                12.5,
                this.state.unascend_charge + (25 - this.state.unascend_charge) * 0.4,
                25
            ));

            this.state.unascend_chargef[self_index] = Math.max(
                this.state.unascend_chargef[self_index],
                this.state.over_status !== OVER_ENUM.NONE ? 4 : 9
            );

            this.state.just_unascend = true;
        }

        return result;
    };

    /**
     * @description: 得到符合规则的生成点
     * @param {boolean} flag3
     * @param {boolean} flag4
     * @return {Pos[]}
     */
    p_scan_pos(flag3, flag4) {
        const tst = [];

        // 若条件满足，则第一轮扫描计算满足一方的ASCEND用子（允许双方都满足）
        // 若双方条件都不满足，则仅计算填充子
        if (this.state.unascend_chargef[0] === 0) tst.push(STONE_ENUM.BLACK_USED);
        if (this.state.unascend_chargef[1] === 0) tst.push(STONE_ENUM.WHITE_USED);
        if (tst.length === 0) tst.push(STONE_ENUM.BLACK, STONE_ENUM.WHITE);


        const result = [];
        /**
         * @param {Pos} pos
         */
        const func = (pos) => {
            const filled = pos.stone === STONE_ENUM.BLACK || pos.stone === STONE_ENUM.WHITE;

            const a = tst.includes(pos.stone) || (filled && (flag4 || this.state.over_status !== OVER_ENUM.NONE));
            const b = filled;

            if (flag3 ? !a : !b) return;

            // 遍历八方向八个点，特殊情况时（完整ASCEND）算入自身
            // 若没有填充子，并且没有满草，则标记
            const ds = [];
            if (flag3) ds.push(pos);

            const s = this.board.get_directions(pos.x, pos.y);
            ds.push(...s);

            // 两草只在超载执行阶段出现；普通/待命阶段的一草不会继续叠加
            ds.forEach((p) => {
                if (result.includes(p) || (p.stone !== STONE_ENUM.NONE && p.stone !== STONE_ENUM.BLACK_USED && p.stone !== STONE_ENUM.WHITE_USED) || p.plant === PLANT_ENUM.TWO || (p.plant === PLANT_ENUM.ONE && this.state.over_status !== OVER_ENUM.EXECUTE)) return;
                result.push(p);
            });
        };


        // 默认进行第一次扫描
        this.board.data.forEach(func);
        // console.log(result.length)

        // 若没有没有扫描到符合点位或完整ASCEND，则扫描第二轮
        // 第二轮扫描默认计算双方的ASCEND用子
        if (result.length > 0 && flag3) return result;

        tst.push(STONE_ENUM.BLACK_USED, STONE_ENUM.WHITE_USED);
        this.board.data.forEach(func);

        return result;
    };

    /**
     * @description: 对生成点计分且筛选
     * @param {Pos[]} points
     * @param {boolean} atk
     * @param {number} count
     * @param {boolean} flag
     * @param {boolean} flag2
     * @param {boolean} flag4
     * @return {Pos[]}
     */
    p_scan_score(points, atk, count, flag, flag2, flag4) {
        const FS_OVER = false;

        const tst = [];

        const self_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 0 : 1;
        const foe_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 1 : 0;


        // 若条件满足，则第一轮扫描计算满足一方的ASCEND用子（允许双方都满足）
        // 若双方条件都不满足，则仅计算填充子
        if (this.state.unascend_chargef[0] === 0) tst.push(STONE_ENUM.BLACK_USED);
        if (this.state.unascend_chargef[1] === 0) tst.push(STONE_ENUM.WHITE_USED);
        if (tst.length === 0) tst.push(STONE_ENUM.BLACK, STONE_ENUM.WHITE);


        const result = [];
        const buf = [];

        let _byte = 0;

        points.forEach((pos) => {
            let score = 500;

            let flag5 = false;
            let flag6 = atk || FS_OVER;

            let abyte = 0;


            const self_stone = this.state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
            const foe_stone = this.state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE : STONE_ENUM.BLACK;

            const [self_align, self_align_t] = this.board.get_align(pos.x, pos.y, self_stone);
            const [foe_align, foe_align_t] = this.board.get_align(pos.x, pos.y, foe_stone);


            if (self_align >= 4 || foe_align >= 4) {
                if (this.state.over_status === OVER_ENUM.EXECUTE) {
                    let byte = 0;

                    if (self_align < 4 && !flag2) byte |= 2;
                    if (foe_align < 4 && !flag) byte |= 1;

                    if (byte == 1 || byte == 2) {
                        score += 450;
                        if (pos.plant === PLANT_ENUM.NONE) score += 100;

                        if (byte == 1 || FS_OVER) flag6 = true;
                        abyte = byte;
                    }
                }
                score -= 450;
            }


            if (flag6) {
                if (self_align_t < foe_align_t) score -= Math.abs(self_align_t - foe_align_t) * 3;
                if (self_align < foe_align) score -= Math.abs(self_align - foe_align) * 15;

                if (self_align === 3 && foe_align <= 1) {
                    if (flag4) flag5 = true;
                    else score += Math.trunc(AIC.zsin(25 - this.state.unascend_charge, 25) * 120);
                }

            } else {
                if (self_align_t < foe_align_t && flag && !flag2) score += Math.abs(self_align_t - foe_align_t) * 6;
                else if (self_align_t > foe_align_t && !flag && flag2) score += Math.abs(self_align_t - foe_align_t) * 6;
                else if (self_align_t !== foe_align_t) score -= Math.abs(self_align_t - foe_align_t) * 3;

                if (self_align !== foe_align) score -= Math.abs(self_align - foe_align) * 15;
            }


            if (pos.plant !== PLANT_ENUM.NONE && !flag4) score -= 30;
            else if (atk && tst.includes(pos.stone)) score += 50;


            score += this.rand_aic.xor(20);


            if (abyte > 0) {
                _byte |= abyte;

                buf.push({
                    'score': score,
                    'bit': abyte,
                    'pos': pos
                });

            } else {
                result.push({
                    'score': score,
                    'bit': 0,
                    'pos': pos
                });

                if (flag5) {
                    count++;
                    result.push({
                        'score': score + 30 - this.rand_aic.xor(90),
                        // 'score': score + 30,
                        'bit': 0,
                        'pos': pos
                    });
                }
            }
        });

        // result.forEach((p) => console.log(p.score, p.pos.x, p.pos.y));
        // buf.forEach((p) => console.log(p.score, p.pos.x, p.pos.y));


        // 合并到最终
        if (_byte > 0) {
            this.rand_unity.shuffle(buf);

            const count2 = buf.length;
            let num7 = 0;

            while (num7 < count2 && _byte > 0) {
                const pt = buf[num7];
                const bit = pt.bit;

                if ((_byte & bit) != 0) {
                    _byte &= ~bit;
                    count++;

                    const pt2 = { ...pt };
                    pt2.score += 40 - this.rand_aic.xor(120);
                    // pt2.score += 40;

                    result.push(pt);
                    result.push(pt2);
                }
                num7++;
            }
        }


        // 生成植物
        // 倒序排序！！！
        // 注意是倒序，从大到小！
        this.rand_unity.shuffle(result);
        CsharpSort.sort(result, 0, result.length, (a, b) => b.score - a.score);

        let num9 = 0;
        count = Math.min(count, 6);

        const poses = [];
        const fix = [];

        while (num9 < result.length && count > 0) {
            const pt = result[num9];
            const pos = pt.pos;
            const bit = pt.bit;

            if (!fix.includes(pos)) {
                poses.push(pos);
                if (pos.plant === PLANT_ENUM.ONE) fix.push(pos);

                count--;

                if ((bit & 1) != 0) this.state.unascend_chargef[self_index] = Math.max(this.state.unascend_chargef[self_index], 4);
                if ((bit & 2) != 0) this.state.unascend_chargef[foe_index] = Math.max(this.state.unascend_chargef[foe_index], 4);
            }
            num9++;
        }

        return poses;
    };

    /**
     * @description: 对扫描到的符合规则的点位排序
     * @param {Pos[]} points
     * @return {void}
     */
    p_sort_pos(points) {
        // 强制排序为AIC实现扫描的顺序！
        points.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y; // Y 升序 (0, 1, 2...)
            return a.x - b.x;                 // X 升序 (0, 1, 2...)
        });
    };

    /**
     * @description: 生成植物
     * @param {number} count
     * @return {Pos[] | void}
     */
    p_create(count) {
        const self_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 0 : 1;
        const foe_index = this.state.turn_player === PLAYER_ENUM.BLACK ? 1 : 0;

        let atk = this.state.ascend_status === ASCEND_ENUM.END; // 临时

        const flag = this.state.unascend_chargef[self_index] > 0;
        const flag2 = this.state.unascend_chargef[foe_index] > 0;
        const flag3 = atk;
        const flag4 = atk && this.state.unascend_charge <= 0;


        if (this.state.unascend_chargef[self_index] > 0) atk = false;


        // 扫描符合规则点位
        const cand = this.p_scan_pos(flag3, flag4);

        // 排序
        this.p_sort_pos(cand);

        // 若超载EX，增加1数量
        // 取最小数量
        // 若符合点位数量为0，则不进行任何生成
        if (this.state.over_status === OVER_ENUM.EXECUTE) count++;
        count = Math.min(count, cand.length);
        if (count <= 0) return;

        // 对点位计分，筛选，得到最终点位
        const result = this.p_scan_score(cand, atk, count, flag, flag2, flag4);

        return result;
    };


    /**
     * @description: 7. 检查胜利
     * @return {PLAYER_ENUM | void}
     */
    ed_win() {
        const stone_count_black = this.board.stone_count_black;
        const stone_count_white = this.board.stone_count_white;
        const stone_count = stone_count_black + stone_count_white;

        const stone_all = this.board.w * this.board.h;

        if (this.state.hp[0] > 0 && this.state.hp[1] <= 0) return PLAYER_ENUM.BLACK; // 白方，血量归零，失败
        else if (this.state.hp[0] <= 0 && this.state.hp[1] > 0) return PLAYER_ENUM.WHITE; // 黑方，血量归零，失败

        else if (stone_count === stone_all && this.state.hp[0] > this.state.hp[1]) return PLAYER_ENUM.BLACK; // 棋盘下满，黑方血量更多，胜利
        else if (stone_count === stone_all && this.state.hp[0] < this.state.hp[1]) return PLAYER_ENUM.WHITE; // 棋盘下满，白方血量更多，胜利

        else if (stone_count === stone_all && this.state.hp[0] === this.state.hp[1] && stone_count_black > stone_count_white) return PLAYER_ENUM.BLACK; // 棋盘下满，血量相同，黑方棋子更多，胜利
        else if (stone_count === stone_all && this.state.hp[0] === this.state.hp[1] && stone_count_black < stone_count_white) return PLAYER_ENUM.WHITE; // 棋盘下满，血量相同，白方棋子更多，胜利

        return;
    };
}


export { GameNormal };