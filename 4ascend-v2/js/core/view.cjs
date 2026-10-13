/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 在线观战
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');


const canvas_board = document.getElementById('canvas_board');

const canvas_stone_fill = document.getElementById('canvas_stone_fill');
const canvas_stone_ascend = document.getElementById('canvas_stone_ascend');

const canvas_plant = document.getElementById('canvas_plant');

const canvas_view_turn = document.getElementById('canvas_view_turn');
const canvas_view_ascend = document.getElementById('canvas_view_ascend');
const canvas_view_move = document.getElementById('canvas_view_move');


const game_top_card = document.getElementById('game_top_card');
const game_buttom_card = document.getElementById('game_buttom_card');


const game_p1_name = document.getElementById('game_p1_name');
const game_p1_ascend = document.getElementById('game_p1_ascend');
const game_p1_hp = document.getElementById('game_p1_hp');
const game_p1_stone = document.getElementById('game_p1_stone');
const game_p1_clock = document.getElementById('game_p1_clock');
const game_p1_card = document.getElementById('game_p1_card');
const game_p1_info = document.getElementById('game_p1_info');
const game_p1_time = document.getElementById('game_p1_time');

const game_p2_name = document.getElementById('game_p2_name');
const game_p2_ascend = document.getElementById('game_p2_ascend');
const game_p2_hp = document.getElementById('game_p2_hp');
const game_p2_stone = document.getElementById('game_p2_stone');
const game_p2_clock = document.getElementById('game_p2_clock');
const game_p2_card = document.getElementById('game_p2_card');
const game_p2_info = document.getElementById('game_p2_info');
const game_p2_time = document.getElementById('game_p2_time');


const game_info_turn = document.getElementById('game_info_turn');
const game_info_p1 = document.getElementById('game_info_p1');
const game_info_p2 = document.getElementById('game_info_p2');
const game_info_plant_cd = document.getElementById('game_info_plant_cd');
const game_info_plant_normal = document.getElementById('game_info_plant_normal');


const dialog_tools = document.getElementById('dialog_tools');

const score_tools_p1 = document.getElementById('score_tools_p1');
const score_tools_p2 = document.getElementById('score_tools_p2');

const winrate_tools_p1 = document.getElementById('winrate_tools_p1');
const winrate_tools_p2 = document.getElementById('winrate_tools_p2');

const button_tools_restart = document.getElementById('button_tools_restart');
const button_tools_archive = document.getElementById('button_tools_archive');
const details_tools_observers = document.getElementById('details_tools_observers');


const dialog_tip = document.getElementById('dialog_tip');


const dialog_end = document.getElementById('dialog_end');

const span_end_win = document.getElementById('span_end_win');
const span_end_hp = document.getElementById('span_end_hp');
const span_end_time = document.getElementById('span_end_time');

const button_end_restart = document.getElementById('button_end_restart');
const button_end_archive = document.getElementById('button_end_archive');


const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const { GameNormal, GameBlight, GameNight, Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, Rand, State, ATK, AIC, ArchiveV0, RandAIC, RandUnity, RandOther } = window.FAscendExports;

const toast = new ShToast();

const { resolve_choice_uuid } = require('./view-color.cjs');


let gl_time = 0;
let gl_run = 0;
let gl_turns, gl_turnc, gl_gameing, gl_win;
let gl_sound, gl_ui, gl_archive;
let gl_my_clock, gl_foe_clock;
let gl_sub_clock, gl_think_clock;
let gl_my_index, gl_foe_index, gl_first_index;
let gl_click_time, gl_click_level;
let gl_game, gl_rand_aic, gl_rand_unity, gl_rand_other, gl_board, gl_state, gl_timer;
let gl_cf_room, gl_cf_archive, gl_cf_health, gl_cf_initb, gl_cf_balance, gl_cf_mode, gl_cf_first, gl_cf_color, gl_cf_token, gl_cf_client;




/**
 * @description: 回合颜色更新
 * @param {boolean} my_turn
 * @return {string}
 */
const turn_color = (my_turn) => {
    if (my_turn) {
        game_p2_card.classList.remove('turn-purple');
        game_p2_info.classList.remove('turn-purple');
        game_p2_time.classList.remove('turn-purple');

        game_p1_card.classList.add('turn-orange');
        game_p1_info.classList.add('turn-orange');
        game_p1_time.classList.add('turn-orange');

        game_msg.classList.remove('text-purple');
        game_msg.classList.add('text-orange');

    } else {
        game_p1_card.classList.remove('turn-orange');
        game_p1_info.classList.remove('turn-orange');
        game_p1_time.classList.remove('turn-orange');

        game_p2_card.classList.add('turn-purple');
        game_p2_info.classList.add('turn-purple');
        game_p2_time.classList.add('turn-purple');

        game_msg.classList.remove('text-orange');
        game_msg.classList.add('text-purple');
    }
};

/**
 * @description: 清理大字体
 * @return {void}
 */
const title_clear = () => {
    game_msg.classList.remove('text-orange');
    game_msg.classList.remove('text-purple');
};

/**
 * @description: 清理文字颜色
 * @return {void}
 */
