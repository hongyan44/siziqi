/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 在线对局
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');
const game_icon = document.getElementById('game_icon');


const main_app = document.getElementById('main_app');
const main_opt = document.getElementById('main_opt');
const main_game = document.getElementById('main_game');


const game_p1_name = document.getElementById('game_p1_name');


const select_server_region = document.getElementById('select_server_region');

const button_server_join = document.getElementById('button_server_join');


const dialog_tools = document.getElementById('dialog_tools');

const button_tools_restart = document.getElementById('button_tools_restart');
const button_tools_archive = document.getElementById('button_tools_archive');

const details_tools_observers = document.getElementById('details_tools_observers');
const details_tools_names = document.getElementById('details_tools_names');


const dialog_leaderboard = document.getElementById('dialog_leaderboard');

const my_ranking_box = document.getElementById('my_ranking_box');
const my_score_val = document.getElementById('my_score_val');
const my_rank_val = document.getElementById('my_rank_val');
const leaderboard_list = document.getElementById('leaderboard_list');


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



let game_ws, game_sound, room;
let is_main = true;

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

// 初始化音频
(() => {
    const opt = JSON.parse(localStorage.getItem('opt'));
    if (!opt) return;
    game_sound = new GameSound(
        parseFloat(opt.bgmv),
        parseFloat(opt.stonev),
        parseFloat(opt.plantv),
        parseFloat(opt.matchv),
        parseFloat(opt.tickv),
        parseFloat(opt.tickv),
        parseFloat(opt.annihilationv),
        parseFloat(opt.hitv),
        parseFloat(opt.orbitv),
        parseFloat(opt.flyv),
    );
})();

// 初始化连接
(() => {
    game_ws = new GameClient(`${window.ws_protocol}${window.online_api}/game/ws`);
    game_ws.connect();
    game_ws.reconnect();
})();

// 对话框防误触关闭
(() => {
    dialog_leaderboard.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
})();




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
                '',
                6,
                '',
                'ncg',
                'normal',
                'rand',
                'rand',
            );
            Online.run();
            is_main = false;

            room_rejoin(id, token);
            game_ws.start_resend(GameMessage.player_heartbeat(id, token), 5000, 1000);

            // toast.success('随机匹配成功！');
            window.switch_wection(main_game, main_opt);
            button_home.classList.add('d-none');

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
    const handler = async () => {
        if (is_main) document.removeEventListener('visibilitychange', handler);
        if (document.visibilityState !== 'visible') return;

        game_ws.start_resend(GameMessage.player_join(id, token), 788, 1009);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'player_join') break;
        game_ws.stop_resend(1009);
    };
    document.addEventListener('visibilitychange', handler);

    for await (const event of game_ws) {
        if (is_main) {
            document.removeEventListener('visibilitychange', handler);
            break;
        }
        if (event.type !== 'error') continue;

        game_ws.start_resend(GameMessage.player_join(id, token), 788, 1001);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'player_join') break;
        game_ws.stop_resend(1001);
    }
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

/**
 * @description: 得到积分排行榜
 * @param {string} token
 * @return {Promise<void>}
 */
const ranked_leaderboard = async (token) => {
    try {
        let status, result;

        // 观战请求
        game_ws.start_resend(GameMessage.ranked_leaderboard(token), 1000, 3333);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_leaderboard') {
            status = event.data.status;
            result = event.data.result;
            break;
        }
        game_ws.stop_resend(3333);
        if (!status) throw Error('ranked_leaderboard error');

        const leaderboard = result.leaderboard;
        const my = result.my;
        // console.log(result);

        render_leaderboard(leaderboard, my);

        // 替换
        dialog_leaderboard.setAttribute('label', `积分排行榜 ${leaderboard.length}人`);
    } catch (_) {
        console.error(_);
        dialog_leaderboard.setAttribute('label', '积分排行榜 加载失败');
    }
};

/**
 * @description: 绘制排行榜
 * @param {Array} data
 * @param {string|number} my_id
 * @return {void}
 */
