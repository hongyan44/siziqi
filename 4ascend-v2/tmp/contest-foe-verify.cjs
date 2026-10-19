/*
 * 赛事对战双方唯一身份标识码校验回归。
 * 运行： node tmp/contest-foe-verify.cjs
 *
 * 背景：赛事比赛原先用“对方昵称”与签表期望对手比对，昵称不唯一且可修改。
 * 现改为用账号 uuid（唯一身份标识码）校验：报名时服务端把 uuid 写入签表
 * node.player_uuids（昵称 -> uuid），对战握手时用双方 uuid 比对。
 *
 * 本测试覆盖：
 *   1) 定位分组与期望对手；
 *   2) uuid 一致 -> 通过；
 *   3) 对方 uuid 不一致 -> 拒绝（foe-mismatch）；
 *   4) 我方 uuid 与报名不符（昵称被他人占用）-> 拒绝（self-mismatch）；
 *   5) 旧签表无 player_uuids -> 回退昵称比对；
 *   6) 未报名/单人组 -> 无法校验，放行。
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

const { locate_group, verify_foe_identity } = load('contest-verify.cjs');

const main = () => {
    const bracket = {
        nodes: [
            {
                id: 'node_main',
                groups: [['甲', '乙'], ['丙']],
                players: ['甲', '乙', '丙'],
                player_uuids: { '甲': 'uuid-jia', '乙': 'uuid-yi', '丙': 'uuid-bing' }
            }
        ]
    };

    // 1) 定位分组
    const located = locate_group(bracket, '甲');
    assert.equal(located.expected_foe_name, '乙', '应定位到甲所在分组并取另一名选手为期望对手');
    assert.equal(locate_group(bracket, '不存在'), null, '未报名选手应返回 null');

    // 2) uuid 一致 -> 通过
    const ok = verify_foe_identity({ bracket, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '乙', foe_uuid: 'uuid-yi' });
    assert.equal(ok.ok, true, '双方 uuid 与报名一致时必须通过');
    assert.equal(ok.mode, 'uuid', '应走 uuid 校验模式');

    // 3) 对方 uuid 不一致 -> 拒绝（即使昵称相同也不能放行）
    const foeBad = verify_foe_identity({ bracket, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '乙', foe_uuid: 'uuid-other' });
    assert.equal(foeBad.ok, false, '对方 uuid 与报名不符必须拒绝');
    assert.equal(foeBad.reason, 'foe-mismatch', '拒绝原因应为 foe-mismatch');

    // 4) 我方 uuid 与报名不符（昵称被他人占用）-> 拒绝
    const selfBad = verify_foe_identity({ bracket, my_name: '甲', my_uuid: 'uuid-imposter', foe_name: '乙', foe_uuid: 'uuid-yi' });
    assert.equal(selfBad.ok, false, '我方 uuid 与报名不符必须拒绝');
    assert.equal(selfBad.reason, 'self-mismatch', '拒绝原因应为 self-mismatch');

    // 5) 旧签表无 player_uuids -> 回退昵称比对
    const legacy = { nodes: [{ id: 'n', groups: [['甲', '乙']], players: ['甲', '乙'] }] };
    const legacyOk = verify_foe_identity({ bracket: legacy, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '乙', foe_uuid: 'uuid-yi' });
    assert.equal(legacyOk.ok, true, '无标识码数据时应回退昵称比对并放行昵称一致者');
    assert.equal(legacyOk.mode, 'name', '回退时应为 name 模式');
    const legacyBad = verify_foe_identity({ bracket: legacy, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '丙', foe_uuid: 'uuid-bing' });
    assert.equal(legacyBad.ok, false, '回退昵称比对时昵称不一致必须拒绝');

    // 6) 单人组 / 未报名 -> 放行
    const solo = verify_foe_identity({ bracket, my_name: '丙', my_uuid: 'uuid-bing', foe_name: '任意', foe_uuid: 'uuid-x' });
    assert.equal(solo.ok, true, '我的组只有我一人时无法校验，应放行');
    assert.equal(solo.mode, 'skip', '无法校验时应为 skip 模式');

    // 7) 晋级场景：旧组（已完赛）不得遮挡下一轮新抽签的配对，校验应以新组对手为准
    const multi = {
        nodes: [
            {
                id: 'node_main', bo: 3,
                groups: [['甲', '乙']],
                players: ['甲', '乙'],
                player_uuids: { '甲': 'uuid-jia', '乙': 'uuid-yi' },
                results: { '0': { wins: { 'uuid-jia': 2, 'uuid-yi': 0 } } }
            },
            {
                id: 'node_round2', bo: 3,
                groups: [['甲', '丙']],
                players: ['甲', '丙'],
                player_uuids: { '甲': 'uuid-jia', '丙': 'uuid-bing' }
            }
        ]
    };

    const advanced = locate_group(multi, '甲');
    assert.equal(advanced.node.id, 'node_round2', '晋级后应定位到下一轮方块，而不是旧组');
    assert.equal(advanced.expected_foe_name, '丙', '下一轮期望对手应为新抽签对手');

    const newFoeOk = verify_foe_identity({ bracket: multi, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '丙', foe_uuid: 'uuid-bing' });
    assert.equal(newFoeOk.ok, true, '与下一轮抽签对手对战应通过校验');

    const oldFoeBad = verify_foe_identity({ bracket: multi, my_name: '甲', my_uuid: 'uuid-jia', foe_name: '乙', foe_uuid: 'uuid-yi' });
    assert.equal(oldFoeBad.ok, false, '与旧组对手对战必须拒绝（该组已完赛，选手已晋级）');
    assert.equal(oldFoeBad.reason, 'foe-mismatch');

    // 旧组仍在进行、只是提前报名了下一轮 -> 仍以旧组为准
    const mixed = {
        nodes: [
            { ...multi.nodes[0], results: { '0': { wins: { 'uuid-jia': 1, 'uuid-yi': 0 } } } },
            multi.nodes[1]
        ]
    };
    assert.equal(locate_group(mixed, '甲').node.id, 'node_main', '旧组未完赛时应以旧组为准');

    console.log('contest-foe-verify: PASS');
};

try {
    main();
} catch (error) {
    console.error('contest-foe-verify: FAIL');
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
}