/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 一次性发布辅助脚本：在所有已激活 http.min.js 的页面后接入好友心跳脚本。
 *   - 仅在「未被注释」的 <script src='/js/ref/http.min.js'> 行后插入 friends.min.js
 *   - 已含 friends.min.js 的页面跳过（幂等）
 *   - 保留原缩进
 * 运行：node tmp/apply-friend-heartbeat.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html_dir = path.join(root, 'html');
const TAG = '/js/ref/friends.min.js?v=replace';
const HTTP_RE = /^(\s*)<script[^>]*src=['"]\/js\/ref\/http\.min\.js[^'"]*['"][^>]*>\s*<\/script>\s*$/;

const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.html')) out.push(full);
    }
    return out;
};

let changed = 0;
let skipped = 0;
for (const file of walk(html_dir)) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    if (lines.some((line) => line.includes(TAG))) { skipped += 1; continue; }

    const index = lines.findIndex((line) => HTTP_RE.test(line));
    if (index === -1) { skipped += 1; continue; }

    const indent = lines[index].match(HTTP_RE)[1];
    lines.splice(index + 1, 0, `${indent}<script src='${TAG}'></script>`);
    fs.writeFileSync(file, lines.join('\n'));
    changed += 1;
    console.log(`接入: ${path.relative(root, file)}`);
}

console.log(`\n完成：修改 ${changed} 个页面，跳过 ${skipped} 个`);