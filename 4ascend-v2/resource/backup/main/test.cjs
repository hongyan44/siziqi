/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 对局完整实现
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');


const main_game = document.getElementById('main_game');
const main_app = document.getElementById('main_app');


const header_main = document.getElementById('header_main');
const footer_main = document.getElementById('footer_main');


const canvas_board = document.getElementById('canvas_board');
const canvas_stone = document.getElementById('canvas_stone');
const canvas_view = document.getElementById('canvas_view');
const canvas_plant = document.getElementById('canvas_plant');
const canvas_turn = document.getElementById('canvas_turn');
const canvas_ascend = document.getElementById('canvas_ascend');


const dialog_game = document.getElementById('dialog_game');
const textarea_game = document.getElementById('textarea_game');
const button_game_restart = document.getElementById('button_game_restart');
const button_game_archive = document.getElementById('button_game_archive');


const game_bl_hp = document.getElementById('game_bl_hp');
const game_bl_ascend = document.getElementById('game_bl_ascend');
const game_bl_name = document.getElementById('game_bl_name');
const game_bl_color = document.getElementById('game_bl_color');
const game_bl_crad = document.getElementById('game_bl_crad');


const game_wh_hp = document.getElementById('game_wh_hp');
const game_wh_ascend = document.getElementById('game_wh_ascend');
const game_wh_name = document.getElementById('game_wh_name');
const game_wh_color = document.getElementById('game_wh_color');
const game_wh_crad = document.getElementById('game_wh_crad');


const { Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Game, Pos, RandAIC, RandUnity, State, ATK, AIC, Archive, GameTest } = window.FAscendExports;

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
    const black_h = game_bl_crad.getBoundingClientRect().height;
    const white_h = game_wh_crad.getBoundingClientRect().height;

    const body_style = window.getComputedStyle(document.body);
    const container_style = window.getComputedStyle(main_app);
    const main_style = window.getComputedStyle(main_game);

    const vpad =
        parseFloat(container_style.paddingTop)
        + parseFloat(container_style.paddingBottom)
        + parseFloat(body_style.paddingTop)
        + parseFloat(body_style.paddingBottom);

    const vgap = (parseFloat(main_style.rowGap) || 0) * 2 + (parseFloat(container_style.gap) || 0);

    const avail_h = window.visualViewport.height - header_h - footer_h - vpad - black_h - white_h - vgap; // 计算高度
    const avail_w = window.visualViewport.width - 2; // 手机端留空

    return Math.floor(Math.min(avail_h, avail_w));
};

/**
 * @description: 等待函数
 * @param {number} ms
 * @return {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description: 生成一个随机数
 * @return {number}
 */
const ruint32 = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
};




let game_sound = new GameSound(0.8, 4.0);

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
    // 对话框防关闭
    dialog_game.addEventListener('sl-request-close', (e) => e.detail.source === 'overlay' && e.preventDefault());
})();

(() => {
    // 对局开始
    const pid = setInterval(() => {
        if (!window.loaded) return;
        clearInterval(pid);

        game_run();
    }, 10);
})();

(() => {
    // 主界面音乐播放
    window.addEventListener('load', () => {
        window.addEventListener('click', async () => {
            await game_sound.context.resume();
            await game_sound.init();
            // game_sound.play_main();
        }, { 'once': true });
    });
})();




let gl_rand, gl_state, gl_board;
let gl_datasave;

let gameing = false;




// 对话框唤出
game_msg.addEventListener('pointerdown', (event) => {
    if (event.target !== game_msg) return;

    dialog_game.classList.remove('d-none');
    dialog_game.show();
});

// 快照保存
button_game_archive.addEventListener('pointerdown', (event) => {
    if (event.target !== button_game_archive) return;

    try {
        const output = Archive.save(gl_board, gl_state, gl_rand);
        const string = BaseZalgo.encode(output);

        textarea_game.value = string;

        toast.success('对局序列化为数据成功！');
    } catch (error) {
        console.log(error);
        toast.error('对局序列化为数据失败！');
    }
});

