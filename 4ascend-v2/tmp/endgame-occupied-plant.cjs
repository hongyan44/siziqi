/*
 * @Description: 残局「卖血占打」后占点上的草必须保留并重绘（回归测试）
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.join(__dirname, '..');

/**
 * @description: 从页面源码中提取结算清理块（pendingAscend.flat().forEach(...))
 * @param {string} file 页面路径
 * @return {string}
 */
const extract_cleanup = (file) => {
    const text = fs.readFileSync(file).toString();
    const match = text.match(/pendingAscend\.flat\(\)\.forEach\(\(pos\) => \{[\s\S]*?\n\s*\}\);/);
    assert.ok(match, `${file} 未找到结算清理块`);
    return match[0];
};

/**
 * @description: 用桩对象执行清理块，返回绘制调用记录
 * @param {string} code 清理块源码
 * @param {object} board 坐标 -> pos
 * @return {object}
 */
const run_cleanup = (code, board) => {
    const calls = [];
    const ui = {
        clear_stone_ascend: (x, y) => calls.push(['clear_ascend', x, y]),
        clear_plant: (x, y) => calls.push(['clear_plant', x, y]),
        draw_plant: (x, y) => calls.push(['draw_plant', x, y]),
        draw_2plant: (x, y) => calls.push(['draw_2plant', x, y]),
    };
    const game = { board: { get_pos: (x, y) => board[`${x},${y}`] || null } };
    const PLANT_ENUM = { NONE: 0, ONE: 1, TWO: 2 };
    const pendingAscend = [[{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }], []];
    new Function('ui', 'game', 'PLANT_ENUM', 'pendingAscend', code)(ui, game, PLANT_ENUM, pendingAscend);
    return calls;
};

const pages = [
    path.join(root, 'html', 'endgame', 'challenge.html'),
    path.join(root, 'html', 'docs', 'story-play.html'),
];

pages.forEach((file) => {
    const code = extract_cleanup(file);
    // (3,3) 被卖血占据且已有一草 → 必须重绘
    // (4,4) 被占据但无草 → 不得绘制
    // (5,5) 已结算为空点 → 不得绘制
    const calls = run_cleanup(code, {
        '3,3': { stone: '', plant: 1 },
        '4,4': { stone: '', plant: 0 },
        '5,5': { stone: '', plant: 0 },
    });

    assert.deepStrictEqual(
        calls.filter((call) => call[0] === 'draw_plant'),
        [['draw_plant', 3, 3]],
        `${path.basename(file)} 应重绘卖血占点上的草`
    );
    assert.deepStrictEqual(
        calls.filter((call) => call[0] === 'draw_2plant'),
        [],
        `${path.basename(file)} 不应误绘双草`
    );
    assert.ok(
        calls.some((call) => call[0] === 'clear_plant' && call[1] === 3 && call[2] === 3),
        `${path.basename(file)} 应先清理占点旧草再重绘`
    );
});

const double = run_cleanup(extract_cleanup(pages[0]), { '3,3': { stone: '', plant: 2 } });
assert.deepStrictEqual(double.filter((call) => call[0] === 'draw_2plant'), [['draw_2plant', 3, 3]], '双草占点应绘双草');

console.log('endgame-occupied-plant: all assertions passed');