const render_leaderboard = (data, my_id) => {
    const sorted_data = [...data].sort((a, b) => b.score - a.score);

    let my_rank_ext = '未上榜';
    let my_score_text = '-';

    // 昵称颜色批量着色（uuid → 昵称节点）
    const color_pairs = [];

    leaderboard_list.innerHTML = '';

    sorted_data.forEach((player, index) => {
        const rank = index + 1;
        const is_me = (player.id === my_id);

        if (is_me) {
            my_rank_ext = `第 ${rank} 名`;
            my_score_text = `${player.score}`;
        }

        // 1. 确定排名显示图形（前三名奖牌，其余数字）
        let rankDisplay = rank;
        if (rank === 1) rankDisplay = "🥇";
        else if (rank === 2) rankDisplay = "🥈";
        else if (rank === 3) rankDisplay = "🥉";

        // 2. 根据排名和身份动态计算样式
        let rowClass = "bg-light border-light"; // 默认普通人
        let rankStyle = "text-secondary";      // 默认普通排名颜色

        if (rank === 1) {
            rowClass = "bg-warning bg-opacity-10 border-warning-subtle";
            rankStyle = "text-warning fw-bold fs-5";
        } else if (rank === 2) {
            rowClass = "bg-secondary bg-opacity-10 border-secondary-subtle";
            rankStyle = "text-secondary fw-bold fs-5";
        } else if (rank === 3) {
            rowClass = "bg-danger bg-opacity-10 border-danger-subtle";
            rankStyle = "text-danger fw-bold fs-5";
        }

        // 如果是“我”，覆盖或叠加样式（保留前三名奖牌的同时，应用“我”的高亮背景）
        if (is_me) {
            rowClass = "bg-primary bg-opacity-10 border-primary fw-bold shadow-sm";
            rankStyle = rank <= 3 ? rankStyle : "text-primary fw-bold"; // 前三名保留前三名颜色，其余用蓝色
        }

        // 3. 构建单行（文本一律走 textContent，避免昵称注入）
        const row = document.createElement('div');
        row.className = `d-flex justify-content-between align-items-center p-2 px-3 rounded-2 border ${rowClass}`;

        const left = document.createElement('div');
        left.className = 'd-flex align-items-center gap-3';

        const rank_node = document.createElement('div');
        rank_node.className = `text-center ${rankStyle}`;
        rank_node.style.width = '32px';
        rank_node.textContent = rankDisplay;

        const avatar_node = document.createElement('sl-avatar');
        avatar_node.style.setProperty('--size', '1.75rem');
        if (player.avatar) avatar_node.setAttribute('image', player.avatar);
        else avatar_node.setAttribute('initials', String(player.name || '?').slice(0, 1).toUpperCase());

        const name_wrap = document.createElement('div');
        name_wrap.className = 'text-dark d-flex align-items-center gap-2';

        const name_node = document.createElement('span');
        name_node.className = 'leaderboard-name fw-semibold';
        name_node.title = '查看玩家资料';
        name_node.textContent = player.name || '无名氏';
        if (player.uuid) {
            name_node.addEventListener('click', () => {
                if (typeof window.player_profile_open === 'function') window.player_profile_open(player.uuid);
            });
            color_pairs.push({ 'uuid': player.uuid, 'node': name_node });
        }
        name_wrap.append(name_node);

        if (is_me) {
            const me_tag = document.createElement('sl-tag');
            me_tag.setAttribute('size', 'small');
            me_tag.setAttribute('variant', 'primary');
            me_tag.setAttribute('pill', '');
            me_tag.textContent = '我';
            name_wrap.append(me_tag);
        }

        left.append(rank_node, avatar_node, name_wrap);

        const score_node = document.createElement('div');
        score_node.className = `fw-bold text-monospace ${is_me ? 'fs-6' : 'text-muted'}`;
        score_node.textContent = `${player.score}`;

        row.append(left, score_node);
        leaderboard_list.append(row);
    });

    // 昵称彩色渲染（与好友列表、对局界面保持一致）
    if (color_pairs.length && typeof window.name_color_apply_pair === 'function') {
        window.name_color_apply_pair(color_pairs);
    }

    // 塞入底部挂底的“我”面板中
    my_rank_val.innerText = my_rank_ext;
    my_score_val.innerText = my_score_text;

    leaderboard_list.scrollTop = 0;
};


/**
 * @description: 进行随机匹配
 * @param {string} server
 * @return {Promise<void>}
 */