// 清理输入框
dialog_game.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_game) return;

    textarea_game.value = '';
});

// 重赛
button_game_restart.addEventListener('pointerdown', (event) => {
    if (event.target !== button_game_restart || gameing) return;

    dialog_game.hide();
    game_run();
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

    game_wh_crad.style.width = size;
    game_bl_crad.style.width = size;


    // 重置
    // game_wh_name.innerText = '?';
    // game_wh_hp.innerText = 'HP：?';
    // game_wh_ascend.innerText = 'PR：?';
    // game_wh_color.innerText = '?';

    // game_bl_name.innerText = '?';
    // game_bl_hp.innerText = 'HP：?';
    // game_bl_ascend.innerText = 'PR：?';
    // game_bl_color.innerText = '?';

    game_wh_crad.classList.remove('player-active-p1');
    game_bl_crad.classList.remove('player-active-p2');

    game_wh_hp.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');
    game_wh_name.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');

    game_bl_hp.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');
    game_bl_name.classList.remove('hp-red', 'hp-yellow', 'hp-blue', 'hp-green');


    // 变量
    const pids = [];


    /**
     * @description: 落子校验
     * @param {number} x
     * @param {number} y
     * @return {boolean}
     */
    const local_valid = (x, y) => {
        const valid = game.valid(x, y, now_stone);
        if (!valid) toast.error('你不能在这里落子！');
        return valid;
    };

    /**
     * @description: 我方落子
     * @return {Promise<boolean>}
     */
    const locl_pice = async () => {
        let last = [-1, -1];
        let pass = false;

        game_ui.start_click2move();
        game_timer.reset(500, 10);
        game_timer.start();

        for await (const pos of game_ui.iterator_click()) {
            if (!pos) continue;

            const x = pos[0];
            const y = pos[1];
            pass = pos[2];

            // 超时
            if (pass && game.ed_tr_1(x, y)) break;

            // 计时完毕
            if (!game_timer.is_running) return;

            // 校验
            if (!local_valid(x, y)) continue;

            // ASCEND，清理之前的提示
            game_ui.clear_ascend();

            // ASCEND，计算
            const is_ascend = Boolean(board.get_ascend(x, y, now_stone));

            // ASCEND，不触发
            if (!is_ascend && game.ed_tr_1(x, y)) break;

            // ASCEND，触发
            if (is_ascend && x === last[0] && y === last[1] && game.ed_tr_1(x, y)) break;

            // ASCEND，提示
            if (is_ascend) game_ui.draw_pstone(x, y, '#BF00FF');

            // 记录
            last[0] = x;
            last[1] = y;
        }

        game_timer.stop();
        game_ui.stop_click2move();
        game_ui.clear_ascend();

        return pass;
    };

    /**
     * @description: 我方超时
     * @return {void}
     */
    const local_pass = () => {
        game_timer.stop();
        game_ui.stop_click2move();

        const points = board.data.filter((pos) =>
            pos.stone === STONE_ENUM.NONE ||
            (state.turn_player === PLAYER_ENUM.BLACK && pos.stone === STONE_ENUM.WHITE_ASCEND) ||
            (state.turn_player === PLAYER_ENUM.WHITE && pos.stone === STONE_ENUM.BLACK_ASCEND)
        );
        const pos = points[ruint32() % points.length];

        game_ui.notify_click([pos.x, pos.y, true]);
    };

    /**
     * @description: 移动标记
     * @return {void}
     */
    const local_move = async () => {
        for await (const pos of game_ui.iterator_move()) {
            game_ui.clear_view();

            if (pos === 'end') break;
            if (!pos) continue;

            game_ui.draw_view(pos[0], pos[1], state.turn_player === PLAYER_ENUM.BLACK ? '#e74c3c' : '#3498db');
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

    function getUniformIndex(max) {
        const limit = Math.floor(0xFFFFFFFF / max) * max;
        let r;
        do {
            r = ruint32();
        } while (r >= limit);
        return r % max;
    }


    // 游戏开局
    const board = new Board(9, 9);
    const state = new State();
    const rand_aic = new RandAIC(Date.now());
    const rand_unity = new RandUnity(Math.floor(Date.now() / 1000));
    const game = new GameTest(board, state, rand_aic, rand_unity);

    const game_timer = new GameTimer(game_msg, local_pass);

    const ascend_points = [[], []];

    state.turn_player = PLAYER_ENUM;

    const turns = [[5,4,false,false],[0,8,false,false],[4,5,false,false],[4,7,false,false],[1,7,false,false],[0,0,false,false],[3,3,false,false],[4,6,false,false],[2,7,false,false],[6,4,false,false],[1,2,false,true],[3,6,false,false],[2,0,false,false],[1,8,false,false],[2,6,false,false],[7,2,false,false],[4,1,false,false],[4,4,false,false],[8,5,false,false],[8,1,false,false],[5,7,false,false],[2,8,false,true],[2,2,false,false],[6,7,false,false],[6,0,false,false],[5,2,false,false],[7,8,false,false],[3,2,false,false],[0,6,false,false],[4,8,false,false],[0,2,false,true],[0,1,false,false],[7,6,false,false],[2,1,false,false],[6,6,false,false],[0,4,false,false],[8,4,false,false],[0,5,false,false],[3,5,false,false],[6,8,false,true],[7,0,false,false],[2,4,false,false],[7,3,false,false],[0,3,false,false],[3,0,false,false],[1,4,false,false],[5,0,false,false],[7,5,false,false],[3,7,false,true],[0,7,false,false],[6,1,false,false],[7,4,false,true],[5,1,false,false],[6,5,false,false],[2,5,false,true],[8,7,false,false],[1,6,false,false],[1,3,false,true],[4,2,true,false],[7,1,true,true],[8,3,false,false],[1,1,false,false],[5,5,true,false],[5,6,true,true],[5,1,false,false],[5,3,false,false],[3,1,true,false],[6,5,false,false]]

    const turnsave = [];


    // 全局
    gl_board = board;
    gl_rand = rand_aic;
    gl_state = state;


    // 原始数据
    const black_alhp = state.hp[0];
    const white_alhp = state.hp[1];

    let white_textcal = 'text-success', black_textcal = 'text-success';

    game_bl_hp.classList.add(black_textcal);
    game_wh_hp.classList.add(white_textcal);

    game_bl_name.classList.add(black_textcal);
    game_wh_name.classList.add(white_textcal);


    // 初始化
    game_bl_ascend.innerText = 'PR：0+0';
    game_wh_ascend.innerText = 'PR：0+0';

    game_bl_hp.innerText = `HP：${black_alhp}/${black_alhp}`;
    game_wh_hp.innerText = `HP：${white_alhp}/${white_alhp}`;

    const is_phone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const turn_line = is_phone ? 4 : 7;

    let now_stone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;

    const htmlr = location.href === 'http://127.0.0.1:9001/test.html?r'


    // 游戏循环
    while (true) {
        // 黑方回合?
        const black_turn = state.turn_player === PLAYER_ENUM.BLACK;

        now_stone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;


        // 呼吸提示
        game_bl_crad.classList.remove('player-active-p1');
        game_wh_crad.classList.remove('player-active-p2');
        black_turn ? game_bl_crad.classList.add('player-active-p1') : game_wh_crad.classList.add('player-active-p2');


        // 文字颜色
        game_msg.classList.add('text-success');


        // 回合提示
        game_msg.innerText = black_turn ? `⚫轮到（黑方）落子` : `⚪轮到（白方）落子`;


        // 落子
        if (!is_phone) local_move();
        const pass = await locl_pice();
        // const pass = true;
        // setTimeout(() => {
        //     if (htmlr) {
        //         const points_ = board.data.filter((pos) =>
        //             pos.stone === STONE_ENUM.NONE ||
        //             (state.turn_player === PLAYER_ENUM.BLACK && pos.stone === STONE_ENUM.WHITE_ASCEND) ||
        //             (state.turn_player === PLAYER_ENUM.WHITE && pos.stone === STONE_ENUM.BLACK_ASCEND)
        //         );
        //         const pos_ = points_[getUniformIndex(points_.length)];
        //         game.ed_tr_1(pos_.x, pos_.y);
        //         game_ui.notify_click([0, 0, true]);
        //     } else {
        //         game.ed_tr_1(turns[state.turn_count][0], turns[state.turn_count][1]);
        //         game_ui.notify_click([0, 0, true]);
        //     }
        // }, 50);
        // for await (const _ of game_ui.iterator_click()) break;


        // 颜色清理
        game_msg.classList.remove('text-success');


        // 上一步与鼠标预览
        game_ui.clear_turn();
        game_ui.clear_view();
        game_ui.draw_turn(state.turn_pos[0], state.turn_pos[1], pass ? '#FFD700' : '#00FFC5', turn_line);

        game_sound.play_stone();


        // ASCEND开始
        const points = game.ed_as_1();

        const vvv_ = board.turns.at(-1);
        const asc_ = state.ascend_status !== ASCEND_ENUM.NONE ? true : false;

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
            game_bl_ascend.innerText = power(PLAYER_ENUM.BLACK);
            game_wh_ascend.innerText = power(PLAYER_ENUM.WHITE);

            if (game_bl_ascend.innerText !== 'PR：0+0') game_bl_ascend.classList.add('text-primary');
            if (game_wh_ascend.innerText !== 'PR：0+0') game_wh_ascend.classList.add('text-primary');
        }


        // ASCEND结算
        const as = game.ed_as_2();


        // 血量显示
        const black_hp = state.hp[0];
        const white_hp = state.hp[1];

        const black_scle = black_hp / black_alhp;
        const white_scle = white_hp / white_alhp;

        game_bl_hp.innerText = `HP：${black_hp}/${black_alhp}`;
        game_wh_hp.innerText = `HP：${white_hp}/${white_alhp}`;

        const black_textc = scle(black_scle);
        const white_textc = scle(white_scle);


        if (black_textc !== black_textcal) {
            game_bl_hp.classList.remove(black_textcal);
            game_bl_name.classList.remove(black_textcal);

            black_textcal = black_textc;

            game_bl_hp.classList.add(black_textc);
            game_bl_name.classList.add(black_textc);
        }

        if (white_textc !== white_textcal) {
            game_wh_hp.classList.remove(white_textcal);
            game_wh_name.classList.remove(white_textcal);

            white_textcal = white_textc;

            game_wh_hp.classList.add(white_textc);
            game_wh_name.classList.add(white_textc);
        }


        if (as !== undefined) {
            game_msg.innerText = `⚫${game_bl_ascend.innerText.slice(3)} VS ⚪${game_wh_ascend.innerText.slice(3)}`;
            await sleep(300);
            game_msg.innerText = `⚫黑方剩余${state.hp[0]}`;
            await sleep(300);
            game_msg.innerText = `⚪白方剩余${state.hp[1]}`;
            await sleep(300);

            game_bl_ascend.innerText = 'PR：0+0';
            game_wh_ascend.innerText = 'PR：0+0';

            game_bl_ascend.classList.remove('text-primary');
            game_wh_ascend.classList.remove('text-primary');
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
        if (win || state.turn_count === turns.length) {
            turnsave.push([vvv_[0], vvv_[1], false, false]);
            game_msg.innerText = win === PLAYER_ENUM.BLACK ? `⚫（黑方）胜利🏆` : `⚪（白方）胜利🏆`;
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
            await sleep(288);
        }
        // if (plants) await sleep(3000);
        turnsave.push([vvv_[0], vvv_[1], asc_, plants && plants.length !== 0 ? true : false]);


        // ASCEND清理
        game.ed_as_3();
    }

    // 变量
    gameing = false;
    button_game_restart.disabled = false;

    if (htmlr) console.log(turnsave);
    gl_datasave = turnsave;
    if (gl_datasave.length < 100 && htmlr) game_run();
    if (!htmlr) console.log(game.debug_texts.join('\n'));
}