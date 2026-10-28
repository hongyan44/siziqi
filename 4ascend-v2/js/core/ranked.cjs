/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 在线对局实现
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

const button_tools_restart = document.getElementById('button_tools_restart');
const button_tools_archive = document.getElementById('button_tools_archive');
const details_tools_observers = document.getElementById('details_tools_observers');


const dialog_end = document.getElementById('dialog_end');

const span_end_win = document.getElementById('span_end_win');
const span_end_hp = document.getElementById('span_end_hp');
const span_end_time = document.getElementById('span_end_time');
const span_end_score = document.getElementById('span_end_score');

const button_end_restart = document.getElementById('button_end_restart');
const button_end_match = document.getElementById('button_end_match');
const button_end_archive = document.getElementById('button_end_archive');


const dialog_leave = document.getElementById('dialog_leave');
const buttom_leave = document.getElementById('buttom_leave');


const dialog_diyerror = document.getElementById('dialog_diyerror');

const span_diy_my = document.getElementById('span_diy_my');
const span_diy_foe = document.getElementById('span_diy_foe');


const dialog_data = document.getElementById('dialog_data');


const button_home = document.getElementById('button_home');


const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const { GameNormal, GameBlight, GameNight, Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, Rand, State, ATK, AIC, ArchiveV0, RandAIC, RandUnity, RandOther } = window.FAscendExports;

const toast = new ShToast();


let gl_msg, gl_last, gl_leave, gl_leavep, gl_wins, gl_end, gl_leavevv;
let gl_sound, gl_ui, gl_archive;
let gl_my_score, gl_foe_score, gl_my_scorep, gl_foe_scorep, gl_my_name, gl_foe_name, gl_my_color, gl_foe_color, gl_time;
let gl_my_clock, gl_foe_clock;
let gl_sub_clock, gl_think_clock;
let gl_my_index, gl_foe_index, gl_first_index;
let gl_click_time, gl_click_level;
let gl_game, gl_rand_aic, gl_rand_unity, gl_rand_other, gl_board, gl_state, gl_timer;
let gl_cf_room, gl_cf_archive, gl_cf_health, gl_cf_initb, gl_cf_balance, gl_cf_mode, gl_cf_first, gl_cf_color, gl_cf_token, gl_cf_client;
let gl_my_uuid, gl_foe_uuid;
let gl_replay_uploaded = false;




/**
 * @description: 回合颜色更新
 * @param {boolean} my_turn
 * @return {string}
 */
const turn_color = (my_turn) => {
    if (my_turn) {
        game_p2_card.classList.remove('turn-blue');
        game_p2_info.classList.remove('turn-blue');
        game_p2_time.classList.remove('turn-blue');

        game_p1_card.classList.add('turn-green');
        game_p1_info.classList.add('turn-green');
        game_p1_time.classList.add('turn-green');

        game_msg.classList.remove('text-primary');
        game_msg.classList.add('text-success');

    } else {
        game_p1_card.classList.remove('turn-green');
        game_p1_info.classList.remove('turn-green');
        game_p1_time.classList.remove('turn-green');

        game_p2_card.classList.add('turn-blue');
        game_p2_info.classList.add('turn-blue');
        game_p2_time.classList.add('turn-blue');

        game_msg.classList.remove('text-success');
        game_msg.classList.add('text-primary');
    }
};

/**
 * @description: 清理大字体
 * @return {void}
 */
const title_clear = () => {
    game_msg.classList.remove('text-primary');
    game_msg.classList.remove('text-success');
};

/**
 * @description: 清理文字颜色
 * @return {void}
 */
