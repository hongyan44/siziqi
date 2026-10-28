/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事比赛
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');
const game_icon = document.getElementById('game_icon');


const main_app = document.getElementById('main_app');
const main_opt = document.getElementById('main_opt');
const main_game = document.getElementById('main_game');


const game_p1_name = document.getElementById('game_p1_name');
const game_p2_name = document.getElementById('game_p2_name');

const STORAGE_KEY_BRACKET = 'match_bracket_state_v2';

const select_server_region = document.getElementById('select_server_region');

const select_server_balance = document.getElementById('select_server_balance');
const select_server_mode = document.getElementById('select_server_mode');
const select_server_first = document.getElementById('select_server_first');
const select_server_color = document.getElementById('select_server_color');

const input_server_room = document.getElementById('input_server_room');
const input_server_archive = document.getElementById('input_server_archive');

const button_server_join = document.getElementById('button_server_join');


// 赛事 BO 系列赛 UI
const series_opt = document.getElementById('series_opt');
const series_bo_opt = document.getElementById('series_bo_opt');
const series_round_opt = document.getElementById('series_round_opt');
const series_score_opt = document.getElementById('series_score_opt');
const series_note_opt = document.getElementById('series_note_opt');

const series_game = document.getElementById('series_game');
const series_bo_game = document.getElementById('series_bo_game');
const series_round_game = document.getElementById('series_round_game');
const series_score_game = document.getElementById('series_score_game');

const series_end = document.getElementById('series_end');
const series_end_bo = document.getElementById('series_end_bo');
const series_end_score = document.getElementById('series_end_score');
const series_end_result = document.getElementById('series_end_result');


const dialog_tools = document.getElementById('dialog_tools');

const button_tools_restart = document.getElementById('button_tools_restart');
const button_tools_archive = document.getElementById('button_tools_archive');

const details_tools_observers = document.getElementById('details_tools_observers');
const details_tools_names = document.getElementById('details_tools_names');


const button_home = document.getElementById('button_home');


const ArchiveV0 = window.FAscendExports.ArchiveV0;

const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const Online = window.MainExports.Online;
const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const toast = new ShToast();

const { verify_foe_identity } = require('./contest-verify.cjs');
const { locate_pair_by_uuid, series_view, next_first_hand } = require('./contest-series.cjs');


// 赛事系列赛上下文（按 uuid 定位分组后填充）
let contest_ctx = null;




// 生成标签
(() => {
    for (let index = 0; index < 30; index++) {
        const element = document.createElement('sl-tag');
        element.setAttribute('size', 'small');
        element.classList.add('d-none');
        details_tools_names.append(element);
    }
})();

// 初始化界面数据缓存
(() => {
    const pid = setInterval(() => {
        if (!window.loaded) return;
        clearInterval(pid);

        const data = JSON.parse(localStorage.getItem('data'));
        select_server_region.value = data.server;
    }, 10);
})();




let game_ws, is_main = true;

/**
 * @description: 加入房间
 * @param {string} id
 * @param {string} server
 * @return {Promise<void>}
 */
const room_join = async (id, server) => {
    try {
        let status;

        const token = window.get_token();

        if (game_ws) game_ws.close();
        game_ws = new GameClient(`${window.ws_protocol}${server}/game/ws`);
        game_ws.connect();
        game_ws.reconnect();

        for await (const event of game_ws) {
            if (event.type === 'open') break;
            else if (event.type === 'error') throw Error('ws error');
        }

        game_ws.start_resend(GameMessage.room_create(id), 788, 0);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'room_create') {
            status = event.data.status;
            break;
        }
        game_ws.stop_resend(0);

        game_ws.start_resend(GameMessage.player_join(id, token), 788, 0);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'player_join') {
            status = event.data.status;
            break;
        }
        game_ws.stop_resend(0);

        if (status) {
            Online.setup(
                game_ws,
                token,
                id,
                input_server_archive.value,
                6,
                '',
                select_server_balance.value,
                select_server_mode.value,
                select_server_first.value,
                select_server_color.value,
                'contest'
            );
            Online.run();

            room_rejoin(id, token);
            room_foeex(id, token);
            game_ws.start_resend(GameMessage.player_heartbeat(id, token), 5000, 1000);

            toast.success('加入房间成功！');
            window.switch_wection(main_game, main_opt);
            is_main = false;
            button_home.classList.add('d-none');

            // 赛事对手校验：报名抽签系统中期望的对手 vs 实际对手
            verify_foe(token);

        } else toast.error('房间的玩家已经到齐，已锁定！');

    } catch (_) {
        if (game_ws) game_ws.close();
        console.error(_);
        toast.error('请求失败！');
    }
};

