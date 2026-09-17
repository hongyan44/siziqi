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

const select_server_balance = document.getElementById('select_server_balance');
const select_server_mode = document.getElementById('select_server_mode');
const select_server_first = document.getElementById('select_server_first');
const select_server_color = document.getElementById('select_server_color');

const input_server_room = document.getElementById('input_server_room');
const input_server_archive = document.getElementById('input_server_archive');
const input_server_health = document.getElementById('input_server_health');
const input_server_board = document.getElementById('input_server_board');

const button_server_join = document.getElementById('button_server_join');


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
                Number(input_server_health.value),
                input_server_board.value,
                select_server_balance.value,
                select_server_mode.value,
                select_server_first.value,
                select_server_color.value
            );
            Online.run();

            room_rejoin(id, token);
            room_foeex(id, token);
            game_ws.start_resend(GameMessage.player_heartbeat(id, token), 5000, 1000);

            toast.success('加入房间成功！');
            window.switch_wection(main_game, main_opt);
            is_main = false;
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
button_server_join.addEventListener('pointerdown', (event) => {
    if (event.target !== button_server_join) return;

    const server = select_server_region.value;
    const room = input_server_room.value;
    const archive = input_server_archive.value;

    if (!server) return toast.error('请先选择服务器！');
    else if (room.length !== 6) return toast.error('非法房间号！');
    else if (archive !== '' && !ArchiveV0.load(BaseZalgo.decode(archive))) return toast.error('非法对局存档！');

    localStorage.setItem('data', JSON.stringify({ server }));

    window.sleep_task(
        [
            select_server_region,
            input_server_room,
            input_server_archive,
            input_server_health,
            // input_server_board,
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