const info_clear = () => {
    game_p1_card.classList.remove('turn-green');
    game_p1_info.classList.remove('turn-green');
    game_p1_time.classList.remove('turn-green');

    game_p2_card.classList.remove('turn-blue');
    game_p2_info.classList.remove('turn-blue');
    game_p2_time.classList.remove('turn-blue');

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

    gl_wins = false;
    gl_leave = false;
    gl_end = false;
    gl_replay_uploaded = false;

    title_clear();
    info_clear();

    gl_ui.clear();
    gl_ui.init();
    gl_ui.draw_board();

    // button_tools_restart.disabled = true;
    // button_tools_restart.classList.add('pe-none');
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
 * @description: 移动标记
 * @return {void}
 */
const my_move = async () => {
    const color = gl_state.turn_player === PLAYER_ENUM.BLACK ? '#e74c3c' : '#3498db';

    for await (const pos of gl_ui.iterator_move()) {
        gl_ui.clear_view_move();

        if (!pos) continue;
        if (pos === '$') break;

        gl_ui.draw_stone_move(pos[0], pos[1], color);
    }
};

/**
 * @description: 我方超时
 * @return {void}
 */
const my_pass = () => {
    gl_timer.stop();
    gl_ui.stop_click2move();

    let pass = true;

    if (gl_last[0] === -1 && gl_last[1] === -1) {
        const points = gl_board.data.filter((pos) =>
            pos.stone === STONE_ENUM.NONE ||
            (gl_state.turn_player === PLAYER_ENUM.BLACK && pos.stone === STONE_ENUM.WHITE_ASCEND) ||
            (gl_state.turn_player === PLAYER_ENUM.WHITE && pos.stone === STONE_ENUM.BLACK_ASCEND)
        );
        const point = points[gl_rand_other.xor(points.length)];
        pos = [point.x, point.y];

    } else {
        pos = gl_last;
        pass = 'as';
    }

    gl_ui.clear_view_move();
    gl_ui.notify_click([pos[0], pos[1], pass]);
};

/**
 * @description: 倒计时
 * @param {number} seconds
 * @return {void}
 */
const my_timer = (seconds) => {
    // 更新时间
    game_msg.innerText = `${gl_msg} ${seconds}秒`;
    gl_sub_clock = gl_think_clock - seconds;

    // 播放音效
    if (seconds <= 10) gl_sound.play_timer_tick();

    // 每一秒都在消耗额外思考时间
    if (gl_my_clock - gl_sub_clock >= 0) game_p1_clock.innerText = `CLK: ${gl_my_clock - gl_sub_clock}`;

    // 如果倒计时为0
    // 立刻停止点击
    if (seconds === 0) my_pass();
};

/**
 * @description: 落子校验
 * @param {number} x
 * @param {number} y
 * @return {boolean}
 */
const valid_ = (x, y) => {
    const valid = gl_game.valid(x, y, gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE);
    if (!valid) toast.error(`非法落子${x},${y}`);
    return valid;
};

/**
 * @description: 我方落子
 * @param {STONE_ENUM} my_stone
 * @return {Promise<[boolean, number]>}
 */
const my_pice = async (my_stone) => {
    gl_last = [-1, -1];
    let pass = false;
    let submit = 0;

    gl_ui.start_click2move();

    gl_think_clock = Math.min(gl_my_clock + 15, 60);
    gl_sub_clock = 0;

    gl_timer.reset(gl_think_clock, my_timer);
    gl_timer.start();

    for await (const pos of gl_ui.iterator_click()) {
        if (!pos) continue;
        if (pos === '$') {
            gl_timer.stop();
            gl_ui.stop_click2move();
            gl_ui.clear_stone_validate();
            return [false, 300];
        }

        // 提取
        const x = pos[0];
        const y = pos[1];
        pass = Boolean(pos[2]);

        // 间隔
        if (!pass && x === gl_last[0] && y === gl_last[1] && Date.now() - submit < gl_click_time) {
            toast.error('落子过快！');
            continue;
        }

        // 超时
        if (pass && gl_game.ed_tr_1(x, y)) break;

        // 计时完毕
        if (!gl_timer.is_active) return;

        // 校验
        if (!valid_(x, y)) continue;

        // 没有保护直接落子
        if (gl_click_level === 0 && gl_game.ed_tr_1(x, y)) break;

        // 清理确认提示
        gl_ui.clear_stone_validate();
        game_p1_ascend.classList.remove('text-primary');
        game_p1_ascend.innerText = 'PR：0+0';

        // 先计算ASCEND
        const points = gl_board.get_ascend(x, y, my_stone);
        const is_ascend = Boolean(points);

        // 仅ASCEND保护，但不是ASCEND
        if (!is_ascend && gl_click_level === 1 && gl_game.ed_tr_1(x, y)) break;

        // 这里是确认落子
        if (x === gl_last[0] && y === gl_last[1] && gl_game.ed_tr_1(x, y)) break;

        // 绘制虚拟棋子以提示
        gl_ui.draw_stone_validate(x, y, '#BF00FF');

        // 时间限定
        submit = Date.now();

        // 如果是ASCEND，则显示数值
        if (is_ascend) {
            game_p1_ascend.innerText = game_power(my_stone, points);
            game_p1_ascend.classList.add('text-primary');
        }

        // 记录
        gl_last[0] = x;
        gl_last[1] = y;
    }

    gl_timer.stop();
    gl_ui.stop_click2move();
    gl_ui.clear_stone_validate();

    gl_my_clock -= gl_sub_clock;
    if (gl_my_clock < 0) gl_my_clock = 0;
    if (gl_my_clock > 0) gl_my_clock += 5;
    if (gl_my_clock >= 0) game_p1_clock.innerText = `CLK: ${gl_my_clock}`;

    if (pass === 'as') pass = false;

    gl_cf_client.start_resend(GameMessage.sync_player2player(gl_cf_room, gl_cf_token, {
        'type': 'game_stone',
        'pos': gl_state.turn_pos,
        'pass': pass,
        'turn': gl_state.turn_count + 1,
        'clock': gl_my_clock
    }), 3888, 903);

    return [pass, gl_my_clock];
};

/**
 * @description: 敌方落子
 * @param {STONE_ENUM} foe_stone
 * @return {Promise<[boolean, number]>}
 */
const foe_pice = async (foe_stone) => {
    let x, y, pass;

    for await (const event of gl_cf_client) {
        if (event.type === '$') return [false, 300];
        if (event.type !== 'message' || event.data.op !== 'sync_player2player') continue;

        const result = event.data.result;
        if (result.type !== 'game_stone') continue;
        if (result.turn <= gl_state.turn_count) continue;

        const pos = result.pos;
        x = pos[0];
        y = pos[1];

        pass = result.pass;
        gl_foe_clock = result.clock;

        if (valid_(x, y)) break;
    }

    if (gl_foe_clock >= 0) game_p2_clock.innerText = `CLK: ${gl_foe_clock}`;
    gl_game.ed_tr_1(x, y, foe_stone);

    return [pass, gl_foe_clock];
};


/**
 * @description: 检测对方是否离开
 * @return {Promise<void>}
 */
const game_leave = async () => {
    const now = gl_board;

    while (true) {
        await window.sleep(3888);

        // 如果已经结束游戏则不再检测，如果不相同，那么游戏已经重新开始
        if (now !== gl_board || gl_end) break;

        let result;

        // 是否离开
        gl_cf_client.start_resend(GameMessage.room_foele(gl_cf_room, gl_cf_token), 1000, 2000);
        for await (const event of gl_cf_client) {
            if (event.type === '$$$') throw Error();
            if (event.type === 'message' && event.data.op === 'room_foele') {
                result = event.data.result;
                break;
            }
        }
        gl_cf_client.stop_resend(2000);
        const lef = result;

        // 心跳太远判断为离线，20s
        gl_cf_client.start_resend(GameMessage.room_foeex(gl_cf_room, gl_cf_token), 1000, 2000);
        for await (const event of gl_cf_client) {
            if (event.type === '$$$') throw Error();
            if (event.type === 'message' && event.data.op === 'room_foeex') {
                result = event.data.result;
                break;
            }
        }
        gl_cf_client.stop_resend(2000);
        // console.log(lef, result, Date.now() - 25 * 1000, result >= Date.now() - 25 * 1000);

        // 如果没有离线就不判断
        if (!lef && result >= await window.http_time_ms() - 25 * 1000) continue;
        // alert('对方离线');

        gl_leavevv = true;
        gl_cf_client.send(GameMessage.ranked_endgame(
            window.get_token(),
            gl_cf_room,
            'A',
            '$my_end',
            false,
        ));
        // break;
    }
};

/**
 * @description: 不停的检测是否结算成功
 * @return {Promise<void>}
 */
const game_end = async () => {
    let status, result;

    for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'ranked_endgame') {
        result = event.data.result;
        status = event.data.status;

        if (status) break;
    }
    // console.log(result);

    gl_leave = true;
    gl_end = true;
    gl_cf_client.notify('$', null);
    gl_ui.notify_click('$', null);

    gl_cf_client.stop_resend(4440);
    gl_cf_client.stop_resend(7790);

    const add_sub = (n) => n < 0 ? n : '+' + n;

    // 只要结算包，那么，就是真结算，直接弹出结算界面
    if (!result) return;

    const my_p = result.my - gl_my_score;
    const foe_p = result.foe - gl_foe_score;

    const win_p = result.win_p;

    // 结算，对局时间与玩家血量
    const my_hp = gl_my_color === PLAYER_ENUM.BLACK ? gl_state.hp[0] : gl_state.hp[1];
    const foe_hp = gl_foe_color === PLAYER_ENUM.BLACK ? gl_state.hp[0] : gl_state.hp[1];
    const winner = win_p === 'my' ? (gl_my_color === PLAYER_ENUM.BLACK ? 'A' : 'B') : win_p === 'foe' ? (gl_foe_color === PLAYER_ENUM.BLACK ? 'A' : 'B') : 'none';

    span_end_time.innerText = format_ms(await window.http_time_ms() - gl_time);
    span_end_hp.innerText = `${my_hp} vs ${foe_hp}`;
    span_end_score.innerText = `我方 (${add_sub(my_p)}) | 对方 (${add_sub(foe_p)})`;

    // alert(String(gl_leavevv) + "||" + String(gl_leave));
    span_end_win.innerText = win_p === 'my' ? gl_my_name : gl_foe_name;

    // 结算画面
    dialog_end.classList.remove('d-none');
    dialog_end.show();

    // 排位只有在服务端返回正式结算后才上传，双方重复上传由服务端幂等去重。
    if (!gl_replay_uploaded && result && typeof window.http_replay_update === 'function') {
        gl_replay_uploaded = true;
        const archive_data = BaseZalgo.decode(exportf());
        window.http_replay_update(gl_cf_token, gl_foe_uuid, archive_data, {
            black_uuid: gl_my_color === PLAYER_ENUM.BLACK ? gl_my_uuid : gl_foe_uuid,
            white_uuid: gl_my_color === PLAYER_ENUM.WHITE ? gl_my_uuid : gl_foe_uuid,
            time: Math.floor(gl_time / 1000),
            duration: Math.max(0, Math.floor((await window.http_time_ms() - gl_time) / 1000)),
            mode: gl_cf_mode === 'night' ? 2 : gl_cf_mode === 'blight' ? 1 : 0,
            category: 'ranked',
            first: gl_first_index,
            black_hp: gl_state.hp[0],
            white_hp: gl_state.hp[1],
            result: winner
        }).then((uploaded) => {
            const replay_id = Number(uploaded && uploaded.id) || 0;
            if (replay_id) console.info('排位回放已保存:', replay_id);
            else console.warn('排位回放保存失败：服务端未返回回放 ID');
            // 棋币与经验结算：排位模式棋币 ×3、经验 ×2，这里仅做提示
            const coin_reward = Number(uploaded && uploaded.reward) || 0;
            const exp_reward = Number(uploaded && uploaded.exp_reward) || 0;
            if (coin_reward > 0 || exp_reward > 0) {
                toast.success(`本局获得 ${coin_reward} 棋币 · ${exp_reward} 经验`);
            }
        }).catch((error) => {
            console.error('排位回放上传失败:', error);
        });
    }
};




