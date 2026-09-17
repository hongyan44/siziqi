/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 绘制
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class Canvas {
    /**
     * @description: 游戏绘制
     * @param {HTMLCanvasElement} canvas_board
     * @param {HTMLCanvasElement} canvas_stone
     * @param {HTMLCanvasElement} canvas_view
     * @param {HTMLCanvasElement} canvas_plant
     * @param {HTMLCanvasElement} canvas_ascend
     * 
     * @param {number} w
     * @param {number} h
     * 
     * @param {number} stone_radius
     * @param {number} plant_radius
     * 
     * @param {number} pad
     * @param {number} size
     * @return {Canvas}
     */
    constructor(
        canvas_board,
        canvas_stone,
        canvas_view,
        canvas_plant,
        canvas_turn,
        canvas_ascend,

        w, h,

        stone_radius,
        plant_radius,

        pad,
        size
    ) {
        this.canvas_board = canvas_board;
        this.canvas_stone = canvas_stone;
        this.canvas_view = canvas_view;
        this.canvas_plant = canvas_plant;
        this.canvas_turn = canvas_turn;
        this.canvas_ascend = canvas_ascend;

        this.w = w;
        this.h = h;

        this.stone_radius = stone_radius;
        this.plant_radius = plant_radius;

        this.pad = pad;
        this.size = size;

        this.dpr = window.devicePixelRatio | 1;

        this.waiters_click = new Set();
        this.waiters_move = new Set();

        this.handler_click_ = this.handler_click.bind(this);
        this.handler_move_ = this.handler_move.bind(this);
    };

    /**
     * @description: 初始化
     * @return {void}
     */
    init() {
        const size = this.size;


        // 设置尺寸
        this.canvas_board.width = size;
        this.canvas_board.height = size;

        this.canvas_stone.width = size;
        this.canvas_stone.height = size;

        this.canvas_plant.width = size;
        this.canvas_plant.height = size;

        this.canvas_turn.width = size;
        this.canvas_turn.height = size;

        this.canvas_view.width = size;
        this.canvas_view.height = size;

        this.canvas_ascend.width = size;
        this.canvas_ascend.height = size;


        // 清晰度提升
        const dpr = this.dpr;

        this.canvas_board.width = size * dpr;
        this.canvas_board.height = size * dpr;
        this.canvas_board.style.width = size + 'px';
        this.canvas_board.style.height = size + 'px';
        this.canvas_board.getContext('2d').scale(dpr, dpr);

        this.canvas_stone.width = size * dpr;
        this.canvas_stone.height = size * dpr;
        this.canvas_stone.style.width = size + 'px';
        this.canvas_stone.style.height = size + 'px';
        this.canvas_stone.getContext('2d').scale(dpr, dpr);

        this.canvas_plant.width = size * dpr;
        this.canvas_plant.height = size * dpr;
        this.canvas_plant.style.width = size + 'px';
        this.canvas_plant.style.height = size + 'px';
        this.canvas_plant.getContext('2d').scale(dpr, dpr);

        this.canvas_turn.width = size * dpr;
        this.canvas_turn.height = size * dpr;
        this.canvas_turn.style.width = size + 'px';
        this.canvas_turn.style.height = size + 'px';
        this.canvas_turn.getContext('2d').scale(dpr, dpr);

        this.canvas_view.width = size * dpr;
        this.canvas_view.height = size * dpr;
        this.canvas_view.style.width = size + 'px';
        this.canvas_view.style.height = size + 'px';
        this.canvas_view.getContext('2d').scale(dpr, dpr);

        this.canvas_ascend.width = size * dpr;
        this.canvas_ascend.height = size * dpr;
        this.canvas_ascend.style.width = size + 'px';
        this.canvas_ascend.style.height = size + 'px';
        this.canvas_ascend.getContext('2d').scale(dpr, dpr);


        this.rect = this.canvas_board.getBoundingClientRect();
    };


    /**
     * @description: 绘制棋盘
     * @return {void}
     */
    draw_board() {
        const ctx = this.canvas_board.getContext('2d');


        // 清空背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.size, this.size);

        // 绘制最外层粗描边
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, this.size, this.size);


        // 计算内部棋盘逻辑
        // 为了给棋子留空，我们需要从总宽度中减去两边的“安全区”
        // 安全区大小至少要等于棋子的实际像素半径
        const cell_w = this.w - 1;
        const cell_h = this.h - 1;

        // 填充，约 0.4 棋子 为 0.062填充
        const padding = this.size * this.pad;
        const draw_size = this.size - (padding * 2);

        // 计算网格间距
        const spacing_w = draw_size / cell_w;
        const spacing_h = draw_size / cell_h;


        // 绘制内部封闭网格线
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;


        ctx.beginPath();

        // 绘制所有横线与纵线
        for (let i = 0; i < this.w; i++) {
            const x = padding + i * spacing_w;
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + draw_size);
        }

        for (let j = 0; j < this.h; j++) {
            const y = padding + j * spacing_h;
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + draw_size, y);
        }

        ctx.stroke();
        ctx.closePath();


        // 储存计算数值
        this.spacing = spacing_w;
        this.offset = padding;
    };

    /**
     * @description: 绘制常态棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_stone(gx, gy, color) {
        const ctx = this.canvas_stone.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2c3e50';
        // ctx.fillStyle = '#ecf0f1';
        ctx.fill();

        // 绘制细描边
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1; // 细线
        ctx.stroke();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制虚拟棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_pstone(gx, gy, color) {
        const ctx = this.canvas_ascend.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        // ctx.fillStyle = '#2c3e50';
        // ctx.fillStyle = '#ecf0f1';
        ctx.fill();

        // 绘制细描边
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1; // 细线
        ctx.stroke();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制预览棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_view(gx, gy, color) {
        const ctx = this.canvas_view.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius + this.spacing * this.stone_radius * 0.1;

        ctx.save(); // 保存当前画布状态
        ctx.beginPath();

        // 设置虚线样式：[实线长度, 间隙长度]
        // 这里设置为 [5, 5]，你可以根据视觉效果微调
        ctx.setLineDash([5, 5]);

        // 绘制圆弧
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // 设置描边属性
        ctx.strokeStyle = color; // 使用传入的颜色
        ctx.lineWidth = 2;       // 虚线建议稍微粗一点（比如2），否则看不清

        // 仅描边，不填充 (no ctx.fill)
        ctx.stroke();

        ctx.closePath();
        ctx.restore(); // 恢复状态，避免 setLineDash 影响后续其他绘制
    };

    /**
     * @description: 绘制上一步棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @param {number} line
     * @return {void}
     */
    draw_turn(gx, gy, color, line) {
        const ctx = this.canvas_turn.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius + this.spacing * this.stone_radius * 0.1;

        ctx.save(); // 保存当前画布状态
        ctx.beginPath();

        // 设置虚线样式：[实线长度, 间隙长度]
        // 这里设置为 [5, 5]，你可以根据视觉效果微调
        ctx.setLineDash([5, 5]);

        // 绘制圆弧
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        // 设置描边属性
        ctx.strokeStyle = color; // 使用传入的颜色
        ctx.lineWidth = line;       // 虚线建议稍微粗一点（比如2），否则看不清

        // 仅描边，不填充 (no ctx.fill)
        ctx.stroke();

        ctx.closePath();
        ctx.restore(); // 恢复状态，避免 setLineDash 影响后续其他绘制
    };

    /**
     * @description: 绘制动态棋子
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_vstone(gx, gy, color) {
        const ctx = this.canvas_stone.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.stone_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        // ctx.shadowColor = p.color === 'black' ? '#e74c3c' : '#3498db';
        ctx.shadowBlur = 9;
        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制植物
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_plant(gx, gy, color = '#2ecc71') {
        const ctx = this.canvas_plant.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.plant_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };

    /**
     * @description: 绘制双植物
     * @param {number} gx
     * @param {number} gy
     * @param {string} color
     * @return {void}
     */
    draw_2plant(gx, gy, color = '#2ecc71') {
        const ctx = this.canvas_plant.getContext('2d');

        // 根据逻辑坐标计算画布上的像素位置
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 设定棋子半径
        const radius = this.spacing * this.plant_radius;


        ctx.beginPath();
        ctx.save();

        ctx.arc(x - radius * 1.3, y, radius, 0, Math.PI * 2);

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        ctx.fill();

        ctx.closePath();


        ctx.beginPath();

        ctx.arc(x + radius * 1.3, y, radius, 0, Math.PI * 2); // 圆

        // 填充颜色
        ctx.fillStyle = color;
        // ctx.fillStyle = '#2ecc71'; // 实体鲜亮绿色
        ctx.shadowBlur = 2;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        ctx.fill();

        ctx.closePath();
        ctx.restore();
    };


    /**
     * @description: 擦除棋子
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_stone(gx, gy) {
        const ctx = this.canvas_stone.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius + this.spacing * (this.stone_radius * 0.3);

        ctx.clearRect(
            x - clear,
            y - clear,
            clear * 2,
            clear * 2
        );
    };

    /**
     * @description: 擦除预览
     * @return {void}
     */
    clear_view() {
        const ctx = this.canvas_view.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除棋盘
     * @return {void}
     */
    clear_board() {
        const ctx = this.canvas_board.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除上一步
     * @return {void}
     */
    clear_turn() {
        const ctx = this.canvas_turn.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除虚拟棋子
     * @return {void}
     */
    clear_ascend() {
        const ctx = this.canvas_ascend.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
    };

    /**
     * @description: 擦除植物
     * @param {number} gx
     * @param {number} gy
     * @return {void}
     */
    clear_plant(gx, gy) {
        const ctx = this.canvas_plant.getContext('2d');

        // 计算棋子中心点
        const x = this.offset + gx * this.spacing;
        const y = this.offset + gy * this.spacing;

        // 计算擦除区域的大小
        // 这里稍微比棋子半径多加 2 像素，确保描边也能被擦干净
        const clear = this.spacing * this.stone_radius;

        ctx.clearRect(
            x - clear,
            y - clear,
            clear * 2,
            clear * 2
        );
    };



    /**
     * @description: 点击坐标转换为点位
     * @param {number} cx
     * @param {number} cy
     * @return {[number, number] | null}
     */
    cxcy2grid(cx, cy) {
        const ox = this.offset;
        // 建议：spW 和 spH 最好在初始化棋盘时计算好，不要每次点击都算
        const spW = this.spacing;
        const spH = this.spacing; // 通常棋盘格子是正方形

        // 1. 减去边距，得到相对于第一个交叉点 (0,0) 的偏移
        const dx = cx - ox;
        const dy = cy - ox;

        // 2. 计算浮点索引
        const floatX = dx / spW;
        const floatY = dy / spH;

        // 3. 四舍五入到最近的交叉点
        const gridX = Math.round(floatX);
        const gridY = Math.round(floatY);

        // 4. 边界过滤
        if (gridX >= 0 && gridX < this.w && gridY >= 0 && gridY < this.h) {
            // 5. 校验点击是否在“感应圆”内
            const centerX = gridX * spW;
            const centerY = gridY * spH;

            // 计算点击点到交叉点的欧氏距离
            const distSq = Math.pow(dx - centerX, 2) + Math.pow(dy - centerY, 2);
            const radius = spW * this.stone_radius;

            if (distSq < radius * radius) return [gridX, gridY];
        }

        return null;
    };


    /**
     * @description: 点击
     * @param {PointerEvent} event
     * @return {void}
     */
    handler_click(event) {
        this.rect = this.canvas_board.getBoundingClientRect(); // ？

        const rect = this.rect;
        const size = this.size;

        const cssx = event.clientX - rect.left;
        const cssy = event.clientY - rect.top;

        const scalex = size / rect.width;
        const scaley = size / rect.height;

        const drawx = cssx * scalex;
        const drawy = cssy * scaley;

        this.notify_click(this.cxcy2grid(drawx, drawy));
    };

    /**
     * @description: 移动
     * @param {PointerEvent} event
     * @return {void}
     */
    handler_move(event) {
        if (this.moveing) return;

        this.moveing = true;
        requestAnimationFrame(() => {
            const rect = this.rect;
            const size = this.size;

            const cssx = event.clientX - rect.left;
            const cssy = event.clientY - rect.top;

            const scalex = size / rect.width;
            const scaley = size / rect.height;

            const drawx = cssx * scalex;
            const drawy = cssy * scaley;

            this.notify_move(this.cxcy2grid(drawx, drawy));
            this.moveing = false;
        });
    };


    /**
     * @description: 开始监听点击与移动
     * @return {void}
     */
    start_click2move() {
        this.canvas_board.addEventListener('pointerdown', this.handler_click_);
        this.canvas_board.addEventListener('pointermove', this.handler_move_);
    };

    /**
     * @description: 停止监听点击与移动
     * @return {void}
     */
    stop_click2move() {
        this.canvas_board.removeEventListener('pointerdown', this.handler_click_);
        this.canvas_board.removeEventListener('pointermove', this.handler_move_);

        // this.notify_click('end');
        this.notify_move('end');

        this.moveing = false;
    };


    /**
     * @description: 分发响应
     * @param {[number, number, boolean] | void} pos
     * @return {void}
     */
    notify_click(pos) {
        const current_waiters = Array.from(this.waiters_click);
        this.waiters_click.clear();
        current_waiters.forEach((resolve) => resolve(pos));
    };

    /**
     * @description: 分发响应
     * @param {[number, number] | void} pos
     * @return {void}
     */
    notify_move(pos) {
        const current_waiters = Array.from(this.waiters_move);
        this.waiters_move.clear();
        current_waiters.forEach((resolve) => resolve(pos));
    };


    /**
     * @description: 生成器 点击
     * @return {Promise<void>}
     */
    async *iterator_click() {
        while (true) yield await new Promise((resolve) => this.waiters_click.add(resolve));
    };

    /**
     * @description: 生成器 移动
     * @return {Promise<void>}
     */
    async *iterator_move() {
        while (true) yield await new Promise((resolve) => this.waiters_move.add(resolve));
    };
}


window.cs_isphone = (() => {
    // 只要设备支持粗略指针（手指），就认为是移动类设备
    const hasCoarseCapability = window.matchMedia('(any-pointer: coarse)').matches;

    // 排除掉纯鼠标操作的设备
    const canTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    return hasCoarseCapability && canTouch;
})();


export { Canvas };