/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 存档回放
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
const game_p1_card = document.getElementById('game_p1_card');
const game_p1_info = document.getElementById('game_p1_info');

const game_p2_name = document.getElementById('game_p2_name');
const game_p2_ascend = document.getElementById('game_p2_ascend');
const game_p2_hp = document.getElementById('game_p2_hp');
const game_p2_stone = document.getElementById('game_p2_stone');
const game_p2_card = document.getElementById('game_p2_card');
const game_p2_info = document.getElementById('game_p2_info');


const game_info_turn = document.getElementById('game_info_turn');
const game_info_p1 = document.getElementById('game_info_p1');
const game_info_p2 = document.getElementById('game_info_p2');
const game_info_plant_cd = document.getElementById('game_info_plant_cd');
const game_info_plant_normal = document.getElementById('game_info_plant_normal');


const button_history_prev = document.getElementById('button_history_prev');
const button_history_prevp = document.getElementById('button_history_prevp');
const button_history_play = document.getElementById('button_history_play');
const button_history_archive = document.getElementById('button_history_archive');
const button_history_nextp = document.getElementById('button_history_nextp');
const button_history_next = document.getElementById('button_history_next');
const icon_play_state = document.getElementById('icon_play_state');


const dialog_tools = document.getElementById('dialog_tools');
const button_tools_restart = document.getElementById('button_tools_restart');
const input_tools_speed = document.getElementById('input_tools_speed');

const dialog_leave = document.getElementById('dialog_leave');
const buttom_leave = document.getElementById('buttom_leave');


const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const { GameNormal, GameBlight, GameNight, Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, Rand, State, ATK, AIC, ArchiveV0, RandAIC, RandUnity, RandOther } = window.FAscendExports;
const EndgameArchive = window.EndgameExports.EndgameArchive;

const toast = new ShToast();


let gl_sound, gl_ui, gl_archive;
let gl_game, gl_rand_aic, gl_rand_unity, gl_rand_other, gl_board, gl_state, gl_timer;




/**
 * @description: 回合颜色更新
 * @param {boolean} my_turn
 * @return {string}
 */
