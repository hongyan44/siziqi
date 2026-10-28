/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友列表纯逻辑（排序 / 状态文案 / ID 规范化），无 DOM 依赖，便于回归测试
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.FriendList = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    // 好友专属短 ID 字符集：去掉易混淆的 0/O/1/I
    const ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    // 房间号沿用在线对局的 6 位大写字母约定
    const ROOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // 单条私信长度上限（字符数，与后端字节上限配套）
    const MESSAGE_MAX_LEN = 1000;

    /**
     * @description: 规范化好友 ID：去空白、转大写，仅保留合法字符
     * @param {string} value
     * @return {string}
     */
    const normalize_friend_id = (value) => {
        if (typeof value !== 'string') return '';
        return value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, 8);
    };

    /**
     * @description: 生成 6 位房间号（大写字母）
     * @return {string}
     */
    const make_room_code = () => {
        let code = '';
        for (let index = 0; index < 6; index++) {
            code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
        }
        return code;
    };

    /**
     * @description: 好友排序：在线优先，其次按最后上线时间从新到旧
     * @param {Array<{online: boolean, last_seen: number}>} friends
     * @return {Array}
     */
    const sort_friends = (friends) => {
        const list = Array.isArray(friends) ? friends.slice() : [];
        return list.sort((a, b) => {
            const online_a = a && a.online ? 1 : 0;
            const online_b = b && b.online ? 1 : 0;
            if (online_a !== online_b) return online_b - online_a;
            return (Number(b && b.last_seen) || 0) - (Number(a && a.last_seen) || 0);
        });
    };

    /**
     * @description: 最后上线时间文案
     * @param {number} last_seen 毫秒时间戳
     * @param {number} now 当前毫秒时间戳
     * @return {string}
     */
    const format_last_seen = (last_seen, now) => {
        const seen = Number(last_seen) || 0;
        const current = Number(now) || Date.now();
        if (seen <= 0) return '从未上线';

        const diff = Math.max(0, current - seen);
        if (diff < 60 * 1000) return '刚刚在线';
        if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;

        const date = new Date(seen);
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    /**
     * @description: 好友在线状态文案
     * @param {{online: boolean, last_seen: number}} friend
     * @param {number} now
     * @return {string}
     */
    const format_presence = (friend, now) => {
        if (friend && friend.online) return '在线';
        return format_last_seen(friend && friend.last_seen, now);
    };

    /**
     * @description: 搜索结果按钮文案与动作
     * @param {string} relation
     * @return {{text: string, action: string | null, disabled: boolean}}
     */
    const relation_label = (relation) => {
        switch (relation) {
            case 'friend': return { text: '已是好友', action: null, disabled: true };
            case 'outgoing': return { text: '已申请', action: null, disabled: true };
            case 'incoming': return { text: '接受', action: 'accept', disabled: false };
            case 'self': return { text: '这是你自己', action: null, disabled: true };
            case 'denied': return { text: '不接受申请', action: null, disabled: true };
            default: return { text: '添加好友', action: 'add', disabled: false };
        }
    };

    /**
     * @description: 好友申请设置文案
     * @param {string} mode deny / manual / auto
     * @return {string}
     */
    const request_mode_label = (mode) => {
        switch (mode) {
            case 'deny': return '不允许申请好友';
            case 'auto': return '好友申请自动同意';
            default: return '好友申请需要同意';
        }
    };

    /**
     * @description: 判断用户是否为管理员（权限等级 4）
     * @param {{level: number}} user
     * @return {boolean}
     */
    const is_admin = (user) => Number(user && user.level) === 4;

    /**
     * @description: 昵称回退
     * @param {string} name
     * @return {string}
     */
    const display_name = (name) => (typeof name === 'string' && name.trim() ? name : '无名氏');

    /**
     * @description: 规范化私信内容：去首尾空白并截断到上限
     * @param {string} value
     * @return {string}
     */
    const normalize_message = (value) => {
        if (typeof value !== 'string') return '';
        return value.trim().slice(0, MESSAGE_MAX_LEN);
    };

    /**
     * @description: 私信时间文案（今天只显示时分，跨天带日期）
     * @param {number} ms 毫秒时间戳
     * @param {number} now 当前毫秒时间戳
     * @return {string}
     */
    const format_message_time = (ms, now) => {
        const value = Number(ms) || 0;
        if (value <= 0) return '';
        const current = Number(now) || Date.now();
        const date = new Date(value);
        const current_date = new Date(current);
        const pad = (number) => String(number).padStart(2, '0');
        const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        if (date.getFullYear() === current_date.getFullYear() &&
            date.getMonth() === current_date.getMonth() &&
            date.getDate() === current_date.getDate()) {
            return time;
        }
        const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        if (date.getFullYear() === current_date.getFullYear()) return `${day} ${time}`;
        return `${date.getFullYear()}-${day} ${time}`;
    };

    /**
     * @description: 胜率文案（无对局时显示占位）
     * @param {number} games 对局数
     * @param {number} wins 胜利数
     * @return {string}
     */
    const format_win_rate = (games, wins) => {
        const total = Math.max(0, Number(games) || 0);
        if (total <= 0) return '暂无记录';
        const win = Math.min(total, Math.max(0, Number(wins) || 0));
        const rate = (win / total) * 100;
        const text = rate === 0 || rate === 100 ? rate.toFixed(0) : rate.toFixed(1);
        return `${text}%`;
    };

    return {
        ID_ALPHABET,
        ROOM_ALPHABET,
        MESSAGE_MAX_LEN,
        normalize_friend_id,
        make_room_code,
        sort_friends,
        format_last_seen,
        format_presence,
        format_win_rate,
        relation_label,
        request_mode_label,
        is_admin,
        display_name,
        normalize_message,
        format_message_time
    };
});