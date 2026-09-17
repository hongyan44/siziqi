/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 工具
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const JSBI = require('jsbi');


class ATK {
    /**
     * @description: Attribution：下不过阿尔玛
     * @param {number[]} a
     * @param {number[]} b
     * @return {[number[], number[]][]}
     */
    static parse(a, b) {
        // 从大到小
        a.sort((x, y) => y - x);
        b.sort((x, y) => y - x);

        const fs = [];
        fs.push([[...a], [...b]]);

        while (a.length > 0 && b.length > 0) {
            const d = Math.min(a[0], b[0]);

            if ((a[0] -= d) <= 0) a.shift();
            if ((b[0] -= d) <= 0) b.shift();

            fs.push([[...a], [...b]]);
        }

        return fs;
    };
}

class AIC {
    /**
     * @description: 限制数值在 [minnum, maxnum] 之间
     * @param {number} minnum
     * @param {number} thenum
     * @param {number} maxnum
     * @return {number}
     */
    static mmx(minnum, thenum, maxnum) {
        return Math.max(minnum, Math.min(thenum, maxnum));
    };


    /**
     * @description: 归一化的正弦过渡函数
     * @param {number} num
     * @param {number} _mx
     * @return {number}
     */
    static zsin(num, _mx) {
        if (num <= 0.0) return 0.0;
        if (num < _mx) return this.sin(this.mmx(0.0, num / _mx, 1.0) * 0.5 * 3.1415927);
        return 1.0;
    };

    /**
     * @description: 正弦函数实现
     * @param {number} x
     * @return {number}
     */
    static sin(x) {
        if (x !== 0.0) return this.cos(x - 1.5707964);
        return 0.0;
    };

    /**
     * @description: 强制对齐 C# float 精度的余弦实现
     * @param {number} x
     * @return {number} (Float32)
     */
    static cos(x) {
        // 将输入转换为单精度
        x = Math.fround(x);
        let num = Math.fround(1.0);

        if (x < 0.0) x = Math.fround(-x);

        // 折叠到 [0, 2π) 区间
        // 注意：这里的常数最好也包裹 fround 以确保与 C# float 常数完全一致
        x = Math.fround(x - Math.fround(Math.floor(Math.fround(x * Math.fround(0.31830987 * 0.5))) * 6.2831855));

        if (x >= 3.1415927) x = Math.fround(6.2831855 - x);

        if (x >= 1.5707964) {
            x = Math.fround(3.1415927 - x);
            num = Math.fround(-1.0);
        }

        if (x > 0.7853982) {
            x = Math.fround(1.5707964 - x);
            const num2 = Math.fround(x * x);
            // 泰勒展开计算并强制转为单精度
            let res = Math.fround(x * Math.fround(1.0 - Math.fround(num2 * 0.16666667) + Math.fround(Math.fround(num2 * num2) * 0.008333334)));
            return Math.fround(res * num);
        }

        const num3 = Math.fround(x * x);
        // 泰勒展开计算并强制转为单精度
        let res = Math.fround(
            Math.fround(1.0 - Math.fround(num3 * 0.5)) +
            Math.fround(Math.fround(num3 * num3) * 0.041666668) -
            Math.fround(Math.fround(Math.fround(num3 * num3) * num3) * 0.0013888889)
        );
        return Math.fround(res * num);
    };
}


class CsharpSort {
    /**
     * @description: 排序
     * @param {Array} keys
     * @param {number} index
     * @param {number} length
     * @param {Function} comparer
     * @return {void}
     */
    static sort(keys, index, length, comparer) {
        try {
            if (length < 2) return;
            this.introspectiveSort(keys, index, length, comparer);
        } catch (e) {
            // 简化的异常处理，模拟原代码的 catch 块
            throw new Error("Failed to compare two elements in the array: " + e.message);
        }
    };

    // 对应源码：IntrospectiveSort
    static introspectiveSort(keys, left, length, comparer) {
        // 对应 2 * FloorLog2PlusOne(length)
        const depthLimit = 2 * (Math.floor(Math.log2(length)) + 1);
        this.introSort(keys, left, length + left - 1, depthLimit, comparer);
    };

    // 对应源码：IntroSort
    static introSort(keys, lo, hi, depthLimit, comparer) {
        while (hi > lo) {
            let num = hi - lo + 1;

            // 源码中的特殊阈值判断：<= 16
            if (num <= 16) {
                if (num === 1) return;
                if (num === 2) {
                    this.swapIfGreater(keys, comparer, lo, hi);
                    return;
                }
                if (num === 3) {
                    this.swapIfGreater(keys, comparer, lo, hi - 1);
                    this.swapIfGreater(keys, comparer, lo, hi);
                    this.swapIfGreater(keys, comparer, hi - 1, hi);
                    return;
                }
                this.insertionSort(keys, lo, hi, comparer);
                return;
            }

            // 深度超限切换堆排序
            if (depthLimit === 0) {
                this.heapsort(keys, lo, hi, comparer);
                return;
            }

            depthLimit--;

            // 分区
            let num2 = this.pickPivotAndPartition(keys, lo, hi, comparer);
            // 递归右半部分
            this.introSort(keys, num2 + 1, hi, depthLimit, comparer);
            // 尾递归优化：将 hi 移至左半部分末尾继续循环
            hi = num2 - 1;
        }
    };

