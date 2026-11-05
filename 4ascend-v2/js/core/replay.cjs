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

const canvas_threat = document.getElementById('canvas_threat');

const threat_switch = document.getElementById('threat_switch');
const switch_threat = document.getElementById('switch_threat');


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


const analysis_fab = document.getElementById('analysis_fab');
const button_analysis_toggle = document.getElementById('button_analysis_toggle');
const analysis_panel = document.getElementById('analysis_panel');
const button_analysis_close = document.getElementById('button_analysis_close');
const analysis_black_rate = document.getElementById('analysis_black_rate');
const analysis_white_rate = document.getElementById('analysis_white_rate');
const analysis_bar_black = document.getElementById('analysis_bar_black');
const analysis_turn = document.getElementById('analysis_turn');
const analysis_counts = document.getElementById('analysis_counts');
const canvas_analysis = document.getElementById('canvas_analysis');
const analysis_source = document.getElementById('analysis_source');
const analysis_best = document.getElementById('analysis_best');
const button_analysis_best = document.getElementById('button_analysis_best');
const analysis_ai_state = document.getElementById('analysis_ai_state');
const analysis_badge = document.getElementById('analysis_badge');


const { ReplayAnalysis } = require('./replay-analysis.cjs');


const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const { GameNormal, GameBlight, GameNight, Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, Rand, State, ATK, AIC, ArchiveV0, RandAIC, RandUnity, RandOther, RulesRuntime, Threats } = window.FAscendExports;
const EndgameArchive = window.EndgameExports.EndgameArchive;

const toast = new ShToast();


let gl_sound, gl_ui, gl_archive;
let gl_game, gl_rand_aic, gl_rand_unity, gl_rand_other, gl_board, gl_state, gl_timer;
// 回放就绪后由 run() 注册：窗口尺寸变化时按当前帧重绘，避免棋盘与分析标注被清空
let gl_resize_redraw = null;
// 全盘打点：由 run() 注册当前帧重绘，局内随时可开关
let gl_threat_on = false;
let gl_threat_refresh = null;


