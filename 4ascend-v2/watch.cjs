/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 监听并编译
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const child_process = require('node:child_process');


// 构建脚本可能从任意工作目录启动，所有源码路径统一锚定项目根目录。
process.chdir(__dirname);


const JS_DIR = 'js';
const HTML_DIR = 'html';
const CSS_DIR = 'css';


const ROOT = 'root';
const AUDIO_SOURCE = path.join('resource', 'audio');
const AUDIO_OUTPUT = path.join(ROOT, 'audio', 'game');
const WORKER_SOURCE = path.join('js', 'worker');
const WORKER_OUTPUT = path.join(ROOT, 'js', 'worker');
const WASM_AI_OUTPUT = path.join(ROOT, 'wasm', 'ai');
const WASM_AI_FILES = [
    [path.join('wasm', '4ascend-zero', 'build', 'wasm', 'wasm32', 'release', '4ascend-zero.js'), path.join(WASM_AI_OUTPUT, '4ascend-zero.js')],
    [path.join('wasm', '4ascend-hce', 'build', 'wasm', 'wasm32', 'release', '4ascend-hce.js'), path.join(WASM_AI_OUTPUT, '4ascend-hce.js')],
];


/**
 * @description: 同步人机 WASM 发布产物
 * @return {void}
 */
const sync_ai_wasm = () => {
    fs.mkdirSync(WASM_AI_OUTPUT, { 'recursive': true });
    WASM_AI_FILES.forEach(([input, output]) => {
        if (!fs.existsSync(input)) return;
        fs.copyFileSync(input, output);
    });
};

/**
 * @description 同步残局挑战依赖的静态资源到发布目录
 * @return {void}
 */
const sync_runtime_assets = () => {
    fs.mkdirSync(AUDIO_OUTPUT, { 'recursive': true });
    fs.readdirSync(AUDIO_SOURCE).forEach((name) => {
        const input = path.join(AUDIO_SOURCE, name);
        if (fs.statSync(input).isFile()) fs.copyFileSync(input, path.join(AUDIO_OUTPUT, name));
    });
    fs.mkdirSync(WORKER_OUTPUT, { 'recursive': true });
    fs.readdirSync(WORKER_SOURCE).forEach((name) => {
        const input = path.join(WORKER_SOURCE, name);
        if (fs.statSync(input).isFile()) fs.copyFileSync(input, path.join(WORKER_OUTPUT, name));
    });
};


/**
 * @description: 调用编译命令
 * @param {string} input
 * @param {string} output
 * @return {void}
 */
const run_esbuild = (input, output) => {
    child_process.spawnSync(
        'bunx',
        [
            'esbuild',
            input,
            '--bundle',
            '--minify',
            '--format=iife',
            '--target=es2015',
            '--charset=utf8',
            `--outfile=${output}`
        ],
        { 'stdio': 'inherit' }
    );
};

/**
 * @description: 调用编译命令
 * @param {string} input
 * @param {string} output
 * @return {Promise<void>}
 */
const run_html_minifier = (input, output) => {
    // child_process.spawn(
    //     'bunx',
    //     [
    //         'html-minifier-terser',
    //         '--remove-comments',
    //         '--collapse-whitespace',
    //         '--conservative-collapse',
    //         '--minify-css', 'true',
    //         '--minify-js', 'true',
    //         '-o', output,
    //         input
    //     ],
    //     { 'stdio': 'inherit' }
    // );

    return new Promise((resolve, reject) => {
        const process = child_process.spawn(
            'bunx',
            [
                'html-minifier-terser',
                '--remove-comments',
                '--collapse-whitespace',
                '--conservative-collapse',
                '--minify-css', 'true',
                '--minify-js', 'true',
                '-o', output,
                input
            ],
            { 'stdio': 'inherit' }
        );

        process.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`进程退出，退出码 ${code}`));
        });

        process.on('error', (err) => reject(err));
    });
};


/**
 * @description: 重编译整个JS
 * @return {void}
 */
const sync_ai_bundle_alias = () => {
    const input = path.join(ROOT, 'js', 'ai', 'build.min.js');
    const output = path.join(ROOT, 'js', 'ai.min.js');
    if (fs.existsSync(input)) fs.copyFileSync(input, output);
};

const build_js = () => {
    const input1 = JS_DIR;
    const output1 = path.join(ROOT, 'js');
    const list = fs.readdirSync(input1);

    // 不清空 root/js：WorkBuddy 的安全文件钩子可能拦截递归删除，且增量覆盖足够完成发布构建。
    fs.mkdirSync(output1, { 'recursive': true });

    list.forEach((name) => {
        const input2 = path.join(input1, name);
        const inputStat = fs.statSync(input2);
        if (!inputStat.isDirectory()) {
            if (!name.endsWith('.cjs')) return;
            const output = path.join(output1, `${path.parse(name).name}.min.js`);
            run_esbuild(input2, output);
            return;
        }

        const output2 = path.join(output1, name);
        fs.mkdirSync(output2, { 'recursive': true });
        fs.readdirSync(input2).forEach((childName) => {
            const input3 = path.join(input2, childName);
            const childStat = fs.statSync(input3);
            const input4 = childStat.isDirectory() ? path.join(input3, 'build.cjs') : input3;
            if (!fs.existsSync(input4) || !input4.endsWith('.cjs')) return;
            const output3 = path.join(output2, `${path.parse(childName).name}.min.js`);
            run_esbuild(input4, output3);
        });
    });
    sync_ai_bundle_alias();
};