/**
 * @description: 重新加入房间
 * @param {string} id
 * @param {string} token
 * @return {Promise<void>}
 */
const room_rejoin = async (id, token) => {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;

        game_ws.start_resend(GameMessage.player_join(id, token), 788, 1009);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'player_join') break;
        game_ws.stop_resend(1009);
    });

    for await (const event of game_ws) {
        if (event.type !== 'error') continue;

        game_ws.start_resend(GameMessage.player_join(id, token), 788, 1001);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'player_join') break;
        game_ws.stop_resend(1001);
    }
};

/**
 * @description: 对方心跳检测
 * @param {string} id
 * @param {string} token
 * @return {Promise<void>}
 */
const room_foeex = async (id, token) => {
    while (true) {
        await window.sleep(5000);
        if (game_p1_name.innerText === '' || game_p1_name.innerText === '?') continue;

        game_ws.start_resend(GameMessage.room_foeex(id, token), 1000, 1002);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'room_foeex') break;
        game_ws.stop_resend(1002);
    }
};

/**
 * @description: 校验赛事对手是否与抽签系统一致
 * @param {string} token
 * @return {Promise<void>}
 */
const verify_foe = async (token) => {
    try {
        // 等对方加入（online.cjs 会把对方名字写到 game_p2_name，双方 uuid 在对局握手后就绪）
        for (let i = 0; i < 60; i++) {
            await window.sleep(1000);
            const foe = game_p2_name.innerText.trim();
            if (foe && foe !== '?') {
                await check_foe_match(token);
                return;
            }
        }
    } catch (_) {
        console.error(_);
    }
};

const check_foe_match = async (token) => {
    const info = await window.http_user_info(token);
    const myName = info && info.name;
    const myUuid = info && info.uuid;
    if (!myName) return;

    // 读服务端签表（全服统一）
    const remote = await window.http_contest_bracket_query();
    const dataStr = remote && remote.data ? remote.data : localStorage.getItem(STORAGE_KEY_BRACKET);
    if (!dataStr) return;

    let saved;
    try { saved = JSON.parse(dataStr); } catch (_) { return; }
    if (!saved || !Array.isArray(saved.nodes)) return;

    const foeName = game_p2_name.innerText.trim();
    const foeUuid = typeof Online.foe_uuid === 'function' ? Online.foe_uuid() : '';
    if (!foeName) return;

    const { ok, reason } = verify_foe_identity({
        bracket: saved,
        my_name: myName,
        my_uuid: myUuid,
        foe_name: foeName,
        foe_uuid: foeUuid
    });
    if (ok) return;

    // 校验失败：禁止继续，隐藏游戏界面，弹回操作界面
    if (reason === 'foe-mismatch') toast.error(`对手不匹配！请移步房间号对战`);
    else toast.error(`对战身份校验失败！请移步房间号对战`);
    is_main = true;
    button_home.classList.remove('d-none');
    window.switch_wection(main_opt, main_game);
    if (game_ws) game_ws.close();
};


/**
 * @description: 用签表节点刷新系列赛上下文（小分/完成/下一局）
 * @param {object} node 签表节点
 * @return {void}
 */
const refresh_series_from_node = (node) => {
    const view = series_view({
        node,
        group_index: contest_ctx.group_index,
        my_uuid: contest_ctx.my_uuid,
        foe_uuid: contest_ctx.foe_uuid
    });
    contest_ctx.node = node;
    contest_ctx.bo = view.bo;
    contest_ctx.target = view.target;
    contest_ctx.mine = view.mine;
    contest_ctx.foe = view.foe;
    contest_ctx.next_index = view.next_index;
    // 先手轮换所需：签表配置与已完赛记录（含每局先手方）
    contest_ctx.rotate = node.rotate;
    contest_ctx.games = view.games;
};

