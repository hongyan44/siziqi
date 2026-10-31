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

// 联机域名必须跟随当前线路：国际线路 glb.siziqi.net 走 online.glb.siziqi.net。
// 旧实现写死 online.siziqi.net，导致国际线路的每一笔请求都回源国内节点，延迟高且频繁超时。
const resolve_api_host = () => {
    const host = (location.hostname || '').toLowerCase();
    if (local_api_hosts.has(host)) return `${host}:50001`;
    if (!host || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return public_api_host;

    const base = host.replace(/^www\./, '');
    if (base.startsWith('online.')) return base;

    // 仅映射已部署的线路域名，未知域名仍回退到默认节点，避免解析到不存在的联机域名。
    const is_line = base === 'siziqi.net' || base.endsWith('.siziqi.net') || base === 'siziqi.cc.cd' || base.endsWith('.siziqi.cc.cd');
    return is_line ? `online.${base}` : public_api_host;
};
window.online_api = resolve_api_host();


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
 * @description: 使用一张 3000 棋币兑换券（背包内使用，成功时增加 3000 棋币）
 * @param {string} token
 * @return {Promise<{ok: boolean, reason: string, coin: number, vouchers: number} | void>}
 */
window.http_user_voucher_use = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/voucher_use`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 使用一张 500 棋币兑换券（背包内使用，成功时增加 500 棋币）
 * @param {string} token
 * @return {Promise<{ok: boolean, reason: string, coin: number, vouchers_500: number} | void>}
 */
window.http_user_voucher_500_use = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/voucher_500_use`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 赠送好友赠礼（扣减自己 1 个，好友背包增加 1 张 500 棋币兑换券）
 * @param {string} token
 * @param {string} uuid 好友标识
 * @return {Promise<{ok: boolean, reason: string, gift_vouchers: number} | void>}
 */
window.http_user_voucher_gift_send = async (token, uuid) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/voucher_gift_send`, { token, uuid });
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
 * @description: 首次通关领奖（关卡或每日挑战，服务端保证只发一次 50 经验 + 50 棋币）
 * @param {string} token
 * @param {'daily'|'level'} target
 * @param {number} level 仅 target 为 level 时需要
 * @return {Promise<{first: boolean, coin: number, exp: number} | void>}
 */
window.http_puzzle_claim_clear = async (token, target, level = 0) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/claim_clear`, { token, target, level });
    if (!rjson || !rjson.status) return;
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
 * @description: 提交残局投稿（权限等级 ≥ 2；target 为 daily 或 level）
 * @param {string} token
 * @param {'daily'|'level'} target
 * @param {number} level 仅 target 为 level 时需要
 * @param {string} title
 * @param {string} code
 * @return {Promise<{id: number, ticket_used: boolean, tickets?: number, task_reward: number} | void>}
 */
window.http_puzzle_submit = async (token, target, level, title, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/submit`, { token, target, level, title, code });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 查询残局投稿（等级 2 看自己的投稿；等级 ≥ 3 可看全部待审核投稿）
 * @param {string} token
 * @return {Promise<{can_review: boolean, submissions: object[]} | void>}
 */
window.http_puzzle_submission_query = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/submission_query`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 审核前修改投稿（权限等级 ≥ 3；仅待审核投稿可改）
 * @param {string} token
 * @param {number} id
 * @param {'daily'|'level'} target
 * @param {number} level 仅 target 为 level 时需要
 * @param {string} title
 * @param {string} code
 * @return {Promise<boolean>}
 */
window.http_puzzle_submission_update = async (token, id, target, level, title, code) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/submission_update`, { token, id, target, level, title, code });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 审核残局投稿（权限等级 ≥ 3；action 为 approve 或 reject）
 * @param {string} token
 * @param {number} id
 * @param {'approve'|'reject'} action
 * @return {Promise<boolean>}
 */
window.http_puzzle_submission_review = async (token, id, action) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/puzzle/submission_review`, { token, id, action });
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
 * @description: 设置对战昵称颜色（等级 ≥ 2 可用单色；等级 ≥ 3 可用彩色渐变；等级 4 可用流动彩虹 'rainbow'；传空字符串清除）
 * @param {string} token
 * @param {string} color
 * @return {Promise<boolean>}
 */
