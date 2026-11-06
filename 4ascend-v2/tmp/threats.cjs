/*
 * 全盘打点（M+N）回归测试。
 * 运行： bun tmp/threats.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = path.resolve(__dirname, '../js/global/fascend');
const cache = new Map();

function load(name) {
    const file = path.resolve(base, name);
    if (cache.has(file)) return cache.get(file).exports;

    const item = { exports: {} };
    cache.set(file, item);

    const source = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', source)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        item,
        item.exports
    );

    return item.exports;
}

const { Threats } = load('threats.cjs');
const { Board } = load('board.cjs');
const { STONE_ENUM, PLANT_ENUM } = load('enum.cjs');

const SIZE = 9;

/**
 * @description: 由棋子/草点构造 81 个格子的数组（与回放帧格式一致）
 * @param {object} spec
 * @return {number[][]}
 */
const make_cells = ({ black = [], white = [], black_ascend = [], white_ascend = [], plants = [] }) => {
    const cells = [];
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) cells.push([x, y, STONE_ENUM.NONE, PLANT_ENUM.NONE]);
    }

    const at = (x, y) => cells[y * SIZE + x];

    black.forEach(([x, y]) => (at(x, y)[2] = STONE_ENUM.BLACK));
    white.forEach(([x, y]) => (at(x, y)[2] = STONE_ENUM.WHITE));
    black_ascend.forEach(([x, y]) => (at(x, y)[2] = STONE_ENUM.BLACK_ASCEND));
    white_ascend.forEach(([x, y]) => (at(x, y)[2] = STONE_ENUM.WHITE_ASCEND));
    plants.forEach(([x, y, value]) => (at(x, y)[3] = value === 2 ? PLANT_ENUM.TWO : PLANT_ENUM.ONE));

    return cells;
};

/**
 * @description: 扫描结果转 map，方便按点查询
 * @param {number[][]} cells
 * @return {Map<string, object>}
 */
const scan_map = (cells) => {
    const map = new Map();
    Threats.scan(cells, STONE_ENUM, PLANT_ENUM).forEach((item) => map.set(`${item.x},${item.y}`, item));
    return map;
};

/**
 * @description: 与规则引擎 Board.get_ascend 的 M/N 定义逐点比对
 * @param {number[][]} cells
 * @return {void}
 */
const compare_with_engine = (cells) => {
    const board = new Board(SIZE, SIZE);
    cells.forEach(([x, y, stone, plant]) => {
        const pos = board.get_pos(x, y);
        pos.stone = stone;
        pos.plant = plant;
    });

    const scanned = scan_map(cells);
    const sides = [
        ['black', STONE_ENUM.BLACK, [STONE_ENUM.BLACK, STONE_ENUM.BLACK_ASCEND, STONE_ENUM.BLACK_USED]],
        ['white', STONE_ENUM.WHITE, [STONE_ENUM.WHITE, STONE_ENUM.WHITE_ASCEND, STONE_ENUM.WHITE_USED]],
    ];

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const entry = scanned.get(`${x},${y}`);
            const center = board.get_pos(x, y).stone;

            sides.forEach(([label, stone, own]) => {
                const poses = board.get_ascend(x, y, stone);
                let expected = null;

                if (!own.includes(center) && poses) {
                    let N = 0;
                    poses.forEach((pos) => {
                        if (pos.plant === PLANT_ENUM.ONE) N += 1;
                        else if (pos.plant === PLANT_ENUM.TWO) N += 2;
                    });

                    expected = { 'M': poses.length, 'N': N, 'MN': poses.length + N };
                }

                const got = entry ? entry[label] : null;

                assert.deepEqual(got, expected, `(${x},${y}) ${label} 打点不一致`);
            });
        }
    }
};

// 1. 空棋盘无打点
compare_with_engine(make_cells({}));
assert.equal(Threats.scan(make_cells({}), STONE_ENUM, PLANT_ENUM).length, 0);

// 2. 黑方三连，右侧空点为 M=4
{
    const cells = make_cells({ black: [[0, 0], [1, 0], [2, 0]] });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('3,0');
    assert.ok(entry, '黑方三连右侧空点应显示打点');
    assert.equal(entry.black.M, 4);
    assert.equal(entry.black.N, 0);
    assert.equal(entry.black.MN, 4);
    assert.equal(entry.white, null);
}

// 3. 草点计入 N（1 草 + 2 草 => N=3, M=4, MN=7）
{
    const cells = make_cells({
        black: [[0, 0], [1, 0], [2, 0]],
        plants: [[1, 0, 1], [2, 0, 2]],
    });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('3,0');
    assert.equal(entry.black.MN, 7);
}

