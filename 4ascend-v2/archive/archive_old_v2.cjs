
/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋局存档
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { ReadBit, WriteBit } = require('../js/global/fascend/utils.cjs');

const { Board } = require('../js/global/fascend/board.cjs');
const { State } = require('../js/global/fascend/state.cjs');
const { Rand } = require('../js/global/fascend/rand.cjs');

const { PLAYER_ENUM } = require('../js/global/fascend/enum.cjs');

const JSBI = require('jsbi');


/** @typedef {import('./state.cjs').State} State */


class Archive {
    /**
     * @description: 序列化
     * @param {number} seed_aic uint32
     * @param {number} seed_unity uint32
     * @param {Board} board
     * @param {State} state
     * @return {Uint8Array}
     */
    static save(seed_aic, seed_unity, board, state) {
        const data = new WriteBit(2048);

        // 随机数种子
        seed_aic >>>= 0;
        seed_unity >>>= 0;

        data.write(seed_aic, 32);
        data.write(seed_unity, 32);

        // 先手
        const value = this.player2bit(state.turn_player);
        data.write(state.turn_count % 2 === 0 ? value : 1 - value, 1);

        // 回合数
        data.write(state.turn_count, 9);

        // 落子数组
        const turns = board.turns.map((pos) => board.xy2index(pos[0], pos[1]));
        const [total, bitlen] = this.encode(turns);
        data.write(total, bitlen);

        // 计算为了字节对齐需要的 padding
        // 公式：(当前长度 + 3位标识) 补齐到 8 的倍数
        const pad = (8 - ((data.offset + 3) % 8)) % 8;
        for (let i = 0; i < pad; i++) data.write(0, 1);

        data.write(pad, 3); // 写入填充了多少位

        return data.buffer.subarray(0, Math.ceil(data.offset / 8));
    };

    /**
     * @description: 反序列化
     * @param {Uint8Array} data
     * @return {any}
     */
    static load(data) {
        const buffer = new ReadBit(data);

        const seed_aic = JSBI.toNumber(buffer.read(32));
        const seed_unity = JSBI.toNumber(buffer.read(32));

        const player = this.bit2player(JSBI.toNumber(buffer.read(1)));
        const count = JSBI.toNumber(buffer.read(9));

        const turns_offset = buffer.offset; // 记录 turns 开始的位置

        // 直接定位到字节流的最后 3 bits 读出 pad 数量
        const total_length = data.byteLength * 8;
        buffer.offset = total_length - 3;
        const pad = JSBI.toNumber(buffer.read(3));

        // 计算 turns 数据块的实际比特长度
        // 长度 = 总长度 - 结尾3位 - 填充位 - 之前已读的位数
        const turns_length = total_length - 3 - pad - turns_offset;

        // 回到 turns 开始的地方进行读取
        buffer.offset = turns_offset;
        const compressed = buffer.read(turns_length);
        const turns = this.decode(compressed, count).map((index) => {
            const x = index % 9;
            const y = Math.floor(index / 9);
            return [x, y];
        });

        return { player, turns, seed_aic, seed_unity };
    };


    /**
     * @description 编码
     * @param {number[]} data
     * @returns {[bigint, number]}
     */
    static encode(data) {
        // let total = BigInt(0);
        // let base = BigInt(81);

        // for (let i = data.length - 1; i >= 0; i--)  total = total * base + BigInt(data[i]);
        // return [total, total.toString(2).length];


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
        // let result = [];
        // let current = packed;
        // let base = BigInt(81);

        // for (let i = 0; i < count; i++) {
        //     result.push(Number(current % base));
        //     current = current / base;
        // }
        // return result;


        let result = [];
        // 确保 packed 是 JSBI 实例
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


    /**
     * @description: 转换为数字
     * @param {PLAYER_ENUM} player
     * @return {number}
     */
    static player2bit(player) {
        if (player === PLAYER_ENUM.BLACK) return 0;
        else if (player === PLAYER_ENUM.WHITE) return 1;
    };

    /**
     * @description: 转换为玩家
     * @param {number} value
     * @return {PLAYER_ENUM}
     */
    static bit2player(value) {
        if (value === 0) return PLAYER_ENUM.BLACK;
        else if (value === 1) return PLAYER_ENUM.WHITE;
    };
}


export { Archive };