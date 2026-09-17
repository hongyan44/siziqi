const http = require("http");
const fs = require("fs");
const path = require("path");
const HOST = "0.0.0.0";
const PORT = 9001;
const PUBLIC_DIR = path.join(__dirname, "root");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  // 新增 Wasm 支持
  ".onnx": "application/octet-stream",
  ".opus": "audio/ogg",
  ".mp3": "audio/mpeg"
};
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  let safeUrl = req.url.split("?")[0];
  let filePath = path.join(PUBLIC_DIR, safeUrl);
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      return res.end("404 Not Found");
    }
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const stream = fs.createReadStream(filePath);
    stream.on("open", () => {
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      stream.pipe(res);
    });
    stream.on("error", (streamErr) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end(`500 Internal Server Error: ${streamErr.message}`);
    });
  });
});
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/ (SharedArrayBuffer Enabled)`);
});
