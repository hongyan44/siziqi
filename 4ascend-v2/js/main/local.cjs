/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 本地对局
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');
const game_icon = document.getElementById('game_icon');


const main_app = document.getElementById('main_app');
const main_opt = document.getElementById('main_opt');
const main_game = document.getElementById('main_game');


const game_p1_name = document.getElementById('game_p1_name');


const select_server_balance = document.getElementById('select_server_balance');
const select_server_mode = document.getElementById('select_server_mode');
const select_server_first = document.getElementById('select_server_first');
const select_server_color = document.getElementById('select_server_color');

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

const Local = window.MainExports.Local;
const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const toast = new ShToast();




let is_main = true;




// 加入房间
button_server_join.addEventListener('pointerdown', (event) => {
    if (event.target !== button_server_join) return;

    const archive = input_server_archive.value;
    const health = Number(input_server_health.value);

    if (archive !== '' && !ArchiveV0.load(BaseZalgo.decode(archive))) return toast.error('非法对局存档！');
    else if (!Number.isInteger(health) || health < 2 || health > 100) return toast.error('生命值需为 2-100 的整数！');

    Local.setup(
        input_server_archive.value,
        health,
        input_server_board.value,
        select_server_balance.value,
        select_server_mode.value,
        select_server_first.value,
        select_server_color.value
    );
    Local.run();

    button_home.classList.add('d-none');
    window.switch_wection(main_game, main_opt);

    is_main = false;
});


// 功能面板
game_msg.addEventListener('pointerdown', (event) => {
    if (event.target !== game_msg || is_main) return;

    dialog_tools.classList.remove('d-none');
    dialog_tools.show();
});