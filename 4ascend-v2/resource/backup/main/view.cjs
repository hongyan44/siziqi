/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 对局完整实现
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');
const game_icon = document.getElementById('game_icon');


const game_sub_title = document.getElementById('game_sub_title');
const game_sub_names = document.getElementById('game_sub_names');


const main_game = document.getElementById('main_game');
const main_app = document.getElementById('main_app');
const main_connect = document.getElementById('main_connect');


const header_main = document.getElementById('header_main');
const footer_main = document.getElementById('footer_main');


const canvas_board = document.getElementById('canvas_board');
const canvas_stone = document.getElementById('canvas_stone');
const canvas_view = document.getElementById('canvas_view');
const canvas_plant = document.getElementById('canvas_plant');
const canvas_turn = document.getElementById('canvas_turn');
const canvas_ascend = document.getElementById('canvas_ascend');


const dialog_init = document.getElementById('dialog_init');
const input_init_name = document.getElementById('input_init_name');
const input_init_stonev = document.getElementById('input_init_stonev');
const input_init_bgmv = document.getElementById('input_init_bgmv');
const button_init = document.getElementById('button_init');


const dialog_game = document.getElementById('dialog_game');
const button_game_restart = document.getElementById('button_game_restart');
const button_game_archive = document.getElementById('button_game_archive');


const input_server = document.getElementById('input_server');
const select_server = document.getElementById('select_server');
const button_server = document.getElementById('button_server');


const dialog_tip = document.getElementById('dialog_tip');
const button_tip = document.getElementById('button_tip');
const button_tip_archive = document.getElementById('button_tip_archive');


const game_my_hp = document.getElementById('game_my_hp');
const game_my_ascend = document.getElementById('game_my_ascend');
const game_my_name = document.getElementById('game_my_name');
const game_my_color = document.getElementById('game_my_color');
const game_my_crad = document.getElementById('game_my_crad');


const game_foe_hp = document.getElementById('game_foe_hp');
const game_foe_ascend = document.getElementById('game_foe_ascend');
const game_foe_name = document.getElementById('game_foe_name');
const game_foe_color = document.getElementById('game_foe_color');
const game_foe_crad = document.getElementById('game_foe_crad');


const { Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Game, Pos, Rand, State, ATK, AIC, Archive, RandAIC, RandUnity } = window.FAscendExports;

const { ShToast } = window.UiExports;
const { BaseZalgo } = window.UtilsExports;


const { Canvas: GameCanvas, Client: GameClient, Message: GameMessage, Timer: GameTimer, Sound: GameSound } = window.GameExports;


const toast = new ShToast();




/**
 * @description: 计算尺寸
 * @return {void}
 */
const math_size = () => {
    const header_h = header_main.getBoundingClientRect().height;
    const footer_h = footer_main.getBoundingClientRect().height;
    const foe_h = game_foe_crad.getBoundingClientRect().height;
    const my_h = game_my_crad.getBoundingClientRect().height;

    const body_style = window.getComputedStyle(document.body);
    const container_style = window.getComputedStyle(main_app);
    const main_style = window.getComputedStyle(main_game);

    const vpad =
        parseFloat(container_style.paddingTop)
        + parseFloat(container_style.paddingBottom)
        + parseFloat(body_style.paddingTop)
        + parseFloat(body_style.paddingBottom);

    const vgap = (parseFloat(main_style.rowGap) || 0) * 2 + (parseFloat(container_style.gap) || 0);

    const avail_h = window.visualViewport.height - header_h - footer_h - vpad - foe_h - my_h - vgap; // 计算高度
    const avail_w = window.visualViewport.width - 2; // 手机端留空

    return Math.floor(Math.min(avail_h, avail_w));
};

/**
 * @description: 切换主界面动画
 * @param {HTMLElement} out
 * @param {HTMLElement} set
 * @return {void}
 */
const switch_wection = (out, set) => {
    out.classList.add('v-hide');
    setTimeout(() => {
        out.classList.add('d-none');
        set.classList.remove('v-hide');
    }, 250);
};

