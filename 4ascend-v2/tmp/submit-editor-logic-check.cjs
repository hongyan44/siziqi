/*
 * Quick validation for endgame editor behavior:
 * - stone color swap keeps plant counts
 * - empty blackBook/whiteTurns can encode/decode
 * - mismatched book lengths still reject
 */
const path = require('path');
const Module = require('module');
const fs = require('fs');
const vm = require('vm');

const endgamePath = path.join(__dirname, '..', 'js', 'global', 'endgame.cjs');
const source = fs.readFileSync(endgamePath, 'utf8');
const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    require: Module.createRequire(endgamePath),
    __dirname: path.dirname(endgamePath),
    __filename: endgamePath,
    Uint8Array,
    Array,
    Number,
    Math,
    Boolean,
    String,
    Map,
    Set,
    Object,
    TypeError,
    RangeError,
    Error,
    Buffer,
};
sandbox.window = {};
vm.runInNewContext(source, sandbox, { filename: endgamePath });
const { EndgameArchive } = sandbox.window.EndgameExports;

const boardSize = 9;
const cells = Array.from({ length: boardSize * boardSize }, () => ({ stone: 'none', plant: 0 }));
cells[4 * boardSize + 4] = { stone: 'black', plant: 1 };
cells[5 * boardSize + 4] = { stone: 'white', plant: 2 };
cells[3 * boardSize + 3] = { stone: 'none', plant: 1 };

const swapStoneColor = (stone) => {
    if (stone === 'black') return 'white';
    if (stone === 'white') return 'black';
    if (stone === 'black-ascend') return 'white-ascend';
    if (stone === 'white-ascend') return 'black-ascend';
    if (stone === 'black-used') return 'white-used';
    if (stone === 'white-used') return 'black-used';
    return stone;
};

const beforePlants = cells.map((cell) => cell.plant);
cells.forEach((item) => { item.stone = swapStoneColor(item.stone); });
if (cells[4 * boardSize + 4].stone !== 'white') throw new Error('black not swapped');
if (cells[5 * boardSize + 4].stone !== 'black') throw new Error('white not swapped');
if (cells.some((cell, index) => cell.plant !== beforePlants[index])) throw new Error('plants changed');

const emptyExport = {
    cells,
    player: 'black',
    first: 'black',
    natural_plant: false,
    hp: { black: 8, white: 3 },
    blackBook: [],
    whiteTurns: [],
    fallback: { level: 2 },
};
const text = EndgameArchive.encode(emptyExport);
const loaded = EndgameArchive.decode(text);
if (loaded.black_book.length !== 0 || loaded.white_turns.length !== 0) throw new Error('empty book roundtrip failed');
if (loaded.hp.black !== 8 || loaded.hp.white !== 3) throw new Error('hp roundtrip failed');
if (loaded.cells[4 * boardSize + 4].stone !== 'white') throw new Error('stone not preserved');
if (loaded.cells[5 * boardSize + 4].plant !== 2) throw new Error('plant not preserved');

let rejected = false;
try {
    EndgameArchive.encode({ ...emptyExport, blackBook: [[1, 1]], whiteTurns: [] });
} catch (_) {
    rejected = true;
}
if (!rejected) throw new Error('mismatched books should fail');

console.log('LOGIC_OK');
console.log('sample_empty_code_len', text.length);
