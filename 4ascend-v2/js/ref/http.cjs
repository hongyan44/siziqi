/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 网络请求
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
// window.http_protocol = 'https://';
// window.http_protocol = 'http://';
window.http_protocol = `${location.protocol}//`;

// window.ws_protocol = 'wss://';
// window.ws_protocol = 'ws://';
window.ws_protocol = window.http_protocol === 'http://' ? 'ws://' : 'wss://';

// window.online_api = 'online.siziqi.net';
// window.online_api = '192.168.1.151:50001';
// window.online_api = `online.${location.host}`;
const local_api_hosts = new Set(['127.0.0.1', 'localhost', '10.162.51.92', '192.168.1.151']);
const public_api_host = 'online.siziqi.net';
window.online_api = local_api_hosts.has(location.hostname) ? `${location.hostname}:50001` : public_api_host;


/**
 * @description: 查询标识（账号/手机号/邮箱）是否已注册
 * @param {string} ident
 * @return {Promise<boolean>}
 */
window.http_user_exist = async (ident) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/exist`, { ident });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 发送验证码（邮箱与手机号均真实发送；手机号未配置短信服务商时后端回退占位固定码，dev 为 true）
 * @param {string} ident
 * @return {Promise<{dev: boolean} | void>}
 */
window.http_user_sms = async (ident) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/sms`, { ident });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 注册（邮箱或手机号 + 验证码 + 账号 + 密码，注册后不自动登录）
 * @param {string} ident
 * @param {string} code
 * @param {string} account
 * @param {string} pass
 * @param {string} name
 * @return {Promise<boolean>}
 */
window.http_user_register = async (ident, code, account, pass, name = '') => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/register`, { ident, code, account, pass, name });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 登录（标识为 账号/手机号/邮箱；密码与验证码二选一）
 * @param {string} ident
 * @param {string} pass
 * @param {string} code
 * @return {Promise<string | void>}
 */
window.http_user_login = async (ident, pass, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/login`, { ident, pass, code });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 得到用户信息
 * @param {string} token
 * @return {Promise<{'name': string, 'avatar': string, 'time': number, 'mail': string, 'account': string, 'phone': string, 'uuid': string, 'score': number, 'level': number} | void>}
 */
window.http_user_info = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/info`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 查询残局关卡
 * @return {Promise<Array>}
 */
window.http_puzzle_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/query`, {});
    if (!rjson || !rjson.status) return [];
    return rjson.result;
};

/**
 * @description: 查询服务端每日挑战残局
 * @return {Promise<Object | null>}
 */
window.http_puzzle_daily_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/daily_query`, {});
    if (!rjson || !rjson.status || !rjson.result || !rjson.result.code) return null;
    return rjson.result;
};

/**
 * @description: 管理员更新服务端每日挑战残局
 * @param {string} token
 * @param {string} code
 * @param {string} title
 * @return {Promise<boolean>}
 */
window.http_puzzle_daily_update = async (token, code, title = '每日挑战') => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/daily_update`, { token, code, title });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 管理员新增残局关卡
 * @param {string} token
 * @param {number} level
 * @param {string} title
 * @param {string} code
 * @return {Promise<number | void>}
 */
window.http_puzzle_add = async (token, level, title, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/add`, { token, level, title, code });
    if (!rjson || !rjson.status) return;
    return rjson.result.id;
};

/**
 * @description: 管理员删除残局关卡
 * @param {string} token
 * @param {number} id
 * @return {Promise<boolean>}
 */
window.http_puzzle_update = async (token, id, level, title, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/update`, { token, id, level, title, code });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 管理员删除残局关卡
 * @param {string} token
 * @param {number} id
 * @return {Promise<boolean>}
 */
window.http_puzzle_delete = async (token, id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/delete`, { token, id });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 用户信息更新
 * @param {string} token
 * @param {string} name
 * @param {string} avatar
 * @return {Promise<boolean>}
 */
window.http_user_update = async (token, name, avatar) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/update`, { token, name, avatar });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 设置/修改登录密码（需验证码校验，验证码发往已绑定的邮箱或手机号）
 * @param {string} token
 * @param {string} code
 * @param {string} pass
 * @return {Promise<boolean>}
 */
