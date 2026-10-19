/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事对战双方唯一身份标识码校验
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

const { group_is_completed, pick_current_round } = require('./contest-series.cjs');

/**
 * @description: 在签表中定位包含指定昵称的分组，得到期望对手
 *   选手晋级后会同时留在旧方块（已完赛）与新方块（下一轮抽签）里，这里与
 *   locate_pair_by_uuid 采用同一套“当前轮次”规则，避免误用旧组的对手导致校验失败。
 * @param {object} bracket 签表数据（{ nodes: [...] }）
 * @param {string} my_name 我方昵称
 * @return {{node: object, expected_foe_name: string} | null}
 */
const locate_group = (bracket, my_name) => {
    if (!bracket || !Array.isArray(bracket.nodes) || !my_name) return null;

    const candidates = [];

    for (let node_index = 0; node_index < bracket.nodes.length; node_index++) {
        const node = bracket.nodes[node_index];
        if (!node || !Array.isArray(node.groups)) continue;
        const player_uuids = node.player_uuids && typeof node.player_uuids === 'object' ? node.player_uuids : {};

        for (let group_index = 0; group_index < node.groups.length; group_index++) {
            const group = node.groups[group_index];
            if (!Array.isArray(group) || !group.includes(my_name)) continue;

            const expected_foe_name = group.find((name) => name !== my_name) || null;
            const my_uuid = player_uuids[my_name] || '';
            const foe_uuid = expected_foe_name ? (player_uuids[expected_foe_name] || '') : '';

            candidates.push({
                node, node_index, group_index, expected_foe_name,
                completed: group_is_completed(node, group_index, my_uuid, foe_uuid)
            });
        }
    }

    const best = pick_current_round(candidates);
    if (!best) return null;

    return { node: best.node, expected_foe_name: best.expected_foe_name };
};

/**
 * @description: 校验对战双方唯一身份标识码是否与赛事报名一致
 * @param {object} args
 * @param {object} args.bracket 签表数据
 * @param {string} args.my_name 我方昵称
 * @param {string} args.my_uuid 我方唯一身份标识码
 * @param {string} args.foe_name 对方昵称
 * @param {string} args.foe_uuid 对方唯一身份标识码
 * @return {{ok: boolean, reason: string, expected_foe_name: string | null, mode: string}}
 */
const verify_foe_identity = ({ bracket, my_name, my_uuid, foe_name, foe_uuid }) => {
    const located = locate_group(bracket, my_name);

    // 未找到我的分组或我的组只有一人：无法校验，放行
    if (!located || !located.expected_foe_name) return { ok: true, reason: 'unregistered', expected_foe_name: null, mode: 'skip' };

    const { node, expected_foe_name } = located;
    const player_uuids = node.player_uuids && typeof node.player_uuids === 'object' ? node.player_uuids : {};

    const my_reg_uuid = player_uuids[my_name] || null;
    const foe_reg_uuid = player_uuids[expected_foe_name] || null;

    // 报名标识码齐全时，按唯一身份标识码校验双方身份
    if (my_reg_uuid && foe_reg_uuid && foe_uuid) {
        if (my_uuid && my_uuid !== my_reg_uuid) return { ok: false, reason: 'self-mismatch', expected_foe_name, mode: 'uuid' };
        if (foe_uuid !== foe_reg_uuid) return { ok: false, reason: 'foe-mismatch', expected_foe_name, mode: 'uuid' };
        return { ok: true, reason: 'uuid-match', expected_foe_name, mode: 'uuid' };
    }

    // 兼容旧签表（无标识码数据）：回退到昵称比对
    if (foe_name !== expected_foe_name) return { ok: false, reason: 'foe-mismatch', expected_foe_name, mode: 'name' };
    return { ok: true, reason: 'name-match', expected_foe_name, mode: 'name' };
};

export { locate_group, verify_foe_identity };