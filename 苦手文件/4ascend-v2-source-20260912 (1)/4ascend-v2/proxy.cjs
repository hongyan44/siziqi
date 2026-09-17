/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 支持 WebSocket 转发的 Bun 反向代理服务器 (已修正异步绑定与全局变量问题)
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const Bun = require("bun");

// 目标 API 的基础路径
const TARGET_URL = "http://127.0.0.1:8080";
// 目标 WebSocket 的基础路径
const TARGET_WS_URL = "ws://127.0.0.1:8080";

// 代理服务器监听的端口
const PORT = 50001;

console.log(`🚀 反向代理服务器正在启动...`);
console.log(`监听本地端口: http://192.168.1.151:${PORT}`);
console.log(`代理目标地址: ${TARGET_URL}\n`);

const server = Bun.serve({
    hostname: '0.0.0.0',
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url);

        // 检测是否为 WebSocket 升级请求
        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            console.log(`🔌 检测到 WebSocket 连接请求: ${url.pathname}`);

            // 拼接目标 WebSocket 的完整地址
            const targetWsPath = `${TARGET_WS_URL}${url.pathname}${url.search}`;

            // 获取客户端带过来的子协议 (如果有)
            const protocol = req.headers.get("sec-websocket-protocol") || undefined;

            try {
                // 使用 globalThis.WebSocket 确保在 Bun 环境下的兼容性
                // 如果有子协议，透传给后端
                const targetWs = protocol 
                    ? new globalThis.WebSocket(targetWsPath, protocol)
                    : new globalThis.WebSocket(targetWsPath);

                // 核心修正：在传递前就绑上基础错误监听，防止未进入 open 钩子前崩溃
                targetWs.onerror = (err) => {
                    console.error(`❌ 目标后端 WS 在连接阶段发生错误`);
                };

                // 将后端 WS 实例作为 context 传给 upgrade 方法
                const upgraded = server.upgrade(req, {
                    data: {
                        targetWs: targetWs,
                        pendingMessages: [] 
                    }
                });

                if (upgraded) {
                    return undefined;
                }
                
                // 如果升级失败，确保关闭后端连接
                targetWs.close();
                return new Response("WebSocket upgrade failed", { status: 400 });
            } catch (err) {
                console.error("❌ 连接目标 WS 后端失败:", err);
                return new Response("Bad Gateway", { status: 502 });
            }
        }

        // ==================== 以下为普通 HTTP 转发逻辑 ====================
        const targetPath = `${TARGET_URL}${url.pathname}${url.search}`;

        const corsHeaders = {
            "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": req.headers.get("Access-Control-Request-Headers") || "*",
            "Access-Control-Allow-Credentials": "true",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        try {
            const headers = new Headers(req.headers);
            headers.set("host", new URL(TARGET_URL).host);

            const fetchOptions = {
                method: req.method,
                headers: headers,
            };

            if (req.method !== "GET" && req.method !== "HEAD") {
                fetchOptions.body = await req.blob();
            }

            console.log(`[${req.method}] 正在转发: ${url.pathname} -> ${targetPath}`);

            const response = await fetch(targetPath, fetchOptions);

            const newHeaders = new Headers(response.headers);
            Object.keys(corsHeaders).forEach(key => {
                newHeaders.set(key, corsHeaders[key]);
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });

        } catch (error) {
            console.error(`❌ 转发请求失败:`, error);
            return new Response(JSON.stringify({ error: "Proxy Error", message: error.message }), {
                status: 502,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                },
            });
        }
    },

    // ==================== WebSocket 事件处理 ====================
    websocket: {
        open(ws) {
            console.log(`✅ 客户端已连接到代理服务器`);
            const targetWs = ws.data.targetWs;

            // 检查此时后端是否其实已经 OPEN 了（解决异步时序快慢问题）
            if (targetWs.readyState === globalThis.WebSocket.OPEN) {
                console.log(`🔗 目标后端 WS 已经是连接状态，直接清空缓存`);
                flushPendingMessages(ws);
            } else {
                targetWs.onopen = () => {
                    console.log(`🔗 代理服务器成功连接到目标后端 WS`);
                    flushPendingMessages(ws);
                };
            }

            // 持续监听后端发送过来的消息，转发给客户端
            targetWs.onmessage = (event) => {
                // Bun 的 ws.send 支持 string, ArrayBuffer 等
                ws.send(event.data);
            };

            // 监听后端关闭
            targetWs.onclose = (event) => {
                console.log(`📴 目标后端 WS 已断开: ${event.reason || '无原因'}`);
                try {
                    ws.close(event.code, event.reason);
                } catch (e) {}
            };

            // 覆写错误监听
            targetWs.onerror = (err) => {
                console.error(`❌ 目标后端 WS 运行中发生错误`);
            };
        },

        message(ws, message) {
            const targetWs = ws.data.targetWs;
            // 状态判断使用标准的全局枚举
            if (targetWs.readyState === globalThis.WebSocket.OPEN) {
                targetWs.send(message);
            } else if (targetWs.readyState === globalThis.WebSocket.CONNECTING) {
                ws.data.pendingMessages.push(message);
            }
        },

        close(ws, code, reason) {
            console.log(`🚪 客户端与代理服务器断开连接`);
            const targetWs = ws.data.targetWs;
            if (targetWs && targetWs.readyState === globalThis.WebSocket.OPEN) {
                targetWs.close(code, reason);
            }
        }
    }
});

// 抽离的清空缓存消息工具函数
function flushPendingMessages(ws) {
    const targetWs = ws.data.targetWs;
    if (ws.data.pendingMessages && ws.data.pendingMessages.length > 0) {
        console.log(`📦 正在转发缓存的 ${ws.data.pendingMessages.length} 条消息到后端...`);
        ws.data.pendingMessages.forEach(msg => targetWs.send(msg));
        ws.data.pendingMessages = [];
    }
}