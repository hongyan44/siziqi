/*
 * 赛事 BO 系列（小分）纯逻辑回归。
 * 运行： node tmp/contest-series.cjs
 *
 * 背景：签表 node 增 bo（默认3，奇数）、rotate（先手轮换配置）、results（按组的小分）。
 * 服务端按回放交叉校验后增量写入 results[group].games（每项 {replay_id, winner_uuid}）。
 *
 * 本测试覆盖：
 *   1) BO 归一化（偶数向上取奇、非法回退 3）；
 *   2) 目标胜局数（BO3->2, BO5->3）；
 *   3) 定位分组；
 *   4) 系列视图（小分/完成/下一局序号）；
 *   5) 先手轮换（配置开启时按序号奇偶轮换，关闭时随机）。
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

const { normalize_bo, series_target, locate_pair, locate_pair_by_uuid, series_view, first_hand } = load('contest-series.cjs');

const main = () => {
    // 1) BO 归一化
    assert.equal(normalize_bo(3), 3);
    assert.equal(normalize_bo(5), 5);
    assert.equal(normalize_bo(4), 5, '偶数应向上取奇');
    assert.equal(normalize_bo(0), 3, '非法值应回退默认 3');
    assert.equal(normalize_bo(undefined), 3);
    assert.equal(normalize_bo('abc'), 3);

    // 2) 目标胜局数
    assert.equal(series_target(3), 2);
    assert.equal(series_target(5), 3);
    assert.equal(series_target(1), 1);

    // 3) 定位分组
    const node = {
        id: 'n1',
        bo: 3,
        rotate: 'first',
        groups: [['甲', '乙'], ['丙']],
        player_uuids: { '甲': 'uuid-a', '乙': 'uuid-b', '丙': 'uuid-c' },
        results: { '0': { wins: { 'uuid-a': 1, 'uuid-b': 1 }, games: [{ replay_id: 11, winner_uuid: 'uuid-a' }, { replay_id: 12, winner_uuid: 'uuid-b' }] } }
    };
    const bracket = { nodes: [node] };

    const located = locate_pair(bracket, '甲');
    assert.equal(located.group_index, 0);
    assert.equal(located.node_index, 0);
    assert.equal(located.foe_name, '乙');
    assert.equal(locate_pair(bracket, '不存在'), null);

    // 3b) 按 uuid 定位分组（昵称可改，uuid 才是权威标识）
    const byUuid = locate_pair_by_uuid(bracket, 'uuid-b');
    assert.equal(byUuid.group_index, 0);
    assert.equal(byUuid.my_name, '乙', '应通过 uuid 反查我方昵称');
    assert.equal(byUuid.foe_name, '甲');
    assert.equal(byUuid.foe_uuid, 'uuid-a', '对方标识码应由同组另一人得出');
    assert.equal(locate_pair_by_uuid(bracket, 'uuid-x'), null, '不在签表的标识码应返回 null');
    assert.equal(locate_pair_by_uuid(bracket, ''), null);
    // 昵称已改但 uuid 未变时仍能定位
    const renamed = { nodes: [{ ...node, player_uuids: { '甲': 'uuid-a', '乙改名': 'uuid-b' }, groups: [['甲', '乙改名'], ['丙']] }] };
    assert.equal(locate_pair_by_uuid(renamed, 'uuid-b').my_name, '乙改名', '昵称变更后仍应按 uuid 定位');

    // 4) 系列视图：1:1，未完成，下一局为第 3 局
    const view = series_view({ node, group_index: 0, my_uuid: 'uuid-a', foe_uuid: 'uuid-b' });
    assert.equal(view.bo, 3);
    assert.equal(view.target, 2);
    assert.equal(view.mine, 1);
    assert.equal(view.foe, 1);
    assert.equal(view.completed, false, '1:1 未达目标不应完成');
    assert.equal(view.next_index, 3, '已计入 2 局，下一局为第 3 局');

    // 完成态：2:1 -> 完成，胜者为我方
    const done = series_view({
        node: { ...node, results: { '0': { wins: { 'uuid-a': 2, 'uuid-b': 1 } } } },
        group_index: 0, my_uuid: 'uuid-a', foe_uuid: 'uuid-b'
    });
    assert.equal(done.completed, true);
    assert.equal(done.winner_uuid, 'uuid-a');
    assert.equal(done.next_index, 4);

    // 管理员手改小分同样生效
    const manual = series_view({
        node: { ...node, results: { '0': { wins: { 'uuid-a': 0, 'uuid-b': 2 } } } },
        group_index: 0, my_uuid: 'uuid-a', foe_uuid: 'uuid-b'
    });
    assert.equal(manual.completed, true);
    assert.equal(manual.winner_uuid, 'uuid-b', '管理员改分后胜者应随之改变');

    // 无 results（旧签表）时安全降级
    const empty = series_view({ node: { bo: 3 }, group_index: 0, my_uuid: 'uuid-a', foe_uuid: 'uuid-b' });
    assert.equal(empty.mine, 0);
    assert.equal(empty.foe, 0);
    assert.equal(empty.completed, false);
    assert.equal(empty.next_index, 1);

    // 5) 先手轮换
    const pairSorted = ['uuid-a', 'uuid-b'].sort();
    assert.equal(first_hand({ node, index: 1, my_uuid: pairSorted[0], foe_uuid: pairSorted[1] }), 'my', '第 1 局应由排序靠前者先手');
    assert.equal(first_hand({ node, index: 2, my_uuid: pairSorted[0], foe_uuid: pairSorted[1] }), 'foe', '第 2 局应轮换');
    assert.equal(first_hand({ node, index: 3, my_uuid: pairSorted[0], foe_uuid: pairSorted[1] }), 'my', '第 3 局再次轮换回排序靠前者');
    assert.equal(first_hand({ node, index: 3, my_uuid: pairSorted[1], foe_uuid: pairSorted[0] }), 'foe', '第 3 局对另一方应为对方先手');
    assert.equal(first_hand({ node: { rotate: 'off' }, index: 1, my_uuid: 'uuid-a', foe_uuid: 'uuid-b' }), 'rand', '未开启轮换应为随机');

    console.log('contest-series: PASS');
};

try {
    main();
} catch (error) {
    console.error('contest-series: FAIL');
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
}