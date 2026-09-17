const http = require('http');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 (可自行修改) =================
const HOST = '0.0.0.0';
const PORT = 9001;
const PUBLIC_DIR = path.join(__dirname, 'root');
const RESOURCE_DIR = path.join(__dirname, 'resource');
// ========================================================

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript', // onnxruntime 通过动态 import 加载该扩展名，MIME 必须为 JS
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm', // 新增 Wasm 支持
    '.onnx': 'application/octet-stream',
    '.opus': 'audio/ogg',
    '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
    // 1. 统一设置高防、支持 SharedArrayBuffer 及全开放 CORS 的响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 开启跨源隔离（激活 SharedArrayBuffer、Performance.now 精确度）
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 允许资源被跨源引用

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    const safeUrl = decodeURIComponent(req.url.split('?')[0]);
    const urlPath = path.posix.normalize(safeUrl.replaceAll('\\', '/'));
    const resourcePrefix = '/audio/';
    const baseDir = urlPath.startsWith(resourcePrefix) ? RESOURCE_DIR : PUBLIC_DIR;
    const relativePath = urlPath.startsWith(resourcePrefix) ? path.posix.join('audio', urlPath.slice(resourcePrefix.length)) : urlPath.slice(1);
    let filePath = path.resolve(baseDir, relativePath);
    const resolvedBase = path.resolve(baseDir);
    if (filePath !== resolvedBase && !filePath.startsWith(`${resolvedBase}${path.sep}`)) {
        res.statusCode = 400;
        return res.end('400 Bad Request');
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            return res.end('404 Not Found');
        }

        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const stream = fs.createReadStream(filePath);

        stream.on('open', () => {
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            stream.pipe(res);
        });

        stream.on('error', (streamErr) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`500 Internal Server Error: ${streamErr.message}`);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}/ (SharedArrayBuffer Enabled)`);
});