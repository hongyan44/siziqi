/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 真随机生成字节 (支持 CLI 输入)
 * @Copyright (c) 2026
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

(async () => {
    // 询问用户输入字节长度
    rl.question('请输入生成的字节长度: ', async (sizeInput) => {
        const size = parseInt(sizeInput, 10);
        if (isNaN(size) || size <= 0) {
            console.error('字节长度必须是正整数');
            rl.close();
            return;
        }

        // 询问用户输入保存路径
        // rl.question('请输入保存的文件路径: ', async (pathInput) => {
        //     try {
        //         const response = await fetch(
        //             `https://www.random.org/integers/?num=${size}&min=0&max=255&col=1&base=16&format=plain&rnd=new`
        //         );
        //         const rtext = await response.text();

        //         const hex = rtext.trim().split('\n');
        //         const network = new Uint8Array(hex.map((h) => parseInt(h, 16)));
        //         const local = crypto.randomBytes(size);

        //         const key = network.map((_, index) => network[index] ^ local[index]);

        //         fs.writeFileSync(pathInput, key);
        //         console.log(Array.from(key));
        //         console.log(`已生成 ${size} 字节并保存到 ${pathInput}`);
        //     } catch (err) {
        //         console.error('生成或保存失败:', err);
        //     } finally {
        //         rl.close();
        //     }
        // });

        // 询问用户输入保存名字
        rl.question('请输入保存的文件名字: ', async (pathInput) => {
            try {
                const response = await fetch(
                    `https://www.random.org/integers/?num=${size}&min=0&max=255&col=1&base=16&format=plain&rnd=new`
                );
                const rtext = await response.text();

                const hex = rtext.trim().split('\n');
                const network = new Uint8Array(hex.map((h) => parseInt(h, 16)));
                const local = crypto.randomBytes(size);

                const key = network.map((_, index) => network[index] ^ local[index]);

                pathInput = path.join('assets', 'resource', 'bin', pathInput);

                fs.writeFileSync(pathInput, key);
                console.log(Array.from(key));
                console.log(`已生成 ${size} 字节并保存到 ${pathInput}`);
            } catch (err) {
                console.error('生成或保存失败:', err);
            } finally {
                rl.close();
            }
        });
    });
})();