const ranked_join = async (server) => {
    let status, result;
    room = null;

    const token = window.get_token();

    if (game_ws) game_ws.close();
    game_ws = new GameClient(`${window.ws_protocol}${window.game_server_host(server)}/game/ws`);
    game_ws.connect();
    game_ws.reconnect();

    for await (const event of game_ws) {
        if (event.type === 'open') break;
        else if (event.type === 'error') throw Error('ws error');
    }

    game_ws.start_resend(GameMessage.ranked_join(token), 788, 0);
    for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_join') {
        status = event.data.status;
        break;
    }
    game_ws.stop_resend(0);
    if (!status) return toast.error('加入匹配池失败！');

    ranked_rejoin(token);
    toast.success('加入匹配池成功！');

    const start = Date.now();

    game_ws.start_resend(GameMessage.ranked_all(), 788, 1);
    for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_all') {
        result = event.data.result;
        status = event.data.status;
        break;
    }
    game_ws.stop_resend(1);
    game_msg.innerText = `匹配池人数：${result.length}人`;

    (async () => {
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_match') {
            if (!event.data.status) continue;
            room = event.data.result;
            clearInterval(pid);

            game_sound.play_match();
            toast.success('匹配成功！');
            room_join(room, server);

            button_server_join.disabled = false;
            button_server_join.loading = false;
            button_server_join.classList.remove('pe-none');

            select_server_region.disabled = false;
            select_server_region.classList.remove('pe-none');
            break;
        }
    })();

    const pid = setInterval(async () => {
        const seconds = Math.floor((Date.now() - start) / 1000);

        toast.info('正在匹配旗鼓相当的对手...');
        await window.sleep(888);
        if (room) return;

        game_ws.start_resend(GameMessage.ranked_all(), 788, 1);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_all') {
            result = event.data.result;
            status = event.data.status;
            break;
        }
        game_ws.stop_resend(1);
        if (room) return;
        game_msg.innerText = `匹配池人数：${result.length}人`;

        if (room) return;
        game_ws.send(GameMessage.ranked_match(token, seconds));
    }, 4000);
};

/**
 * @description: 重新加入随机匹配
 * @param {string} token
 * @return {Promise<void>}
 */
const ranked_rejoin = async (token) => {
    const handler = async () => {
        if (!is_main) document.removeEventListener('visibilitychange', handler);
        if (document.visibilityState !== 'visible') return;

        game_ws.start_resend(GameMessage.ranked_join(token), 788, 1009);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_join') break;
        game_ws.stop_resend(1009);
    };
    document.addEventListener('visibilitychange', handler);

    for await (const event of game_ws) {
        if (!is_main) {
            document.removeEventListener('visibilitychange', handler);
            break;
        }
        if (event.type !== 'error') continue;

        game_ws.start_resend(GameMessage.ranked_join(token), 788, 1001);
        for await (const event of game_ws) if (event.type === 'message' && event.data.op === 'ranked_join') break;
        game_ws.stop_resend(1001);
    }
};




// 加入匹配池
button_server_join.addEventListener('pointerdown', (event) => {
    if (event.target !== button_server_join) return;

    const server = select_server_region.value;

    if (!server) return toast.error('请先选择服务器！');

    localStorage.setItem('data', JSON.stringify({ server }));

    select_server_region.disabled = true;
    select_server_region.classList.add('pe-none');

    button_server_join.disabled = true;
    button_server_join.loading = true;
    button_server_join.classList.add('pe-none');

    window.sleep_task(
        [],
        null,
        async () => ranked_join(server)
    );
});


// 功能面板
game_msg.addEventListener('pointerdown', (event) => {
    if (event.target !== game_msg || is_main) return;

    window.sleep_task(
        [details_tools_observers],
        null,
        async () => room_getsub(room)
    );

    details_tools_observers.setAttribute('summary', '当前观战 加载中...');
    details_tools_observers.open = false;

    dialog_tools.classList.remove('d-none');
    dialog_tools.show();
});

// 排行榜
game_icon.addEventListener('pointerdown', (event) => {
    if (event.target !== game_icon) return;

    const current_list = document.getElementById('leaderboard_list');
    if (current_list) current_list.innerHTML = '';

    my_rank_val.innerText = '-';
    my_score_val.innerText = '-';

    window.sleep_task(
        [],
        null,
        async () => ranked_leaderboard(window.get_token())
    );

    dialog_leaderboard.classList.remove('d-none');
    dialog_leaderboard.show();
});

// 重置显示
dialog_leaderboard.addEventListener('sl-show', () => {
    setTimeout(() => {
        leaderboard_list.scrollTop = 0;
        dialog_leaderboard.setAttribute('label', '积分排行榜 加载中')
    }, 0);
});

dialog_leaderboard.addEventListener('sl-hide-after', () => {
    const current_list = document.getElementById('leaderboard_list');
    if (current_list) current_list.innerHTML = '';
    my_rank_val.innerText = '-';
    my_score_val.innerText = '-';
    game_ws.stop_resend(3333);
});