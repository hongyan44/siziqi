/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
// const crypto = require('node:crypto');

const BaseZalgo = require('../js/global/utils/basezalgo.cjs').BaseZalgo;

const ArchiveOld = require('./archive_old_v2.cjs').Archive;
const ArchiveNew = require('../js/global/fascend/archive.cjs').ArchiveV0;


async function copy(text) {
    const { $ } = require('bun');

    try {
        if (process.platform === 'darwin') {
            // macOS: 天然支持 UTF-8
            await $`echo -n ${text} | pbcopy`;

        } else if (process.platform === 'win32') {
            // Windows: 
            // 1. 使用 chcp 65001 强制当前终端使用 UTF-8 编码
            // 2. 使用 set /p 替代 echo，完美移除 Windows 下的末尾换行符
            await $`powershell -Command "Set-Clipboard -Value '${text}'"`;

        } else {
            // Linux:
            // 1. 显式指定 LANG=en_US.UTF-8 确保 xclip 用 UTF-8 接收
            // 2. 建议同时支持 xsel 和 xclip，增加兼容性
            try {
                await $`echo -n ${text} | LANG=en_US.UTF-8 xclip -selection clipboard`;
            } catch {
                // 如果没有 xclip，尝试使用 xsel
                await $`echo -n ${text} | LANG=en_US.UTF-8 xsel --clipboard --input`;
            }
        }
        // console.log('复制成功！');
    } catch (err) {
        // console.error('复制失败:', err);
    }
}

// async function copy(text) {
//     // 1. 现代浏览器方案 (异步 Clipboard API)
//     if (navigator.clipboard && window.isSecureContext) {
//         try {
//             await navigator.clipboard.writeText(text);
//             console.log('复制成功 (Clipboard API)');
//             return true;
//         } catch (err) {
//             console.error('Clipboard API 失败，尝试降级方案:', err);
//             return fallbackCopyText(text);
//         }
//     } else {
//         // 2. 旧版本浏览器方案 (同步 execCommand 方案)
//         return Promise.resolve(fallbackCopyText(text));
//     }
// }

// // 旧版本浏览器的降级兜底实现
// function fallbackCopyText(text) {
//     // 创建一个隐藏的 textarea 元素
//     const textArea = document.createElement("textarea");
//     textArea.value = text;

//     // 避免滚动条闪烁，将其固定在屏幕外
//     textArea.style.position = "fixed";
//     textArea.style.top = "-9999px";
//     textArea.style.left = "-9999px";
//     document.body.appendChild(textArea);

//     // 选中文本
//     textArea.focus();
//     textArea.select();

//     let success = false;
//     try {
//         // 执行浏览器复制命令（兼容旧版的核心）
//         success = document.execCommand('copy');
//         if (success) {
//             console.log('复制成功 (execCommand 降级方案)');
//         } else {
//             console.error('execCommand 复制失败');
//         }
//     } catch (err) {
//         console.error('无法执行复制命令:', err);
//     }

//     // 移除临时元素
//     document.body.removeChild(textArea);
//     return success;
// }


const text = '|̘̹̱̤̈̓̿̂|̛̫̪̽̒̾̄́|̣̪̪̬̙̌̑̾|̰̰̝̗̮̻̐̾|̵̛̝̱̼̹̂̄|̶̵̯̰̻̩̏̽|̡̛̬̲̀̽̂̓|̨̹̳̰̖̐̿̈|̨̛̭̜̯̳̯̑|̴̶̡̱̩̘̔̽|̶̳̣̪̍̎̃̕|̥̬̠̋';
const bytes = BaseZalgo.decode(text);
const data = ArchiveOld.load(bytes);

console.log(bytes, bytes.length);
console.log();
console.log(data);
console.log();


const new_data = ArchiveNew.save(
    [data.seed_aic, data.seed_unity, crypto.getRandomValues(new Uint32Array(1))[0]], // 随机生成其他种子用于补齐
    [300, 300],
    [6, 6],
    data.turns,
    data.turns.length,
    ArchiveOld.player2bit(data.player),
    0
);

console.log(new_data, new_data.length);
console.log();
console.log(ArchiveNew.load(new_data));
console.log();
console.log(BaseZalgo.encode(new_data));

// await copy(BaseZalgo.encode(new_data));
copy(text);