/*
 * 回放残局 AI 验证用临时服务器：静态托管 root，并把 /test 重定向到带存档的回放页。
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', 'root');
const archive = require('./replay-plant-archive.json').archive;
const target = `/pages/local/replay.html?replayCode=${encodeURIComponent(archive)}`;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.onnx': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.json': 'application/json; charset=utf-8',
};

http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/test') {
        res.writeHead(302, { 'Location': target });
        res.end();
        return;
    }

    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    fs.readFile(file, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
            return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(8123, '127.0.0.1', () => console.log('listening 8123'));