// /**
//  * @description: 重新编译整个HTML
//  * @return {void}
//  */
// const build_html = async (pn) => {
//     const input1 = HTML_DIR;
//     const output1 = ROOT;
//     const list = fs.readdirSync(input1);

//     fs.readdirSync(output1).forEach((name) => {
//         if (pn && pn !== name) return;
//         name.endsWith('.html') && fs.rmSync(path.join(output1, name), { 'force': true, 'recursive': true })
//     });

//     for (const name of list) {
//         if (pn && name !== pn) continue;
//         const input2 = path.join(input1, name);
//         const output2 = path.join(output1, name);
//         await run_html_minifier(input2, output2);
//     }

//     child_process.spawn('bun', ['rand.cjs'], { 'stdio': 'inherit' });

//     console.log('html end');
// };


/**
 * @description: 重新编译整个HTML（支持一层嵌套文件夹）
 * @param {string} [pn] - 可选：指定编译的特定文件夹名或文件名
 * @return {void}
 */
const build_html = async (pn) => {
    const input1 = HTML_DIR;
    const output1 = ROOT;

    // 1. 动态判断并清理历史生成的 HTML 文件/文件夹
    // 如果存在 pages 目录，也需要纳入清理范围
    // 增量覆盖 HTML，避免递归删除触发安全文件钩子；源码中的同名文件会被完整替换。
    fs.mkdirSync(output1, { 'recursive': true });
    fs.mkdirSync(path.join(output1, 'pages'), { 'recursive': true });

    // 2. 读取源码目录
    const list = fs.readdirSync(input1);

    for (const name of list) {
        // 如果指定了 pn，且当前第一层目录/文件名不匹配，则跳过
        if (pn && name !== pn) continue;

        const fullPath = path.join(input1, name);
        const isDir = fs.statSync(fullPath).isDirectory();

        if (isDir) {
            // ================= 【有嵌套的情况】 =================
            // 读取子文件夹内的所有文件
            const subList = fs.readdirSync(fullPath);

            for (const subName of subList) {
                if (subName.endsWith('.html')) {
                    const input2 = path.join(fullPath, subName);
                    // 嵌套文件输出到 ROOT/pages/文件夹名/文件名.html
                    const output2 = path.join(output1, 'pages', name, subName);

                    // 确保输出的嵌套文件夹存在
                    fs.mkdirSync(path.dirname(output2), { recursive: true });
                    await run_html_minifier(input2, output2);
                }
            }
        } else {
            // ================= 【没有嵌套的情况】 =================
            if (name.endsWith('.html')) {
                const input2 = fullPath;
                // 直接放到根目录 ROOT/文件名.html
                const output2 = path.join(output1, name);

                await run_html_minifier(input2, output2);
            }
        }
    }

    // 3. 后续任务
    sync_ai_wasm();
    sync_runtime_assets();
    child_process.spawn('bun', ['rand.cjs'], { 'stdio': 'inherit' });

    console.log('html end');
};


/**
 * @description: 重新编译整个CSS
 * @return {void}
 */
const build_css = () => {
    const input1 = CSS_DIR;
    const output1 = path.join(ROOT, 'css');
    const list = fs.readdirSync(input1);

    fs.mkdirSync(output1, { 'recursive': true });
    list.forEach((name) => {
        const input2 = path.join(input1, name);
        const output2 = path.join(output1, `${path.parse(name).name}.min.css`);
        run_esbuild(input2, output2);
    });
};


build_html();
build_js();
build_css();
sync_ai_wasm();
sync_runtime_assets();


const chokidar = require('chokidar');

/**
 * 防抖函数：防止保存文件时多次触发编译
 */
const debounce = (fn, delay = 300) => {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

// 封装防抖后的编译任务
let htmln;
const debouncedBuildHTML = debounce(() => {
    console.log('[Watch] HTML changed, rebuilding...');
    build_html(htmln);

});

const debouncedBuildJS = debounce(() => {
    console.log('[Watch] JS changed, rebuilding...');
    build_js();
});

const debouncedBuildCSS = debounce(() => {
    console.log('[Watch] CSS changed, rebuilding...');
    build_css();
});

// 初始化监听器
const watcher = chokidar.watch([JS_DIR, HTML_DIR, CSS_DIR], {
    ignored: /(^|[\/\\])\../, // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true // 初始运行已手动执行过，此处设为 true
});

// 监听文件变化
watcher.on('all', (event, filePath) => {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const parts = relativePath.split('/');

    const rootDir = filePath.split(path.sep)[0];

    switch (rootDir) {
        case HTML_DIR:
            // htmln = path.basename(filePath);
            if (parts[1]) {
                htmln = parts[1];
                debouncedBuildHTML();
            }
            break;
        case JS_DIR:
            debouncedBuildJS();
            break;
        case CSS_DIR:
            debouncedBuildCSS();
            break;
    }
});

console.log(`Watching for changes in ${JS_DIR}, ${HTML_DIR}, ${CSS_DIR}...`);