// 如果对局正在进行中，则需要不断轮询检测是否强制结束对局
// 如果对局正常结束，那么则立刻显示，然后结算计分
// 才能将匹配的按钮重新允许点击，必须结算完毕才是真正的结算




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

        // run();
        // dialog_tools.hide();
        dialog_leave.classList.remove('d-none');
        dialog_leave.show();
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

    // button_end_restart.addEventListener('pointerdown', (event) => {
    //     if (event.target !== button_end_restart) return;

    //     run();
    //     dialog_end.hide();
    // });

    button_end_match.addEventListener('pointerdown', (event) => {
        if (event.target !== button_end_match) return;

        button_home.classList.remove('d-none');
        gl_leavep = false;
        gl_cf_client.notify('$$$', null);
        game_msg.innerText = '等待加入匹配池';
        window.switch_wection(main_opt, main_game);
        dialog_end.hide();
    });

    buttom_leave.addEventListener('pointerdown', async (event) => {
        if (event.target !== buttom_leave) return;

        let status;
        gl_cf_client.start_resend(GameMessage.room_setle(gl_cf_room, gl_cf_token), 1000, 2001);
        for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'room_setle') {
            status = event.data.status;
            break;
        }
        gl_cf_client.stop_resend(2001);
        toast.success('逃跑成功！');
        location.replace('/');
    });
})();