/**
 * @description: 等待函数
 * @param {number} ms
 * @return {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description: 计算名字等效占用
 * @param {string} val
 * @return {number}
 */
const name_length = (val) => {
    let len = 0;
    for (let i = 0; i < val.length; i++) {
        let a = val.charAt(i);
        // 使用正则表达式判断是否为全角/中文
        if (a.match(/[^\x00-\xff]/ig) != null) len += 2 // 中文占2单位
        else len += 1; // 半角占1个单位
    }
    return len;
};




let my_name_gl, game_sound;

(() => {
    // 拼写检查、自动纠正、自动建议、自动大写
    document.querySelectorAll('sl-input, sl-textarea, input, textarea').forEach((el) => {
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('autocapitalize', 'off');
        el.setAttribute('autocorrect', 'off');
    });
})();

(() => {
    // 设置昵称
    if (!localStorage.getItem('init_storage')) localStorage.setItem('init_storage', '{}');
    if (localStorage.getItem('name')) localStorage.removeItem('name');

    dialog_init.addEventListener('sl-after-hide', () => {
        const opt = JSON.parse(localStorage.getItem('init_storage'));
        if (
            opt &&
            opt.name && opt.stonev
            && opt.bgmv && opt.stonev >= 0 && opt.stonev <= 5.0
            && opt.bgmv >= 0 && opt.bgmv <= 5.0
        ) return location.reload();
        dialog_init.show();
    });

    button_init.addEventListener('pointerdown', () => {
        const name = input_init_name.value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
        const bgmv = parseInt(input_init_bgmv.value, 10);
        const stonev = parseInt(input_init_stonev.value, 10);

        if (!name) {
            toast.error('请输入文本！');
            return;
        } if (name_length(name) > 18) {
            toast.error('昵称最长18个英文！');
            return;
        } else if (bgmv < 0 || bgmv > 500) {
            toast.error('背景音乐音量必须是0(%)-500(%)范围！');
            return;
        } else if (stonev < 0 || stonev > 500) {
            toast.error('落子音效音量必须是0(%)-500(%)范围！');
            return;
        }

        localStorage.setItem('init_storage', JSON.stringify(
            { 'name': name, 'bgmv': (bgmv / 100).toFixed(2), 'stonev': (stonev / 100).toFixed(2) }
        ));
        dialog_init.hide();
    });

    const pid = setInterval(() => {
        if (!window.loaded) return;
        clearInterval(pid);

        const opt = JSON.parse(localStorage.getItem('init_storage'));
        if (
            opt &&
            opt.name && opt.stonev
            && opt.bgmv && opt.stonev >= 0 && opt.stonev <= 5.0
            && opt.bgmv >= 0 && opt.bgmv <= 5.0
        ) return;

        dialog_init.classList.remove('d-none');
        dialog_init.show();
    }, 10);
})();

(() => {
    // 初始化
    const opt = JSON.parse(localStorage.getItem('init_storage'));

    if (!opt.name) return;

    my_name_gl = opt.name;
    game_sound = new GameSound(parseFloat(opt.bgmv), parseFloat(opt.stonev));
})();

(() => {
    // 对话框防关闭
    dialog_init.addEventListener('sl-request-close', (e) => e.detail.source === 'overlay' && e.preventDefault());
    dialog_game.addEventListener('sl-request-close', (e) => e.detail.source === 'overlay' && e.preventDefault());
    dialog_tip.addEventListener('sl-request-close', (e) => e.detail.source === 'overlay' && e.preventDefault());
})();

(() => {
    // 过期标识清理
    const now = Date.now() - 24 * 60 * 60 * 1000; // 1天
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
        const value = localStorage.getItem(key).split(':');
        if (value.length !== 2) return;

        const time = parseInt(value[0], 10);
        if (time >= now) return;

        localStorage.removeItem(key);
    });
})();

(() => {
    // 主界面音乐播放
    window.addEventListener('load', () => {
        window.addEventListener('click', async () => {
            await game_sound.context.resume();
            await game_sound.init();
            game_sound.play_main();
        }, { 'once': true });
    });
})();