const info_clear = () => {
    game_p1_card.classList.remove('turn-orange');
    game_p1_info.classList.remove('turn-orange');
    game_p1_time.classList.remove('turn-orange');

    game_p2_card.classList.remove('turn-purple');
    game_p2_info.classList.remove('turn-purple');
    game_p2_time.classList.remove('turn-purple');

    game_info_plant_cd.classList.remove('text-danger');
    game_info_plant_cd.classList.remove('text-warning');
    game_info_plant_cd.classList.remove('text-info');
};


/**
 * @description: 游戏文字重置
 * @return {void}
 */
const game_clear = () => {
    game_p1_name.innerText = '?';
    game_p1_hp.innerText = 'HP: ?';
    game_p1_ascend.innerText = 'PR: ?';
    game_p1_stone.innerText = '?';
    game_p1_clock.innerText = 'CLK: ?';

    game_p2_name.innerText = '?';
    game_p2_hp.innerText = 'HP: ?';
    game_p2_ascend.innerText = 'PR: ?';
    game_p2_stone.innerText = '?';
    game_p2_clock.innerText = 'CLK: ?';

    game_info_plant_cd.innerText = `CD=cd`;
    game_info_plant_normal.innerText = 'p NPlants';

    game_info_p1.innerText = 'W+w';
    game_info_p2.innerText = 'B+b';

    game_info_turn.innerText = `t Turns`;

    score_tools_p1.innerText = '?';
    score_tools_p2.innerText = '?';

    document.documentElement.style.setProperty('--hp-color-p1', '-1');
    document.documentElement.style.setProperty('--hp-color-p2', '-1');

    title_clear();
    info_clear();

    gl_ui.clear();
    gl_ui.init();
    gl_ui.draw_board();

    button_tools_restart.disabled = true;
    button_tools_restart.classList.add('pe-none');
};

/**
 * @description: 游戏棋盘重绘
 * @return {void}
 */