window.http_user_set_pass = async (token, code, pass) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/set_pass`, { token, code, pass });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 设置登录账号（仅当前账号为空时可设置，设置后不可修改；需验证码校验，验证码发往已绑定的邮箱或手机号）
 * @param {string} token
 * @param {string} code
 * @param {string} account
 * @return {Promise<boolean>}
 */
window.http_user_set_account = async (token, code, account) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/set_account`, { token, code, account });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 使用秘钥解锁用户权限等级
 * @param {string} token
 * @param {string} secret
 * @return {Promise<number | void>}
 */
window.http_user_unlock_level = async (token, secret) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/unlock_level`, { token, secret });
    if (!rjson || !rjson.status) return;
    return rjson.result.level;
};

/**
 * @description: 刷新凭证
 * @param {string} token
 * @return {Promise<string | void>}
 */
window.http_user_rtoken = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/rtoken`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 创建房间
 * @param {string} id
 * @return {Promise<boolean>}
 */
window.http_room_create = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_create`, { id });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 房间是否存在
 * @param {string} id
 * @return {Promise<boolean>}
 */
window.http_room_exist = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_exist`, { id });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 查询所有房间信息
 * @return {Promise<{'id': string, 'exp': number, 'name1': string, 'name2': string}>}
 */
window.http_room_getall = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_getall`, {});
    if (!rjson || !rjson.status) return [];
    return rjson.result;
};

/**
 * @description: 得到所有观战者的名字
 * @param {string} id
 * @return {Promise<string[]>}
 */
window.http_room_getsub = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_getsub`, { id });
    if (!rjson || !rjson.status) return [];
    return rjson.result;
};


/**
 * @description: 查询随机匹配玩家池人数
 * @return {Promise<number>}
 */
window.http_rand_getall = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/rand_getall`, {});
    if (!rjson) return;
    return rjson.result;
};


/**
 * @description: 查询自己的所有回放
 * @param {string} token
 * @return {Promise<any[]>}
 */
window.http_replay_query = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/replay/query`, { token });
    if (!rjson || !rjson.status) return [];
    return rjson.result;
};

/**
 * @description: 得到回放数据
 * @param {string|number} id
 * @param {string} token
 * @return {Promise<Uint8Array | void>}
 */
window.http_replay_get = async (id, token = window.get_token()) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/replay/get`, { id, token });
    if (!rjson || !rjson.status) return;
    return new Uint8Array(rjson.result);
};

/**
 * @description: 上传已经结束的在线回放
 * @param {string} token
 * @param {string} opponent
 * @param {Uint8Array} data
 * @param {object} meta
 * @return {Promise<number | void>}
 */
window.http_replay_update = async (token, opponent, data, meta = {}) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/replay/update`, {
        token,
        opponent,
        data,
        ...meta
    });
    if (!rjson || !rjson.status) return;
    return rjson.result.id;
};


/**
 * @description: 毫秒时间戳
 * @return {Promise<number>}
 */
window.http_time_ms = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/time/ms`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 秒时间戳
 * @return {Promise<number>}
 */
window.http_time_s = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/time/s`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 查询赛事签表
 * @return {Promise<{data: string, creator: string, updated_at: number} | undefined>}
 */
window.http_contest_bracket_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/bracket_query`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 更新赛事签表（仅管理员）
 * @param {string} token
 * @param {string} data
 * @return {Promise<boolean>}
 */
window.http_contest_bracket_update = async (token, data) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/bracket_update`, { token, data });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 赛事报名（加入未满组，服务端校验）
 * @param {string} token
 * @param {string} node_id
 * @param {string} name
 * @return {Promise<boolean>}
 */
window.http_contest_bracket_register = async (token, node_id, name) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/bracket_register`, { token, node_id, name });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 上报一局赛事结果（服务端回放交叉校验后增量写回签表小分；未完成不记录）
 * @param {string} token
 * @param {string} node_id
 * @param {number} group_index
 * @param {number} replay_id
 * @return {Promise<{games: object[], wins: object, completed: boolean, winner_uuid: string} | void>}
 */
window.http_contest_match_report = async (token, node_id, group_index, replay_id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/match_report`, { token, node_id, group_index, replay_id });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 查询赛事规则
 * @return {Promise<{data: string, creator: string, updated_at: number} | undefined>}
 */
