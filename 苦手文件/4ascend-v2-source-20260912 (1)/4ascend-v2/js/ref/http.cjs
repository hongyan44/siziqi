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
window.online_api = local_api_hosts.has(location.hostname) ? `${location.hostname}:50001` : `online.${location.host}`;


/**
 * @description: 查询是否注册
 * @param {string} mail
 * @return {Promise<boolean>}
 */
window.http_user_exist = async (mail) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/exist`, { mail });
    return rjson.status;
};

/**
 * @description: 发送邮箱验证码
 * @param {string} mail
 * @return {Promise<boolean>}
 */
window.http_user_sms = async (mail) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/sms`, { mail });
    return rjson.status;
};

/**
 * @description: 邮箱注册
 * @param {string} mail
 * @param {string} code
 * @return {Promise<string | void>}
 */
window.http_user_register = async (mail, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/register`, { mail, code });
    if (!rjson.status) return;
    return rjson.result;
};

/**
 * @description: 邮箱登录
 * @param {string} mail
 * @param {string} code
 * @return {Promise<string | void>}
 */
window.http_user_login = async (mail, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/login`, { mail, code });
    if (!rjson.status) return;
    return rjson.result;
};

/**
 * @description: 得到用户信息
 * @param {string} token
 * @return {Promise<{'name': string, 'avatar': string, 'time': number, 'mail': string} | void>}
 */
window.http_user_info = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/info`, { token });
    if (!rjson.status) return;
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
    return rjson.status;
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
    if (!rjson.status) return;
    return rjson.result;
};


/**
 * @description: 创建房间
 * @param {string} id
 * @return {Promise<boolean>}
 */
window.http_room_create = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_create`, { id });
    return rjson.status;
};

/**
 * @description: 房间是否存在
 * @param {string} id
 * @return {Promise<boolean>}
 */
window.http_room_exist = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_exist`, { id });
    return rjson.status;
};

/**
 * @description: 查询所有房间信息
 * @return {Promise<{'id': string, 'exp': number, 'name1': string, 'name2': string}>}
 */
window.http_room_getall = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_getall`, {});
    if (!rjson.status) return [];
    return rjson.result;
};

/**
 * @description: 得到所有观战者的名字
 * @param {string} id
 * @return {Promise<string[]>}
 */
window.http_room_getsub = async (id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/room_getsub`, { id });
    if (!rjson.status) return [];
    return rjson.result;
};


/**
 * @description: 查询随机匹配玩家池人数
 * @return {Promise<number>}
 */
window.http_rand_getall = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/game/rand_getall`, {});
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
    if (!rjson.status) return;
    return rjson.result;
};

/**
 * @description: 秒时间戳
 * @return {Promise<number>}
 */
window.http_time_s = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/time/s`, {});
    if (!rjson.status) return;
    return rjson.result;
};


// 刷新凭证：主页/本地页不自动弹窗或跳转，避免访问主页时反复提示登录
(async () => {
    const toast = new window.UiExports.ShToast();
    const path = location.pathname;
    const skip_auth_prompt = path === '/' || path.endsWith('/index.html') || path.includes('/pages/local/');

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