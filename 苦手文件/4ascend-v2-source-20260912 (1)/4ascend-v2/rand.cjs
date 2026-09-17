/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 随机版本 (支持递归嵌套文件夹)
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = 'html';
const OUTPUT = 'root';

/**
 * @description 高性能 NanoID 简单实现 (Bun 版)
 * @param size ID 长度，默认 21
 * @param alphabet 自定义字符集，默认 URL 友好字符
 */
function generateNanoID(
    size = 21,
    alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQUHtgbfjkskvlziyw'
) {
    const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1;
    const step = Math.ceil((1.6 * mask * size) / alphabet.length);

    let id = '';
    while (true) {
        const bytes = crypto.getRandomValues(new Uint8Array(step));
        for (let i = 0; i < step; i++) {
            const byte = bytes[i] & mask;
            if (alphabet[byte]) {
                id += alphabet[byte];
                if (id.length === size) return id;
            }
        }
    }
}

/**
 * 递归获取目录下所有 HTML 文件的绝对/相对路径
 * @param {string} dirPath 目标目录
 * @param {string[]} fileList 累积的文件列表
 */
function getAllHtmlFiles(dirPath, fileList = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 如果是文件夹，递归调用
            getAllHtmlFiles(fullPath, fileList);
        } else if (file.endsWith('.html')) {
            // 如果是 html 文件，记录路径
            fileList.push(fullPath);
        }
    });

    return fileList;
}

// 获取 OUTPUT 目录下所有嵌套的 html 文件
const htmlFiles = getAllHtmlFiles(OUTPUT);
const cache = {};

// 遍历处理所有找到的 html 文件
htmlFiles.forEach((filePath) => {
    let text = fs.readFileSync(filePath).toString();

    const regex = /\/[\w\/\.-]+\.(?:js|css)\?v=replace/g;
    const matches = text.match(regex);
    if (!matches) return;

    matches.forEach((res) => {
        // 如果缓存里没有，生成一个新的版本号（同名资源在不同 html 中能保持一致）
        if (!cache[res]) {
            cache[res] = `${Date.now()}-${generateNanoID(11)}`;
        }
        text = text.replace(res, res.replace('?v=replace', `?v=${cache[res]}`));
    });

    // 写回原路径
    fs.writeFileSync(filePath, text);
    console.log(`已处理: ${filePath}`);
});