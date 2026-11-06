/*
 * @Description: 一次性重编译全部 HTML 并刷新版本号（等价于 watch.cjs 的 build_html）
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.chdir(path.join(__dirname, '..'));

const HTML_DIR = 'html';
const ROOT = 'root';

const pairs = [];
fs.readdirSync(HTML_DIR).forEach((name) => {
    const full = path.join(HTML_DIR, name);
    if (fs.statSync(full).isDirectory()) {
        fs.readdirSync(full).forEach((sub) => {
            if (sub.endsWith('.html')) pairs.push([path.join(full, sub), path.join(ROOT, 'pages', name, sub)]);
        });
        return;
    }
    if (name.endsWith('.html')) pairs.push([full, path.join(ROOT, name)]);
});

pairs.forEach(([input, output]) => {
    fs.mkdirSync(path.dirname(output), { 'recursive': true });
    const result = spawnSync('bunx', [
        'html-minifier-terser',
        '--remove-comments',
        '--collapse-whitespace',
        '--conservative-collapse',
        '--minify-css', 'true',
        '--minify-js', 'true',
        '-o', output,
        input,
    ], { 'stdio': 'inherit' });
    if (result.status !== 0) throw new Error(`编译失败：${input}`);
});

const rand = spawnSync('bun', ['rand.cjs'], { 'stdio': 'inherit' });
if (rand.status !== 0) throw new Error('rand.cjs 执行失败');

console.log(`html 编译完成：${pairs.length} 个`);
