/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 编码算法
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class BaseZalgo {
    static {
        this.MARKS = Array.from({ 'length': 64 }, (_, i) => String.fromCharCode(0x0300 + i)); // 64个变音符号 (U+0300 - U+033F)，负责纵向堆叠
        this.ANCHOR = '|';
    };

    /**
     * @description: 编码函数
     * @param {Uint8Array} data
     * @return {string}
     */
    static encode(data) {
        let bin = '';
        for (let b of data) bin += b.toString(2).padStart(8, '0');

        let result = '';
        for (let i = 0; i < bin.length; i += 6) {
            let chunk = bin.substring(i, i + 6).padEnd(6, '0');
            let index = parseInt(chunk, 2);

            // 每堆叠 8 个符号（即 1 字节数据对应约 1.3 个符号）
            // 这里的逻辑会让它看起来像一根根长满倒钩的天线
            if ((i / 6) % 8 === 0) result += this.ANCHOR;

            result += this.MARKS[index];
        }
        return result;
    };

    /**
     * @description: 解码函数
     * @param {string} str
     * @return {Uint8Array}
     */
    static decode(str) {
        let bin = '';
        for (let char of str) {
            let index = this.MARKS.indexOf(char);
            if (index !== -1) bin += index.toString(2).padStart(6, '0');
        }

        let bytes = [];
        for (let i = 0; i < bin.length; i += 8) {
            let chunk = bin.substring(i, i + 8);
            if (chunk.length === 8) bytes.push(parseInt(chunk, 2));
        }
        return new Uint8Array(bytes);
    };
}


export { BaseZalgo };