/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 点
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
/** @typedef {import('./enum.cjs').STONE_ENUM} STONE_ENUM */
/** @typedef {import('./enum.cjs').PLANT_ENUM} PLANT_ENUM */


class Pos {
    /**
     * @description: 点
     * @param {number} x
     * @param {number} y
     * @param {STONE_ENUM} s
     * @param {PLANT_ENUM} p
     * @return {Pos}
     */
    constructor(x, y, s, p) {
        /** @type {number} */
        this.x = x;
        /** @type {number} */
        this.y = y;

        /** @type {STONE_ENUM} */
        this.stone = s;
        /** @type {PLANT_ENUM} */
        this.plant = p;
    };
}


export { Pos };