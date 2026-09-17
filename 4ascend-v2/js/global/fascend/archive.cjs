
/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋局存档
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const JSBI = require('jsbi');

const { ReadBit, WriteBit } = require('./utils.cjs');

const { PLAYER_ENUM } = require('./enum.cjs');


/** @typedef {import('./state.cjs').State} State */


class ArchiveV0 {
    /**
     * @description: 序列化
     * @param {[number, number, number]} seeds aic | unity | other
     * @param {[number, number]} clocks b | w
     * @param {[number, number]} healths b | w
     * @param {[number, number][]} turns
     * @param {number} turn_count
     * @param {number} first
     * @param {number} mode 0 | 1 | 2
     * @return {Uint8Array}
     */
    static save(seeds, clocks, healths, turns, turn_count, first, mode) {
        const data = new WriteBit(10240); // 1MB

        data.write('C'.charCodeAt(0), 8);
        data.write('A'.charCodeAt(0), 8);
        data.write('T'.charCodeAt(0), 8);

        data.write(1, 10);

        // 随机数种子
        let [seed_aic, seed_unity, seed_other] = seeds;

        seed_aic >>>= 0;
        seed_unity >>>= 0;
        seed_other >>>= 0;

        data.write(seed_aic, 32);
        data.write(seed_unity, 32);
        data.write(seed_other, 32);

        // 棋种
        data.write(clocks[0], 10); // my
        data.write(clocks[1], 10); // foe

        // 阵营
        data.write(healths[0], 8); // my
        data.write(healths[1], 8); // foe

        // 先手
        data.write(first, 1);

        // 游戏模式（2位：0普通，1灾荒，2永夜）
        data.write(mode, 2);

        // 回合数
        data.write(turn_count, 10);

        // 落子数组
        turns = turns.map((pos) => pos[1] * 9 + pos[0]); // xy2index
        const [total, bitlen] = this.encode(turns);
        data.write(total, bitlen);

        // 对齐
        const pad = (8 - ((data.offset + 3) % 8)) % 8;
        for (let i = 0; i < pad; i++) data.write(0, 1);
        data.write(pad, 3);

        return data.buffer.subarray(0, Math.ceil(data.offset / 8));
    };

    /**
     * @description: 反序列化
     * @param {Uint8Array} data
     * @return {any}
     */
    static load(data) {
        const buffer = new ReadBit(data);

        // 魔数与版本
        const magic = String.fromCharCode(JSBI.toNumber(buffer.read(8)), JSBI.toNumber(buffer.read(8)), JSBI.toNumber(buffer.read(8)));
        const version = JSBI.toNumber(buffer.read(10));

        if (magic !== 'CAT' || (version !== 0 && version !== 1)) return;

        // 随机数种子
        const seed_aic = JSBI.toNumber(buffer.read(32));
        const seed_unity = JSBI.toNumber(buffer.read(32));
        const seed_other = JSBI.toNumber(buffer.read(32));

        // 棋种
        const clocks = [JSBI.toNumber(buffer.read(10)), JSBI.toNumber(buffer.read(10))];

        // 生命值
        const healths = [JSBI.toNumber(buffer.read(8)), JSBI.toNumber(buffer.read(8))];

        // 先手
        const first = JSBI.toNumber(buffer.read(1));

        // 游戏模式：旧版本使用1位，新版本使用2位（支持永夜）
        const mode = JSBI.toNumber(buffer.read(version === 0 ? 1 : 2));

        // 回合数
        const turn_count = JSBI.toNumber(buffer.read(10));

        // 落子数组
        const turns_offset = buffer.offset;

        const total_length = data.byteLength * 8;
        buffer.offset = total_length - 3;
        const pad = JSBI.toNumber(buffer.read(3));

        const turns_length = total_length - 3 - pad - turns_offset;

        buffer.offset = turns_offset;
        const compressed = buffer.read(turns_length);
        const turns = this.decode(compressed, turn_count).map((index) => {
            const x = index % 9;
            const y = Math.floor(index / 9);
            return [x, y];
        });

        return { seed_aic, seed_unity, seed_other, clocks, healths, first, turns, mode };
    };


    /**
     * @description 编码
     * @param {number[]} data
     * @returns {[bigint, number]}
     */
    static encode(data) {
        let total = JSBI.BigInt(0);
        let base = JSBI.BigInt(81);

        for (let i = data.length - 1; i >= 0; i--) {
            // total = total * base + BigInt(data[i])
            const term = JSBI.multiply(total, base);
            total = JSBI.add(term, JSBI.BigInt(data[i]));
        }

        // 获取二进制长度
        const binary_str = total.toString(2);
        return [total, binary_str.length];
    };

    /**
     * @description 解码
     * @param {BigInt} packed
     * @param {number} count
     * @returns {number[]}
     */
    static decode(packed, count) {
        let result = [];
        let current = JSBI.BigInt(packed.toString());
        let base = JSBI.BigInt(81);

        for (let i = 0; i < count; i++) {
            // result.push(Number(current % base))
            const remainder = JSBI.remainder(current, base);
            result.push(JSBI.toNumber(remainder));

            // current = current / base
            current = JSBI.divide(current, base);
        }
        return result
    };
}


export { ArchiveV0 };