const game_redraw = () => {
    gl_ui.clear();

    const size = window.math_size(main_game, [game_top_card]);
    gl_ui.size = size;
    game_top_card.style.width = `${size}px`;

    gl_ui.init();
    gl_ui.draw_board();

    if (!gl_board) return;
    gl_board.data.forEach((pos) => {
        const stone = pos.stone;
        const plant = pos.plant;

        const x = pos.x;
        const y = pos.y;

        if (stone === STONE_ENUM.BLACK) gl_ui.draw_stone_fill(x, y, '#2c3e50');
        else if (stone === STONE_ENUM.WHITE) gl_ui.draw_stone_fill(x, y, '#ecf0f1');
        else if (stone === STONE_ENUM.BLACK_ASCEND) { if (!gl_ui.ascend_is_lifted(x, y)) gl_ui.draw_stone_ascend(x, y, '#e74c3c'); }
        else if (stone === STONE_ENUM.WHITE_ASCEND) { if (!gl_ui.ascend_is_lifted(x, y)) gl_ui.draw_stone_ascend(x, y, '#3498db'); }

        if (plant === PLANT_ENUM.ONE) gl_ui.draw_plant(x, y);
        else if (plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(x, y);
    });

    if (gl_state.turn_count !== 0) {
        gl_ui.clear_view_turn();
        gl_ui.draw_stone_turn(gl_state.turn_pos[0], gl_state.turn_pos[1], '#FFD700', 5);
    }
};

/**
 * @description: 先手平衡
 * @return {Promise<void>}
 */
const game_balance = () => {
    return new Promise(async (resolve) => {
        if (gl_cf_balance === 'cg+') {
            const points = [
                // 水平
                [[4, 2], [4, 3], [4, 5]],
                [[4, 3], [4, 5], [4, 6]],

                // 垂直
                [[2, 4], [3, 4], [5, 4]],
                [[3, 4], [5, 4], [6, 4]],

                // 主对角 ↘
                [[2, 2], [3, 3], [5, 5]],
                [[3, 3], [5, 5], [6, 6]],

                // 副对角 ↗
                [[2, 6], [3, 5], [5, 3]],
                [[3, 5], [5, 3], [6, 2]],
            ];

            // 提取先手
            const indexf = gl_rand_other.xor(points.length);
            const turns_first = points[indexf];

            // 提取与非先手的下标落子数组
            let indexb = gl_rand_other.xor(points.length);
            let turns_befor = points[indexb];
            while (indexf === indexb || Math.abs(indexf - indexb) === 1) {
                indexb = gl_rand_other.xor(points.length);
                turns_befor = points[indexb];
            }
            // console.log(turns_first, turns_befor);

            // 合并
            const turns = [];

            turns.push([4, 4]);
            for (let index = 0; index < 3; index++) {
                turns.push(turns_first[index]);
                turns.push(turns_befor[index]);
            }
            turns.push([4, 4]);

            for (let index = 0; index < turns.length; index++) {
                const point = turns[index];
                const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
                gl_game.ed_tr_1(point[0], point[1], stone);

                gl_game.ed_as_1();
                gl_game.ed_as_2();
                gl_game.ed_tr_2();
                gl_game.ed_pl_1();
                gl_game.ed_as_3();

                game_redraw();
                await window.sleep(25);
            }

        } else if (gl_cf_balance === 'cg-') {
            const points = [
                [[4, 3], [4, 2], [4, 1]],
                [[4, 5], [4, 6], [4, 7]],

                [[3, 4], [2, 4], [1, 4]],
                [[5, 4], [6, 4], [7, 4]],

                [[3, 3], [2, 2], [1, 1]],
                [[5, 3], [6, 2], [7, 1]],

                [[3, 5], [2, 6], [1, 7]],
                [[5, 5], [6, 6], [7, 7]]
            ];

            // 提取先手
            const indexf = gl_rand_other.xor(points.length);
            const turns_first = points[indexf];

            // 提取与非先手的下标落子数组
            let indexb = gl_rand_other.xor(points.length);
            let turns_befor = points[indexb];
            while (indexf === indexb) {
                indexb = gl_rand_other.xor(points.length);
                turns_befor = points[indexb];
            }
            // console.log(turns_first, turns_befor);

            // 合并
            const turns = [];

            turns.push([4, 4]);
            for (let index = 0; index < 3; index++) {
                turns.push(turns_first[index]);
                turns.push(turns_befor[index]);
            }
            turns.push([4, 4]);

            for (let index = 0; index < turns.length; index++) {
                const point = turns[index];
                const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
                gl_game.ed_tr_1(point[0], point[1], stone);

                gl_game.ed_as_1();
                gl_game.ed_as_2();
                gl_game.ed_tr_2();
                gl_game.ed_pl_1();
                gl_game.ed_as_3();

                game_redraw();
                await window.sleep(25);
            }
        } else if (gl_cf_balance === 'ncg') {
            // 合并
            const turns = [[4, 3], [3, 4], [4, 2], [2, 4], [4, 5], [5, 4], [4, 6], [6, 4], [4, 4], [4, 4]];

            for (let index = 0; index < turns.length; index++) {
                const point = turns[index];
                const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
                gl_game.ed_tr_1(point[0], point[1], stone);

                gl_game.ed_as_1();
                gl_game.ed_as_2();
                gl_game.ed_tr_2();
                gl_game.ed_pl_1();
                gl_game.ed_as_3();

                game_redraw();
                await window.sleep(25);
            }
        }
        gl_turnc = gl_state.turn_count;
        resolve();
    });
};

/**
 * @description: 对局存档读取并复原
 * @return {Promise<void>}
 */
const game_archive = () => {
    return new Promise(async (resolve) => {
        const turns = gl_archive.turns;

        for (let index = 0; index < turns.length; index++) {
            const point = turns[index];
            const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
            gl_game.ed_tr_1(point[0], point[1], stone);

            gl_game.ed_as_1();
            gl_game.ed_as_2();
            gl_game.ed_tr_2();
            gl_game.ed_pl_1();
            gl_game.ed_as_3();

            game_redraw();
            await window.sleep(25);
        }
        gl_turnc = gl_state.turn_count;
        resolve();
    });
};


/**
 * @description: 计算一方的总子力
 * @param {STONE_ENUM} stone
 * @param {Pos[]} datas 
 * @return {string}
 */
const game_power = (stone, datas) => {
    let snum = 0;
    let pnum = 0;

    if (datas) {
        datas.forEach((pos) => {
            snum += 1;

            if (pos.plant === PLANT_ENUM.ONE) pnum += 1;
            else if (pos.plant === PLANT_ENUM.TWO) pnum += 2;
        });
    } else {
        const as = stone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;
        gl_board.data.forEach((pos) => {
            if (pos.stone !== as) return;
            snum += 1;

            if (pos.plant === PLANT_ENUM.ONE) pnum += 1;
            else if (pos.plant === PLANT_ENUM.TWO) pnum += 2;
        });
    }

    return `PR：${snum}+${pnum}`;
};

/**
 * @description: 计算数组并更新
 * @param {STONE_ENUM} my_stone
 * @param {STONE_ENUM} foe_stone
 * @return {void}
 */
const game_match = (my_stone, foe_stone) => {
    let plantn = 0;

    let my_stone_num = 0;
    let my_plant_num = 0;

    let foe_stone_num = 0;
    let foe_plant_num = 0;

    // 遍历得到
    gl_board.data.forEach((pos) => {
        const stone = pos.stone;
        const plant = pos.plant;

        if (stone === my_stone) {
            my_stone_num++;
            if (plant === PLANT_ENUM.ONE) my_plant_num++;
            else if (plant === PLANT_ENUM.TWO) my_plant_num += 2;

        } else if (stone === foe_stone) {
            foe_stone_num++;
            if (plant === PLANT_ENUM.ONE) foe_plant_num++;
            else if (plant === PLANT_ENUM.TWO) foe_plant_num += 2;

        } else {
            if (plant === PLANT_ENUM.ONE) plantn++;
            else if (plant === PLANT_ENUM.TWO) plantn += 2;
        }
    });

    game_info_p1.innerText = `${my_stone_num}+${my_plant_num}`;
    game_info_p2.innerText = `${foe_stone_num}+${foe_plant_num}`;

    game_info_plant_normal.innerText = `${plantn} NPlants`;

    // 回合数
    game_info_turn.innerText = `${gl_state.turn_count} Turns`;

    // 植物生成倒计时
    if (gl_state.ascend_status === ASCEND_ENUM.NONE) {
        game_info_plant_cd.innerText = `CD=${gl_state.grow_count}`;
        if (gl_state.grow_count === 1) game_info_plant_cd.classList.add('text-danger');
        else if (gl_state.grow_count === 3) game_info_plant_cd.classList.add('text-info');

    } else if (gl_state.just_unascend) {
        game_info_plant_cd.innerText = 'CD=no';
        game_info_plant_cd.classList.add('text-warning');

    } else if (gl_state.ascend_status === ASCEND_ENUM.START) {
        game_info_plant_cd.innerText = 'CD=st';
        game_info_plant_cd.classList.add('text-danger');

    } else if (gl_state.ascend_status === ASCEND_ENUM.END) {
        game_info_plant_cd.innerText = 'CD=ed';
        game_info_plant_cd.classList.add('text-danger');
    }

    if (gl_state.grow_count > 3 && gl_state.ascend_status === ASCEND_ENUM.NONE) {
        game_info_plant_cd.classList.remove('text-info');
        game_info_plant_cd.classList.remove('text-danger');
        game_info_plant_cd.classList.remove('text-warning');

    } else if (gl_state.grow_count === 1 && gl_state.ascend_status === ASCEND_ENUM.NONE) {
        game_info_plant_cd.classList.remove('text-info');
    }
};


/**
 * @description: 观战指示
 * @return {Promise<void>}
 */
const view_instruct = async () => {
    gl_ui.start_click2move();

    const color_s = ['#c41bd7', '#c8e096', '#f57927'];
    const color_m = {};
    const color_p = {};

    const uuid = `${Date.now()}-${window.uuidv4()}`;

    (async () => {
        let result;
        for await (const event of gl_cf_client) {
            if (event.type === '$') break;
            if (event.type === 'message' && event.data.op === 'sync_observer2observers') {
                result = event.data.result;
                if (result.type === 'view_instruct') gl_ui.notify_click(result.pos.concat(result.uuid).concat(result.color));
            }
        }
    })();

    for await (const pos of gl_ui.iterator_click()) {
        if (pos === '$') break;
        if (!pos) continue;

        // 不允许重合
        if (gl_state.turn_pos[0] === pos[0] && gl_state.turn_pos[1] === pos[1]) {
            toast.error('非法标注！');
            continue;
        }

        // 如果没有颜色，立刻擦除现有的
        if (color_s.length === 0 || Object.keys(color_m).length === 3) {
            const key = Object.keys(color_m)[0];
            clearTimeout(color_m[key]);

            gl_ui.clear_view_turnp(color_p[key][0], color_p[key][1]);

            delete color_m[key];
            delete color_p[key];
            color_s.push(key);
        }

        // 取出颜色，绘制
        let color = pos[3] || color_s.pop();
        gl_ui.draw_stone_turn(pos[0], pos[1], color, 5);

        // 机遇定时器
        color_m[color] = setTimeout(() => {
            if (!pos[3]) color_s.push(color);
            gl_ui.clear_view_turnp(pos[0], pos[1]);
        }, 3000);

        // 坐标
        color_p[color] = pos;

        // 同步观战之间
        if (pos[2]) continue;
        gl_cf_client.send(GameMessage.sync_observer2observers(gl_cf_room, gl_cf_token, {
            'type': 'view_instruct',
            'pos': pos,
            'uuid': uuid,
            'color': color,
        }));
    }
};

/**
 * @description: 观战黑板
 * @param {STONE_ENUM} my_stone
 * @param {STONE_ENUM} foe_stone
 * @return {Promise<void>}
 */
const view_pice = (my_stone, foe_stone) => {
    return new Promise((resolve, _) => {
        const pid = setInterval(() => {
            if (!gl_gameing) return resolve([0, 0]);

            const data = gl_turns[gl_state.turn_count - gl_turnc];
            if (!gl_turns || !data) return;
            clearInterval(pid);

            const [x, y, pass, cp] = data;
            const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;

            if (my_stone === stone) {
                gl_my_clock = cp
                game_p1_clock.innerText = `CLK: ${cp}`;
            } else {
                gl_foe_clock = cp
                game_p2_clock.innerText = `CLK: ${cp}`;
            }

            gl_game.ed_tr_1(x, y, stone);
            resolve([pass, cp]);
        }, 25);
    });
};

/**
 * @description: 观战接收数据
 * @return {Promise<void>}
 */
const view_accept = async (run_id) => {
    let result;
    for await (const event of gl_cf_client) {
        // 本局已被新的 run() 顶替：立即退场，绝不再改动全局状态
        if (run_id !== gl_run) return;

        if (event.type === 'message' && event.data.op === 'sync_player2observers') {
            result = event.data.result;

            if (result.type === 'view_sync' && result.time > gl_time) break;
            if (result.turns && result.turns.length > gl_turns.length) gl_turns = result.turns;
        }
    }

    // 退出循环后再校验一次，只有仍是当前局才允许宣告对局结束并提示
    if (run_id !== gl_run) return;

    gl_gameing = false;

    dialog_tip.classList.remove('d-none');
    dialog_tip.show();
};




// 重绘
(() => {
    let timer;
    window.addEventListener('resize', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => gl_ui && game_redraw(gl_ui, gl_board), 150);
        gl_ui && game_redraw(gl_ui, gl_board);
    });
})();