(() => {
    // 创建30个观战名字元素
    for (let index = 0; index < 30; index++) {
        const element = document.createElement('sl-tag');
        element.setAttribute('size', 'small');
        element.classList.add('d-none');
        game_sub_names.append(element);
    }
})();




let game_client, game_room, game_uuid, game_server;
let gl_rand_aic, gl_rand_unity, gl_state, gl_board, gl_game_ui;

let gameing = false;
let is_main = true;

let pids = [];

let game_time = null;

const http_protocol = location.protocol === 'http:' ? 'http://' : 'https://';
const ws_protocol = location.protocol === 'http:' ? 'ws:' : 'wss:';




/**
 * @description: 查询房间
 * @return {Promise<boolean>}
 */
const http_room_exist = async () => {
    const response = await fetch(`${http_protocol}${game_server}/game/room_exist?id=${game_room}`);
    return (await response.json()).status;
};

/**
 * @description: 查询观战
 * @return {Promise<string[]>}
 */
const http_room_getsub = async () => {
    const response = await fetch(`${http_protocol}${game_server}/game/room_getsub?id=${game_room}`);
    const rjson = await response.json();
    return rjson.status ? rjson.result : [];
};

/**
 * @description: 分配标识
 * @return {Promise<void>}
 */
const http_room_genid = async () => {
    const key = `${game_server}_${game_room}_view`;
    game_uuid = localStorage.getItem(key);

    const response = await fetch(`${http_protocol}${game_server}/game/room_genid?id=${game_room}&uuid=${game_uuid}`);
    const rjson = await response.json();

    if (rjson.status) { // 更换新标识
        game_uuid = rjson.result;
        localStorage.setItem(key, game_uuid);
    }
};

/**
 * @description: 重连并加入
 * @return {Promise<void>}
 */
const ws_reconect = async () => {
    for await (const event of game_client) {
        if (event.type !== 'error') continue;
        const pid = game_client.resend(GameMessage.room_sej(game_room, game_uuid, my_name_gl), 2888);
        for await (const event of game_client) if (event.type === 'message' && event.data.op === 'room_sej') break;
        game_client.resendc(pid);
    }
};




// 输入房间号
input_server.addEventListener('sl-input', (event) => {
    if (event.target !== input_server) return;

    const value = input_server.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
    input_server.value = value;

    game_room = value;
});

// 选择服务器
select_server.addEventListener('sl-change', (event) => {
    if (event.target !== select_server) return;

    game_server = select_server.value;
});

// 按钮连接
button_server.addEventListener('pointerdown', async (event) => {
    if (event.target !== button_server) return;

    if (!game_server) {
        toast.error('请先选择服务器节点！');
        return;
    } else if (game_room?.length !== 6) {
        toast.error('房间代号必须是六位大写字母！');
        return;
    }

    button_server.disabled = true;
    button_server.loading = true;
    input_server.disabled = true;
    select_server.disabled = true;

    await sleep(688);

    try {
        const exist = await http_room_exist();
        if (!exist) {
            toast.error('房间不存在！');
            return;
        }

        await http_room_genid();

        if (game_client) {
            game_client.close();
            game_client = null;
        }
        game_client = new GameClient(`${ws_protocol}${game_server}/game/connect`);
        game_client.ping();
        game_client.heartbeat(game_room, game_uuid);
        ws_reconect();

        for await (const event of game_client) if (event.type === 'open') break;

        let status;
        const pid = game_client.resend(GameMessage.room_sej(game_room, game_uuid, my_name_gl), 2888);
        for await (const event of game_client) if (event.type === 'message' && event.data.op === 'room_sej') {
            status = event.data.status;
            break;
        }
        game_client.resendc(pid);

        if (status) {
            game_run();
            switch_wection(main_connect, main_game);
            is_main = false;
            // toast.success('加入房间成功！');
        } else {
            game_client.close();
            game_client = null;
            toast.error('观战人数已达15人上限！');
        }

    } catch (error) {
        toast.error('请求失败！');

    } finally {
        button_server.disabled = false;
        button_server.loading = false;
        input_server.disabled = false;
        select_server.disabled = false;
    }
});