const turn_color = (my_turn) => {
    if (my_turn) {
        game_p2_card.classList.remove('turn-purple');
        game_p2_info.classList.remove('turn-purple');

        game_p1_card.classList.add('turn-orange');
        game_p1_info.classList.add('turn-orange');

        game_msg.classList.remove('text-purple');
        game_msg.classList.add('text-orange');

    } else {
        game_p1_card.classList.remove('turn-orange');
        game_p1_info.classList.remove('turn-orange');

        game_p2_card.classList.add('turn-purple');
        game_p2_info.classList.add('turn-purple');

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

    game_p2_card.classList.remove('turn-purple');
    game_p2_info.classList.remove('turn-purple');

    game_info_plant_cd.classList.remove('text-danger');
    game_info_plant_cd.classList.remove('text-warning');
    game_info_plant_cd.classList.remove('text-info');
};


/**
 * @description: 游戏文字重置
 * @return {void}
 */
const game_clear = () => {
    game_p1_name.innerText = '黑方玩家';
    game_p1_hp.innerText = 'HP: ?';
    game_p1_ascend.innerText = 'PR: ?';
    game_p1_stone.innerText = '⚫';

    game_p2_name.innerText = '白方玩家';
    game_p2_hp.innerText = 'HP: ?';
    game_p2_ascend.innerText = 'PR: ?';
    game_p2_stone.innerText = '⚪';

    game_info_plant_cd.innerText = `CD=cd`;
    game_info_plant_normal.innerText = 'p NPlants';

    game_info_p1.innerText = 'W+w';
    game_info_p2.innerText = 'B+b';

    game_info_turn.innerText = `t Turns`;

    document.documentElement.style.setProperty('--hp-color-p1', '-1');
    document.documentElement.style.setProperty('--hp-color-p2', '-1');

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

    const size = window.math_size(main_game, [game_top_card, game_buttom_card]);
    gl_ui.size = size;
    game_top_card.style.width = `${size}px`;
    game_buttom_card.style.width = `${size}px`;

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
        else if (stone === STONE_ENUM.BLACK_ASCEND) gl_ui.draw_stone_ascend(x, y, '#e74c3c');
        else if (stone === STONE_ENUM.WHITE_ASCEND) gl_ui.draw_stone_ascend(x, y, '#3498db');

        if (plant === PLANT_ENUM.ONE) gl_ui.draw_plant(x, y);
        else if (plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(x, y);
    });

    if (gl_state.turn_count !== 0) {
        gl_ui.clear_view_turn();
        gl_ui.draw_stone_turn(gl_state.turn_pos[0], gl_state.turn_pos[1], '#FFD700', 5);
    }
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
        const as = stone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;
        datas.forEach((pos) => {
            if (pos.stone !== as) return;
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
 * @param {Board} board
 * @param {State} state
 * @param {STONE_ENUM} my_stone
 * @param {STONE_ENUM} foe_stone
 * @return {string[]}
 */
const game_match = (board, state, my_stone, foe_stone) => {
    let plantn = 0;

    let my_stone_num = 0;
    let my_plant_num = 0;

    let foe_stone_num = 0;
    let foe_plant_num = 0;

    // 遍历得到
    board.data.forEach((pos) => {
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

    const i_p1 = `${my_stone_num}+${my_plant_num}`;
    const i_p2 = `${foe_stone_num}+${foe_plant_num}`;

    const i_plantt = `${plantn} NPlants`;

    // 回合数
    const i_turn = `${state.turn_count} Turns`;

    // 植物生成倒计时
    let i_plantc;
    let i_plant_color;

    if (state.ascend_status === ASCEND_ENUM.NONE) {
        i_plantc = `CD=${state.grow_count}`;
        if (state.grow_count === 1) i_plant_color = 'text-danger';
        else if (state.grow_count === 2) i_plant_color = 'text-info';
        else if (state.grow_count === 3) i_plant_color = 'text-info';

    } else if (state.just_unascend) {
        i_plantc = 'CD=no';
        i_plant_color = 'text-warning';

    } else if (state.ascend_status === ASCEND_ENUM.START) {
        i_plantc = 'CD=st';
        i_plant_color = 'text-danger';

    } else if (state.ascend_status === ASCEND_ENUM.END) {
        i_plantc = 'CD=ed';
        i_plant_color = 'text-danger';
    }

    if (state.over_status !== OVER_ENUM.NONE) {
        i_plant_color = 'text-danger';
    }

    // if (state.grow_count > 3 && state.ascend_status === ASCEND_ENUM.NONE) {
    //     game_info_plant_cd.classList.remove('text-info');
    //     game_info_plant_cd.classList.remove('text-danger');
    //     game_info_plant_cd.classList.remove('text-warning');

    // } else if (state.grow_count === 1 && state.ascend_status === ASCEND_ENUM.NONE) {
    //     game_info_plant_cd.classList.remove('text-info');
    // }

    return [i_turn, i_p1, i_p2, i_plantc, i_plantt, i_plant_color];
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
    // 返回主页
    button_tools_restart.addEventListener('click', (event) => {
        if (event.target !== button_tools_restart) return;

        dialog_leave.classList.remove('d-none');
        dialog_leave.show();
    });

    buttom_leave.addEventListener('click', (event) => {
        if (event.target !== buttom_leave) return;

        window.location.replace('/');
    });
})();

// 对话框防误触关闭
(() => {
    dialog_tools.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_leave.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
})();

// 关闭连接清理声音
(() => {
    window.addEventListener('unload', () => {
        gl_sound.main.pause();
        gl_sound.main.currentTime = 0;
        gl_sound.main.loop = true;
    });
})();


class AsyncDispatcher {
    constructor() {
        // 存储所有正在等待的消费者的 resolve 函数集合
        this.listeners = new Set();
    }

    // 广播分发：遍历所有等待者，把数据原样分发出去，并清空等待队列
    dispatch(data) {
        const currentListeners = this.listeners;
        this.listeners = new Set(); // 重置集合，准备接收下一轮等待
        for (const resolve of currentListeners) {
            resolve(data);
        }
    }

    // 异步生成器：支持多个 for await...of 同时独立循环
    async *[Symbol.asyncIterator]() {
        while (true) {
            yield new Promise((resolve) => {
                this.listeners.add(resolve);
            });
        }
    }
}




/**
 * @description: 游戏配置
 * @param {string} archive
 * @return {void}
 */
const setup = (archive) => {
    const size = window.math_size(main_game, [game_top_card, game_buttom_card]);
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
    game_buttom_card.style.width = `${size}px`;

    gl_archive = archive;
};


/**
 * @description: 游戏循环
 * @return {Promise<void>}
 */
const run = async () => {
    // 重置
    game_clear();
    game_redraw();


    // 解析
    const { seed_aic, seed_unity, seed_other, clocks, healths, first, turns, mode } = ArchiveV0.load(BaseZalgo.decode(gl_archive));


    // 初始化
    const board = new Board(9, 9);
    const state = new State();
    const rand_aic = new RandAIC(seed_aic);
    const rand_unity = new RandUnity(seed_unity);

    let game;
    if (mode === 0) game = new GameNormal(board, state, rand_aic, rand_unity);
    else if (mode === 1) game = new GameBlight(board, state, rand_aic, rand_unity);
    else if (mode === 2) game = new GameNight(board, state, rand_aic, rand_unity);


    // 加载所有信息
    const info_canvas = [];
    const info_hp = [];
    const info_turns_count = [];
    const info_p1 = [];
    const info_p2 = [];
    const info_title = [];
    const info_view = [];

    const info_card = [];
    const info_turn = [];
    const info_sound = [];
    const info_color = [];

    let is_win;

    turns.forEach((pos) => {
        if (is_win) return;
        const [x, y] = pos;

        // 落子
        game.ed_tr_1(x, y);

        info_sound.push('stone');
        info_view.push([x, y]);


        // 检查ASCEND
        const ascend_points = game.ed_as_1();

        const datas = [];
        board.data.forEach((pos) => datas.push([pos.x, pos.y, pos.stone, pos.plant]));
        info_canvas.push(datas);
        info_hp.push([state.hp[0], state.hp[1]]);
        info_turns_count.push(state.turn_count);

        const pr1 = game_power(STONE_ENUM.BLACK, board.data);
        const pr2 = game_power(STONE_ENUM.WHITE, board.data);

        const pr1_color = pr1 !== 'PR：0+0';
        const pr2_color = pr2 !== 'PR：0+0';


        // 结算ASCEND
        const ascend_end = game.ed_as_2();

        const hp1_color = Math.trunc((state.hp[0] / healths[0]).toFixed(2) * 100).toString();
        const hp2_color = Math.trunc((state.hp[1] / healths[1]).toFixed(2) * 100).toString();

        info_p1.push([`HP: ${state.hp[0]}/${healths[0]}`, pr1]); // hp pr
        info_p2.push([`HP: ${state.hp[1]}/${healths[1]}`, pr2]); // hp pr 

        info_title.push(ascend_end ? `${pr1.slice(3)} VS ${pr2.slice(3)}` : (state.turn_player === PLAYER_ENUM.BLACK ? '⚪等待（白方）落子' : '⚫等待（黑方）落子'));


        // 更改回合
        game.ed_tr_2();

        const [i_turn, i_p1, i_p2, i_plantc, i_plantt, i_plant_color] = game_match(
            board, state, STONE_ENUM.BLACK, STONE_ENUM.WHITE
        );
        info_card.push([i_turn, i_p1, i_p2, i_plantc, i_plantt]); // game_info_turn, game_info_p1, game_info_p2, game_info_plant_cd, game_info_plant_normal

        info_turn.push(state.turn_player);

        info_color.push([hp1_color, hp2_color, pr1_color, pr2_color, i_plant_color]); // hp1, hp2, pr1, pr2, plant_cd


        // 生成植物
        const plant_points = game.ed_pl_1();
        const win = game.ed_win();
        is_win = win;

        // 需要两回合结算
        if (plant_points || win) {
            game.ed_as_3();

            const datas = [];
            board.data.forEach((pos) => datas.push([pos.x, pos.y, pos.stone, pos.plant]));
            info_canvas.push(datas);
            info_hp.push([state.hp[0], state.hp[1]]);
            info_turns_count.push(state.turn_count);

            info_p1.push([`HP: ${state.hp[0]}/${healths[0]}`, `PR：0+0`]); // hp pr
            info_p2.push([`HP: ${state.hp[1]}/${healths[1]}`, `PR：0+0`]); // hp pr 

            info_turn.push(null);
            info_view.push(null);

            const [i_turn, i_p1, i_p2, i_plantc, i_plantt, i_plant_color] = game_match(
                board, state, STONE_ENUM.BLACK, STONE_ENUM.WHITE
            );

            info_card.push([i_turn, i_p1, i_p2, i_plantc, i_plantt]); // game_info_turn, game_info_p1, game_info_p2, game_info_plant_cd, game_info_plant_normal
            info_color.push([null, null, null, null, i_plant_color]); // hp1, hp2, pr1, pr2, plant_cd

            info_sound.push('plant');

            const [win_label, win_stone] = win === PLAYER_ENUM.BLACK ? ['黑方', '⚫'] : ['白方', '⚪'];
            info_title.push(win ? `🏆（${win_label}）胜利${win_stone}` : '🪴植物已生成');
        }
    });


    // 生成器
    const gen = new AsyncDispatcher();

    let ptr = -1;
    let pid = null;
    let gl_snapshot_ptr = -1;

    // 监听
    button_history_prev.addEventListener('click', () => {
        if (ptr - 1 < 0) return toast.error('无法再后退！');
        ptr--;
        gen.dispatch(ptr);
    });

    button_history_prevp.addEventListener('click', () => {
        if (ptr - 5 < 0) return toast.error('无法再后退！');
        ptr -= 5;
        gen.dispatch(ptr);
    });

    button_history_archive.addEventListener('click', async () => {
        try {
            const text = snapshot_endgame();
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
            else if (window.clipboard && typeof window.clipboard.copy === 'function') window.clipboard.copy(text);
            else throw new Error('当前环境无法写入剪贴板');
            toast.success(`当前残局码已复制（${text.length} 字符）`);
        } catch (error) {
            toast.error(error && error.message ? error.message : '复制残局码失败');
        }
    });

    button_history_play.addEventListener('click', () => {
        if (icon_play_state.getAttribute('name') === 'play-fill') {
            icon_play_state.setAttribute('name', 'pause-fill');

            // ptr = 0;

            pid = setInterval(() => {
                if (ptr + 1 > info_canvas.length - 1) {
                    clearInterval(pid);
                    button_history_prev.classList.remove('pe-none');
                    button_history_prev.disabled = false;
                    button_history_prevp.classList.remove('pe-none');
                    button_history_prevp.disabled = false;

                    button_history_next.classList.remove('pe-none');
                    button_history_next.disabled = false;
                    button_history_nextp.classList.remove('pe-none');
                    button_history_nextp.disabled = false;

                    icon_play_state.setAttribute('name', 'play-fill');
                    pid = null;
                    return;
                }
                ptr++;
                gen.dispatch(ptr);
            }, parseInt(input_tools_speed.value, 10));

            button_history_prev.classList.add('pe-none');
            button_history_prev.disabled = true;
            button_history_prevp.classList.add('pe-none');
            button_history_prevp.disabled = true;

            button_history_next.classList.add('pe-none');
            button_history_next.disabled = true;
            button_history_nextp.classList.add('pe-none');
            button_history_nextp.disabled = true;

        } else {
            icon_play_state.setAttribute('name', 'play-fill');

            clearInterval(pid);
            pid = null;

            button_history_prev.classList.remove('pe-none');
            button_history_prev.disabled = false;
            button_history_prevp.classList.remove('pe-none');
            button_history_prevp.disabled = false;

            button_history_next.classList.remove('pe-none');
            button_history_next.disabled = false;
            button_history_nextp.classList.remove('pe-none');
            button_history_nextp.disabled = false;
        }
    });

    button_history_next.addEventListener('click', () => {
        if (ptr + 1 > info_canvas.length - 1) return toast.error('无法再前进！');
        ptr++;
        gen.dispatch(ptr);
    });

    button_history_nextp.addEventListener('click', () => {
        if (ptr + 5 > info_canvas.length - 1) return toast.error('无法再前进！');
        ptr += 5;
        gen.dispatch(ptr);
    });

    // 循环
    while (true) {
        let p;
        for await (const data of gen) {
            p = data;
            gl_snapshot_ptr = p;
            break;
        }


        // 重绘
        gl_ui.canvas_stone_fill.getContext('2d').clearRect(0, 0, gl_ui.size, gl_ui.size);
        gl_ui.canvas_stone_ascend.getContext('2d').clearRect(0, 0, gl_ui.size, gl_ui.size);
        gl_ui.canvas_plant.getContext('2d').clearRect(0, 0, gl_ui.size, gl_ui.size);
        gl_ui.canvas_view_turn.getContext('2d').clearRect(0, 0, gl_ui.size, gl_ui.size);

        const points = info_canvas[p];
        points.forEach((pos) => {
            const [x, y, stone, plant] = pos;

            if (stone === STONE_ENUM.BLACK) gl_ui.draw_stone_fill(x, y, '#2c3e50');
            else if (stone === STONE_ENUM.WHITE) gl_ui.draw_stone_fill(x, y, '#ecf0f1');
            else if (stone === STONE_ENUM.BLACK_ASCEND) gl_ui.draw_stone_ascend(x, y, '#e74c3c');
            else if (stone === STONE_ENUM.WHITE_ASCEND) gl_ui.draw_stone_ascend(x, y, '#3498db');

            if (plant === PLANT_ENUM.ONE) gl_ui.draw_plant(x, y);
            else if (plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(x, y);
        });

        // 标题
        game_msg.innerText = info_title[p];

        // 生命、数值
        const p1 = info_p1[p];
        if (p1) {
            game_p1_hp.innerText = p1[0];
            game_p1_ascend.innerText = p1[1];
        }

        const p2 = info_p2[p];
        if (p2) {
            game_p2_hp.innerText = p2[0];
            game_p2_ascend.innerText = p2[1];
        }

        // 回合
        const view = info_view[p];
        if (view) gl_ui.draw_stone_turn(view[0], view[1], '#00FFC5', 5);

        // 声音
        const sound = info_sound[p];
        if (sound === 'stone') gl_sound.play_stone();
        else if (sound === 'plant') gl_sound.play_plant();

        // 数据卡片
        const card = info_card[p];

        if (card) {
            game_info_turn.innerText = card[0];
            game_info_p1.innerText = card[1];
            game_info_p2.innerText = card[2];
            game_info_plant_cd.innerText = card[3];
            game_info_plant_normal.innerText = card[4];
        }

        // 谁的回合
        const turn = info_turn[p];

        title_clear();

        if (turn) {
            turn_color(turn === PLAYER_ENUM.BLACK);
        }

        // 颜色
        const color = info_color[p];

        game_p1_ascend.classList.remove('text-primary');
        game_p2_ascend.classList.remove('text-primary');

        game_info_plant_cd.classList.remove('text-info');
        game_info_plant_cd.classList.remove('text-danger');
        game_info_plant_cd.classList.remove('text-warning');

        if (color) {
            if (color[0]) document.documentElement.style.setProperty('--hp-color-p1', color[0]);
            if (color[1]) document.documentElement.style.setProperty('--hp-color-p2', color[1]);

            if (color[2]) game_p1_ascend.classList.add('text-primary');
            if (color[3]) game_p2_ascend.classList.add('text-primary');

            if (color[4]) game_info_plant_cd.classList.add(color[4]);
        }
    }
};

/**
 * @description: 当前暂停局面转为残局码
 * @return {string}
 */
const snapshot_endgame = () => {
    if (ptr < 0 || !info_canvas[ptr]) throw new Error('请先进入回放并停留在一个局面');
    if (pid) throw new Error('请先暂停回放，再复制当前残局码');

    const hp = info_hp[ptr] || healths;
    const turn_player = info_turn[ptr] === PLAYER_ENUM.WHITE ? 'white' : 'black';
    const cells = Array.from({ 'length': 81 }, () => ({ 'stone': 'none', 'plant': 0 }));
    const stone_of = (stone) => {
        if (stone === STONE_ENUM.BLACK || stone === STONE_ENUM.BLACK_ASCEND || stone === STONE_ENUM.BLACK_USED) return 'black';
        if (stone === STONE_ENUM.WHITE || stone === STONE_ENUM.WHITE_ASCEND || stone === STONE_ENUM.WHITE_USED) return 'white';
        return 'none';
    };
    const plant_of = (plant) => plant === PLANT_ENUM.TWO ? 2 : plant === PLANT_ENUM.ONE ? 1 : 0;

    info_canvas[ptr].forEach((pos) => {
        const [x, y, stone, plant] = pos;
        cells[(8 - y) * 9 + x] = {
            'stone': stone_of(stone),
            'plant': plant_of(plant)
        };
    });

    return EndgameArchive.encode({
        'cells': cells,
        'player': turn_player,
        'first': turn_player,
        'natural_plant': false,
        'hp': {
            'black': Math.max(0, Number(hp[0]) || 0),
            'white': Math.max(0, Number(hp[1]) || 0)
        },
        'blackBook': [],
        'whiteTurns': [],
        'mode_code': mode,
        'fallback': { 'level': 2 }
    });
};


/**
 * @description: 导出对局存档
 * @return {string}
 */
const exportf = () => {
    if (!gl_archive) return '';
    return gl_archive;
};


if (!window.MainExports) window.MainExports = {};
window.MainExports.Replay = { setup, run, exportf };