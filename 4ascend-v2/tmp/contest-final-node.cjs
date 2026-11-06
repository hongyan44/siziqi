/*
 * 决赛方块（地图最后一次抽签）纯逻辑回归。
 * 运行： node tmp/contest-final-node.cjs
 *
 * 背景：赛事签表以方块地图组织，方块间用 edges 连线。
 * 规则：只有「入度 > 0 且出度 = 0」的终端方块才是决赛（主方块没有前驱，不算）；
 * 多个终端时取路径最深的终点，深度相同则取 nodes 顺序靠后的一个。
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname, '../js/main');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

const { final_node_id } = load('contest-series.cjs');

const node = (id) => ({ id });

const main = () => {
    // 1) 只有主方块（无连线）时没有决赛
    assert.equal(final_node_id({ nodes: [node('main')], edges: [] }), null);
    // 2) 主方块 → 一个方块：后者即决赛
    assert.equal(final_node_id({ nodes: [node('main'), node('a')], edges: [{ from: 'main', to: 'a' }] }), 'a');
    // 3) 线性三轮：最深终点是决赛
    const linear = {
        nodes: [node('main'), node('r1'), node('r2'), node('r3')],
        edges: [
            { from: 'main', to: 'r1' },
            { from: 'r1', to: 'r2' },
            { from: 'r2', to: 'r3' }
        ]
    };
    assert.equal(final_node_id(linear), 'r3');
    // 4) 分支赛程：取最深的一条终点
    const branch = {
        nodes: [node('main'), node('a'), node('b'), node('fa'), node('fb')],
        edges: [
            { from: 'main', to: 'a' },
            { from: 'main', to: 'b' },
            { from: 'a', to: 'fa' },
            { from: 'b', to: 'fb' },
            { from: 'fa', to: 'fb' }
        ]
    };
    assert.equal(final_node_id(branch), 'fb');
    // 5) 两个并列终点（同深度）取 nodes 顺序靠后者
    const tie = {
        nodes: [node('main'), node('x'), node('y')],
        edges: [
            { from: 'main', to: 'x' },
            { from: 'main', to: 'y' }
        ]
    };
    assert.equal(final_node_id(tie), 'y');
    // 6) 环路存在时仍能收敛并返回唯一终点
    const cycle = {
        nodes: [node('main'), node('a'), node('b'), node('f')],
        edges: [
            { from: 'main', to: 'a' },
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' },
            { from: 'b', to: 'f' }
        ]
    };
    assert.equal(final_node_id(cycle), 'f');
    // 7) 非法输入安全返回 null
    assert.equal(final_node_id(null), null);
    assert.equal(final_node_id({ nodes: [], edges: [] }), null);
    assert.equal(final_node_id({ nodes: 'bad', edges: [] }), null);

    console.log('contest-final-node: all assertions passed');
};

main();