// 回车连接
input_server.addEventListener('keydown', (event) => {
    if (event.target !== input_server || event.key !== 'Enter') return;

    button_server.dispatchEvent(new Event('pointerdown'));
});

// 重新设置昵称
game_icon.addEventListener('pointerdown', (event) => {
    if (event.target !== game_icon || button_server.loading) return;

    const opt = JSON.parse(localStorage.getItem('init_storage'));
    input_init_name.value = opt.name;
    input_init_bgmv.value = Math.trunc(opt.bgmv * 100);
    input_init_stonev.value = Math.trunc(opt.stonev * 100);

    dialog_init.classList.remove('d-none');
    dialog_init.show();
});




// 对话框唤出
game_msg.addEventListener('pointerdown', async (event) => {
    if (event.target !== game_msg || is_main) return;

    dialog_game.classList.remove('d-none');
    dialog_game.show();

    // 观战请求
    const names_ = await http_room_getsub();

    // 筛选
    const names = [];
    names_.forEach((name) => name && names.push(name));

    // 排序
    names.sort((a, b) => name_length(b) - name_length(a));

    // 隐藏
    const elements = Array.from(game_sub_names.children)
    elements.forEach((el) => el.classList.add('d-none'));

    // 替换
    game_sub_title.setAttribute('summary', `当前观战 ${names.length}人`);

    names.forEach((name, index) => {
        const element = elements[index];
        element.innerText = name;
        element.classList.remove('d-none');
    });
});

// 快照保存
button_game_archive.addEventListener('pointerdown', (event) => {
    if (event.target !== button_game_archive) return;

    try {
        const output = Archive.save(gl_board, gl_state, gl_rand);
        const string = BaseZalgo.encode(output);

        navigator.clipboard.writeText(string);

        toast.success('序列化成功，已复制到剪贴板！');
    } catch (error) {
        toast.error('对局序列化失败！');
    }
});

// 快照保存
button_tip_archive.addEventListener('pointerdown', (event) => {
    if (event.target !== button_tip_archive) return;

    try {
        const output = Archive.save(gl_board, gl_state, gl_rand);
        const string = BaseZalgo.encode(output);

        navigator.clipboard.writeText(string);

        toast.success('序列化成功，已复制到剪贴板！');
    } catch (error) {
        toast.error('对局序列化失败！');
    }
});

// 新对局，手动
button_game_restart.addEventListener('pointerdown', (event) => {
    if (event.target !== button_game_restart || gameing) return;

    gl_board = null;
    gl_rand = null;
    gl_state = null;

    // if (gl_game_ui) gl_game_ui.stop_click2move();

    gl_game_ui = null;

    dialog_game.hide();

    pids.forEach((pid) => clearInterval(pid));
    pids.length = 0;

    game_run();
});

// 新对局，提示
button_tip.addEventListener('pointerdown', (event) => {
    if (event.target !== button_tip) return;

    gl_board = null;
    gl_rand = null;
    gl_state = null;

    // if (gl_game_ui) gl_game_ui.stop_click2move();

    gl_game_ui = null;

    game_time = 'tip';
    dialog_tip.hide();

    pids.forEach((pid) => clearInterval(pid));
    pids.length = 0;

    game_run();
});

// 防止不点击新对局
dialog_tip.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_tip) return;
    if (game_time !== 'tip') dialog_tip.show();
});