window.http_user_set_color = async (token, color) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/set_color`, { token, color });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 批量查询用户昵称颜色（公开接口，用于对战界面渲染双方昵称颜色）
 * @param {string[]} uuids
 * @return {Promise<Array<{uuid: string, color: string, level: number}>>}
 */
window.http_user_colors = async (uuids) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/colors`, { uuids: uuids || [] });
    if (!rjson || !rjson.status || !Array.isArray(rjson.result)) return [];
    return rjson.result;
};

/**
 * @description: 玩家公开资料（昵称/头像/等级/最近登录/真实对局与近100场胜率/AI 场次/展示成就）
 * @param {string} uuid
 * @param {Uint8Array | null} [token] 可选，携带时附带与查看者的好友关系
 * @return {Promise<Object | undefined>}
 */
window.http_user_profile = async (uuid, token = null) => {
    const params = token ? { uuid, token } : { uuid };
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/profile`, params);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 同步玩家展示数据（AI 对局场次 / 展示的成就，最多 3 个）
 * @param {string} token
 * @param {number | null} ai_games
 * @param {string[] | null} showcase
 * @return {Promise<{ai_games: number, showcase: string[]} | undefined>}
 */
window.http_user_stats_update = async (token, ai_games = null, showcase = null) => {
    const params = { token };
    if (typeof ai_games === 'number') params.ai_games = ai_games;
    if (Array.isArray(showcase)) params.showcase = showcase.slice(0, 3);
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/stats`, params);
    if (!rjson || !rjson.status) return;
    return rjson.result;
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
 * @description: 商店购买（权限码 level2 / level3 与皮肤 piece / piece_rouge / grass / board）
 * @param {string} token
 * @param {'level2'|'level3'|'piece'|'piece_rouge'|'grass'|'grass_gold'|'grass_jade'|'board'|'board_gold'} item
 * @return {Promise<{ok: boolean, reason: string, level: number, coin: number, exp_level: number, exp_cur: number, exp_need: number, skins: string[]} | void>}
 */
window.http_shop_buy = async (token, item) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/user/shop_buy`, { token, item });
    if (!rjson || !rjson.status) return;
    return rjson.result;
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
 * @return {Promise<{id?: number, reward?: number} | void>} id 为回放 ID，reward 为本局结算的棋币
 */
window.http_replay_update = async (token, opponent, data, meta = {}) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/replay/update`, {
        token,
        opponent,
        data,
        ...meta
    });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 人机对战结算（仅登录玩家；不足 1 分钟胜方 20 / 败方 1，其余按对局时长标准值发放，胜方双倍、向上取整）
 * @param {string} token
 * @param {number} duration 对局时长（秒）
 * @param {boolean} win 玩家是否获胜
 * @param {number} time 本局开局时间（毫秒，用于同一局结算去重）
 * @param {number} difficulty AI 难度选项（'0' 入门，'1' 及以上为简单及以上难度）
 * @return {Promise<{reward: number, exp_reward: number, task_reward: number, coin: number, exp: number, exp_level: number, exp_cur: number, exp_need: number} | void>}
 */
window.http_ai_reward = async (token, duration, win, time = 0, difficulty = 0) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/replay/ai_reward`, {
        token,
        duration: Math.max(0, Math.trunc(Number(duration) || 0)),
        win: win ? 1 : 0,
        time: Math.max(0, Math.trunc(Number(time) || 0)),
        difficulty: Math.max(0, Math.trunc(Number(difficulty) || 0)),
    });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 查询每日任务（首次访问自动生成 3 个多人 + 2 个单人 + 1 个投稿任务，每天 0 点刷新）
 * @param {string} token
 * @return {Promise<{day: number, done_count: number, claimable_count: number, refresh_count: number, free_refresh: number, refresh_cost: number, tasks: Array<{id: string, kind: string, title: string, target: number, progress: number, reward: number, done: boolean, claimed: boolean}>} | void>}
 */
window.http_task_query = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/task/query`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 刷新指定的未完成任务（前 2 次免费，之后每次 50 棋币；投稿任务与已完成任务不可刷新）
 * @param {string} token
 * @param {string} id 目标任务 id
 * @return {Promise<{ok: boolean, reason: string, cost: number, coin: number, refresh_count: number, free_refresh: number, refresh_cost: number, done_count: number, claimable_count: number, tasks: object[]} | void>}
 */
