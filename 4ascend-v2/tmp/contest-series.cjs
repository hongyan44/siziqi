/*
 * 赛事 BO 系列（小分）纯逻辑回归。
 * 运行： node tmp/contest-series.cjs
 *
 * 背景：签表 node 增 bo（默认3，奇数）、rotate（先手轮换）、results（按组的小分）。
 * 赛事对局保留手动先手/阵营选项；当签表配置为先手轮换（rotate='first'）时，
 * 第 1 局真随机、第 2 局起逐局交换先后手，该结果只与局号和签表记录有关，
 * 因此与「是否点重赛按钮」无关（重赛本身也是交换先后手）。
 * 服务端按回放交叉校验后增量写入 results[group].games（每项 {replay_id, winner_uuid, first_uuid}）。
 *
 * 本测试覆盖：
 *   1) BO 归一化（偶数向上取奇、非法回退 3）；
 *   2) 目标胜局数（BO3->2, BO5->3）；
 *   3) 定位分组；
 *   4) 系列视图（小分/完成/下一局序号）；
 *   5) 先手轮换推导（next_first_hand）。
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

const series = load('contest-series.cjs');
const { normalize_bo, series_target, locate_pair, locate_pair_by_uuid, series_view, next_first_hand } = series;

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

    // 3c) 多轮签表：晋级后旧组（已完赛）不得遮挡下一轮新抽签的配对
    const round1 = {
        id: 'node_main', bo: 3,
        groups: [['甲', '乙'], ['丙', '丁']],
        player_uuids: { '甲': 'uuid-a', '乙': 'uuid-b', '丙': 'uuid-c', '丁': 'uuid-d' },
        results: { '0': { wins: { 'uuid-a': 2, 'uuid-b': 0 } } }
    };
    const round2 = {
        id: 'node_round2', bo: 3,
        groups: [['甲', '丙']],
        player_uuids: { '甲': 'uuid-a', '丙': 'uuid-c' },
        results: {}
    };

    // 旧组已完赛 + 已进入下一轮 -> 应定位下一轮
    const advanced = locate_pair_by_uuid({ nodes: [round1, round2] }, 'uuid-a');
    assert.equal(advanced.node.id, 'node_round2', '晋级后应定位到下一轮方块，而不是旧组');
    assert.equal(advanced.group_index, 0);
    assert.equal(advanced.foe_uuid, 'uuid-c', '下一轮对手应为新抽签的对手');

    // 旧组仍在进行 + 已提前报名下一轮 -> 仍应定位旧组（逐轮推进，不得误判为下一轮）
    const round1_playing = { ...round1, results: { '0': { wins: { 'uuid-a': 1, 'uuid-b': 0 } } } };
    const stillPlaying = locate_pair_by_uuid({ nodes: [round1_playing, round2] }, 'uuid-a');
    assert.equal(stillPlaying.node.id, 'node_main', '旧组未完赛时应优先当前正在进行的轮次');

    // 全部完赛 -> 回退到最后一轮，供界面展示最近一次系列赛
    const round2_done = { ...round2, results: { '0': { wins: { 'uuid-a': 2, 'uuid-c': 1 } } } };
    const allDone = locate_pair_by_uuid({ nodes: [round1, round2_done] }, 'uuid-a');
    assert.equal(allDone.node.id, 'node_round2', '全部完赛时应回退到最后一轮');

    // 被淘汰（旧组完赛、未晋级）时仍能定位到自己最后一次系列赛
    const eliminated = locate_pair_by_uuid({ nodes: [round1, round2] }, 'uuid-b');
    assert.equal(eliminated.node.id, 'node_main');
    assert.equal(eliminated.foe_uuid, 'uuid-a');

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

    // 5) 先手轮换（next_first_hand）：第 1 局真随机，第 2 局起与上一局实际先手交换
    assert.equal(typeof series.first_hand, 'undefined', '旧的 first_hand（强制锁定）不应再导出');
    assert.equal(typeof next_first_hand, 'function', 'next_first_hand 应导出');

    // 不轮换时恒为随机
    assert.equal(next_first_hand({ rotate: 'off', index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: [] }), 'rand');
    assert.equal(next_first_hand({ rotate: undefined, index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: [] }), 'rand');

    // 第 1 局：真随机（双方都得到 rand，由客户端协商）
    assert.equal(next_first_hand({ rotate: 'first', index: 1, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: [] }), 'rand');
    assert.equal(next_first_hand({ rotate: 'first', index: 0, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: [] }), 'rand', '非法局号应回退随机');

    // 第 2 局：与上一局实际先手交换（上一局 A 先手 -> 本局 B 先手）
    const g2 = [{ replay_id: 1, winner_uuid: 'uuid-a', first_uuid: 'uuid-a' }];
    assert.equal(next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: g2 }), 'foe');
    assert.equal(next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-b', foe_uuid: 'uuid-a', games: g2 }), 'my', '双方推导必须互补');

    // 第 3 局：继续交替（第 2 局 B 先手 -> 第 3 局 A 先手）
    const g3 = [...g2, { replay_id: 2, winner_uuid: 'uuid-b', first_uuid: 'uuid-b' }];
    assert.equal(next_first_hand({ rotate: 'first', index: 3, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: g3 }), 'my');
    assert.equal(next_first_hand({ rotate: 'first', index: 3, my_uuid: 'uuid-b', foe_uuid: 'uuid-a', games: g3 }), 'foe', '双方推导必须互补');

    // 第 4 局：再次交替
    const g4 = [...g3, { replay_id: 3, winner_uuid: 'uuid-a', first_uuid: 'uuid-a' }];
    assert.equal(next_first_hand({ rotate: 'first', index: 4, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: g4 }), 'foe');
    assert.equal(next_first_hand({ rotate: 'first', index: 4, my_uuid: 'uuid-b', foe_uuid: 'uuid-a', games: g4 }), 'my');

    // 未传 games 时从 node.results[group_index] 读取
    const node_rot = { bo: 3, rotate: 'first', results: { '0': { games: g2 } } };
    assert.equal(next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', node: node_rot, group_index: 0 }), 'foe');
    const no_rec_a = next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', node: { bo: 3, rotate: 'first' }, group_index: 0 });
    const no_rec_b = next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-b', foe_uuid: 'uuid-a', node: { bo: 3, rotate: 'first' }, group_index: 0 });
    assert.ok(no_rec_a !== no_rec_b, '无记录时双方推导仍须互补（回退到 uuid 排序 + 局号奇偶）');

    // 旧记录无 first_uuid 时回退到“uuid 排序 + 局号奇偶”，双方结果一致
    const legacy = [{ replay_id: 1, winner_uuid: 'uuid-a' }];
    const la = next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: legacy });
    const lb = next_first_hand({ rotate: 'first', index: 2, my_uuid: 'uuid-b', foe_uuid: 'uuid-a', games: legacy });
    assert.ok(la !== lb, '回退算法下双方推导必须互补');
    const lc = next_first_hand({ rotate: 'first', index: 3, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: legacy });
    assert.ok(lc !== la, '回退算法按局号奇偶交替（第2局与第3局异侧）');
    const ld = next_first_hand({ rotate: 'first', index: 4, my_uuid: 'uuid-a', foe_uuid: 'uuid-b', games: legacy });
    assert.equal(ld, la, '回退算法按局号奇偶交替（第2局与第4局同侧）');

    // 6) 赛事对局保留先手/阵营手动选项（轮换只预置默认值，不锁定选择框）
    const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
    const match_src = read(path.join('js', 'main', 'match-game.cjs'));
    assert.ok(match_src.includes('next_first_hand'), 'match-game 应引用先手轮换推导');
    assert.ok(match_src.includes('apply_next_first'), 'match-game 应把推导结果预置到先手选择框');
    assert.ok(!/select_server_first\.disabled/.test(match_src), '先手选择框不得被锁定');
    const game_html = read(path.join('html', 'mod', 'match-game.html'));
    assert.ok(game_html.includes('我方是先手') && game_html.includes('我方是黑方'), '赛事对局页应保留我方/对方先手与黑方选项');
    assert.ok(!/<sl-select[^>]*id='select_server_first'[^>]*disabled/.test(game_html), '先手选择框不应带 disabled 属性');
    const reg_html = read(path.join('html', 'mod', 'match-registration.html'));
    assert.ok(reg_html.includes('select_node_rotate'), '报名页应提供先手轮换配置');
    assert.ok(reg_html.includes("nodeRotateSelect.value = node.rotate === 'first' ? 'first' : 'off';"), '报名页应回填轮换配置');
    assert.ok(reg_html.includes("node.rotate = nodeRotateSelect.value === 'first' ? 'first' : 'off';"), '报名页保存时应写入轮换配置');
    assert.ok(/node\.rotate = node\.rotate === 'off' \? 'off' : 'first';/.test(reg_html), '旧签表缺失 rotate 时默认强制轮换');

    console.log('contest-series: PASS');
};

try {
    main();
} catch (error) {
    console.error('contest-series: FAIL');
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
}