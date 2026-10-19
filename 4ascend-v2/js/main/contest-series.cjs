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
 * @description: 判断某分组是否已分出胜负（任一方小分达到目标胜局）
 * @param {object} node 签表节点
 * @param {number} group_index 分组序号
 * @param {string} uuid_a 一方唯一身份标识码
 * @param {string} uuid_b 另一方唯一身份标识码
 * @return {boolean}
 */
const group_is_completed = (node, group_index, uuid_a, uuid_b) => {
    const target = series_target(node && node.bo);

    const results = node && node.results && typeof node.results === 'object' ? node.results : {};
    const entry = results[String(group_index)] || {};
    const wins = entry.wins && typeof entry.wins === 'object' ? entry.wins : {};

    const a = Number(wins[uuid_a]) || 0;
    const b = Number(wins[uuid_b]) || 0;

    return a >= target || b >= target;
};

/**
 * @description: 从多轮候选里挑出“当前轮次”的配对
 *   选手晋级后会同时留在旧方块（已完赛）与新方块（下一轮抽签）里；
 *   若按顺序取第一个匹配，会永远定位到旧组，导致下一轮对手校验失败、开不了比赛。
 *   规则：优先尚未完赛的配对，并按方块序号取「最早」的一轮（单败赛制必须逐轮推进，
 *   所以当前正在打的就是还没完赛的最小轮次；即便选手提前报名了后面的方块，也不会误判）；
 *   若全部都完赛，则取最后完赛的一轮，供界面展示最近一次系列赛。
 * @param {Array<{node_index: number, group_index: number, completed: boolean}>} list
 * @return {object|null}
 */
const pick_current_round = (list) => {
    if (!Array.isArray(list) || !list.length) return null;

    const active = list.filter((item) => !item.completed);
    const pool = active.length
        ? active.slice().sort((a, b) => (a.node_index - b.node_index) || (a.group_index - b.group_index))
        : list.slice().sort((a, b) => (b.node_index - a.node_index) || (a.group_index - b.group_index));

    return pool[0];
};

/**
 * @description: 在签表中按唯一身份标识码定位分组（比 locate_pair 更可靠，昵称可改）
 * @param {object} bracket 签表数据
 * @param {string} my_uuid 我方唯一身份标识码
 * @return {{node: object, node_index: number, group_index: number, my_name: string, foe_name: string, foe_uuid: string} | null}
 */
const locate_pair_by_uuid = (bracket, my_uuid) => {
    if (!bracket || !Array.isArray(bracket.nodes) || !my_uuid) return null;

    const candidates = [];

    for (let node_index = 0; node_index < bracket.nodes.length; node_index++) {
        const node = bracket.nodes[node_index];
        if (!node || !Array.isArray(node.groups)) continue;
        const player_uuids = node.player_uuids && typeof node.player_uuids === 'object' ? node.player_uuids : {};

        for (let group_index = 0; group_index < node.groups.length; group_index++) {
            const group = node.groups[group_index];
            if (!Array.isArray(group)) continue;

            const my_name = group.find((name) => player_uuids[name] === my_uuid) || null;
            if (!my_name) continue;

            const foe_name = group.find((name) => name !== my_name) || null;
            const foe_uuid = foe_name ? (player_uuids[foe_name] || '') : '';

            candidates.push({
                node, node_index, group_index, my_name, foe_name, foe_uuid,
                completed: group_is_completed(node, group_index, my_uuid, foe_uuid)
            });
        }
    }

    const best = pick_current_round(candidates);
    if (!best) return null;

    return {
        node: best.node, node_index: best.node_index, group_index: best.group_index,
        my_name: best.my_name, foe_name: best.foe_name, foe_uuid: best.foe_uuid
    };
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

export { normalize_bo, series_target, locate_pair, locate_pair_by_uuid, series_view, group_is_completed, pick_current_round };