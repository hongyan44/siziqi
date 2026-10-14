/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事 BO 系列（小分）纯逻辑
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

/**
 * @description: 归一化 BO 局数（必须为奇数，默认 3）
 * @param {number|string} bo
 * @return {number}
 */
const normalize_bo = (bo) => {
    const value = Number(bo);
    if (!Number.isFinite(value) || value < 1) return 3;
    const count = Math.floor(value);
    return count % 2 === 0 ? count + 1 : count;
};

/**
 * @description: 系列目标胜局数（BO3 -> 2，BO5 -> 3）
 * @param {number|string} bo
 * @return {number}
 */
const series_target = (bo) => Math.floor(normalize_bo(bo) / 2) + 1;

/**
 * @description: 在签表中定位某昵称所在的分组
 * @param {object} bracket 签表数据
 * @param {string} my_name 我方昵称
 * @return {{node: object, node_index: number, group_index: number, foe_name: string} | null}
 */
const locate_pair = (bracket, my_name) => {
    if (!bracket || !Array.isArray(bracket.nodes) || !my_name) return null;

    for (let node_index = 0; node_index < bracket.nodes.length; node_index++) {
        const node = bracket.nodes[node_index];
        if (!node || !Array.isArray(node.groups)) continue;

        for (let group_index = 0; group_index < node.groups.length; group_index++) {
            const group = node.groups[group_index];
            if (!Array.isArray(group) || !group.includes(my_name)) continue;

            const foe_name = group.find((name) => name !== my_name) || null;
            return { node, node_index, group_index, foe_name };
        }
    }

    return null;
};

/**
 * @description: 在签表中按唯一身份标识码定位分组（比 locate_pair 更可靠，昵称可改）
 * @param {object} bracket 签表数据
 * @param {string} my_uuid 我方唯一身份标识码
 * @return {{node: object, node_index: number, group_index: number, my_name: string, foe_name: string, foe_uuid: string} | null}
 */
const locate_pair_by_uuid = (bracket, my_uuid) => {
    if (!bracket || !Array.isArray(bracket.nodes) || !my_uuid) return null;

    for (let node_index = 0; node_index < bracket.nodes.length; node_index++) {
        const node = bracket.nodes[node_index];
        if (!node || !Array.isArray(node.groups)) continue;
        const player_uuids = node.player_uuids && typeof node.player_uuids === 'object' ? node.player_uuids : {};

        for (let group_index = 0; group_index < node.groups.length; group_index++) {
            const group = node.groups[group_index];
            if (!Array.isArray(group)) continue;

            let my_name = null;
            let foe_name = null;
            let foe_uuid = '';

            for (const name of group) {
                const uuid = player_uuids[name];
                if (!uuid) continue;
                if (uuid === my_uuid) my_name = name;
                else if (!foe_uuid) { foe_uuid = uuid; foe_name = name; }
            }

            if (!my_name) continue;
            return { node, node_index, group_index, my_name, foe_name, foe_uuid };
        }
    }

    return null;
};

/**
 * @description: 计算某分组的 BO 系列视图
 * @param {object} args
 * @param {object} args.node 签表节点
 * @param {number} args.group_index 分组序号
 * @param {string} args.my_uuid 我方唯一身份标识码
 * @param {string} args.foe_uuid 对方唯一身份标识码
 * @return {{bo: number, target: number, games: object[], mine: number, foe: number, completed: boolean, winner_uuid: string, next_index: number}}
 */
const series_view = ({ node, group_index, my_uuid, foe_uuid }) => {
    const bo = normalize_bo(node && node.bo);
    const target = series_target(bo);

    const results = node && node.results && typeof node.results === 'object' ? node.results : {};
    const entry = results[String(group_index)] || {};
    // wins 为权威小分（按标识码累计），games 仅作审计日志
    const wins = entry.wins && typeof entry.wins === 'object' ? entry.wins : {};
    const games = Array.isArray(entry.games) ? entry.games : [];

    const mine = Number(wins[my_uuid]) || 0;
    const foe = Number(wins[foe_uuid]) || 0;

    const completed = mine >= target || foe >= target;
    const winner_uuid = completed ? (mine > foe ? my_uuid : foe_uuid) : '';

    return { bo, target, games, mine, foe, completed, winner_uuid, next_index: mine + foe + 1 };
};

/**
 * @description: 按管理员配置决定本局我方先手
 * @param {object} args
 * @param {object} args.node 签表节点
 * @param {number} args.index 本局序号（从 1 开始）
 * @param {string} args.my_uuid 我方唯一身份标识码
 * @param {string} args.foe_uuid 对方唯一身份标识码
 * @return {'my' | 'foe' | 'rand'}
 */
const first_hand = ({ node, index, my_uuid, foe_uuid }) => {
    if (!node || node.rotate !== 'first') return 'rand';

    const pair = [my_uuid, foe_uuid].sort();
    const leader = Number(index) % 2 === 1 ? pair[0] : pair[1];
    return leader === my_uuid ? 'my' : 'foe';
};

export { normalize_bo, series_target, locate_pair, locate_pair_by_uuid, series_view, first_hand };