/**
 * @description: 渲染系列赛比分（报名前卡片 + 对局中条）
 * @return {void}
 */
const render_series = () => {
    if (!contest_ctx) return;

    const bo = contest_ctx.bo;
    const score = `${contest_ctx.mine} : ${contest_ctx.foe}`;
    const round_text = `第 ${contest_ctx.next_index} 局`;

    series_opt.classList.add('show');
    series_bo_opt.textContent = `BO${bo}`;
    series_round_opt.textContent = round_text;
    series_score_opt.textContent = score;
    series_note_opt.textContent = `我方 ${contest_ctx.my_name} vs 对方 ${contest_ctx.foe_name}（先赢 ${contest_ctx.target} 局者胜）`;

    series_game.classList.add('show');
    series_bo_game.textContent = `BO${bo}`;
    series_round_game.textContent = round_text;
    series_score_game.textContent = score;
};

/**
 * @description: 渲染对局结算里的系列赛总比分
 * @return {void}
 */
const render_series_end = () => {
    if (!contest_ctx) return;

    series_end.classList.add('show');
    series_end_bo.textContent = `BO${contest_ctx.bo}`;
    series_end_score.textContent = `${contest_ctx.mine} : ${contest_ctx.foe}`;
    series_end_result.textContent = `下一局为第 ${contest_ctx.next_index} 局`;
};

/**
 * @description: 按“先手轮换”配置推导本局先手，并预置到先手选择框
 *   第 1 局随机；第 2 局起与上一局实际先手交换（依据签表记录，双方一致）。
 *   结果只与局号和记录有关，因此无论从表单重新加入还是点重赛开新局都一致。
 *   仅预置默认值，不锁定选择框。
 * @return {void}
 */
const apply_next_first = () => {
    if (!contest_ctx) return;

    const value = next_first_hand({
        rotate: contest_ctx.rotate,
        index: contest_ctx.next_index,
        my_uuid: contest_ctx.my_uuid,
        foe_uuid: contest_ctx.foe_uuid,
        games: contest_ctx.games
    });

    select_server_first.value = value;
};

/**
 * @description: 读取服务端签表并按 uuid 定位本组，刷新系列赛上下文
 * @return {Promise<boolean>} 是否定位到本组
 */