// 4. 被对方普通子堵住的点同样显示（M+N 的 M >= 4）
{
    const cells = make_cells({ black: [[0, 0], [1, 0], [2, 0]], white: [[3, 0]] });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('3,0');
    assert.ok(entry, '被堵住的点也应显示黑方打点');
    assert.equal(entry.black.M, 4);
    assert.equal(entry.white, null, '白方己方棋子所在点不可落子');
}

// 5. 同一点双方打点：黑蓝在上、白红在下，数值各自独立
{
    const cells = make_cells({
        black: [[1, 4], [2, 4], [3, 4]],
        white: [[5, 4], [6, 4], [7, 4]],
        plants: [[2, 4, 1], [6, 4, 2]],
    });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('4,4');
    assert.ok(entry);
    assert.deepEqual(entry.black, { 'M': 4, 'N': 1, 'MN': 5 });
    assert.deepEqual(entry.white, { 'M': 4, 'N': 2, 'MN': 6 });
}

// 6. 对方盘旋子所在点可落子，己方盘旋子所在点不可落子
{
    const cells = make_cells({
        black: [[0, 0], [1, 0], [2, 0]],
        white_ascend: [[3, 0]],
    });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('3,0');
    assert.ok(entry);
    assert.equal(entry.black.M, 4);
    assert.equal(entry.white, null);
}

// 7. 双轴同时成打：M 取并集（3 + 3 + 中心 = 7）
{
    const cells = make_cells({
        black: [[3, 3], [3, 4], [3, 5], [4, 2], [5, 2], [6, 2]],
    });
    compare_with_engine(cells);

    const entry = scan_map(cells).get('3,2');
    assert.ok(entry);
    assert.equal(entry.black.M, 7);
}

// 8. 随机盘面交叉验证（固定种子，覆盖堵点/草点/盘旋子混合场景）
{
    let seed = 20261105;
    const rand = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };

    for (let round = 0; round < 80; round++) {
        const cells = make_cells({});

        for (let i = 0; i < 81; i++) {
            const value = rand();

            if (value < 0.22) cells[i][2] = STONE_ENUM.BLACK;
            else if (value < 0.44) cells[i][2] = STONE_ENUM.WHITE;
            else if (value < 0.47) cells[i][2] = STONE_ENUM.BLACK_ASCEND;
            else if (value < 0.50) cells[i][2] = STONE_ENUM.WHITE_ASCEND;

            if (rand() < 0.12) cells[i][3] = rand() < 0.5 ? PLANT_ENUM.ONE : PLANT_ENUM.TWO;
        }

        compare_with_engine(cells);
    }
}

// 9. 绘制：黑方蓝色在上、白方红色在下，锚点位于点的左下角
{
    const calls = [];
    const ctx = {
        'fillStyle': '',
        'strokeStyle': '',
        'font': '',
        'textAlign': '',
        'textBaseline': '',
        'lineJoin': '',
        'lineWidth': 1,
        'setTransform': () => {},
        'clearRect': () => {},
        'measureText': (text) => ({ 'width': text.length * 6 }),
        'strokeText': () => {},
        'fillText': (text, x, y) => calls.push({ 'text': text, 'x': x, 'y': y, 'color': ctx.fillStyle }),
    };

    const canvas = {
        'width': 300,
        'height': 150,
        'style': {},
        'clientWidth': 300,
        'getContext': () => ctx,
    };

    global.window = { 'devicePixelRatio': 1 };

    const cells = make_cells({
        black: [[1, 4], [2, 4], [3, 4]],
        white: [[5, 4], [6, 4], [7, 4]],
        plants: [[2, 4, 2], [6, 4, 1]],
    });

    const layout = {
        'stoneEnum': STONE_ENUM,
        'plantEnum': PLANT_ENUM,
        'offset': 20,
        'spacing': 30,
        'size': 300,
        'w': 9,
        'h': 9,
    };

    const list = Threats.draw(canvas, cells, layout);
    assert.equal(list.length, 3, '三连两端与公共点均为打点');
    assert.equal(canvas.width, 300, '画布应按棋盘尺寸同步');

    // 仅取公共点 (4,4) 的双方数值（x 距该点左侧约 13px）
    const both = calls.filter((call) => call.x > 115 && call.x < 135);
    assert.equal(both.length, 2, '同点双方打点应绘制两个数值');
    assert.equal(both[0].text, '6');
    assert.equal(both[0].color, '#2563eb');
    assert.equal(both[1].text, '5');
    assert.equal(both[1].color, '#dc2626');
    assert.ok(both[0].y < both[1].y, '黑方数值应在白方上方');
    assert.ok(both[0].x < 20 + 4 * 30, '数值应位于点的左侧');
    assert.ok(both[0].y > 20 + 4 * 30, '数值应位于点的下方');
}

console.log('threats 回归测试通过');