// 全盘打点开关（局内随时可切换）
(() => {
    if (!switch_threat) return;

    switch_threat.addEventListener('change', () => {
        gl_threat_on = Boolean(switch_threat.checked);

        if (gl_threat_refresh) gl_threat_refresh();
        else Threats.clear(canvas_threat);
    });
})();




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

    game_info_p1.innerText = 'B+b';
    game_info_p2.innerText = 'W+w';

    game_info_turn.innerText = `t Turns`;

    document.documentElement.style.setProperty('--hp-color-p1', '-1');
    document.documentElement.style.setProperty('--hp-color-p2', '-1');

    title_clear();
    info_clear();

    gl_ui.clear();
    gl_ui.init();
    gl_ui.draw_board();

    Threats.clear(canvas_threat);

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

    // 打点图层由帧循环重绘，这里先清空避免残留上一帧内容
    Threats.clear(canvas_threat);
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
    const resize_redraw = () => {
        if (!gl_ui) return;
        // 先按新尺寸重建画布，再按当前帧补回棋子、落点圈与正着分析标注
        game_redraw();
        if (gl_resize_redraw) gl_resize_redraw();
    };
    window.addEventListener('resize', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(resize_redraw, 150);
        resize_redraw();
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

    // 回放就绪后才显示局势分析入口
    if (analysis_fab) analysis_fab.classList.remove('d-none');
    // 回放就绪后显示全盘打点开关
    if (threat_switch) threat_switch.classList.remove('d-none');

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
    state.turn_player = first === 1 ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
    const rand_aic = new RandAIC(seed_aic);
    const rand_unity = new RandUnity(seed_unity);

    let game;
    if (mode === 0) game = new GameNormal(board, state, rand_aic, rand_unity);
    else if (mode === 1) game = new GameBlight(board, state, rand_aic, rand_unity);
    else if (mode === 2) game = new GameNight(board, state, rand_aic, rand_unity);

    // 残局 AI 快照需要首手方与模型历史轨道，这里与真实对局保持一致。
    RulesRuntime.initialize(game, state.turn_player);


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

    // 局势分析用的纯数字盘面帧（0空 1黑 2白）
    const info_grid = [];
    const info_winner = [];

    // 残局 AI 评估用：每手落子前的 RulesRuntime 快照与最近 7 个纯棋子盘面
    const info_snapshot = [];
    const solid_boards = [];

    const snapshot = (sound = null, view = null, title = null) => {
        const datas = [];
        board.data.forEach((pos) => datas.push([pos.x, pos.y, pos.stone, pos.plant]));

        const grid = new Uint8Array(81);
        const plants = new Uint8Array(81);
        board.data.forEach((pos, index) => {
            grid[index] = pos.stone === STONE_ENUM.BLACK ? 1 : pos.stone === STONE_ENUM.WHITE ? 2 : 0;
            plants[index] = pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0;
        });

        const p1 = game_power(STONE_ENUM.BLACK, board.data);
        const p2 = game_power(STONE_ENUM.WHITE, board.data);
        const [i_turn, i_p1, i_p2, i_plantc, i_plantt, i_plant_color] = game_match(
            board, state, STONE_ENUM.BLACK, STONE_ENUM.WHITE
        );
        const hp1_color = Math.trunc((state.hp[0] / healths[0]).toFixed(2) * 100).toString();
        const hp2_color = Math.trunc((state.hp[1] / healths[1]).toFixed(2) * 100).toString();

        info_canvas.push(datas);
        info_hp.push([state.hp[0], state.hp[1]]);
        info_turns_count.push(state.turn_count);
        info_p1.push([`HP: ${state.hp[0]}/${healths[0]}`, p1]);
        info_p2.push([`HP: ${state.hp[1]}/${healths[1]}`, p2]);
        info_card.push([i_turn, i_p1, i_p2, i_plantc, i_plantt]);
        info_turn.push(state.turn_player);
        info_sound.push(sound);
        info_view.push(view);
        info_color.push([
            hp1_color,
            hp2_color,
            p1 !== 'PR：0+0',
            p2 !== 'PR：0+0',
            i_plant_color
        ]);
        info_title.push(title || (state.turn_player === PLAYER_ENUM.BLACK ? '⚫等待（黑方）落子' : '⚪等待（白方）落子'));

        info_grid.push({
            'grid': grid,
            'plants': plants,
            'hp': [state.hp[0], state.hp[1]],
            'turn': state.turn_player === PLAYER_ENUM.WHITE ? 1 : 0,
        });
        info_winner.push(is_win === PLAYER_ENUM.BLACK ? 0 : is_win === PLAYER_ENUM.WHITE ? 1 : null);
    };

    let is_win;

    turns.forEach((pos) => {
        if (is_win) return;
        const [x, y] = pos;

        // 残局 AI 需要精确的落子前局面：完整快照 + 最近 7 个纯棋子盘面
        const solid = RulesRuntime.solidBoard(game);
        const before = RulesRuntime.snapshot(game);
        before.history = solid_boards.map((board) => Array.from(board));

        // 回放严格复用真实对局顺序，并在本回合所有结算完成后保存完整帧。
        if (!game.ed_tr_1(x, y)) return;
        info_snapshot.push(before);
        solid_boards.push(solid);
        if (solid_boards.length > 7) solid_boards.shift();
        game.ed_as_1();
        game.ed_as_2();
        game.ed_tr_2();

        const win = game.ed_win();
        is_win = win;
        if (win) {
            game.ed_as_3();
            snapshot('stone', [x, y], `🏆（${win === PLAYER_ENUM.BLACK ? '黑方' : '白方'}）胜利${win === PLAYER_ENUM.BLACK ? '⚫' : '⚪'}`);
            return;
        }

        const plant_points = game.ed_pl_1();
        game.ed_as_3();
        // 刷草只改变提示标题，落子标记仍需保留，避免复盘中落点消失。
        snapshot(plant_points ? 'plant' : 'stone', [x, y], plant_points ? '🪴植物已生成' : null);
    });


    // 生成器
    const gen = new AsyncDispatcher();

    let ptr = -1;
    let pid = null;
    let gl_snapshot_ptr = -1;
    // 尺寸变化触发的重绘不重复播放落子音效
    let gl_silent_redraw = false;

    gl_resize_redraw = () => {
        if (ptr < 0) return;
        gl_silent_redraw = true;
        gen.dispatch(ptr);
    };


    // 全盘打点：按当前帧盘面绘制（局内开关随时生效）
    const threat_layout = () => ({
        'stoneEnum': STONE_ENUM,
        'plantEnum': PLANT_ENUM,
        'offset': gl_ui.offset,
        'spacing': gl_ui.spacing,
        'size': gl_ui.size,
        'w': 9,
        'h': 9,
    });

    gl_threat_refresh = () => {
        if (!gl_threat_on || ptr < 0 || !info_canvas[ptr]) return Threats.clear(canvas_threat);

        Threats.draw(canvas_threat, info_canvas[ptr], threat_layout());
    };


    // -------------------------------------------------------------------------
    // 局势分析
    // -------------------------------------------------------------------------
    const ANALYSIS_ORDER = ['brilliant', 'good', 'interesting', 'dubious', 'mistake', 'blunder'];
    const ANALYSIS_COLORS = {
        'brilliant': '#8b5cf6',
        'good': '#22c55e',
        'interesting': '#14b8a6',
        'dubious': '#eab308',
        'mistake': '#f97316',
        'blunder': '#ef4444',
    };
    const ANALYSIS_LABELS = {
        'brilliant': '妙手',
        'good': '好棋',
        'interesting': '有趣',
        'dubious': '可疑',
        'mistake': '坏棋',
        'blunder': '大漏',
    };
    const ANALYSIS_SYMBOLS = {
        'brilliant': '!!',
        'good': '!',
        'interesting': '!?',
        'dubious': '?!',
        'mistake': '?',
        'blunder': '??',
    };

    const analysis_frames = info_grid.map((frame, index) => ({
        'grid': frame.grid,
        'plants': frame.plants,
        'hp': frame.hp,
        'turn': frame.turn,
        'winner': info_winner[index],
    }));

    let analysis_result = null;
    // 局势分析一旦开启，棋盘上的着手标识与推荐落点就独立于面板显隐持续显示。
    // 窄屏下面板会遮挡棋盘，用户必须先关闭面板才能看到棋盘。
    let analysis_mode = false;

    const analysis_open = () => Boolean(analysis_panel) && !analysis_panel.classList.contains('d-none');

    const ensure_analysis = () => {
        if (!analysis_result) analysis_result = ReplayAnalysis.analyze(analysis_frames);
        return analysis_result;
    };

    // -------------------------------------------------------------------------
    // 回放 AI（ZeroAI SIM=120 整场扫盘 / 残局 AI SIM=888 正着分析）
    // -------------------------------------------------------------------------
    const SWEEP_SIMULATIONS = 120;
    const BEST_SIMULATIONS = 888;

    // 整场扫盘结果（每手落子后的胜率与着手质量）
    const analysis_sweep_cache = new Map();
    const analysis_sweep_failures = new Set();
    // 点击「正着分析」后由 888 SIM 残局 AI 给出的正着
    const analysis_best_cache = new Map();
    const analysis_best_failures = new Set();

    let analysis_ai_thread = null;
    let analysis_ai_worker = null;
    let analysis_ai_ready = false;
    let analysis_ai_failed = false;
    let analysis_ai_init = null;

    // Worker 串行任务队列：正着分析插队优先，整场扫盘按序补齐
    let analysis_jobs = [];
    let analysis_job_running = null;

    /**
     * @description: 懒加载回放 AI Worker（首次需要下载 ONNX 模型）
     * @return {Promise<boolean>}
     */
    const ensure_analysis_ai = () => {
        if (analysis_ai_ready) return Promise.resolve(true);
        if (analysis_ai_failed) return Promise.resolve(false);
        if (typeof Worker === 'undefined' || typeof Comlink === 'undefined') {
            analysis_ai_failed = true;
            return Promise.resolve(false);
        }
        if (analysis_ai_init) return analysis_ai_init;

        analysis_ai_init = (async () => {
            try {
                analysis_ai_thread = new Worker('/js/worker/ai.min.js');
                analysis_ai_worker = Comlink.wrap(analysis_ai_thread);
                await analysis_ai_worker.AI_INIT();
                analysis_ai_ready = true;
                return true;
            } catch (error) {
                console.warn('回放 AI 加载失败，回退静态评估。', error);
                analysis_ai_failed = true;
                if (analysis_ai_thread) analysis_ai_thread.terminate();
                analysis_ai_thread = null;
                analysis_ai_worker = null;
                return false;
            }
        })();
        return analysis_ai_init;
    };

    /**
     * @description: 按 AI 的 q 值判定国际象棋式标识
     * 本手与正着同档时比较正着领先次优解的差距，否则按相对正着的损失分档。
     * @param {object | null} result
     * @return {'brilliant' | 'good' | 'interesting' | 'dubious' | 'mistake' | 'blunder' | null}
     */
    const analysis_ai_label = (result) => {
        if (!result || !Number.isFinite(result.bestQ) || !Number.isFinite(result.actualQ)) return null;

        const regret = Math.max(0, result.bestQ - result.actualQ);
        if (regret >= 0.14) return 'blunder';
        if (regret >= 0.06) return 'mistake';
        if (regret >= 0.02) return 'dubious';

        const second = Number.isFinite(result.secondQ) ? result.secondQ : result.bestQ;
        const gap = Math.max(0, result.bestQ - second);
        if (gap >= 0.07) return 'brilliant';
        if (gap >= 0.035) return 'good';
        return 'interesting';
    };

    /**
     * @description: 行棋方 q 值（-1~1）换算成该方胜率
     * @param {number} q
     * @return {number | null}
     */
    const analysis_side_rate = (q) => {
        if (!Number.isFinite(q)) return null;
        return Math.min(1, Math.max(0, (1 + q) / 2));
    };

    /**
     * @description: 整场扫盘中某一手落子后的黑方胜率
     * @param {number} index
     * @return {number | null}
     */
    const analysis_sweep_black_rate = (index) => {
        const item = index >= 0 ? analysis_sweep_cache.get(index) : null;
        if (!item) return null;
        const side = analysis_side_rate(Number.isFinite(item.actualQ) ? item.actualQ : item.winRate);
        if (side === null) return null;
        return item.mover === 0 ? side : 1 - side;
    };

    /**
     * @description: 888 SIM 正着分析中某一手落子后的黑方胜率
     * @param {number} index
     * @return {number | null}
     */
    const analysis_best_black_rate = (index) => {
        const item = index >= 0 ? analysis_best_cache.get(index) : null;
        if (!item) return null;
        const side = analysis_side_rate(item.actualQ);
        if (side === null) return null;
        return item.mover === 0 ? side : 1 - side;
    };

    /**
     * @description: 某一手的标识：优先正着分析，其次整场扫盘，最后回退静态评估
     * @param {number} index
     * @return {string | null}
     */
    const analysis_label_of = (index) => {
        const best = index >= 0 ? analysis_best_cache.get(index) : null;
        if (best && best.label) return best.label;
        const sweep = index >= 0 ? analysis_sweep_cache.get(index) : null;
        if (sweep && sweep.label) return sweep.label;
        const move = index >= 0 ? ensure_analysis().moves[index] : null;
        return move ? move.label : null;
    };

    /**
     * @description: 某一手的黑方胜率：正着分析 > 整场扫盘 > 静态评估
     * @param {number} index
     * @param {number} static_rate
     * @return {number}
     */
    const analysis_point_rate = (index, static_rate) => {
        if (index < 0) return 0.5;
        const frame = analysis_frames[index];
        if (frame && (frame.winner === 0 || frame.winner === 1)) return frame.winner === 0 ? 1 : 0;

        const best = analysis_best_black_rate(index);
        if (best !== null) return best;
        const sweep = analysis_sweep_black_rate(index);
        if (sweep !== null) return sweep;
        return Number.isFinite(static_rate) ? static_rate : 0.5;
    };

    /**
     * @description: 是否仍有 AI 任务在排队或执行
     * @return {boolean}
     */
    const analysis_ai_busy = () => Boolean(analysis_job_running) || analysis_jobs.length > 0;

    /**
     * @description: 任务入队；正着分析优先于整场扫盘
     * @param {{type: 'sweep' | 'best', index: number}} job
     * @return {void}
     */
    const analysis_push_job = (job) => {
        if (!job || job.index < 0 || job.index >= info_snapshot.length) return;

        if (job.type === 'best') {
            if (analysis_best_cache.has(job.index) || analysis_best_failures.has(job.index)) return;
            analysis_jobs = analysis_jobs.filter((item) => !(item.type === 'best' && item.index === job.index));
            analysis_jobs.unshift(job);
        } else {
            if (analysis_sweep_cache.has(job.index) || analysis_sweep_failures.has(job.index)) return;
            if (analysis_jobs.some((item) => item.type === 'sweep' && item.index === job.index)) return;
            analysis_jobs.push(job);
        }

        analysis_job_pump();
    };

    const analysis_job_pump = () => {
        if (!analysis_open()) {
            // 面板关闭后停止补扫全盘（省电），但保留用户主动发起的正着分析任务，
            // 保证窄屏用户关闭面板查看棋盘时，正着结果仍会出现在棋盘上。
            analysis_jobs = analysis_jobs.filter((item) => item.type === 'best');
        }
        if (analysis_job_running || !analysis_jobs.length) return;

        const job = analysis_jobs.shift();
        analysis_job_running = job;

        (async () => {
            try {
                const ready = await ensure_analysis_ai();
                if (!ready) return;

                const view = info_view[job.index];
                const actual = view ? view[1] * 9 + view[0] : null;
                const result = job.type === 'best'
                    ? await analysis_ai_worker.REPLAY_EVAL(info_snapshot[job.index], BEST_SIMULATIONS, actual)
                    : await analysis_ai_worker.REPLAY_SWEEP(info_snapshot[job.index], SWEEP_SIMULATIONS, actual);

                if (result && Number.isInteger(result.action) && result.action >= 0) {
                    result.label = analysis_ai_label(result);
                    if (job.type === 'best') analysis_best_cache.set(job.index, result);
                    else analysis_sweep_cache.set(job.index, result);
                } else if (job.type === 'best') {
                    analysis_best_failures.add(job.index);
                } else {
                    analysis_sweep_failures.add(job.index);
                }
            } catch (error) {
                console.warn('回放 AI 评估失败。', error);
                if (job.type === 'best') analysis_best_failures.add(job.index);
                else analysis_sweep_failures.add(job.index);
            } finally {
                analysis_job_running = null;
                // 标注层跟随分析模式而不是面板显隐，面板关闭时也要把结果补到棋盘上
                if (analysis_mode) {
                    if (ptr === job.index) refresh_analysis_overlay();
                    if (analysis_open()) render_analysis();
                }
                // 单个失败不应阻塞其余任务，继续补齐下一手
                analysis_job_pump();
            }
        })();
    };

    /**
     * @description: 把某一手的扫盘任务提到队首（切到该手时优先分析）
     * @param {number} index
     * @return {void}
     */
    const analysis_sweep_prioritize = (index) => {
        if (!analysis_open() || analysis_ai_failed) return;
        if (index < 0 || index >= info_snapshot.length) return;
        if (analysis_sweep_cache.has(index) || analysis_sweep_failures.has(index)) return;
        if (analysis_job_running && analysis_job_running.type === 'sweep' && analysis_job_running.index === index) return;

        const rest = analysis_jobs.filter((item) => !(item.type === 'sweep' && item.index === index));
        analysis_jobs = [{ 'type': 'sweep', 'index': index }, ...rest];
        analysis_job_pump();
    };

    /**
     * @description: 补齐整场扫盘；当前手优先，其余按顺序排队
     * @return {void}
     */
    const analysis_sweep_all = () => {
        if (!analysis_open() || analysis_ai_failed) return;

        analysis_sweep_prioritize(ptr);
        for (let i = 0; i < info_snapshot.length; i++) {
            if (i === ptr) continue;
            analysis_push_job({ 'type': 'sweep', 'index': i });
        }
        render_analysis();
    };

    /**
     * @description: 用户点击「正着分析」后请求 888 SIM 残局 AI
     * @param {number} index
     * @return {void}
     */
    const analysis_best_request = (index) => {
        if (!analysis_open() || analysis_ai_failed) return;
        if (index < 0 || index >= info_snapshot.length) return;
        if (analysis_best_cache.has(index) || analysis_best_failures.has(index)) return;
        if (analysis_job_running && analysis_job_running.type === 'best' && analysis_job_running.index === index) return;
        analysis_push_job({ 'type': 'best', 'index': index });
        render_analysis();
    };

    /**
     * @description: 正着分析给出的推荐落点
     * @param {number} index
     * @return {object | null}
     */
    const analysis_ai_best_of = (index) => {
        const ai = index >= 0 ? analysis_best_cache.get(index) : null;
        if (!ai || !Number.isInteger(ai.action) || ai.action < 0) return null;
        return ai;
    };

    /**
     * @description: SIM=120 整场扫盘给出的推荐落点
     * @param {number} index
     * @return {object | null}
     */
    const analysis_sweep_best_of = (index) => {
        const item = index >= 0 ? analysis_sweep_cache.get(index) : null;
        if (!item || !Number.isInteger(item.action) || item.action < 0) return null;
        return item;
    };

    /**
     * @description: 当前生效的推荐正着：手动正着分析（888）优先，否则用整场扫盘（120）
     * @param {number} index
     * @return {object | null}
     */
    const analysis_recommend_of = (index) => analysis_ai_best_of(index) || analysis_sweep_best_of(index);

    /**
     * @description: 本手是否命中当前生效的推荐正着
     * @param {number} index
     * @return {boolean}
     */
    const analysis_move_is_best = (index) => {
        const view = index >= 0 ? info_view[index] : null;
        const ai = analysis_recommend_of(index);
        if (!view || !ai) return false;
        return view[0] === ai.x && view[1] === ai.y;
    };

    /**
     * @description: 在棋盘上标出推荐正着：888 正着分析为浅蓝圈，120 整场扫盘为浅绿圈
     * @param {number} index
     * @return {void}
     */
    const draw_analysis_ai_move = (index) => {
        const ai = analysis_recommend_of(index);
        const best = analysis_ai_best_of(index);
        if (!ai || !gl_ui || !gl_ui.canvas_view_move) return;

        const ctx = gl_ui.canvas_view_move.getContext('2d');
        const x = gl_ui.offset + ai.x * gl_ui.spacing;
        const y = gl_ui.offset + ai.y * gl_ui.spacing;
        // 比实落子圈略大，保证两者重合时仍能看到推荐框
        const radius = gl_ui.spacing * gl_ui.stone_radius * 1.45;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = best ? '#7DD3FC' : '#86EFAC';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    };

    /**
     * @description: 在当前落子点右上角显示着手标识（纯 UI 叠加）
     * @param {number} index
     * @return {void}
     */
    const update_move_badge = (index) => {
        if (!analysis_badge) return;

        const view = index >= 0 ? info_view[index] : null;
        if (!analysis_mode || !view) {
            analysis_badge.classList.add('d-none');
            return;
        }

        const matched = analysis_move_is_best(index);
        const label = analysis_label_of(index);
        if (!matched && !label) {
            analysis_badge.classList.add('d-none');
            return;
        }

        // 棋盘几何按比例换算，窗口缩放时位置保持一致
        const x_px = gl_ui.offset + view[0] * gl_ui.spacing + gl_ui.spacing * gl_ui.stone_radius * 0.78;
        const y_px = gl_ui.offset + view[1] * gl_ui.spacing - gl_ui.spacing * gl_ui.stone_radius * 0.78;
        const left = Math.min(Math.max((x_px / gl_ui.size) * 100, 4), 96);
        const top = Math.min(Math.max((y_px / gl_ui.size) * 100, 4), 96);

        analysis_badge.style.left = `${left}%`;
        analysis_badge.style.top = `${top}%`;
        // 命中推荐正着时标识改为黄色五角星，推荐圈仍保留在棋盘上
        analysis_badge.style.background = matched ? 'transparent' : ANALYSIS_COLORS[label];
        analysis_badge.style.border = matched ? 'none' : '1.5px solid rgba(255, 255, 255, 0.95)';
        analysis_badge.style.boxShadow = matched ? 'none' : '0 1px 4px rgba(15, 23, 42, 0.35)';
        analysis_badge.style.color = matched ? '#FBBF24' : '#fff';
        analysis_badge.style.fontSize = matched ? '17px' : '12px';
        analysis_badge.style.textShadow = matched ? '0 1px 3px rgba(15, 23, 42, 0.55)' : 'none';
        analysis_badge.innerText = matched ? '★' : ANALYSIS_SYMBOLS[label];
        analysis_badge.classList.remove('d-none');
    };

    /**
     * @description: 只刷新当前帧的落点圈与着手标识，不重放整帧
     * @return {void}
     */
    const refresh_analysis_overlay = () => {
        if (ptr < 0) return;
        const view = info_view[ptr];
        if (!view) return;

        gl_ui.canvas_view_turn.getContext('2d').clearRect(0, 0, gl_ui.size, gl_ui.size);
        gl_ui.clear_view_move();

        if (!analysis_mode) {
            if (analysis_badge) analysis_badge.classList.add('d-none');
            gl_ui.draw_stone_turn(view[0], view[1], '#00FFC5', 5);
            return;
        }

        const label = analysis_label_of(ptr);
        gl_ui.draw_stone_turn(view[0], view[1], label ? ANALYSIS_COLORS[label] : '#00FFC5', 5);
        if (label || analysis_move_is_best(ptr)) update_move_badge(ptr);
        else if (analysis_badge) analysis_badge.classList.add('d-none');
        draw_analysis_ai_move(ptr);
    };

    /**
     * @description: 绘制胜率曲线（优先 ZeroAI SIM=120 扫盘数据，未分析的手回退静态估算）
     * @param {object} result
     * @param {number} index
     * @param {number | null} current_rate 当前手胜率
     * @return {void}
     */
    const draw_analysis_chart = (result, index, current_rate = null) => {
        if (!canvas_analysis) return;

        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, canvas_analysis.clientWidth);
        const height = Math.max(1, canvas_analysis.clientHeight);

        canvas_analysis.width = Math.round(width * dpr);
        canvas_analysis.height = Math.round(height * dpr);

        const ctx = canvas_analysis.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const pad_x = 8;
        const pad_y = 14;
        const inner_w = Math.max(1, width - pad_x * 2);
        const inner_h = Math.max(1, height - pad_y * 2);

        // 50% 基准线
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad_x, pad_y + inner_h / 2);
        ctx.lineTo(pad_x + inner_w, pad_y + inner_h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 上下阵营提示
        ctx.fillStyle = 'rgba(100, 116, 139, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText('黑', pad_x, pad_y - 4);
        ctx.fillText('白', pad_x, height - 3);

        const rates = analysis_frames.map((frame, i) => analysis_point_rate(i, result.rates[i]));
        if (!rates.length) return;

        const x_of = (i) => rates.length === 1 ? pad_x + inner_w / 2 : pad_x + (i / (rates.length - 1)) * inner_w;
        const y_of = (rate) => pad_y + (1 - rate) * inner_h;

        // 胜率折线
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        rates.forEach((rate, i) => {
            const x = x_of(i);
            const y = y_of(rate);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 每手质量点（残局 AI 已评估的手优先用 AI 标识，与徽标保持一致）
        result.moves.forEach((move, i) => {
            const label = analysis_label_of(i) || move.label;
            if (!label) return;

            const x = x_of(i);
            const y = y_of(rates[i]);
            const radius = label === 'brilliant'
                ? 3
                : label === 'interesting' || label === 'dubious' ? 1.7 : 2.6;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = ANALYSIS_COLORS[label];
            ctx.fill();
        });

        // 当前帧
        if (index >= 0 && index < rates.length) {
            const x = x_of(index);
            const y = y_of(Number.isFinite(current_rate) ? current_rate : rates[index]);

            ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x, pad_y);
            ctx.lineTo(x, pad_y + inner_h);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    /**
     * @description: 刷新局势分析面板
     * @return {void}
     */
    const render_analysis = () => {
        if (!analysis_open()) return;

        const result = ensure_analysis();
        const index = ptr;
        const static_rate = index >= 0 && index < result.rates.length ? result.rates[index] : 0.5;
        const rate = analysis_point_rate(index, static_rate);
        const best = index >= 0 ? analysis_best_cache.get(index) || null : null;
        const sweep = index >= 0 ? analysis_sweep_cache.get(index) || null : null;
        const total = info_snapshot.length;

        if (analysis_black_rate) analysis_black_rate.innerText = `黑方 ${(rate * 100).toFixed(1)}%`;
        if (analysis_white_rate) analysis_white_rate.innerText = `白方 ${((1 - rate) * 100).toFixed(1)}%`;
        if (analysis_bar_black) analysis_bar_black.style.width = `${(rate * 100).toFixed(2)}%`;
        if (analysis_source) {
            analysis_source.innerText = analysis_ai_failed
                ? '胜率来源：静态估算（ZeroAI 不可用）'
                : `胜率来源：ZeroAI · SIM=120（${analysis_sweep_cache.size}/${total} 手，未分析部分为静态估算）`;
        }

        if (analysis_turn) {
            if (index < 0) {
                analysis_turn.innerText = '初始局面 · 请进入某一手查看胜率与着手质量';
                analysis_turn.style.color = '';
            } else {
                const label = analysis_label_of(index);
                const move = result.moves[index];
                const mover = info_turn[index] === PLAYER_ENUM.WHITE ? '黑方' : '白方';
                const item = best || sweep;
                let detail;
                if (item && Number.isFinite(item.actualQ)) {
                    detail = `本手胜率 ${(analysis_side_rate(item.actualQ) * 100).toFixed(1)}%`;
                    if (Number.isFinite(item.bestQ)) {
                        detail += ` · 正着 ${(analysis_side_rate(item.bestQ) * 100).toFixed(1)}%`;
                    }
                } else {
                    detail = `${move.delta >= 0 ? '+' : ''}${(move.delta * 100).toFixed(1)}%`;
                }
                const quality = label ? `${ANALYSIS_SYMBOLS[label]} ${ANALYSIS_LABELS[label]}` : '未评估';
                analysis_turn.innerText = `第 ${index + 1} 手 · ${mover} · ${quality}（${detail}）`;
                analysis_turn.style.color = label ? ANALYSIS_COLORS[label] : '';
            }
        }

        if (analysis_best) {
            if (index < 0) {
                analysis_best.innerText = '请先进入回放的某一手';
            } else if (best) {
                const actual = info_view[index];
                const same = actual && actual[0] === best.x && actual[1] === best.y;
                const q = Number.isFinite(best.bestQ) ? `胜率 ${(analysis_side_rate(best.bestQ) * 100).toFixed(1)}%` : '—';
                analysis_best.innerHTML = `<div>第 ${best.x + 1} 列 · 第 ${9 - best.y} 行 `
                    + `<span style="color: #0f172a; font-weight: 700;">${q}</span>`
                    + (same ? ' <span style="color: #16a34a; font-weight: 700;">本手即正着</span>' : '')
                    + `</div><div class="text-muted" style="font-size: 0.68rem;">`
                    + `${best.source} · ${best.simulations} 模拟 · ${Math.round(best.milliseconds)}ms</div>`;
            } else if (analysis_ai_failed) {
                analysis_best.innerText = 'ZeroAI 不可用';
            } else if (analysis_best_failures.has(index)) {
                analysis_best.innerText = '该手评估失败';
            } else if (analysis_job_running && analysis_job_running.type === 'best' && analysis_job_running.index === index) {
                analysis_best.innerText = '正在用 888 SIM 残局 AI 分析本手正着…';
            } else {
                analysis_best.innerText = '点击「正着分析」按钮，用 888 SIM 残局 AI 计算本手正着';
            }
        }

        if (analysis_ai_state) {
            if (analysis_ai_failed) analysis_ai_state.innerText = 'ZeroAI 不可用';
            else if (analysis_ai_busy()) analysis_ai_state.innerText = `分析中… ${analysis_sweep_cache.size}/${total} 手`;
            else if (analysis_ai_ready) analysis_ai_state.innerText = `ZeroAI 已就绪 · ${analysis_sweep_cache.size}/${total} 手`;
            else analysis_ai_state.innerText = '加载中…';
        }

        if (button_analysis_best) {
            const running = analysis_job_running && analysis_job_running.type === 'best' && analysis_job_running.index === index;
            button_analysis_best.disabled = Boolean(index < 0 || analysis_ai_failed || best || running);
        }

        if (analysis_counts) {
            const counts = Object.fromEntries(ANALYSIS_ORDER.map((label) => [label, 0]));
            let analyzed = 0;
            analysis_frames.forEach((frame, i) => {
                if (!analysis_sweep_cache.has(i) && !analysis_best_cache.has(i)) return;
                analyzed++;
                const label = analysis_label_of(i);
                if (label) counts[label] += 1;
            });
            analysis_counts.innerText = `已分析 ${analyzed}/${total} 手 · `
                + ANALYSIS_ORDER.map((label) => `${ANALYSIS_SYMBOLS[label]} ${counts[label]}`).join(' · ');
        }

        draw_analysis_chart(result, index, rate);
    };

    if (button_analysis_toggle) button_analysis_toggle.addEventListener('click', () => {
        if (!analysis_panel) return;
        if (analysis_panel.classList.contains('d-none')) {
            analysis_panel.classList.remove('d-none');
            // 首次开启后棋盘标注长期保留，关闭面板不会抹掉着手标识与推荐落点
            analysis_mode = true;
            analysis_sweep_all();
        } else {
            analysis_panel.classList.add('d-none');
        }
        refresh_analysis_overlay();
    });

    if (button_analysis_close) button_analysis_close.addEventListener('click', () => {
        if (analysis_panel) analysis_panel.classList.add('d-none');
        refresh_analysis_overlay();
    });

    if (button_analysis_best) button_analysis_best.addEventListener('click', () => {
        analysis_best_request(ptr);
    });

    if (canvas_analysis) canvas_analysis.addEventListener('click', (event) => {
        const result = ensure_analysis();
        const total = result.rates.length;
        if (!total) return;

        const rect = canvas_analysis.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        ptr = total === 1 ? 0 : Math.round(ratio * (total - 1));
        gen.dispatch(ptr);
    });

    window.addEventListener('resize', () => {
        if (analysis_open() && analysis_result) render_analysis();
    });


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
        gl_ui.clear_view_move();

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

        // 回合（开启分析时用着手质量颜色标注最新落点）
        let view_color = '#00FFC5';
        let analysis_label = null;
        if (analysis_mode) {
            analysis_label = analysis_label_of(p);
            if (analysis_label) view_color = ANALYSIS_COLORS[analysis_label];
        }
        const view = info_view[p];
        if (view) gl_ui.draw_stone_turn(view[0], view[1], view_color, 5);

        // 当前落子点右上角显示着手标识（纯 UI 叠加）
        if (analysis_mode && (analysis_label || analysis_move_is_best(p))) {
            update_move_badge(p);
        } else if (analysis_badge) {
            analysis_badge.classList.add('d-none');
        }

        // 推荐正着圈：888 正着分析为浅蓝，回退到 120 整场扫盘时显示浅绿
        if (analysis_mode) draw_analysis_ai_move(p);

        // 声音
        if (gl_silent_redraw) gl_silent_redraw = false;
        else if (info_sound[p] === 'stone') gl_sound.play_stone();
        else if (info_sound[p] === 'plant') gl_sound.play_plant();

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

        // 局势分析面板
        render_analysis();
        analysis_sweep_prioritize(p);

        // 全盘打点
        gl_threat_refresh();
    }
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