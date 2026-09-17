/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋盘
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { STONE_ENUM, PLANT_ENUM } = require('./enum.cjs');

const { Pos } = require('./pos.cjs');


class Board {
    /**
     * @description: 棋盘
     * @param {number} w
     * @param {number} h
     * @return {Board}
     */
    constructor(w, h) {
        /** @type {number} */
        this.w = w;
        /** @type {number} */
        this.h = h;

        /** @type {Pos[]} */
        this.data = Array.from({ 'length': this.w * this.h }, (_, index) => {
            const [x, y] = this.index2xy(index);
            return new Pos(x, y, STONE_ENUM.NONE, PLANT_ENUM.NONE);
        });

        /** @type {[number, number][]} */
        this.turns = [];
    };


    /**
     * @description 获取当前棋子总数
     * @returns {number}
     */
    get stone_count() {
        return this.data.filter((p) => p.stone === STONE_ENUM.BLACK || p.stone === STONE_ENUM.WHITE).length;
    };

    /**
     * @description 获取当前黑方棋子总数
     * @returns {number}
     */
    get stone_count_black() {
        return this.data.filter((p) => p.stone === STONE_ENUM.BLACK).length;
    };

    /**
     * @description 获取当前白方棋子总数
     * @returns {number}
     */
    get stone_count_white() {
        return this.data.filter((p) => p.stone === STONE_ENUM.WHITE).length;
    };


    /**
     * @description 索引转坐标
     * @param {number} i 
     * @returns {[number, number]}
     */
    index2xy(i) {
        const x = i % this.w;
        const y = Math.floor(i / this.w);
        return [x, y];
    };

    /**
     * @description 坐标转索引
     * @param {number} x 
     * @param {number} y 
     * @returns {number}
     */
    xy2index(x, y) {
        return y * this.w + x;
    };

    /**
     * @description 设置棋子
     * @param {number} x 
     * @param {number} y 
     * @param {STONE_ENUM} stone 
     */
    set_stone(x, y, stone) {
        this.data[this.xy2index(x, y)].stone = stone;
    };

    /**
     * @description 获取棋子
     * @param {number} x 
     * @param {number} y 
     * @returns {STONE_ENUM}
     */
    get_stone(x, y) {
        return this.data[this.xy2index(x, y)].stone;
    };

    /**
     * @description 设置植物
     * @param {number} x 
     * @param {number} y 
     * @param {PLANT_ENUM} plant 
     */
    set_plant(x, y, plant) {
        this.data[this.xy2index(x, y)].plant = plant;
    };

    /**
     * @description 获取植物
     * @param {number} x 
     * @param {number} y 
     * @returns {PLANT_ENUM}
     */
    get_plant(x, y) {
        return this.data[this.xy2index(x, y)].plant;
    };

    /**
     * @description 同时设置棋子和植物
     * @param {number} x 
     * @param {number} y 
     * @param {STONE_ENUM} stone 
     * @param {PLANT_ENUM} plant 
     */
    set_pos(x, y, stone, plant) {
        this.data[this.xy2index(x, y)].stone = stone;
        this.data[this.xy2index(x, y)].plant = plant;
    };

    /**
     * @description 获取位置对象
     * @param {number} x 
     * @param {number} y 
     * @returns {Pos}
     */
    get_pos(x, y) {
        return this.data[this.xy2index(x, y)];
    };


    /**
     * @description 获取自身旁边八个方向的所有点
     * @param {number} x 
     * @param {number} y 
     * @returns {Pos[]}
     */
    get_directions(x, y) {
        const directions = [
            [-1, 0],  // 左
            [1, 0],   // 右

            [0, 1],   // 上
            [0, -1],  // 下

            [-1, 1],  // 左上
            [-1, -1], // 左下

            [1, 1],   // 右上
            [1, -1],  // 右下
        ]; // 警告，为了统一AIC访问顺序，特此定义

        const result = [];

        directions.forEach(([dx, dy]) => {
            const sx = x + dx;
            const sy = y + dy;
            if (!this.in_bounds(sx, sy)) return;

            const p = this.data[this.xy2index(sx, sy)];
            result.push(p);
        });

        return result;
    };

    /**
     * @description 获取 max_align max_align_total || 最大 总和
     * @param {number} x 
     * @param {number} y 
     * @param {STONE_ENUM} stone 
     * @returns {[number, number]}
     */
    get_align(x, y, stone) {
        const directions = [
            [0, -1],  // 上
            [0, 1],   // 下

            [-1, 0],  // 左
            [1, 0],   // 右

            [-1, -1], // 左上
            [1, 1],   // 右下

            [-1, 1],  // 左下
            [1, -1],  // 右上
        ];

        const result = [];
        for (const [dx, dy] of directions) {
            // 必须连续，不允许断开或者敌方棋子
            // 中心默认计数1，就算非我方棋子也计数
            let c = 1;

            let sx = x;
            let sy = y;

            sx += dx;
            sy += dy;

            while (this.in_bounds(sx, sy)) {
                if (this.get_stone(sx, sy) !== stone) break;

                c++;
                sx += dx;
                sy += dy;
            }

            result.push(c);
        }

        // 以两组，计算连线
        const line = [];
        for (let index = 0; index < 8; index += 2) {
            const a = result[index] - 1;
            const b = result[index + 1] - 1;

            line.push(a + b + 1); // 中心+1
        }

        // 取最大连线长度
        const max_align = Math.max(...line);

        // 计算所有方向总连续长度
        let max_align_total = -7; // 八方向，默认-8，但中心+1
        result.forEach((c) => max_align_total += c);

        return [max_align, max_align_total];
    };

    /**
     * @description 获取ASCEND数据
     * @param {number} x 
     * @param {number} y 
     * @param {STONE_ENUM} stone 
     * @returns {Pos[] | null}
     */
    get_ascend(x, y, stone) {
        const directions = [
            [0, -1],  // 上
            [0, 1],   // 下

            [-1, 0],  // 左
            [1, 0],   // 右

            [-1, -1], // 左上
            [1, 1],   // 右下

            [-1, 1],  // 左下
            [1, -1],  // 右上
        ];

        const result = [];
        for (const [dx, dy] of directions) {
            // 必须连续，不允许断开或者敌方棋子
            // 中心默认计数1，就算非我方棋子也计数
            // 计数，但是不是每次都进行计数
            const c = [];

            let sx = x;
            let sy = y;

            sx += dx;
            sy += dy;

            while (this.in_bounds(sx, sy)) {
                const p = this.get_pos(sx, sy);
                if (p.stone !== stone) break;

                c.push(p);
                sx += dx;
                sy += dy;
            }

            result.push(c);
        }

        // 合并为连线
        // 遍历所有连线
        // 至少需要3独立棋子
        // 中心点不计算
        // 若形成ASCEND，则计算中心点
        const poses = [];
        for (let index = 0; index < 8; index += 2) {
            const a = result[index];
            const b = result[index + 1];

            if (a.length + b.length >= 3) poses.push(...a, ...b);
        }

        if (poses.length === 0) return null;

        poses.push(this.get_pos(x, y));
        return poses;
    };


    /**
     * @description 是否在范围内
     * @param {number} x 
     * @param {number} y 
     * @returns {boolean}
     */
    in_bounds(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h; // 下标不超过
    };
}


export { Board };