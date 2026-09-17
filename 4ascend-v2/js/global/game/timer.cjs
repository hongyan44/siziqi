/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 高精度倒计时
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class Timer {
    /**
     * @description: 构建
     * @return {Timer}
     */
    constructor() {
        this.remaining_ms = 0;
        this.base_remaining_ms = 0;

        this.tick_handler = null;
        this.request_id = null;

        this.start_time = 0;
        this.is_active = false;
        this.last_second_mark = -1;
    };

    /**
     * @description: 重置倒计时
     * @param {number} seconds
     * @param {Function} callback
     * @return {void}
     */
    reset(seconds, callback) {
        this.stop();

        this.remaining_ms = seconds * 1000;
        this.base_remaining_ms = this.remaining_ms;

        this.tick_handler = callback;
        this.last_second_mark = -1;
    };

    /**
     * @description: 递归
     * @param {number} timestamp
     * @return {void}
     */
    _run_loop(timestamp) {
        if (!this.is_active) return;

        // timestamp 是由 rAF 提供的，与 performance.now() 同源
        const elapsed_since_start = timestamp - this.start_time;
        const current_remaining = Math.max(0, this.base_remaining_ms - elapsed_since_start);

        const display_seconds = Math.ceil(current_remaining / 1000);

        if (display_seconds !== this.last_second_mark) {
            if (this.tick_handler) this.tick_handler(display_seconds);
            this.last_second_mark = display_seconds;
        }

        if (current_remaining > 0) this.request_id = requestAnimationFrame((t) => this._run_loop(t));
        else {
            this.is_active = false;
            this.remaining_ms = 0;
            this.request_id = null;
        }
    };

    /**
     * @description: 开始/继续
     * @return {void}
     */
    start() {
        if (this.is_active || this.remaining_ms <= 0) return;

        this.is_active = true;
        this.base_remaining_ms = this.remaining_ms;

        if (this.request_id) cancelAnimationFrame(this.request_id);

        // 关键改进：记录 performance.now() 作为初始同步点
        this.start_time = performance.now();
        this.request_id = requestAnimationFrame((timestamp) => this._run_loop(timestamp));
    };

    /**
     * @description: 暂停
     * @return {void}
     */
    stop() {
        if (!this.is_active) return;

        this.is_active = false;
        if (this.request_id) {
            cancelAnimationFrame(this.request_id);
            this.request_id = null;
        }

        // 此时 performance.now() 与 start() 记录的 start_time 严格同源
        const elapsed = performance.now() - this.start_time;
        this.remaining_ms = Math.max(0, this.base_remaining_ms - elapsed);
    };
}


export { Timer };