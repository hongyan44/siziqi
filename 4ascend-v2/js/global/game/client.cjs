/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 客户端（修复重连版）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const msgpack_lite = require('msgpack-lite');

const risk_encrypt = window.RiskExports.Api.encrypt;
const risk_decrypt = window.RiskExports.Api.decrypt;


class Client {
    constructor(address) {
        /** @type {string} */
        this.address = address;

        /** @type {boolean} */
        this.closed = false;
        /** @type {boolean} */
        this.connecting = false;

        /** @type {number} */
        this.exp = 0;
        /** @type {number} */
        this.timeout = 0;

        /** @type {Set<Function>} */
        this.waiters = new Set();
        /** @type {Map<number, Function[]>} */
        this.pids = new Map();

        /** @type {number[]} */
        this.pids_ = [];

        /** @type {string} */
        this.title = document.title;

        /** @type {WebSocket|null} */
        this.ws = null;
        /** @type {any} */
        this.reconnectTimer = null; // 新增：专门控制重连频次
    }

    /**
     * @description: 建立连接
     * @return {void}
     */
    connect() {
        if (this.closed) return;
        if (this.connecting) return;

        // 限制频繁调用 connect
        if (this.timeout > Date.now() - 3 * 1000) {
            this.queueReconnect(); // 如果被拦截，确保依然有排队重连
            return;
        }

        this.timeout = Date.now();
        this.connecting = true;
        document.title = '连接中';

        // 清理旧连接及事件，防止内存泄漏和多重回调
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            try { this.ws.close(); } catch (e) { }
        }

        // 通知现有的 waiters 连接失败/重置
        const current_waiters = Array.from(this.waiters);
        this.waiters.clear();
        current_waiters.forEach((resolve) => resolve({ 'type': 'error', 'data': null }));

        try {
            this.ws = new WebSocket(this.address);
        } catch (error) {
            console.error("WebSocket 创建失败:", error);
            this.connecting = false;
            this.queueReconnect();
            return;
        }

        this.ws.onopen = (_) => {
            this.exp = Date.now();
            this.connecting = false;
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

            // 发送 ping
            this.send(new Uint8Array([129, 162, 111, 112, 164, 112, 105, 110, 103]));
            this.notify('open', null);
            document.title = this.title;
        };

        this.ws.onmessage = async (event) => {
            try {
                let message = Array.from(new Uint8Array(await event.data.arrayBuffer()));
                message = msgpack_lite.decode(risk_decrypt(message));
                // console.log(message);
                this.notify('message', message);
            } catch (error) {
                console.error("解析消息失败:", error);
            }
        };

        this.ws.onerror = (_) => {
            // error 后会自动触发 close，这里只需打印或打标记
            this.connecting = false;
        };

        this.ws.onclose = (_) => {
            this.connecting = false;
            document.title = '断开连接';
            if (this.closed) return;
            this.queueReconnect(); // 触发排队重连
        };
    }

    /**
     * @description: 安全的排队重连机制，避免死循环卡死浏览器
     */
    queueReconnect() {
        if (this.closed || this.connecting) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        // 延迟 3 秒后尝试重连
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, 3000);
    }

    /**
     * @description: 监测连接（心跳保活）
     * @return {void}
     */
    async reconnect() {
        // 定时检查：10秒没收到任何消息则主动断开触发重连
        const pid = setInterval(() => {
            if (this.closed) return;

            // 如果连接中超时（比如握手卡住超过5秒）
            if (this.connecting && this.timeout < Date.now() - 5 * 1000) {
                this.connecting = false;
            }

            // 10秒没收到任何消息，认为连接已死，主动 close 触发 onclose 重连
            if (this.ws && this.ws.readyState === WebSocket.OPEN && this.exp < Date.now() - 10 * 1000) {
                console.warn("心跳超时，主动断开重连...");
                this.ws.close();
            }
        }, 1000);
        this.pids_.push(pid);

        // 消费消息队列以更新心跳时间
        for await (const event of this) {
            if (this.closed) break;
            if (event.type !== 'message') continue;
            this.exp = Date.now(); // 收到任何有效消息，刷新活度时间
        }
    }

    /**
     * @description: 彻底关闭连接
     * @return {void}
     */
    close() {
        this.closed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        this.pids_.forEach((pid) => clearInterval(pid));
        this.pids_ = [];

        for (const [id, pids] of this.pids.entries()) {
            if (Array.isArray(pids)) pids.forEach((pid) => clearInterval(pid));
        }
        this.pids.clear();

        this.notify('$', '$');

        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.close();
        }
    }

    /**
     * @description: 发送
     */
    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        try {
            message = Array.from(message);
            this.ws.send(new Uint8Array(risk_encrypt(message)));
        } catch (error) {
            console.error("发送失败:", error);
        }
    }

    /**
     * @description: 分发响应
     */
    notify(type, data) {
        const current_waiters = Array.from(this.waiters);
        this.waiters.clear();
        current_waiters.forEach((resolve) => resolve({ type, data }));
    }

    /**
     * @description: 开始重复发送
     */
    start_resend(message, duration, id) {
        let pids = this.pids.get(id);
        if (!(pids instanceof Array)) {
            pids = [];
            this.pids.set(id, pids);
        }

        this.send(message);
        const pid = setInterval(() => this.send(message), duration);
        pids.push(pid);
    }

    /**
     * @description: 终止重复发送
     */
    stop_resend(id) {
        const pids = this.pids.get(id);
        if (!pids) return;

        this.pids.delete(id);
        pids.forEach((pid) => clearInterval(pid));
    }

    /**
     * @description: 生成器
     */
    async *[Symbol.asyncIterator]() {
        while (!this.closed) {
            yield await new Promise((resolve) => this.waiters.add(resolve));
        }
    }
}


export { Client };