// 初始化音频
(() => {
    const opt = JSON.parse(localStorage.getItem('opt'));
    if (!opt) return;
    gl_sound = new GameSound(
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

    gl_click_time = opt.click_time;
    gl_click_level = opt.click_level;
})();

// 主音乐播放
(() => {
    window.addEventListener('load', () => {
        window.addEventListener('click', async () => {
            await gl_sound.context.resume();
            await gl_sound.init();
            gl_sound.play_main();
        }, { 'once': true });
    }, { 'once': true });
})();

// 功能
(() => {
    button_tools_archive.addEventListener('pointerdown', (event) => {
        if (event.target !== button_tools_archive) return;

        try {
            navigator.clipboard.writeText(exportf());
            toast.success('成功，已复制到剪贴板！');
        } catch (error) {
            console.error(error);
            toast.error('对局序列化失败！');
        }
    });

    button_tools_restart.addEventListener('pointerdown', (event) => {
        if (event.target !== button_tools_restart) return;

        run();
        dialog_tools.hide();
    });

    button_end_archive.addEventListener('pointerdown', (event) => {
        if (event.target !== button_end_archive) return;

        try {
            navigator.clipboard.writeText(exportf());
            toast.success('成功，已复制到剪贴板！');
        } catch (error) {
            console.error(error);
            toast.error('对局序列化失败！');
        }
    });

    button_end_restart.addEventListener('pointerdown', (event) => {
        if (event.target !== button_end_restart) return;

        run();
        dialog_end.hide();
    });
})();

// 对话框防误触关闭
(() => {
    dialog_tools.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_end.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
})();

// 关闭连接清理声音
(() => {
    window.addEventListener('unload', () => {
        gl_sound.main.pause();
        gl_sound.main.currentTime = 0;
        gl_sound.main.loop = true;
        gl_cf_client.close();
    });
})();




/**
 * @description: 游戏配置
 * @param {GameClient} client
 * @param {string} token
 * @param {string} room
 * @return {void}
 */
const setup = (client, token, room) => {
    const size = window.math_size(main_game, [game_top_card]);
    gl_ui = new GameCanvas(
        canvas_board,

        canvas_stone_fill,
        canvas_stone_ascend,

        canvas_plant,

        canvas_view_turn,
        canvas_view_ascend,
        canvas_view_move,

        9,
        9,

        0.41,
        0.12,

        0.062,
        size
    );

    game_top_card.style.width = `${size}px`;


    gl_cf_client = client;
    gl_cf_token = token;
    gl_cf_room = room;
};


/**
 * @description: 游戏循环
 * @return {Promise<void>}
 */
const run = async () => {
    // 本局世代号：递增后，上一局残留的 view_accept 立即失效，
    // 避免其在新局开局时抢先消费 view_sync 并把 gl_gameing 置为 false
    const run_id = ++gl_run;

    // 清理
    game_clear();
    game_redraw();


    // 变量
    let result, start;
    gl_gameing = true;


    // 接收对局数据
    game_msg.innerText = '📍等待新的对局开始';
    for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'sync_player2observers') {
        result = event.data.result;
        if (result.type === 'view_sync' && result.time > gl_time) break;
    }
    await window.sleep(388);


    // 提示
    game_msg.innerText = '🕒解析对局数据中';
    await window.sleep(388);


    // 解析对局数据
    gl_cf_archive = result.archive;

    gl_cf_health = result.health;
    gl_cf_initb = result.initb;

    gl_cf_balance = result.balance;
    gl_cf_mode = result.mode;

    gl_cf_first = result.first;
    gl_cf_color = result.color;

    gl_turns = result.turns;
    console.log(result);


    // 取第一位作为“我”
    let uuids = result.uuids;

    const my_uuid = [...uuids].sort()[0];
    const foe_uuid = [...uuids].sort()[1];

    const a_index = uuids.indexOf(my_uuid);
    const b_index = uuids.indexOf(foe_uuid);

    // 发送方 uuid：view_sync 的 uuids[0] 恒为发送者本人（两端都发 [自己, 对方]）。
    // 观战是第三方，my_uuid/foe_uuid 只是按 uuid 排序得到的上下显示位，与发送方无关，
    // 因此发送方传来的 'my'/'foe' 这类相对选择必须借助 sender_uuid 才能还原成绝对黑白。
    const sender_uuid = Array.isArray(result.uuids) && result.uuids[0] ? result.uuids[0] : my_uuid;

    const my_name = result.names[a_index];
    const foe_name = result.names[b_index];

    const my_score = result.scores[a_index];
    const foe_score = result.scores[b_index];


    // 常量
    let archive;
    if (gl_cf_archive !== '') {
        archive = ArchiveV0.load(BaseZalgo.decode(gl_cf_archive));
        gl_cf_archive = '';
    }
    gl_archive = archive;


    // 对局数据协商
    let hp;
    let rand_aic, rand_unity, rand_other, time;
    let my_color, foe_color;
    let my_stone, my_icon, my_label, my_index;
    let foe_stone, foe_icon, foe_label, foe_index;
    let first_color, first_icon, first_index;
    let game, board, state, timer;


    // 决定对局开始时间
    time = result.time;
    gl_time = time;
    gl_win = false;

    // 决定随机数种子
    rand_aic = new RandAIC(result.seed_aic);
    rand_unity = new RandUnity(result.seed_unity);
    rand_other = new RandOther(result.seed_other);

    gl_rand_aic = rand_aic;
    gl_rand_unity = rand_unity;
    gl_rand_other = rand_other;

    score_tools_p1.innerText = my_score;
    score_tools_p2.innerText = foe_score;


    // 决定棋子颜色
    uuids = [my_uuid, foe_uuid].sort();
    my_color = uuids[rand_other.xor(2)] === my_uuid ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;
    foe_color = my_color === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;

    // 决定先手
    [first_color, first_icon, first_index] = rand_other.xor(2) === 0 ? [PLAYER_ENUM.BLACK, '⚫', 0] : [PLAYER_ENUM.WHITE, '⚪', 1];

    // 得到棋子，得到棋子图标
    [my_stone, my_icon, my_label, my_index] = my_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, '⚫', '黑方', 0] : [STONE_ENUM.WHITE, '⚪', '白方', 1];
    [foe_stone, foe_icon, foe_label, foe_index] = foe_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, '⚫', '黑方', 0] : [STONE_ENUM.WHITE, '⚪', '白方', 1];


    // 对局初始化
    board = new Board(9, 9);
    state = new State();
    timer = new GameTimer();

    gl_board = board;
    gl_state = state;
    gl_timer = timer;

    // 游戏模式
    if (gl_cf_mode === 'normal') game = new GameNormal(board, state, rand_aic, rand_unity);
    else if (gl_cf_mode === 'blight') game = new GameBlight(board, state, rand_aic, rand_unity);
    else if (gl_cf_mode === 'night') game = new GameNight(board, state, rand_aic, rand_unity);
    gl_game = game;


    // 阵营决定
    // gl_cf_color 是发送方相对自身的阵营选择（'my'=发送方执黑，'foe'=发送方执白），
    // 必须结合 sender_uuid 解释成绝对黑白；否则观战会因“先收到哪一方的 view_sync”
    // 不同而把黑白方反过来（对方收到 'foe' 时也会被误当成“最小 uuid 执黑”）。
    if (gl_cf_color !== 'rand') {
        const black_uuid = resolve_choice_uuid(sender_uuid, gl_cf_color, my_uuid, foe_uuid);
        my_color = black_uuid === my_uuid ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;
        foe_color = my_color === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;

        [my_stone, my_icon, my_label, my_index] = my_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, '⚫', '黑方', 0] : [STONE_ENUM.WHITE, '⚪', '白方', 1];
        [foe_stone, foe_icon, foe_label, foe_index] = foe_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, '⚫', '黑方', 0] : [STONE_ENUM.WHITE, '⚪', '白方', 1];
    }

    // 生命值、初始盘面、先手平衡、先手决定
    game_msg.innerText = '🍳对局加载中';
    if (!archive) {
        state.hp = [gl_cf_health, gl_cf_health];
        hp = gl_cf_health;

        if (gl_cf_first !== 'rand') {
            // gl_cf_first 同样是发送方相对自身的先手选择，需按 sender_uuid 还原成绝对先手方
            const first_uuid = resolve_choice_uuid(sender_uuid, gl_cf_first, my_uuid, foe_uuid);
            const temp_stone = first_uuid === my_uuid ? my_stone : foe_stone;

            [first_color, first_icon, first_index] = temp_stone === STONE_ENUM.BLACK ? [PLAYER_ENUM.BLACK, '⚫', 0] : [PLAYER_ENUM.WHITE, '⚪', 1];
        }
        state.turn_player = first_color;

        if (gl_cf_initb) 1; // todo
        if (gl_cf_balance && gl_cf_initb === '') await game_balance();

        gl_my_clock = 300;
        gl_foe_clock = 300;
    } else {
        // 随机数生成器
        rand_aic = new RandAIC(archive.seed_aic);
        rand_unity = new RandUnity(archive.seed_unity);
        rand_other = new RandOther(archive.seed_other);

        gl_rand_aic = rand_aic;
        gl_rand_unity = rand_unity;
        gl_rand_other = rand_other;

        // 游戏模式
        if (archive.mode === 0) game = new GameNormal(board, state, rand_aic, rand_unity);
        else if (archive.mode === 1) game = new GameBlight(board, state, rand_aic, rand_unity);
        else if (archive.mode === 2) game = new GameNight(board, state, rand_aic, rand_unity);
        gl_game = game;

        // 先手
        [first_color, first_icon, first_index] = archive.first === 0 ? [PLAYER_ENUM.BLACK, '⚫', 0] : [PLAYER_ENUM.WHITE, '⚪', 1];
        state.turn_player = first_color;

        // 棋钟
        gl_my_clock = archive.clocks[my_index];
        gl_foe_clock = archive.clocks[foe_index];

        // 生命值
        state.hp = [...archive.healths];
        hp = archive.healths[0];

        // 对局
        await game_archive();
    }

    gl_my_index = my_index;
    gl_foe_index = foe_index;
    gl_first_index = first_index;

    state.turn_player = first_color;


    // 信息显示
    game_msg.innerText = `${my_icon}|${my_name}|是${my_label}`;
    await window.sleep(788);

    game_msg.innerText = `${foe_icon}|${foe_name}|是${foe_label}`;
    await window.sleep(788);

    game_msg.innerText = `${first_icon}|${first_color === my_color ? my_name : foe_name}|是先手`;
    await window.sleep(788);

    document.documentElement.style.setProperty('--hp-color-p1', Math.trunc((state.hp[my_index] / hp).toFixed(2) * 100).toString());
    document.documentElement.style.setProperty('--hp-color-p2', Math.trunc((state.hp[foe_index] / hp).toFixed(2) * 100).toString());

    game_p1_name.innerText = my_name;
    game_p1_hp.innerText = `HP: ${state.hp[my_index]}/${hp}`;
    game_p1_ascend.innerText = 'PR: 0+0';
    game_p1_stone.innerText = my_icon;
    game_p1_clock.innerText = `CLK: ${gl_my_clock}`;

    game_p2_name.innerText = foe_name;
    game_p2_hp.innerText = `HP: ${state.hp[foe_index]}/${hp}`;
    game_p2_ascend.innerText = 'PR: 0+0';
    game_p2_stone.innerText = foe_icon;
    game_p2_clock.innerText = `CLK: ${gl_foe_clock}`;

    game_redraw();
    view_accept(run_id);
    view_instruct();


    const ascend_points = [[], []];


    // 开始游戏
    while (true) {
        // 我方回合？
        const [my_turn, turn_icon, turn_label] = my_color === state.turn_player ? [true, my_icon, '我方'] : [false, foe_icon, '对方'];

        // 回合提示
        game_msg.innerText = `${turn_icon}轮到|${my_turn ? my_name : foe_name}|落子`;
        gl_msg = game_msg.innerText;

        // 回合颜色
        turn_color(my_turn);

        // 数据显示
        game_match(my_stone, foe_stone);


        // 清理对局请求
        if (my_turn && start) {
            gl_cf_client.stop_resend(900);
            // gl_cf_client.stop_resend(901);
            // gl_cf_client.stop_resend(903);
        } else if (my_turn) start = true;


        // 落子
        const [pass, cp] = await view_pice(my_stone, foe_stone);
        if (!gl_gameing) break;

        // 反击/卖血：击落对方盘旋中的这枚棋子
        gl_ui.ascend_counter(state.turn_pos[0], state.turn_pos[1]);

        // 清理回合颜色
        title_clear();


        // 上一步与鼠标预览
        gl_ui.clear_view_turn();
        gl_ui.clear_view_move();
        gl_ui.draw_stone_turn(state.turn_pos[0], state.turn_pos[1], pass ? '#FFD700' : '#00FFC5', 5);
        gl_sound.play_stone();


        // ASCEND开始
        const points = game.ed_as_1();

        if (!points) {
            gl_ui.clear_stone_fill(state.turn_pos[0], state.turn_pos[1]);
            gl_ui.clear_stone_ascend(state.turn_pos[0], state.turn_pos[1]);
            gl_ui.draw_stone_fill(state.turn_pos[0], state.turn_pos[1], state.turn_player === PLAYER_ENUM.BLACK ? '#2c3e50' : '#ecf0f1');
            const normal_pos = gl_board.get_pos(state.turn_pos[0], state.turn_pos[1]);
            if (normal_pos.plant === PLANT_ENUM.ONE) gl_ui.draw_plant(normal_pos.x, normal_pos.y);
            else if (normal_pos.plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(normal_pos.x, normal_pos.y);
            gl_ui.draw_effect_place(state.turn_pos[0], state.turn_pos[1], state.turn_player === PLAYER_ENUM.BLACK ? '#2c3e50' : '#95a5a6');
        }
        else if (state.ascend_status === ASCEND_ENUM.START) {
            ascend_points[0].push(...points);
            points.forEach((pos) => {
                if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
                // 同时清理实体层与旧 ASCEND 层，再保留红/蓝位置提示
                gl_ui.clear_stone_fill(pos.x, pos.y);
                gl_ui.clear_stone_ascend(pos.x, pos.y);
                gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
            });
            await gl_ui.ascend_lift(points.map((pos) => ({
                'gx': pos.x,
                'gy': pos.y,
                'power': pos.plant === PLANT_ENUM.ONE ? 2 : pos.plant === PLANT_ENUM.TWO ? 3 : 1,
                'plant': pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0,
                'color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db',
                'stone_color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#2c3e50' : '#ecf0f1',
                'marker_color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db'
            })), state.turn_player === my_color ? 'left' : 'right');
            points.forEach((pos) => {
                if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
                gl_ui.draw_effect_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
            });
        }
        else if (state.ascend_status === ASCEND_ENUM.END) {
            ascend_points[1].push(...points);
            points.forEach((pos) => {
                if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
                // 同时清理实体层与旧 ASCEND 层，再保留红/蓝位置提示
                gl_ui.clear_stone_fill(pos.x, pos.y);
                gl_ui.clear_stone_ascend(pos.x, pos.y);
                gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
            });
            await gl_ui.ascend_lift(points.map((pos) => ({
                'gx': pos.x,
                'gy': pos.y,
                'power': pos.plant === PLANT_ENUM.ONE ? 2 : pos.plant === PLANT_ENUM.TWO ? 3 : 1,
                'plant': pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0,
                'color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db',
                'stone_color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#2c3e50' : '#ecf0f1',
                'marker_color': pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db'
            })), state.turn_player === my_color ? 'left' : 'right');
            points.forEach((pos) => {
                if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
                gl_ui.draw_effect_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
            });
        }

        ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            if (gl_ui.ascend_is_lifted(pos.x, pos.y)) return;
            gl_ui.clear_stone_fill(pos.x, pos.y);
            gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
        });

        ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            if (gl_ui.ascend_is_lifted(pos.x, pos.y)) return;
            gl_ui.clear_stone_fill(pos.x, pos.y);
            gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
        });

        if (state.ascend_status !== ASCEND_ENUM.NONE) {
            game_p1_ascend.innerText = game_power(my_stone);
            game_p2_ascend.innerText = game_power(foe_stone);

            if (game_p1_ascend.innerText !== 'PR：0+0') game_p1_ascend.classList.add('text-primary');
            if (game_p2_ascend.innerText !== 'PR：0+0') game_p2_ascend.classList.add('text-primary');
        }


        // ASCEND结算
        const as = game.ed_as_2(true);
        game_match(my_stone, foe_stone);

        const pending_hp = [state.hp[0] - (state.pending_damage ? state.pending_damage[0] : 0), state.hp[1] - (state.pending_damage ? state.pending_damage[1] : 0)];
        const my_hp = my_color === PLAYER_ENUM.BLACK ? pending_hp[0] : pending_hp[1];
        const foe_hp = foe_color === PLAYER_ENUM.BLACK ? pending_hp[0] : pending_hp[1];

        if (as !== undefined) {
            const fx_done = gl_ui.ascend_settle(
                { 'left': game_p1_hp, 'right': game_p2_hp },
                () => {
                    if (state.pending_damage) {
                        state.hp[0] -= state.pending_damage[0];
                        state.hp[1] -= state.pending_damage[1];
                        state.pending_damage = null;
                    }
                    game_p1_hp.innerText = `HP：${my_hp}/${hp}`;
                    game_p2_hp.innerText = `HP：${foe_hp}/${hp}`;
                    document.documentElement.style.setProperty('--hp-color-p1', Math.trunc((my_hp / hp).toFixed(2) * 100).toString());
                    document.documentElement.style.setProperty('--hp-color-p2', Math.trunc((foe_hp / hp).toFixed(2) * 100).toString());
                },
                () => {
                    game_msg.innerText = `${my_icon}|${my_name}|剩余${my_hp} · ${foe_icon}|${foe_name}|剩余${foe_hp}`;
                }
            );

            game_msg.innerText = `${game_p1_ascend.innerText.slice(3)} VS ${game_p2_ascend.innerText.slice(3)}`;
            await window.sleep(900);

            game_p1_ascend.innerText = 'PR：0+0';
            game_p2_ascend.innerText = 'PR：0+0';

            game_p1_ascend.classList.remove('text-primary');
            game_p2_ascend.classList.remove('text-primary');

            await fx_done;
        }

        ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            gl_ui.clear_stone_ascend(pos.x, pos.y);
            gl_ui.clear_plant(pos.x, pos.y);
        });

        ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            gl_ui.clear_stone_ascend(pos.x, pos.y);
            gl_ui.clear_plant(pos.x, pos.y);
        });

        if (as !== undefined) {
            ascend_points[0].length = 0;
            ascend_points[1].length = 0;
        }


        // 切换回合
        game.ed_tr_2();
        game_match(my_stone, foe_stone);


        // 判断胜负
        const win = game.ed_win();
        if (win) {
            span_end_time.innerText = format_ms(await window.http_time_ms() - time);
            span_end_hp.innerText = `${my_hp} vs ${foe_hp}`;
            span_end_win.innerText = win === my_color ? my_name : foe_name;

            game_msg.innerText = win === my_color ? `🏆|${my_name}|胜利${my_icon}` : `💀|${foe_name}|胜利${foe_icon}`;
            gl_win = true;
            break;
        }


        // 生成植物
        const plants = game.ed_pl_1();
        if (plants) {
            plants.forEach((pos) => {
                gl_ui.clear_plant(pos.x, pos.y);
                const plant_count = pos.plant === PLANT_ENUM.TWO ? 2 : 1;
                gl_ui.draw_effect_plant(pos.x, pos.y, plant_count);
                plant_count === 1 ? gl_ui.draw_plant(pos.x, pos.y) : gl_ui.draw_2plant(pos.x, pos.y);
            });

            game_msg.innerText = '🪴植物已生成';
            gl_sound.play_plant();
            await window.sleep(488);
        }


        // ASCEND清理
        game.ed_as_3();
    }


    // 清理
    gl_ui.stop_click2move();
    gl_cf_client.notify('$', null);
    gl_ui.notify_click('$');


    // 请求清理
    gl_cf_client.stop_resend(900);
    // gl_cf_client.stop_resend(901);
    // gl_cf_client.stop_resend(903);

    // 给予
    button_tools_restart.disabled = false;
    button_tools_restart.classList.remove('pe-none');

    // 结算画面
    if (gl_win) {
        dialog_end.classList.remove('d-none');
        dialog_end.show();
    }
};


/**
 * @description: 导出对局存档
 * @return {string}
 */
const exportf = () => {
    let mode;
    if (gl_cf_mode === 'normal') mode = 0;
    else if (gl_cf_mode === 'blight') mode = 1;
    else if (gl_cf_mode === 'night') mode = 2;
    else throw Error('exportf error');

    const black_clock = gl_my_index === 0 ? gl_my_clock : gl_foe_clock;
    const white_clock = gl_my_index === 1 ? gl_my_clock : gl_foe_clock;

    return BaseZalgo.encode(ArchiveV0.save(
        [gl_rand_aic.seed, gl_rand_unity.seed, gl_rand_other.seed],
        [black_clock, white_clock],
        [gl_cf_health, gl_cf_health],
        gl_board.turns,
        gl_state.turn_count,
        gl_first_index,
        mode
    ));
};


if (!window.MainExports) window.MainExports = {};
window.MainExports.View = { setup, run, exportf };