// 游戏联机
async function game_run() {
    // 正在游戏
    button_game_restart.disabled = true;
    gameing = true;

    // 绘制
    const size = math_size();
    const game_ui = new GameCanvas(
        canvas_board,
        canvas_stone,
        canvas_view,
        canvas_plant,
        canvas_turn,
        canvas_ascend,

        9,
        9,

        0.4,
        0.12,

        0.062,
        size
    );

    game_ui.clear_board();
    game_ui.init();
    game_ui.draw_board();

    game_my_crad.style.width = size;
    game_foe_crad.style.width = size;


    // 重置
    game_my_name.innerText = '?';
    game_my_hp.innerText = 'HP：?';
    game_my_ascend.innerText = 'PR：?';
    game_my_color.innerText = '?';

    game_foe_name.innerText = '?';
    game_foe_hp.innerText = 'HP：?';
    game_foe_ascend.innerText = 'PR：?';
    game_foe_color.innerText = '?';

    game_msg.classList.remove('hp-p1');
    game_msg.classList.remove('hp-p2');

    game_my_crad.classList.remove('player-active-p2');
    game_foe_crad.classList.remove('player-active-p1');

    game_my_hp.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');
    game_my_name.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');

    game_foe_hp.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');
    game_foe_name.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');

    // 兜底清理
    pids.forEach((pid) => clearInterval(pid));
    pids.length = 0;


    // 变量
    let my_name, foe_name, seed_aic, seed_unity;
    let my_color, foe_color, first_color;
    let result;


    // 新对局
    game_msg.innerText = '🍃正在等待新对局开始';

    for await (const event of game_client) if (event.type === 'message' && event.data.op === 'sync_sub') {
        if (event.data.result.time !== game_time) {
            game_time = event.data.result.time;
            result = event.data.result;
            break;
        }
    }

    await sleep(488);


    // 提示
    game_msg.innerText = '📦正在接收对局数据';
    await sleep(488);


    // 下标作为 “我”
    const name_ = [...result.names].sort()[0];
    const index_ = result.names.indexOf(name_);

    const my_index = index_;
    const foe_index = 1 - index_;


    // 名字
    my_name = result.names[my_index];
    foe_name = result.names[foe_index];

    game_my_name.innerText = my_name;
    game_foe_name.innerText = foe_name;


    // 随机数种子
    seed_aic = result.seed_aic;
    seed_unity = result.seed_unity;

    const rand_aic = new RandAIC(seed_aic);
    const rand_unity = new RandUnity(seed_unity);

    rand_unity.ins(0, 2);
    rand_unity.ins(0, 2);


    // 阵营
    my_color = result.colors[my_index] === 0 ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;
    foe_color = result.colors[foe_index] === 0 ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;


    // 颜色
    const my_text = my_color === PLAYER_ENUM.BLACK ? '⚫' : '⚪';
    const foe_text = my_color === PLAYER_ENUM.BLACK ? '⚪' : '⚫';

    // const my_stone = my_color === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
    // const foe_stone = my_color === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE : STONE_ENUM.BLACK;

    game_my_color.innerText = my_text;
    game_foe_color.innerText = foe_text;


    // 先手
    first_color = result.first === 0 ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;


    // 提示
    game_msg.innerText = `${my_text}（${my_name}）是${my_color === PLAYER_ENUM.BLACK ? '黑方' : '白方'}`;
    await sleep(988);

    game_msg.innerText = `${foe_text}（${foe_name}）是${foe_color === PLAYER_ENUM.BLACK ? '黑方' : '白方'}`;
    await sleep(988);

    game_msg.innerText = `${first_color === my_color ? my_text : foe_text}（${first_color === my_color ? my_name : foe_name}）先手`;
    await sleep(988);


    /**
     * @description: 更新数组
     * @return {Promise<void>}
     */
    const update = async () => {
        const now = game_time;

        for await (const event of game_client) if (event.type === 'message' && event.data.op === 'sync_sub') {
            if (event.data.result.time !== now) {
                dialog_tip.classList.remove('d-none');
                if (game_time !== 'tip') dialog_tip.show();
                break;
            }
            if (event.data.result.turns.length > turns.length) turns = event.data.result.turns;
        }
    };

    /**
     * @description: 计算一方的总子力
     * @param {PLAYER_ENUM} player
     * @return {string}
     */
    const power = (player) => {
        const stone = player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const as = stone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;

        let snum = 0;
        let pnum = 0;

        board.data.forEach((pos) => {
            if (pos.stone !== as) return;
            snum += 1;

            if (pos.plant === PLANT_ENUM.ONE) pnum += 1;
            else if (pos.plant === PLANT_ENUM.TWO) pnum += 2;
        });

        return `PR：${snum}+${pnum}`;
    };

    /**
     * @description: 颜色
     * @param {number} n
     * @return {string}
     */
    const scle = (n) => {
        // if (n >= 0.85) {
        //     return 'text-success';    // 绿色
        // } else if (n >= 0.70) {
        //     return 'text-info';       // 青蓝色
        // } else if (n >= 0.60) {
        //     return 'text-warning';    // 黄色
        // } else {
        //     return 'text-danger';     // 红色
        // }
        if (n >= 0.85) {
            return 'hp-green';    // 绿色
        } else if (n >= 0.70) {
            return 'hp-blue';       // 青蓝色
        } else if (n >= 0.60) {
            return 'hp-yellow';     // 黄色
        } else {
            return 'hp-red';    // 红色
        }
    };


    // 游戏开局
    const board = new Board(9, 9);
    const state = new State();
    const game = new Game(board, state, rand_aic, rand_unity);

    const ascend_points = [[], []];
    let turns = [];
    state.turn_player = first_color;


    // 全局
    gl_board = board;
    gl_rand_aic = rand_aic;
    gl_rand_unity = rand_unity;
    gl_state = state;
    gl_game_ui = game_ui;


    // 原始数据
    const my_alhp = state.hp[my_color === PLAYER_ENUM.BLACK ? 0 : 1];
    const foe_alhp = state.hp[foe_color === PLAYER_ENUM.BLACK ? 0 : 1];

    let my_textcal = 'text-success', foe_textcal = 'text-success';

    game_my_hp.classList.add(my_textcal);
    game_foe_hp.classList.add(foe_textcal);

    game_my_name.classList.add(my_textcal);
    game_foe_name.classList.add(foe_textcal);


    // 初始化
    game_my_ascend.innerText = 'PR：0+0';
    game_foe_ascend.innerText = 'PR：0+0';

    game_my_hp.innerText = `HP：${my_alhp}/${my_alhp}`;
    game_foe_hp.innerText = `HP：${foe_alhp}/${foe_alhp}`;

    const turn_line = window.cs_isphone ? 4 : 7;

    // GameSound.play_main();

    update();


    // 游戏循环
    while (true) {
        // 我的回合?
        const my_turn = state.turn_player === my_color;


        // 呼吸提示
        game_my_crad.classList.remove('player-active-p2');
        game_foe_crad.classList.remove('player-active-p1');
        my_turn ? game_my_crad.classList.add('player-active-p2') : game_foe_crad.classList.add('player-active-p1');


        // 文字颜色
        my_turn ? game_msg.classList.add('hp-p2') : game_msg.classList.add('hp-p1');


        // 回合提示
        game_msg.innerText = my_turn ? `${my_text}等待（${my_name}）落子` : `${foe_text}等待（${foe_name}）落子`;


        // 每0.8秒查询一次落子
        const pid = setInterval(() => {
            if (!turns[state.turn_count]) return;
            clearInterval(pid);
            game_ui.notify_click(turns[state.turn_count]);
        }, 600);
        pids.push(pid);


        // 落子
        let pass;
        for await (const pos of game_ui.iterator_click()) {
            game.ed_tr_1(pos[0], pos[1]);
            pass = pos[2];
            break;
        }
        if (gl_board !== board || gl_rand_aic !== rand_aic || gl_rand_unity !== rand_unity || gl_state !== state || gl_game_ui !== game_ui) break;


        // 颜色清理
        game_msg.classList.remove('hp-p1');
        game_msg.classList.remove('hp-p2');


        // 上一步与鼠标预览
        game_ui.clear_turn();
        game_ui.clear_view();
        game_ui.draw_turn(state.turn_pos[0], state.turn_pos[1], pass ? '#FFD700' : '#00FFC5', turn_line);

        game_sound.play_stone();


        // ASCEND开始
        const points = game.ed_as_1();

        if (!points) {
            game_ui.clear_stone(state.turn_pos[0], state.turn_pos[1]);
            game_ui.draw_stone(state.turn_pos[0], state.turn_pos[1], state.turn_player === PLAYER_ENUM.BLACK ? '#2c3e50' : '#ecf0f1');
        }
        else if (state.ascend_status === ASCEND_ENUM.START) ascend_points[0].push(...points);
        else if (state.ascend_status === ASCEND_ENUM.END) ascend_points[1].push(...points);

        ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            game_ui.clear_stone(pos.x, pos.y);
            game_ui.draw_vstone(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
        });

        ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            game_ui.clear_stone(pos.x, pos.y);
            game_ui.draw_vstone(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
        });

        if (state.ascend_status !== ASCEND_ENUM.NONE) {
            game_my_ascend.innerText = power(my_color);
            game_foe_ascend.innerText = power(foe_color);

            if (game_my_ascend.innerText !== 'PR：0+0') game_my_ascend.classList.add('text-primary');
            if (game_foe_ascend.innerText !== 'PR：0+0') game_foe_ascend.classList.add('text-primary');
        }


        // ASCEND结算
        const as = game.ed_as_2();


        // 血量显示
        const my_hp = my_color === PLAYER_ENUM.BLACK ? state.hp[0] : state.hp[1];
        const foe_hp = foe_color === PLAYER_ENUM.BLACK ? state.hp[0] : state.hp[1];

        const my_scle = my_hp / my_alhp;
        const foe_scle = foe_hp / foe_alhp;

        game_my_hp.innerText = `HP：${my_hp}/${my_alhp}`;
        game_foe_hp.innerText = `HP：${foe_hp}/${foe_alhp}`;

        const my_textc = scle(my_scle);
        const foe_textc = scle(foe_scle);

        if (my_textc !== my_textcal) {
            game_my_hp.classList.remove(my_textcal);
            game_my_name.classList.remove(my_textcal);

            my_textcal = my_textc;

            game_my_hp.classList.add(my_textc);
            game_my_name.classList.add(my_textc);
        }

        if (foe_textc !== foe_textcal) {
            game_foe_hp.classList.remove(foe_textcal);
            game_foe_name.classList.remove(foe_textcal);

            foe_textcal = foe_textc;

            game_foe_hp.classList.add(foe_textc);
            game_foe_name.classList.add(foe_textc);
        }


        if (as !== undefined) {
            game_msg.innerText = `${my_text}${game_my_ascend.innerText.slice(3)} VS ${foe_text}${game_foe_ascend.innerText.slice(3)}`;
            await sleep(2100);
            game_msg.innerText = `${my_text}（${my_name}）剩余${my_color === PLAYER_ENUM.BLACK ? state.hp[0] : state.hp[1]}`;
            await sleep(900);
            game_msg.innerText = `${foe_text}（${foe_name}）剩余${my_color === PLAYER_ENUM.BLACK ? state.hp[1] : state.hp[0]}`;
            await sleep(900);

            game_my_ascend.innerText = 'PR：0+0';
            game_foe_ascend.innerText = 'PR：0+0';

            game_my_ascend.classList.remove('text-primary');
            game_foe_ascend.classList.remove('text-primary');
        }

        ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            game_ui.clear_stone(pos.x, pos.y);
            game_ui.clear_plant(pos.x, pos.y);
        });

        ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            game_ui.clear_stone(pos.x, pos.y);
            game_ui.clear_plant(pos.x, pos.y);
        });

        if (as !== undefined) {
            ascend_points[0].length = 0;
            ascend_points[1].length = 0;
        }


        // 切换回合
        game.ed_tr_2();


        // 判断胜负
        const win = game.ed_win();
        if (win) {
            game_msg.innerText = win === my_color ? `🏆（${my_name}）胜利${my_text}` : `🏆（${foe_name}）胜利${my_text}`;
            break;
        }


        // 生成植物
        const plants = game.ed_pl_1();
        if (plants) {
            plants.forEach((pos) => {
                game_ui.clear_plant(pos.x, pos.y);
                pos.plant === PLANT_ENUM.ONE ? game_ui.draw_plant(pos.x, pos.y) : game_ui.draw_2plant(pos.x, pos.y)
            });

            game_msg.innerText = '🪴植物已生成';
            await sleep(488);
        }


        // ASCEND清理
        game.ed_as_3();
    }

    // 变量
    gameing = false;
    button_game_restart.disabled = false;

    // 兜底清理
    pids.forEach((pid) => clearInterval(pid));
    pids.length = 0;
}