    // 对应源码：PickPivotAndPartition
    static pickPivotAndPartition(keys, lo, hi, comparer) {
        // 三数取中逻辑
        let num = lo + Math.floor((hi - lo) / 2);
        this.swapIfGreater(keys, comparer, lo, num);
        this.swapIfGreater(keys, comparer, lo, hi);
        this.swapIfGreater(keys, comparer, num, hi);

        let t = keys[num];
        this.swap(keys, num, hi - 1);

        let i = lo;
        let num2 = hi - 1;
        while (i < num2) {
            while (comparer(keys[++i], t) < 0);
            while (comparer(t, keys[--num2]) < 0);
            if (i >= num2) break;
            this.swap(keys, i, num2);
        }
        this.swap(keys, i, hi - 1);
        return i;
    };

    // 对应源码：Heapsort
    static heapsort(keys, lo, hi, comparer) {
        let n = hi - lo + 1;
        for (let i = Math.floor(n / 2); i >= 1; i--) {
            this.downHeap(keys, i, n, lo, comparer);
        }
        for (let j = n; j > 1; j--) {
            this.swap(keys, lo, lo + j - 1);
            this.downHeap(keys, 1, j - 1, lo, comparer);
        }
    };

    // 对应源码：DownHeap
    static downHeap(keys, i, n, lo, comparer) {
        let t = keys[lo + i - 1];
        while (i <= Math.floor(n / 2)) {
            let num = 2 * i;
            if (num < n && comparer(keys[lo + num - 1], keys[lo + num]) < 0) {
                num++;
            }
            if (comparer(t, keys[lo + num - 1]) >= 0) break;
            keys[lo + i - 1] = keys[lo + num - 1];
            i = num;
        }
        keys[lo + i - 1] = t;
    };

    // 对应源码：InsertionSort
    static insertionSort(keys, lo, hi, comparer) {
        for (let i = lo; i < hi; i++) {
            let num = i;
            let t = keys[i + 1];
            while (num >= lo && comparer(t, keys[num]) < 0) {
                keys[num + 1] = keys[num];
                num--;
            }
            keys[num + 1] = t;
        }
    };

    // 对应源码：SwapIfGreater
    static swapIfGreater(keys, comparer, a, b) {
        if (a !== b && comparer(keys[a], keys[b]) > 0) {
            let t = keys[a];
            keys[a] = keys[b];
            keys[b] = t;
        }
    };

    // 对应源码：Swap
    static swap(a, i, j) {
        if (i !== j) {
            let t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
    };
}

class ReadBit {
    /**
     * @description: 二进制位读取
     * @param {Uint8Array} buffer
     * @return {ReadBit}
     */
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    /**
     * @description: 读取数字
     * @param {number} length
     * @returns {bigint}
     */
    read(length) {
        // let result = 0n;
        // for (let i = 0; i < length; i++) {
        //     const byte_index = Math.floor(this.offset / 8);
        //     const bit_index = 7 - (this.offset % 8);

        //     // 提取当前位
        //     const bit = BigInt((this.buffer[byte_index] >> bit_index) & 1);

        //     // 将位拼接到结果中
        //     result = (result << 1n) | bit;

        //     this.offset++;
        // }
        // return result;


        let result = JSBI.BigInt(0);
        const ONE = JSBI.BigInt(1);

        for (let i = 0; i < length; i++) {
            const byte_index = Math.floor(this.offset / 8);
            const bit_index = 7 - (this.offset % 8);

            // 1. 从 buffer 中提取位 (bit)
            // 注意：buffer[i] 是普通 number，可以直接使用原生位运算
            const bitVal = (this.buffer[byte_index] >> bit_index) & 1;
            const bit = JSBI.BigInt(bitVal);

            // 2. 拼接结果：result = (result << 1n) | bit
            result = JSBI.leftShift(result, ONE);
            result = JSBI.bitwiseOr(result, bit);

            this.offset++;
        }
        return result;
    };
}

class WriteBit {
    /**
     * @description: 二进制位写入
     * @param {number} size
     * @return {WriteBit}
     */
    constructor(size) {
        this.buffer = new Uint8Array(size); // all 0
        this.offset = 0;
    };

    /**
     * @description: 写入数字
     * @param {number|bigint} value
     * @param {number} length
     */
    write(value, length) {
        // const big = BigInt(value);
        // for (let i = length - 1; i >= 0; i--) {
        //     const byte_index = Math.floor(this.offset / 8);
        //     const bit_index = 7 - (this.offset % 8); // 从字节高位向低位写

        //     // 提取当前要写入的那一位 (0 或 1)
        //     const bit = Number((big >> BigInt(i)) & 1n);

        //     if (bit === 1) this.buffer[byte_index] |= (1 << bit_index);
        //     else this.buffer[byte_index] &= ~(1 << bit_index);

        //     this.offset++;
        // }


        // 确保转换为 JSBI 实例
        const big = JSBI.BigInt(value.toString());
        const ONE = JSBI.BigInt(1);

        for (let i = length - 1; i >= 0; i--) {
            const byte_index = Math.floor(this.offset / 8);
            const bit_index = 7 - (this.offset % 8); // 字节内从高位 (MSB) 向低位 (LSB) 写

            // 1. 提取当前位：(big >> i) & 1
            // JSBI 不支持运算符重载，必须调用静态方法
            const i_big = JSBI.BigInt(i);
            const shifted = JSBI.signedRightShift(big, i_big);
            const bit = JSBI.toNumber(JSBI.bitwiseAnd(shifted, ONE));

            // 2. 写入 Buffer
            // 这里的 buffer 操作是针对普通 number 的，不需要 JSBI
            if (bit === 1) {
                this.buffer[byte_index] |= (1 << bit_index);
            } else {
                this.buffer[byte_index] &= ~(1 << bit_index);
            }

            this.offset++;
        }
    };
}


export { ATK, AIC, ReadBit, WriteBit, CsharpSort };