window.http_contest_rules_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/rules_query`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 更新赛事规则（仅管理员，保存后全服可见）
 * @param {string} token
 * @param {string} data
 * @return {Promise<boolean>}
 */
window.http_contest_rules_update = async (token, data) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/rules_update`, { token, data });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 查询报名页文案
 * @return {Promise<{data: string, creator: string, updated_at: number} | undefined>}
 */
window.http_contest_signup_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/signup_query`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 更新报名页文案（仅管理员，保存后全服可见）
 * @param {string} token
 * @param {string} data
 * @return {Promise<boolean>}
 */
window.http_contest_signup_update = async (token, data) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/contest/signup_update`, { token, data });
    return Boolean(rjson && rjson.status);
};


/**
 * @description: 好友心跳（更新在线时间，返回待处理申请数与最新对战邀请）
 * @param {string} token
 * @return {Promise<{requests: number, invite: object | null} | void>}
 */
window.http_friend_heartbeat = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/heartbeat`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 好友列表（好友 / 收到的申请 / 发出的申请 / 我的好友ID）
 * @param {string} token
 * @return {Promise<{friend_id: string, friends: object[], incoming: object[], outgoing: object[]} | void>}
 */
window.http_friend_list = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/list`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 按好友ID搜索用户
 * @param {string} token
 * @param {string} friend_id
 * @return {Promise<{friend_id: string, found: boolean, relation: string, uuid?: string, name?: string, avatar?: string} | void>}
 */
window.http_friend_search = async (token, friend_id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/search`, { token, friend_id });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 发送好友申请（对方已申请过我时直接成为好友）
 * @param {string} token
 * @param {string} friend_id
 * @return {Promise<{relation: string} | void>}
 */
window.http_friend_request = async (token, friend_id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/request`, { token, friend_id });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 接受好友申请
 * @param {string} token
 * @param {string} from
 * @return {Promise<boolean>}
 */
window.http_friend_accept = async (token, from) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/accept`, { token, from });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 拒绝好友申请
 * @param {string} token
 * @param {string} from
 * @return {Promise<boolean>}
 */
window.http_friend_reject = async (token, from) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/reject`, { token, from });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 删除好友
 * @param {string} token
 * @param {string} uuid
 * @return {Promise<boolean>}
 */
window.http_friend_remove = async (token, uuid) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/remove`, { token, uuid });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 邀请好友对战
 * @param {string} token
 * @param {string} uuid
 * @param {string} room
 * @return {Promise<boolean>}
 */
window.http_friend_challenge = async (token, uuid, room) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/challenge`, { token, uuid, room });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 清除对战邀请（接受或忽略后调用）
 * @param {string} token
 * @param {string} from
 * @return {Promise<boolean>}
 */
window.http_friend_invite_clear = async (token, from) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/invite_clear`, { token, from });
    return Boolean(rjson && rjson.status);
};


// 刷新凭证：主页/本地页/赛事页不自动弹窗或跳转，避免访问时反复提示登录
(async () => {
    const toast = new window.UiExports.ShToast();
    const path = location.pathname;
    const skip_auth_prompt = path === '/' || path.endsWith('/index.html') || path.includes('/pages/local/') || path.includes('/pages/mod/');

    const pid = setInterval(async () => {
        if (!window.loaded) return;
        clearInterval(pid);

        let result = true;
        try {
            const token = window.get_token();
            if (!token) return;

            result = await window.http_user_rtoken(token); // 无返回即过期
            result ? window.set_token(token) : localStorage.removeItem('token');
        } catch (_) {
            if (!skip_auth_prompt) toast.error('检查登录状态失败！');
        }

        if (!result) {
            if (skip_auth_prompt) return;
            toast.error('您的登录已过期！');
            await window.sleep(2000);
            window.location.replace('/');
        }
    }, 100);
})();