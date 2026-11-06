/*
 * @Description: 一次性构建全部 JS（等价于 watch.cjs 的 build_js，但不启动监听）
 */
const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');

process.chdir(path.join(__dirname, '..'));

const JS_DIR = 'js';
const ROOT = 'root';

const run_esbuild = (input, output) => {
    const result = child_process.spawnSync('bunx', [
        'esbuild', input, '--bundle', '--minify', '--format=iife', '--target=es2015', '--charset=utf8', `--outfile=${output}`,
    ], { 'stdio': 'inherit' });
    if (result.status !== 0) throw new Error(`esbuild 失败：${input}`);
};

const build_js = () => {
    const output1 = path.join(ROOT, 'js');
    fs.mkdirSync(output1, { 'recursive': true });
    fs.readdirSync(JS_DIR).forEach((name) => {
        const input2 = path.join(JS_DIR, name);
        if (fs.statSync(input2).isDirectory()) {
            const output2 = path.join(output1, name);
            fs.mkdirSync(output2, { 'recursive': true });
            fs.readdirSync(input2).forEach((childName) => {
                const input3 = path.join(input2, childName);
                const input4 = fs.statSync(input3).isDirectory() ? path.join(input3, 'build.cjs') : input3;
                if (!fs.existsSync(input4) || !input4.endsWith('.cjs')) return;
                run_esbuild(input4, path.join(output2, `${path.parse(childName).name}.min.js`));
            });
            return;
        }
        if (!name.endsWith('.cjs')) return;
        run_esbuild(input2, path.join(output1, `${path.parse(name).name}.min.js`));
    });

    const alias_in = path.join(ROOT, 'js', 'ai', 'build.min.js');
    if (fs.existsSync(alias_in)) fs.copyFileSync(alias_in, path.join(ROOT, 'js', 'ai.min.js'));
};

build_js();
console.log('js 编译完成');
