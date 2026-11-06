/*
 * @Description: 验证残局盘面身份哈希稳定且不同盘面不同身份
 */
const fs = require('node:fs');
const path = require('node:path');
const EndgameArchive = (() => {
    global.window = global.window || {};
    require(path.join(__dirname, 'endgame.bundle.cjs'));
    return global.window.EndgameExports.EndgameArchive;
})();

const identity = (data) => {
    const code = EndgameArchive.encode(data);
    let hash = 0;
    for (let index = 0; index < code.length; index += 1) hash = ((hash << 5) - hash + code.charCodeAt(index)) | 0;
    return `e${(hash >>> 0).toString(36)}`;
};

const indexOf = (x, y) => y * 9 + x;
const base = Array.from({ length: 81 }, () => ({ 'stone': 'none', 'plant': 0 }));
[[1, 1], [2, 2], [5, 4], [7, 6], [4, 7]].forEach(([x, y]) => { base[indexOf(x, y)].stone = 'black'; });
[[2, 1], [3, 3], [6, 5], [5, 7]].forEach(([x, y]) => { base[indexOf(x, y)].stone = 'white'; base[indexOf(x, y)].plant = 1; });
base[indexOf(4, 4)].plant = 2;
const daily = { 'cells': base, 'hp': { 'black': 6, 'white': 6 }, 'natural_plant': false, 'black_book': [[4, 4], [5, 5], [6, 4]], 'white_turns': [[4, 5], [5, 3], [6, 3]] };
const other = JSON.parse(JSON.stringify(daily));
other.hp.black = 5;
const other2 = JSON.parse(JSON.stringify(daily));
other2.cells[indexOf(0, 0)].stone = 'black';

const a = identity(daily);
const b = identity(daily);
assert = require('node:assert');
assert.strictEqual(a, b, '同一盘面身份必须稳定');
assert.notStrictEqual(a, identity(other), '不同血量应视为不同残局');
assert.notStrictEqual(a, identity(other2), '不同盘面应视为不同残局');
const roundtrip = EndgameArchive.decode(EndgameArchive.encode(daily));
assert.strictEqual(identity(roundtrip), a, '解码后再编码身份必须一致');
console.log('残局身份哈希校验通过', a, identity(other), identity(other2));