window.http_task_refresh = async (token, id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/task/refresh`, { token, id });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 领取指定已完成任务的奖励（棋币 + 等额经验，同一任务只能领取一次）
 * @param {string} token
 * @param {string} id 目标任务 id
 * @return {Promise<{ok: boolean, reason: string, reward: number, coin: number, done_count: number, claimable_count: number, tasks: object[]} | void>}
 */
window.http_task_claim = async (token, id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/task/claim`, { token, id });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 观战任务上报（成功加入观战房间时调用）
 * @param {string} token
 * @return {Promise<{task_reward: number} | void>}
 */
window.http_task_spectate = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/task/spectate`, { token });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


/**
 * @description: 查询当前全服消息（公开接口，无消息时返回空）
 * @return {Promise<{notice: {id: number, title: string, content: string, created_at: number} | null} | void>}
 */
window.http_notice_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/notice/query`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 发布全服消息（仅管理员 level=4；旧消息自动失效）
 * @param {string} token
 * @param {string} title
 * @param {string} content
 * @return {Promise<boolean>}
 */
window.http_notice_publish = async (token, title, content) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/notice/publish`, { token, title, content });
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 清除全服消息（仅管理员 level=4）
 * @param {string} token
 * @return {Promise<boolean>}
 */
window.http_notice_clear = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/notice/clear`, { token });
    return Boolean(rjson && rjson.status);
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
 * @description: 查询文档内容（游戏规则 / 使用手册）
 * @param {string} key 'rule' | 'tip'
 * @return {Promise<{data: string, creator: string, updated_at: number} | undefined>}
 */
window.http_docs_query = async (key) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/docs/query`, { key });
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 更新文档内容（仅管理员，保存后全服可见）
 * @param {string} token
 * @param {string} key 'rule' | 'tip'
 * @param {string} data
 * @return {Promise<boolean>}
 */
window.http_docs_update = async (token, key, data) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/docs/update`, { token, key, data });
    return Boolean(rjson && rjson.status);
};


/**
 * @description: 查询剧情角色与表情（公开接口，图片为 data URL）
 * @return {Promise<{characters: {id: number, name: string, rep: string, expressions: {id: number, name: string, image: string}[]}[]} | void>}
 */
window.http_story_character_query = async () => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_query`, {});
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 新增剧情角色（仅管理员，图片为 data URL）
 * @param {string} token
 * @param {string} name 角色名
 * @param {string} image 代表图 data URL
 * @return {Promise<{id: number} | void>}
 */
window.http_story_character_add = async (token, name, image) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_update`, { token, action: 'character', name, image }, 60000);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 更换剧情角色代表图（仅管理员，图片为 data URL）
 * @param {string} token
 * @param {number} character_id
 * @param {string} image 新代表图 data URL
 * @return {Promise<{id: number} | void>}
 */
window.http_story_character_update_rep = async (token, character_id, image) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_update`, { token, action: 'update_rep', character_id, image }, 60000);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 删除剧情角色及其全部表情（仅管理员，不可恢复）
 * @param {string} token
 * @param {number} character_id
 * @return {Promise<{id: number} | void>}
 */
window.http_story_character_delete = async (token, character_id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_update`, { token, action: 'delete', character_id }, 60000);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 为角色新增表情（仅管理员，图片为 data URL）
 * @param {string} token
 * @param {number} character_id
 * @param {string} name 表情名
 * @param {string} image 表情图 data URL
 * @return {Promise<{id: number} | void>}
 */
