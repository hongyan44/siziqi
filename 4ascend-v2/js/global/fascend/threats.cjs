/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 全盘打点（M+N）计算与绘制（观战 / 回放共用）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

// 四条轴线，每条轴线由两个相反方向组成，与 Board.get_ascend 保持一致。
const AXES = [
    [[0, -1], [0, 1]],
    [[-1, 0], [1, 0]],
    [[-1, -1], [1, 1]],
    [[-1, 1], [1, -1]],
];

class Threats {
    /**
     * @description: 沿一个方向收集连续的同色棋子下标
     * @param {symbol[]} stones
     * @param {number} x
     * @param {number} y
     * @param {number} dx
     * @param {number} dy
     * @param {number} w
     * @param {number} h
     * @param {symbol} stone
     * @return {number[]}
     */
    static collect(stones, x, y, dx, dy, w, h, stone) {
        const list = [];

        let sx = x + dx;
        let sy = y + dy;

        while (sx >= 0 && sy >= 0 && sx < w && sy < h) {
            const index = sy * w + sx;
            if (stones[index] !== stone) break;

            list.push(index);
            sx += dx;
            sy += dy;
        }

        return list;
    }

    /**
     * @description: 计算某一方在该点的 M+N（该点被己方棋子占据时不可落子，返回 null）
     * @param {symbol[]} stones
     * @param {symbol[]} plants
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {symbol} center 该点当前的棋子
     * @param {symbol} stone 计算方棋子
     * @param {object} stone_enum
     * @param {object} plant_enum
     * @return {{M: number, N: number, MN: number} | null}
     */
    static side_power(stones, plants, x, y, w, h, center, stone, stone_enum, plant_enum) {
        const own = stone === stone_enum.BLACK
            ? [stone_enum.BLACK, stone_enum.BLACK_ASCEND, stone_enum.BLACK_USED]
            : [stone_enum.WHITE, stone_enum.WHITE_ASCEND, stone_enum.WHITE_USED];

        // 己方普通子 / 盘旋子 / 已拿起子的位置不能再落子
        if (own.includes(center)) return null;

        // 中心点按落子后归属己方计算；被对方普通子堵住的点同样按“假想拿下”计算
        const points = new Set([y * w + x]);

        AXES.forEach(([a, b]) => {
            const first = Threats.collect(stones, x, y, a[0], a[1], w, h, stone);
            const second = Threats.collect(stones, x, y, b[0], b[1], w, h, stone);

            // 与 get_ascend 一致：单轴连续子数（不含中心）至少 3 才构成 M >= 4
            if (first.length + second.length < 3) return;

            first.forEach((index) => points.add(index));
            second.forEach((index) => points.add(index));
        });

        if (points.size <= 1) return null;

        let M = 0;
        let N = 0;

        points.forEach((index) => {
            M += 1;

            if (plants[index] === plant_enum.ONE) N += 1;
            else if (plants[index] === plant_enum.TWO) N += 2;
        });

        return { 'M': M, 'N': N, 'MN': M + N };
    }

    /**
     * @description: 扫描全盘打点（仅返回至少一方可成打的点）
     * @param {Array<object | number[]>} cells 棋盘数据（对象或 [x, y, stone, plant] 数组）
     * @param {object} stone_enum
     * @param {object} plant_enum
     * @param {number} w
     * @param {number} h
     * @return {{x: number, y: number, black: object | null, white: object | null}[]}
     */
    static scan(cells, stone_enum, plant_enum, w = 9, h = 9) {
        if (!cells || !stone_enum || !plant_enum) return [];

        const stones = new Array(w * h).fill(stone_enum.NONE);
        const plants = new Array(w * h).fill(plant_enum.NONE);

        cells.forEach((cell) => {
            const x = Array.isArray(cell) ? cell[0] : cell.x;
            const y = Array.isArray(cell) ? cell[1] : cell.y;
            if (!Number.isInteger(x) || !Number.isInteger(y)) return;
            if (x < 0 || y < 0 || x >= w || y >= h) return;

            const index = y * w + x;
            stones[index] = Array.isArray(cell) ? cell[2] : cell.stone;
            plants[index] = Array.isArray(cell) ? cell[3] : cell.plant;
        });

        const result = [];

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const center = stones[y * w + x];

                const black = Threats.side_power(stones, plants, x, y, w, h, center, stone_enum.BLACK, stone_enum, plant_enum);
                const white = Threats.side_power(stones, plants, x, y, w, h, center, stone_enum.WHITE, stone_enum, plant_enum);

                if (!black && !white) continue;
                result.push({ x, y, black, white });
            }
        }

        return result;
    }

    /**
     * @description: 清空打点图层
     * @param {HTMLCanvasElement} canvas
     * @return {void}
     */
    static clear(canvas) {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * @description: 绘制全盘打点数值（黑方蓝色在上，白方红色在下）
     * @param {HTMLCanvasElement} canvas
     * @param {Array<object | number[]>} cells
     * @param {object} layout 棋盘几何（stoneEnum / plantEnum / offset / spacing / size / w / h）
     * @return {{x: number, y: number, black: object | null, white: object | null}[]}
     */
    static draw(canvas, cells, layout) {
        if (!canvas) return [];

        const stone_enum = layout.stoneEnum;
        const plant_enum = layout.plantEnum;
        const size = Number(layout.size) || canvas.clientWidth || 1;

        const dpr = window.devicePixelRatio || 1;
        const pixel = Math.round(size * dpr);

        if (canvas.width !== pixel || canvas.height !== pixel) {
            canvas.width = pixel;
            canvas.height = pixel;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;
        }

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        const list = Threats.scan(cells, stone_enum, plant_enum, layout.w || 9, layout.h || 9);
        if (!list.length) return list;

        const spacing = Number(layout.spacing) || size / 9;
        const offset = Number(layout.offset) || 0;

        // 尽量小但可读：随棋盘间距缩放，并设置 9px 下限
        const font = Math.min(18, Math.max(9, Math.round(spacing * 0.19)));
        const line = font * 1.08;

        ctx.font = `700 ${font}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1.2, font * 0.16);

        const draw_text = (value, x, y, color) => {
            const text = String(value);
            const width = ctx.measureText(text).width;
            // 贴合棋盘左缘时自动内收，避免数字被裁切
            const px = Math.min(size - 1, Math.max(width + 1, x));

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.strokeText(text, px, y);

            ctx.fillStyle = color;
            ctx.fillText(text, px, y);
        };

        list.forEach((item) => {
            const px = offset + item.x * spacing;
            const py = offset + item.y * spacing;

            // 左下角：以点的右下方为锚点，文字向左上延伸
            const x = px - spacing * 0.44;
            const base = Math.min(size - 1, py + spacing * 0.44);
            const both = item.black && item.white;

            if (item.black) draw_text(item.black.MN, x, both ? base - line : base, '#2563eb');
            if (item.white) draw_text(item.white.MN, x, base, '#dc2626');
        });

        return list;
    }
}

export { Threats };
