/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 状态共享
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { PLAYER_ENUM, ASCEND_ENUM, OVER_ENUM } = require('./enum.cjs');


class State {
    /**
     * @description: 状态
     * @return {State}
     */
    constructor() {
        /** @type {number} */
        this.turn_count = 0;
        /** @type {PLAYER_ENUM} */
        this.turn_player = PLAYER_ENUM.BLACK;
        /** @type {[number, number]} */
        this.turn_pos = [0, 0]; // x y

        /** @type {ASCEND_ENUM} */
        this.ascend_status = ASCEND_ENUM.NONE;

        /** @type {[number, number]} */
        this.hp = [6, 6]; // black white


        /** @type {number} */
        this.unascend_charge = 25;
        /** @type {[number, number]} */
        this.unascend_chargef = [9, 9]; // black white

        /** @type {OVER_ENUM} */
        this.over_status = OVER_ENUM.NONE;
        /** @type {boolean} */
        this.just_unascend = false;
        /** @type {number} */
        this.grow_count = 11;
    };
}


export { State };