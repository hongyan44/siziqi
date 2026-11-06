/*
 * @Description: 一次性按 watch.cjs 规则构建全部 HTML（构建后不进入监听）
 */
const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');

process.chdir(path.join(__dirname, '..'));

const HTML_DIR = 'html';
const ROOT = 'root';
const OUTPUT_TYPES = ['.html'];

const run_html_minifier = (input, output) => new Promise((resolve, reject) => {
    const process = child_process.spawn('bunx', [
        'html-minifier-terser',
        '--remove-comments',
        '--collapse-whitespace',
        '--conservative-collapse',
        '--minify-css', 'true',
        '--minify-js', 'true',
        '-o', output,
        input,
    ], { 'stdio': 'inherit' });

    process.on('close', (code) => code === 0 ? resolve() : reject(new Error(`退出码 ${code}: ${input}`)));
    process.on('error', reject);
});

const walk = (dir, list = []) => {
    fs.readdirSync(dir).forEach((name) => {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, list);
        else if (OUTPUT_TYPES.some((ext) => name.endsWith(ext))) list.push(full);
    });
    return list;
};

(async () => {
    const list = walk(HTML_DIR);
    for (const input of list) {
        const relative = path.relative(HTML_DIR, input);
        const parts = relative.split(path.sep);
        const output = parts.length === 1
            ? path.join(ROOT, parts[0])
            : path.join(ROOT, 'pages', ...parts);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        await run_html_minifier(input, output);
        console.log(`已构建: ${output}`);
    }

    child_process.spawnSync('bun', ['rand.cjs'], { 'stdio': 'inherit' });
    console.log('HTML 构建完成');
})();
