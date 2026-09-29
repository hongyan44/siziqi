/*
 * 解码用户上传的残局码文件，打印真实局面（display 坐标：x 左→右, y 下→上, 1-based）。
 * 运行： node tmp/decode-endgame.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../js/global');
const cache = new Map();
function load(file) {
    const abs = path.resolve(file);
    if (cache.has(abs)) return cache.get(abs).exports;
    const module = { exports: {} };
    cache.set(abs, module);
    const text = fs.readFileSync(abs, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', 'window', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(abs), p)) : require(p)),
        module, module.exports, global
    );
    return module.exports;
}

load(path.resolve(source, 'endgame.cjs'));
const { EndgameArchive } = global.EndgameExports;
const { STONE_NAMES } = { STONE_NAMES: ['none', 'black', 'white', 'black-ascend', 'white-ascend', 'black-used', 'white-used'] };

const file = process.argv[2] || path.resolve(__dirname, '../../../../江承泽/.trae-cn/attachments/6ab1eeeec218370356b0f991/70de3f29-ad0e-4fe4-9cc7-a2712d9f0651_c2f02f9b-1b40-4655-a882-9168356bc75a_残局码.txt');
const raw = fs.readFileSync(file, 'utf8').trim();

let data;
try {
    data = EndgameArchive.decode(raw);
} catch (err) {
    console.log('解码失败:', err.message);
    process.exit(1);
}

console.log('=== 解码结果 ===');
console.log('hp 黑/白 =', data.hp.black + '/' + data.hp.white);
console.log('先手 =', data.first, ' 当前行棋 =', data.snapshot.turnPlayer === 1 ? 'white' : 'black');
console.log('玩家 =', data.player, ' 模式 =', data.game_mode, ' 自然生长 =', data.natural_plant);
console.log('黑方正着(black_book) =', JSON.stringify(data.black_book));
console.log('白方预案(white_turns) =', JSON.stringify(data.white_turns));
console.log('turns =', JSON.stringify(data.snapshot.turns));
console.log('turnCount =', data.snapshot.turnCount, ' turnPos =', JSON.stringify(data.snapshot.turnPos));
console.log('growCount =', data.snapshot.growCount, ' unascendCharge =', data.snapshot.unascendCharge);
console.log('ascendStatus =', data.snapshot.ascendStatus, ' overStatus =', data.snapshot.overStatus);

// cells 索引 i → boardX = i%9, boardY = floor(i/9)；board y=0 为最上一行（渲染确认）
// display 坐标：dx = boardX+1, dy = 9-boardY
const b2d = (bx, by) => [bx + 1, 9 - by];
const toCode = (s) => ['none', 'black', 'white', 'black-ascend', 'white-ascend', 'black-used', 'white-used'].indexOf(s);

const grid = Array.from({ length: 9 }, () => new Array(9).fill('none'));
const black = [];
const white = [];
data.cells.forEach((cell, i) => {
    const bx = i % 9, by = Math.floor(i / 9);
    grid[by][bx] = cell.stone;
    if (cell.stone === 'black') black.push(b2d(bx, by));
    if (cell.stone === 'white') white.push(b2d(bx, by));
    if (cell.stone !== 'none' && cell.stone !== 'black' && cell.stone !== 'white') console.log(`  特殊棋子 ${cell.stone} @ display(${b2d(bx, by)})`);
});

console.log('\n=== 盘面（display 坐标：上=9行, 下=1行；x 1..9 左→右）===');
console.log('      1  2  3  4  5  6  7  8  9');
for (let dy = 9; dy >= 1; dy--) {
    const by = 9 - dy;
    let line = String(dy).padStart(3, ' ') + '   ';
    for (let bx = 0; bx < 9; bx++) {
        const s = grid[by][bx];
        line += (s === 'black' ? 'B' : s === 'white' ? 'W' : s === 'none' ? '.' : '*') + '  ';
    }
    console.log(line);
}
console.log('\n黑方棋子 display:', JSON.stringify(black.sort((a, b) => a[0] - b[0] || a[1] - b[1])));
console.log('白方棋子 display:', JSON.stringify(white.sort((a, b) => a[0] - b[0] || a[1] - b[1])));