window.http_story_expression_add = async (token, character_id, name, image) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_update`, { token, action: 'expression', character_id, name, image }, 60000);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 删除角色的单个表情（仅管理员，不可恢复）
 * @param {string} token
 * @param {number} character_id
 * @param {number} expression_id
 * @return {Promise<{id: number} | void>}
 */
window.http_story_expression_delete = async (token, character_id, expression_id) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/story/character_update`, { token, action: 'delete_expression', character_id, expression_id }, 60000);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};


// 好友接口超时：跨线路/跨境网络握手与重传开销大，默认 5s 会让心跳与接受申请被客户端主动中断（nginx 499）。
const FRIEND_TIMEOUT = 12000;
// 长轮询：服务端最多挂起 3s，客户端留足网络余量。
const FRIEND_WAIT_TIMEOUT = 15000;

/**
 * @description: 好友心跳（更新在线时间，返回待处理申请数与最新对战邀请）
 * @param {string} token
 * @return {Promise<{requests: number, invite: object | null} | void>}
 */
window.http_friend_heartbeat = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/heartbeat`, { token }, FRIEND_TIMEOUT);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 好友长轮询（带版本号，服务端有变更立即返回，否则挂起至多约 3 秒）
 * @param {string} token
 * @param {number} version 客户端已知的变更版本号
 * @return {Promise<{version: number, requests: number, invite: object | null} | void>}
 */
window.http_friend_wait = async (token, version) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/wait`, { token, version: String(version || 0) }, FRIEND_WAIT_TIMEOUT);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 好友列表（好友 / 收到的申请 / 发出的申请 / 我的好友ID）
 * @param {string} token
 * @return {Promise<{friend_id: string, friends: object[], incoming: object[], outgoing: object[]} | void>}
 */
window.http_friend_list = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/list`, { token }, FRIEND_TIMEOUT);
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
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/search`, { token, friend_id }, FRIEND_TIMEOUT);
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
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/request`, { token, friend_id }, FRIEND_TIMEOUT);
    if (!rjson || !rjson.status) return;
    return rjson.result;
};

/**
 * @description: 查询全部在线玩家（仅权限等级 4 管理员可用）
 * @param {string} token
 * @return {Promise<{uuid: string, players: object[]} | void>}
 */
window.http_friend_online = async (token) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/online`, { token }, FRIEND_TIMEOUT);
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
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/accept`, { token, from }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 拒绝好友申请
 * @param {string} token
 * @param {string} from
 * @return {Promise<boolean>}
 */
window.http_friend_reject = async (token, from) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/reject`, { token, from }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 保存好友申请设置（deny 不允许申请 / manual 需要同意 / auto 自动同意）
 * @param {string} token
 * @param {string} mode
 * @return {Promise<boolean>}
 */
window.http_friend_settings = async (token, mode) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/settings`, { token, mode }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 删除好友
 * @param {string} token
 * @param {string} uuid
 * @return {Promise<boolean>}
 */
window.http_friend_remove = async (token, uuid) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/remove`, { token, uuid }, FRIEND_TIMEOUT);
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
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/challenge`, { token, uuid, room }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 清除对战邀请（接受或忽略后调用）
 * @param {string} token
 * @param {string} from
 * @return {Promise<boolean>}
 */
window.http_friend_invite_clear = async (token, from) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/invite_clear`, { token, from }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 给好友发送私信（仅好友之间可发）
 * @param {string} token
 * @param {string} uuid 好友标识
 * @param {string} content 私信内容
 * @return {Promise<boolean>}
 */
window.http_friend_message_send = async (token, uuid, content) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/message_send`, { token, uuid, content }, FRIEND_TIMEOUT);
    return Boolean(rjson && rjson.status);
};

/**
 * @description: 拉取与好友的会话记录（打开即标记对方来信为已读）
 * @param {string} token
 * @param {string} uuid 好友标识
 * @return {Promise<{messages: Array<{mine: boolean, content: string, created_at: number}>, unread: number} | void>}
 */
window.http_friend_message_list = async (token, uuid) => {
    const rjson = await window.fetch_task(`${window.http_protocol}${window.online_api}/friend/message_list`, { token, uuid }, FRIEND_TIMEOUT);
    if (!rjson || !rjson.status) return;
    return rjson.result;
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