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
    // (() => {
    //     let vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    //     alert(vh);
    //     document.documentElement.style.setProperty('--vh', `${vh}px`);
    // })();

    // window.addEventListener(('resize'), (event) => alert(window.visualViewport.height));

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
 * @description: 得到设备指纹
 * @return {Promise<Uint8Array>}
 */
const get_fp = async () => {
    const entropy = {};

    // 1. GPU 显卡型号
    const get_gpu = () => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'no-gpu';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'no-ext';
    };

    // 2. Canvas 像素特征
    const get_canvas = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillText('fp_fp_fp_martcat2js', 2, 2);
        return canvas.toDataURL();
    };

    // 3. Audio 渲染特征 (利用离线上下文，不发声)
    const get_audio = async () => {
        return new Promise((resolve) => {
            try {
                const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                const context = new AudioCtx(1, 44100, 44100);
                const oscillator = context.createOscillator();
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(1000, context.currentTime);
                const compressor = context.createDynamicsCompressor();
                oscillator.connect(compressor);
                compressor.connect(context.destination);
                oscillator.start(0);
                context.oncomplete = (e) => resolve(e.renderedBuffer.getChannelData(0)[4500].toString());
                context.startRendering();
            } catch (e) { resolve('audio-err'); }
        });
    };

    // 4. 收集数据
    entropy.gpu = get_gpu();
    entropy.canvas = get_canvas();
    entropy.audio = await get_audio();
    entropy.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 5. 输出 512位 哈希
    const raw = JSON.stringify(entropy);
    const message = new TextEncoder().encode(raw);
    const buffer = sha512.array(message);

    return new Uint8Array(buffer);
};

/**
 * @description: 生成一个随机数
 * @return {Promise<number>}
 */
const ruint32 = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
};

/**
 * @description: splitmix32
 * @param {number} seed
 * @return {number}
 */
const splitmix32 = (seed) => {
    seed |= 0;
    seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
    seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
    return (seed ^ (seed >>> 16)) >>> 0;
};

/**
 * @description: 生成一个Unity的随机数种子
 * @return {number}
 */
const runity = async () => {
    // 时间熵
    let seed = Math.floor(Date.now() / 1000);
    // seed >>>= 0;

    // 底层熵
    const random_entropy = ruint32();
    seed ^= random_entropy;
    // seed >>>= 0;

    // 指纹熵
    const fp = await get_fp();
    fp.forEach((value) => {
        // seed ^= value;
        // seed = Math.imul(seed ^ value, 0x5DEECE66D);
        seed = splitmix32(seed ^ value);
        // seed >>>= 0;
    });

    // return seed >>> 0; // 截断
    return seed;
};

/**
 * @description: 生成一个AIC的随机数种子
 * @return {number}
 */
const raic = () => {
    return Date.now(); // 毫秒
};




let game_sound;

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
    // 初始化
    game_sound = new GameSound(0.5, 3.7);
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




let gl_rand_aic, gl_rand_unity, gl_state, gl_board, gl_game_ui;

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

        navigator.clipboard.writeText(string);

        toast.success('对局序列化成功，已复制到剪贴板！');
    } catch (error) {
        toast.error('对局序列化失败！');
    }
});

// 重赛
button_game_restart.addEventListener('pointerdown', (event) => {
    if (event.target !== button_game_restart || gameing) return;

    gl_board = null;
    gl_rand = null;
    gl_state = null;

    if (gl_game_ui) gl_game_ui.stop_click2move();

    gl_game_ui = null;

    dialog_game.hide();
    game_run();
});




// 游戏联机
async function game_run() {
    // 正在游戏
    // button_game_restart.disabled = true;
    // gameing = true;

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
        // game_timer.reset(500, 10);
        // game_timer.start();

        for await (const pos of game_ui.iterator_click()) {
            if (!pos) continue;
            if (pos === 'end') return 'end';

            const x = pos[0];
            const y = pos[1];
            pass = pos[2];

            // 超时
            if (pass && game.ed_tr_1(x, y)) break;

            // 计时完毕
            // if (!game_timer.is_running) return;

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

        // game_timer.stop();
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


    // 游戏开局
    const board = new Board(9, 9);
    const state = new State();
    const rand_aic = new RandAIC(raic());
    const rand_unity = new RandUnity(await runity());
    const game = new Game(board, state, rand_aic, rand_unity);

    const game_timer = new GameTimer(game_msg, local_pass);

    const ascend_points = [[], []];

    state.turn_player = PLAYER_ENUM;

    // 两次
    rand_unity.ins(0, 2);
    rand_unity.ins(0, 2);


    // 全局
    gl_board = board;
    gl_rand_aic = rand_aic;
    gl_rand_unity = rand_unity;
    gl_state = state;
    gl_game_ui = game_ui;


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

    const turn_line = window.cs_isphone ? 4 : 7;

    let now_stone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;


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
        if (!window.cs_isphone) local_move();
        const pass = await locl_pice();
        if (gl_board !== board || gl_rand_aic !== rand_aic || gl_rand_unity !== rand_unity || gl_state !== state || gl_game_ui !== game_ui) break;


        // 颜色清理
        game_msg.classList.remove('text-success');


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
            await sleep(2100);
            game_msg.innerText = `⚫黑方剩余${state.hp[0]}`;
            await sleep(900);
            game_msg.innerText = `⚪白方剩余${state.hp[1]}`;
            await sleep(900);

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
        if (win) {
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
            await sleep(488);
        }


        // ASCEND清理
        game.ed_as_3();
    }

    // 变量
    // gameing = false;
    // button_game_restart.disabled = false;

    console.log(board.turns);
}