/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 随机数生成器
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class RandAIC {
    /**
     * @description: AIC Xor128
     * @param {number} seed
     * @return {Rand}
     */
    constructor(seed) {
        this.seed = this.parse(seed); // uint32

        this.states = [0, 0, 0, 0];
        this.states[0] = this.seed;
        this.states[1] = this.parse(this.seed + 123456789); // uint32
        this.states[2] = this.parse(this.seed + 362436069); // uint32
        this.states[3] = this.parse(this.seed + 521288629); // uint32

        // 分布预热
        for (let i = 0; i < 132; i++)  this.next();
    };

    /**
     * @description: 截断
     * @param {number} n
     * @return {number}
     */
    parse(n) {
        return n >>> 0;
    };


    /**
     * @description: uint32
     * @return {number}
     */
    next() {
        const num = this.parse(this.states[0] ^ this.parse(this.states[0] << 11));
        this.states[0] = this.states[1];
        this.states[1] = this.states[2];
        this.states[2] = this.states[3];
        this.states[3] = this.parse(this.states[3] ^ this.parse(this.states[3] >>> 19) ^ this.parse(num ^ this.parse(num >>> 8)));
        return this.states[3];
    };
    /**
     * @description: [0, max)
     * @param {number} n 
     */
    xor(n) {
        // return 0;
        // 使用 float() 得到的 [0, 1) 乘以 n 再取整
        // 这利用了 IEEE 754 浮点数的均匀性
        // return Math.floor(this.float() * n);
        return this.next() % n; // AIC
    };
}

class RandUnity {
    /**
     * @description: Unity Xor128
     * @param {number} seed
     * @return {Rand}
     */
    constructor(seed) {
        this.seed = this.parse(seed); // uint32

        this.states = [0, 0, 0, 0];
        this.states[0] = this.seed;
        this.states[1] = this.parse(Math.imul(this.states[0], 1812433253) + 1); // uint32
        this.states[2] = this.parse(Math.imul(this.states[1], 1812433253) + 1); // uint32
        this.states[3] = this.parse(Math.imul(this.states[2], 1812433253) + 1); // uint32

        // console.log(this);
    };

    /**
     * @description: 截断
     * @param {number} n
     * @return {number}
     */
    parse(n) {
        return n >>> 0;
    };


    /**
     * @description: uint32
     * @return {number}
     */
    next() {
        const num = this.parse(this.states[0] ^ this.parse(this.states[0] << 11));
        this.states[0] = this.states[1];
        this.states[1] = this.states[2];
        this.states[2] = this.states[3];
        this.states[3] = this.parse(this.states[3] ^ this.parse(this.states[3] >>> 19) ^ this.parse(num ^ this.parse(num >>> 8)));
        return this.states[3];
    };


    /**
     * @description: 区间
     * @param {number} min
     * @param {number} max
     * @return {number}
     */
    ins(min, max) {
        let dif;

        if (min < max) {
            dif = max - min;
            let t = this.next() % dif;
            t += min;
            return t;

        } else if (min > max) {
            dif = min - max;
            let t = this.next() % dif;
            t = min - t;
            return t;

        } else {
            return min;
        }
    };

    /**
     * @description: 乱序数组
     * @param {Array} array
     * @return {void}
     */
    shuffle(array) {
        // return;
        const length = array.length;
        const num = (length - 1) * 23;

        for (let ptr = 0; ptr < num; ptr++) {
            const num2 = this.ins(0, length);
            const num3 = this.ins(0, length);
            const num4 = num2;
            const num5 = num3;

            const a1 = array[num3];
            const a2 = array[num2];

            array[num4] = a1;
            array[num5] = a2;
        }
    };
}

class RandOther {
    /**
     * @description: SFC32
     * @param {number} seed
     * @return {number}
     */
    constructor(seed) {
        this.seed = seed | 0;

        this.a = seed | 0;
        this.b = (seed ^ 0xDEADBEEF) | 0;
        this.c = (seed ^ 0x55555555) | 0;
        this.d = 1;

        // 预热算法，让状态充分混合
        for (let i = 0; i < 128; i++) this.next();
    };

    /**
     * @description: 下一个随机数
     * @return {number}
     */
    next() {
        this.a |= 0; this.b |= 0; this.c |= 0; this.d |= 0;
        let t = (this.a + this.b | 0) + this.d | 0;
        this.d = this.d + 1 | 0;
        this.a = this.b ^ (this.b >>> 9);
        this.b = this.c + (this.c << 3) | 0;
        this.c = (this.c << 21 | this.c >>> 11);
        this.c = this.c + t | 0;
        return t >>> 0;
    };

    /**
     * @description: 随机浮点数
     * @return {number}
     */
    float() {
        return this.next() / 0x100000000;
    };

    /**
     * @description: 拒绝采样随机
     * @param {number} max
     * @return {number}
     */
    xor(max) {
        // 计算 uint32 范围内能被 max 整除的最大边界
        // 例如 2^32 = 4294967296
        const limit = ((-max) >>> 0) % max;

        while (true) {
            const r = this.next();
            if (r >= limit) return r % max; // 在安全范围内，取模是均匀的
            // 落在 [limit, 2^32-1] 之间的数被“拒绝”，重新采样
        }
    };
}


export { RandAIC, RandUnity, RandOther };