// 对话框防误触关闭
(() => {
    dialog_tools.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_end.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_diyerror.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_leave.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_data.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
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
 * 
 * @param {string} room
 * @param {string} archive
 * 
 * @param {number} health
 * @param {string} initb
 * 
 * @param {string} balance
 * @param {string} mode
 * 
 * @param {string} first
 * @param {string} color
 * @return {void}
 */
const setup = (client, token, room, archive, health, initb, balance, mode, first, color) => {
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
    gl_ui.set_sound(gl_sound);

    game_top_card.style.width = `${size}px`;


    gl_cf_client = client;
    gl_cf_token = token;

    gl_cf_room = room;
    gl_cf_archive = archive;

    gl_cf_health = health;
    gl_cf_initb = initb;

    gl_cf_balance = balance;
    gl_cf_mode = mode;

    gl_cf_first = first;
    gl_cf_color = color;
};


/**
 * @description: 游戏循环
 * @return {Promise<void>}
 */
const run = async () => {
    gl_replay_uploaded = false;

    // 清理
    game_clear();
    game_redraw();
    game_end();


    // 背景
    gl_cf_client.start_resend(GameMessage.ranked_endgame(
        window.get_token(),
        gl_cf_room,
        'A',
        '',
        true,
    ), 3888, 7790);


    // 变量
    let result, start;
    gl_replay_uploaded = false;

    gl_leavep = false;
    gl_end = false;
    gl_leavevv = false;

    // 常量
    let archive;
    if (gl_cf_archive !== '') {
        archive = ArchiveV0.load(BaseZalgo.decode(gl_cf_archive));
        // gl_cf_archive = '';
    }
    gl_archive = archive;
    // console.log(archive);


    // 初始化信息
    const info = await window.http_user_info(gl_cf_token);
    const my_name = info.name;
    const my_uuid = info.uuid;
    gl_my_uuid = my_uuid;
    const my_score = info.score;
    // console.log(info);


    // 重置对局
    game_msg.innerText = '🤔等待对方开始新对局';
    gl_cf_client.start_resend(GameMessage.sync_player2player(gl_cf_room, gl_cf_token, {
        'type': 'game_reset',
        'archive': gl_cf_archive,
        'health': gl_cf_health,
        'initb': gl_cf_initb,
        'balance': gl_cf_balance,
        'mode': gl_cf_mode,
        'first': gl_cf_first,
        'color': gl_cf_color,
    }), 1000, 900);
    for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'sync_player2player') {
        result = event.data.result;
        if (result.type === 'game_reset') break;
    }
    await window.sleep(388);

    const foe_cf_archive = result.archive;

    const foe_cf_health = result.health;
    const foe_cf_initb = result.initb;

    const foe_cf_balance = result.balance;
    const foe_cf_mode = result.mode;

    const foe_cf_first = result.first;
    const foe_cf_color = result.color;


    // 对局配置校验
    const my_cfs = [gl_cf_archive, gl_cf_health, gl_cf_initb, gl_cf_balance, gl_cf_mode];
    const foe_cfs = [foe_cf_archive, foe_cf_health, foe_cf_initb, foe_cf_balance, foe_cf_mode];

    if (
        my_cfs.filter((_, index) => my_cfs[index] !== foe_cfs[index]).length > 0 // 配置必须一致
        ||
        (gl_cf_first !== 'rand' && foe_cf_first !== 'rand' && gl_cf_first === foe_cf_first) // 不允许选择相同的先手决定，除非是随机
        ||
        (gl_cf_color !== 'rand' && foe_cf_color !== 'rand' && gl_cf_color === foe_cf_color) // 不允许选择相同的阵营决定，除非是随机
        ||
        ((gl_cf_first === 'rand' && foe_cf_first !== 'rand') || gl_cf_first !== 'rand' && foe_cf_first === 'rand') // 一方选择随机，另外一方也必须选择
        ||
        ((gl_cf_color === 'rand' && foe_cf_color !== 'rand') || gl_cf_color !== 'rand' && foe_cf_color === 'rand') // 一方选择随机，另外一方也必须选择
    ) {
        // gl_cf_client.stop_resend(900);
        game_msg.innerText = '❌对局配置冲突';

        if (my_cfs[0] === foe_cfs[0]) {
            my_cfs[0] = 'yes';
            foe_cfs[0] = 'yes';
        } else {
            my_cfs[0] = 'yes';
            foe_cfs[0] = 'no';
        }

        span_diy_my.innerText = ['我方:'].concat(...my_cfs).concat(gl_cf_first, gl_cf_color).join(' | ');
        span_diy_foe.innerText = ['对方:'].concat(...foe_cfs).concat(foe_cf_first, foe_cf_color).join(' | ');

        dialog_diyerror.classList.remove('d-none');
        dialog_diyerror.show();
        return;
    }


    // 对局数据协商
    let hp;
    let rand_aic, rand_unity, rand_other, time;
    let my_color, foe_color;
    let my_stone, my_icon, my_label, my_index;
    let foe_stone, foe_icon, foe_label, foe_index;
    let first_color, first_icon, first_index;
    let game, board, state, timer;

    const my_seed_aic = Date.now();
    const my_seed_unity = Math.floor(Date.now() / 1000) ^ crypto.getRandomValues(new Uint32Array(1))[0];
    const my_seed_other = crypto.getRandomValues(new Uint32Array(1))[0];

    const my_time = await window.http_time_ms();

    game_msg.innerText = '☕等待新对局数据传输';
    gl_cf_client.start_resend(GameMessage.sync_player2player(gl_cf_room, gl_cf_token, {
        'type': 'game_start',
        'seed_aic': my_seed_aic,
        'seed_unity': my_seed_unity,
        'seed_other': my_seed_other,
        'uuid': my_uuid,
        'time': my_time,
        'name': my_name,
        'score': my_score,
    }), 1000, 901);
    for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'sync_player2player') {
        result = event.data.result;
        if (result.type === 'game_start') break;
    }
    await window.sleep(388);

    const foe_seed_aic = result.seed_aic;
    const foe_seed_unity = result.seed_unity;
    const foe_seed_other = result.seed_other;

    const foe_uuid = result.uuid;
    gl_foe_uuid = foe_uuid;
    const foe_time = result.time;
    const foe_name = result.name;
    const foe_score = result.score;


    // 决定对局开始时间
    time = Math.max(my_time, foe_time);

    const seed_aic = Math.max(my_seed_aic, foe_seed_aic);
    const seed_unity = Math.max(my_seed_unity, foe_seed_unity);
    const seed_other = Math.max(my_seed_other, foe_seed_other);

    // 决定随机数种子
    rand_aic = new RandAIC(seed_aic);
    rand_unity = new RandUnity(seed_unity);
    rand_other = new RandOther(seed_other);
    // console.log(
    //     Math.max(my_seed_aic, foe_seed_aic) >>> 0,
    //     Math.max(my_seed_unity, foe_seed_unity >>> 0),
    //     Math.max(my_seed_other, foe_seed_other) >>> 0
    // );

    gl_rand_aic = rand_aic;
    gl_rand_unity = rand_unity;
    gl_rand_other = rand_other;

    gl_my_score = my_score;
    gl_foe_score = foe_score;

    gl_my_name = my_name;
    gl_foe_name = foe_name;

    gl_time = time;
    // console.log(my_score, foe_score);

    score_tools_p1.innerText = my_score;
    score_tools_p2.innerText = foe_score;


    // 验证数据
    let resultv;

    game_msg.innerText = '📝验证对局数据中';
    gl_cf_client.start_resend(GameMessage.sync_player2player(gl_cf_room, gl_cf_token, {
        'type': 'game_verify',
        'seed_aic': seed_aic,
        'seed_unity': seed_unity,
        'seed_other': seed_other,
    }), 1000, 906);
    for await (const event of gl_cf_client) if (event.type === 'message' && event.data.op === 'sync_player2player') {
        resultv = event.data.result;
        if (resultv.type === 'game_verify') break;
    }

    if (seed_aic !== resultv.seed_aic || seed_unity !== resultv.seed_unity || seed_other !== resultv.seed_other) {
        gl_cf_client.stop_resend(900);
        gl_cf_client.stop_resend(901);
        gl_cf_client.stop_resend(906);
        game_msg.innerText = '❌对局数据不正确';

        dialog_data.classList.remove('d-none');
        dialog_data.show();
        return;
    }
    await window.sleep(388);


    // 决定棋子颜色
    const uuids = [my_uuid, foe_uuid].sort();
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
    if (gl_cf_color !== 'rand' && foe_cf_color !== 'rand') {
        [my_color, my_stone, my_icon, my_label, my_index] = gl_cf_color === 'my' ? [PLAYER_ENUM.BLACK, STONE_ENUM.BLACK, '⚫', '黑方', 0] : [PLAYER_ENUM.WHITE, STONE_ENUM.WHITE, '⚪', '白方', 1];
        [foe_color, foe_stone, foe_icon, foe_label, foe_index] = gl_cf_color === 'foe' ? [PLAYER_ENUM.BLACK, STONE_ENUM.BLACK, '⚫', '黑方', 0] : [PLAYER_ENUM.WHITE, STONE_ENUM.WHITE, '⚪', '白方', 1];
    }

    // 生命值、初始盘面、先手平衡、先手决定
    game_msg.innerText = '🍳对局加载中';
    if (!archive) {
        state.hp = [gl_cf_health, gl_cf_health];
        hp = gl_cf_health;

        if (gl_cf_first !== 'rand' && foe_cf_first !== 'rand') {
            let temp_stone;
            if (gl_cf_first === 'my' && foe_cf_first === 'foe') temp_stone = my_stone;
            else if (gl_cf_first === 'foe' && foe_cf_first === 'my') temp_stone = foe_stone;

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

    gl_my_color = my_color;
    gl_foe_color = foe_color;


    // 观战同步
    gl_cf_client.start_resend(GameMessage.sync_player2observers(gl_cf_room, gl_cf_token, {
        'type': 'view_sync',
        'uuids': [my_uuid, foe_uuid],
        'names': [my_name, foe_name],
        'scores': [my_score, foe_score],
        'time': time,
        'archive': gl_cf_archive,
        'health': gl_cf_health,
        'initb': gl_cf_initb,
        'balance': gl_cf_balance,
        'mode': gl_cf_mode,
        'first': gl_cf_first,
        'color': gl_cf_color,
        'turns': [],
        'seed_aic': seed_aic,
        'seed_unity': seed_unity,
        'seed_other': seed_other
    }), 3888, 905);


    // 信息显示
    game_msg.innerText = `${my_icon}我方是${my_label}`;
    await window.sleep(788);

    game_msg.innerText = `${foe_icon}对方是${foe_label}`;
    await window.sleep(788);

    game_msg.innerText = `${first_icon}${first_color === my_color ? '我方' : '对方'}是先手`;
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
    // 双方昵称颜色（登录玩家用自己设置的颜色，对方用其设置的颜色）
    window.name_color_apply_pair([{ uuid: my_uuid, node: game_p1_name }, { uuid: foe_uuid, node: game_p2_name }]);

    game_redraw();

    // 成就：首次进入真人对局
    if (typeof window.achievement_event === 'function') window.achievement_event('online_enter');

    // gl_cf_client.stop_resend(900);
    // gl_cf_client.stop_resend(901);
    // gl_cf_client.stop_resend(906);

    if (!gl_leavep) {
        gl_leavep = true;
        game_leave();
    }


    const turns = [];
    const ascend_points = [[], []];


    // 开始游戏
    while (true) {
        // 我方回合？
        const [my_turn, turn_icon, turn_label] = my_color === state.turn_player ? [true, my_icon, '我方'] : [false, foe_icon, '对方'];

        // 回合提示
        game_msg.innerText = `${turn_icon}轮到（${turn_label}）落子`;
        gl_msg = game_msg.innerText;

        // 回合颜色
        turn_color(my_turn);

        // 轮到我方时，棋盘外缘低频闪烁
        if (gl_ui) gl_ui.set_turn_flash(my_turn);

        // 数据显示
        game_match(my_stone, foe_stone);


        // 清理对局请求
        if (my_turn && start) {
            gl_cf_client.stop_resend(900);
            gl_cf_client.stop_resend(901);
            gl_cf_client.stop_resend(903);
            gl_cf_client.stop_resend(904);
            gl_cf_client.stop_resend(905);
            gl_cf_client.stop_resend(906);
        } else if (my_turn) start = true;


        // 落子
        if (!window.isphone) my_move();
        const [pass, cp] = my_turn ? await my_pice(my_stone) : await foe_pice(foe_stone);
        if (gl_leave) break;

        // 同步
        turns.push([state.turn_pos[0], state.turn_pos[1], pass, cp]);

        // 反击/卖血：击落对方盘旋中的这枚棋子
        gl_ui.ascend_counter(state.turn_pos[0], state.turn_pos[1]);

        // 同步
        gl_cf_client.start_resend(GameMessage.sync_player2observers(gl_cf_room, gl_cf_token, {
            'type': 'view_sync',
            'uuids': [my_uuid, foe_uuid],
            'names': [my_name, foe_name],
            'scores': [my_score, foe_score],
            'time': time,
            'archive': gl_cf_archive,
            'health': gl_cf_health,
            'initb': gl_cf_initb,
            'balance': gl_cf_balance,
            'mode': gl_cf_mode,
            'first': gl_cf_first,
            'color': gl_cf_color,
            'turns': turns,
            'seed_aic': seed_aic,
            'seed_unity': seed_unity,
            'seed_other': seed_other,
        }), 4888, 904);

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
                    game_msg.innerText = `${my_icon}我方剩余${my_hp} · ${foe_icon}对方剩余${foe_hp}`;
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
            gl_wins = true;
            if (gl_ui) gl_ui.set_turn_flash(false);
            // 成就：赢下真人对局
            if (win === my_color && typeof window.achievement_event === 'function') window.achievement_event('online_win');
            game_msg.innerText = win === my_color ? `🏆|${my_name}|胜利${my_icon}` : `💀|${foe_name}|胜利${foe_icon}`;
            span_end_win.innerText = win === my_color ? my_name : foe_name;
            gl_end = true;
            gl_cf_client.start_resend(GameMessage.ranked_endgame(
                window.get_token(),
                gl_cf_room,
                win === my_color ? 'A' : 'B',
                exportf(),
                false,
            ), 888, 4440);
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


    // 请求清理
    gl_cf_client.stop_resend(900);
    gl_cf_client.stop_resend(901);
    gl_cf_client.stop_resend(903);
    gl_cf_client.stop_resend(904);
    gl_cf_client.stop_resend(905);

    // 清理文字颜色
    title_clear();

    // 重置对局存档，重置玩家阵营决定
    if (archive) {
        gl_cf_color = 'rand';
        gl_cf_archive = '';
    }

    game_msg.innerText = '💬对局结算';
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
window.MainExports.Online = { setup, run, exportf };