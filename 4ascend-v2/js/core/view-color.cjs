/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 观战黑白方 / 先手还原（发送方相对选择 -> 绝对 uuid）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

/**
 * @description: 把发送方相对的阵营 / 先手选择还原成绝对 uuid
 *   观战是第三方：view_sync 的 uuids[0] 恒为发送者本人，
 *   而 'my' / 'foe' 只相对发送者自身，必须结合 sender_uuid 才能还原成绝对归属。
 * @param {string} sender_uuid 发送方 uuid（view_sync 的 uuids[0]）
 * @param {string} choice 'my' 或 'foe'
 * @param {string} my_uuid 观战上方位（uuid 排序较小者）
 * @param {string} foe_uuid 观战下方位（uuid 排序较大者）
 * @return {string} 被选中的绝对 uuid
 */
const resolve_choice_uuid = (sender_uuid, choice, my_uuid, foe_uuid) => {
    if (choice === 'my') return sender_uuid;
    if (sender_uuid === my_uuid) return foe_uuid;
    return my_uuid;
};

export { resolve_choice_uuid };