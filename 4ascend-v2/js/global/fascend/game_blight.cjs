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


class GameBlight {
    /**
     * @description: 游戏
     * @param {Board} board
     * @param {State} state
     * @param {RandAIC} rand_aic
     * @param {RandUnity} rand_unity
     * @return {GameBlight}
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
        /** @type {boolean} Blight/endgame mode never refreshes plants. */
        this.natural_plant = false;
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
        return;
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


export { GameBlight };