const sync_contest = async () => {
    try {
        const token = window.get_token();
        if (!token) return false;

        const info = await window.http_user_info(token);
        if (!info || !info.uuid) return false;

        const remote = await window.http_contest_bracket_query();
        const dataStr = remote && remote.data ? remote.data : localStorage.getItem(STORAGE_KEY_BRACKET);
        if (!dataStr) return false;

        let bracket;
        try { bracket = JSON.parse(dataStr); } catch (_) { return false; }

        const located = locate_pair_by_uuid(bracket, info.uuid);
        if (!located || !located.foe_uuid) return false;

        contest_ctx = {
            node_id: located.node.id,
            group_index: located.group_index,
            my_uuid: info.uuid,
            my_name: info.name,
            foe_name: located.foe_name,
            foe_uuid: located.foe_uuid
        };
        refresh_series_from_node(located.node);
        render_series();
        // 依局号与签表记录预置本局先手（第 1 局随机，之后逐局交换）
        apply_next_first();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

/**
 * @description: 每局结束回调：完成对战才上报，服务端回放校验后增量写回签表小分
 * @param {object} payload 由 online.cjs 提供
 * @return {Promise<void>}
 */
// 上报链路串行化：保证“立即重赛”读取签表前，上一局的上报已经落库
let end_report_chain = Promise.resolve();

const handle_contest_end = (payload) => {
    const task = async () => {
        if (!contest_ctx) return;
        // 未完成对战（对方离开 / 未分胜负）不记录
        if (!payload || !payload.win || !payload.replay_id) return;

        const token = window.get_token();
        if (!token) return;

        const result = await window.http_contest_match_report(token, contest_ctx.node_id, contest_ctx.group_index, payload.replay_id);
        if (!result) return;

        contest_ctx.mine = Number(result.wins && result.wins[contest_ctx.my_uuid]) || 0;
        contest_ctx.foe = Number(result.wins && result.wins[contest_ctx.foe_uuid]) || 0;
        contest_ctx.next_index = contest_ctx.mine + contest_ctx.foe + 1;
        // 用回放交叉校验后的最新记录刷新先手轮换依据（含本局先手方）
        if (Array.isArray(result.games)) contest_ctx.games = result.games;

        render_series();
        render_series_end();
        // 依局号与记录预置下一局先手（与重赛按钮的交换结果一致）
        apply_next_first();

        // 本组 BO 已分出胜负：按最新签表重新定位，晋级后可直接确认下一轮的对手并开赛
        const completed = contest_ctx.mine >= contest_ctx.target || contest_ctx.foe >= contest_ctx.target;
        if (completed) await sync_contest();
    };

    end_report_chain = end_report_chain.then(task, task);
    return end_report_chain;
};


/**
 * @description: 得到所有观战者
 * @param {string} id
 * @return {Promise<void>}
 */
const room_getsub = async (id) => {
    try {
        let status, result;

        // 观战请求
        game_ws.start_resend(GameMessage.room_observers(id), 1000, 6);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'room_observers') {
            status = event.data.status;
            result = event.data.result;
            break;
        }
        game_ws.stop_resend(6);
        if (!status) return;
        const names_ = result;

        // 筛选
        const names = [];
        names_.forEach((name) => name && names.push(name));

        // 排序
        names.sort((a, b) => window.name_length(b) - window.name_length(a));

        // 隐藏
        const elements = Array.from(details_tools_names.children)
        elements.forEach((el) => el.classList.add('d-none'));

        // 替换
        details_tools_observers.setAttribute('summary', `当前观战 ${names.length}人`);

        names.forEach((name, index) => {
            const element = elements[index];
            element.innerText = name;
            element.classList.remove('d-none');
        });

    } catch (_) {
        console.error(_)
        details_tools_observers.setAttribute('summary', '当前观战 加载失败');
    }
};




// 房间号限制
input_server_room.addEventListener('sl-input', (event) => {
    if (event.target !== input_server_room) return;

    const value = input_server_room.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
    input_server_room.value = value;
});

// 加入房间
button_server_join.addEventListener('pointerdown', async (event) => {
    if (event.target !== button_server_join) return;

    const server = select_server_region.value;
    const room = input_server_room.value;
    const archive = input_server_archive.value;

    if (!server) return toast.error('请先选择服务器！');
    else if (room.length !== 6) return toast.error('非法房间号！');
    else if (archive !== '' && !ArchiveV0.load(BaseZalgo.decode(archive))) return toast.error('非法对局存档！');

    // 按服务端签表刷新系列赛状态，避免本地滞后
    await sync_contest();

    localStorage.setItem('data', JSON.stringify({ server }));

    window.sleep_task(
        [
            select_server_region,
            input_server_room,
            input_server_archive,
            select_server_balance,
            select_server_color,
            select_server_first,
            select_server_mode
        ],
        button_server_join,
        async () => room_join(room, server)
    );
});

// 回车
input_server_room.addEventListener('keydown', (event) => {
    if (event.target !== input_server_room) return;

    if (event.key === 'Enter') button_server_join.dispatchEvent(new PointerEvent('pointerdown'));
});


// 功能面板
game_msg.addEventListener('pointerdown', (event) => {
    if (event.target !== game_msg || is_main) return;

    window.sleep_task(
        [details_tools_observers],
        null,
        async () => room_getsub(input_server_room.value)
    );

    details_tools_observers.setAttribute('summary', '当前观战 加载中...');
    details_tools_observers.open = false;

    dialog_tools.classList.remove('d-none');
    dialog_tools.show();
});


// 赛事系列赛：注册每局结局回调，并在页面加载后读取签表上下文
if (typeof Online.on_end === 'function') Online.on_end(handle_contest_end);

window.addEventListener('load', () => {
    sync_contest();
});