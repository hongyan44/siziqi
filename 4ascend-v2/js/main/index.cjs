/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 主界面
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const button_local = document.getElementById('button_local');
const button_user = document.getElementById('button_user');
const button_clear = document.getElementById('button_clear');

// 每日任务入口与弹窗
const button_task_wrap = document.getElementById('button_task_wrap');
const button_task_toggle = document.getElementById('button_task_toggle');
const badge_task_dot = document.getElementById('badge_task_dot');
const dialog_task = document.getElementById('dialog_task');
const div_task_list = document.getElementById('div_task_list');
const button_task_close = document.getElementById('button_task_close');
const span_task_refresh = document.getElementById('span_task_refresh');


const dialog_init = document.getElementById('dialog_init');

// 新手引导（仅初次注册时弹出）
const dialog_onboard = document.getElementById('dialog_onboard');
const button_onboard_story = document.getElementById('button_onboard_story');
const button_onboard_rule = document.getElementById('button_onboard_rule');
const button_onboard_skip = document.getElementById('button_onboard_skip');

const button_init_login = document.getElementById('button_init_login');
const button_init_register = document.getElementById('button_init_register');
const panel_init_login = document.getElementById('panel_init_login');
const panel_init_register = document.getElementById('panel_init_register');

const input_login_ident = document.getElementById('input_login_ident');
const button_login_sms = document.getElementById('button_login_sms');
const input_login_pass = document.getElementById('input_login_pass');
const input_login_code = document.getElementById('input_login_code');

const input_reg_ident = document.getElementById('input_reg_ident');
const button_reg_sms = document.getElementById('button_reg_sms');
const input_reg_code = document.getElementById('input_reg_code');
const input_reg_account = document.getElementById('input_reg_account');
const input_reg_name = document.getElementById('input_reg_name');
const input_reg_pass = document.getElementById('input_reg_pass');
const input_reg_pass2 = document.getElementById('input_reg_pass2');

const button_init_submit = document.getElementById('button_init_submit');


const dialog_local = document.getElementById('dialog_local');

const range_sound_tick = document.getElementById('range_sound_tick');
const range_sound_stone = document.getElementById('range_sound_stone');
const range_sound_plant = document.getElementById('range_sound_plant');
const range_sound_match = document.getElementById('range_sound_match');
const range_sound_bgm = document.getElementById('range_sound_bgm');
const range_sound_annihilation = document.getElementById('range_sound_annihilation');
const range_sound_hit = document.getElementById('range_sound_hit');
const range_sound_orbit = document.getElementById('range_sound_orbit');
const range_sound_fly = document.getElementById('range_sound_fly');
const input_music_files = document.getElementById('input_music_files');
const button_music_add = document.getElementById('button_music_add');
const select_music_mode = document.getElementById('select_music_mode');
const music_playlist = document.getElementById('music_playlist');
const span_music_count = document.getElementById('span_music_count');

const range_click_time = document.getElementById('range_click_time');
const range_click_level = document.getElementById('range_click_level');

const switch_skin_piece = document.getElementById('switch_skin_piece');
const switch_skin_piece_rouge = document.getElementById('switch_skin_piece_rouge');
const switch_skin_piece_atlantis = document.getElementById('switch_skin_piece_atlantis');
const switch_skin_grass = document.getElementById('switch_skin_grass');
const switch_skin_grass_gold = document.getElementById('switch_skin_grass_gold');
const switch_skin_grass_jade = document.getElementById('switch_skin_grass_jade');
const switch_skin_grass_firesteel = document.getElementById('switch_skin_grass_firesteel');
const switch_skin_board = document.getElementById('switch_skin_board');
const switch_skin_board_gold = document.getElementById('switch_skin_board_gold');
const switch_skin_board_atlantis = document.getElementById('switch_skin_board_atlantis');
const switch_skin_theme = document.getElementById('switch_skin_theme');
const switch_skin_theme_black = document.getElementById('switch_skin_theme_black');
const switch_skin_theme_liuqing = document.getElementById('switch_skin_theme_liuqing');



const dialog_user = document.getElementById('dialog_user');
const input_user_name = document.getElementById('input_user_name');
const button_user_submit = document.getElementById('button_user_submit');
const span_user_avatar = document.getElementById('span_user_avatar');
const button_user_avatar_pick = document.getElementById('button_user_avatar_pick');
const input_user_avatar_file = document.getElementById('input_user_avatar_file');
const span_user_mail = document.getElementById('span_user_mail');
const span_user_account = document.getElementById('span_user_account');
const span_user_pass_status = document.getElementById('span_user_pass_status');
const span_user_level = document.getElementById('span_user_level');
const span_user_role = document.getElementById('span_user_role');
const block_user_wallet = document.getElementById('block_user_wallet');
const input_user_secret = document.getElementById('input_user_secret');
const button_user_unlock = document.getElementById('button_user_unlock');

const button_user_permission_guide = document.getElementById('button_user_permission_guide');
const block_user_color = document.getElementById('block_user_color');
const block_user_color_gradient = document.getElementById('block_user_color_gradient');
const block_user_color_rainbow = document.getElementById('block_user_color_rainbow');
const span_user_color_preview = document.getElementById('span_user_color_preview');
const input_user_color_custom = document.getElementById('input_user_color_custom');
const button_user_color_clear = document.getElementById('button_user_color_clear');
const button_user_color_save = document.getElementById('button_user_color_save');
const dialog_permission_guide = document.getElementById('dialog_permission_guide');

const input_user_pass_code = document.getElementById('input_user_pass_code');
const button_user_pass_sms = document.getElementById('button_user_pass_sms');
const input_user_pass = document.getElementById('input_user_pass');
const input_user_pass2 = document.getElementById('input_user_pass2');
const button_user_pass_submit = document.getElementById('button_user_pass_submit');

const block_user_account_set = document.getElementById('block_user_account_set');
const input_user_account_code = document.getElementById('input_user_account_code');
const button_user_account_sms = document.getElementById('button_user_account_sms');
const input_user_account = document.getElementById('input_user_account');
const button_user_account_submit = document.getElementById('button_user_account_submit');

// 全服消息管理（仅管理员 level 4 可见）
const block_notice_admin = document.getElementById('block_notice_admin');
const input_notice_title = document.getElementById('input_notice_title');
const textarea_notice_content = document.getElementById('textarea_notice_content');
const button_notice_publish = document.getElementById('button_notice_publish');
const button_notice_clear_admin = document.getElementById('button_notice_clear_admin');

// 当前账号绑定的邮箱或手机号，用于发送设置密码的验证码
let user_ident = '';
// 当前账号头像（data URL，空字符串表示未设置）
let user_avatar_data = '';

const USER_LEVEL_NAMES = {
    1: '普通用户',
    2: '进阶用户',
    3: '高级用户',
    4: '管理员',
};


const dialog_clear = document.getElementById('dialog_clear');
const button_clear_submit = document.getElementById('button_clear_submit');


const { ShToast, Skins } = window.UiExports;
const toast = new ShToast();
const button_music_toggle = document.getElementById('button_music_toggle');
const icon_music_toggle = document.getElementById('icon_music_toggle');
const MUSIC_MAX_TRACKS = window.MusicPlaylist.MAX_TRACKS || 500;

const music_size = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const render_music_playlist = () => {
    const list = window.MusicPlaylist.get_meta();
    span_music_count.innerText = `${list.length} / ${MUSIC_MAX_TRACKS} 首`;
    music_playlist.innerHTML = '';
    if (!list.length) {
        music_playlist.innerHTML = `<div class='text-secondary small border rounded p-2'>还没有自定义音乐，将继续播放默认背景音乐。</div>`;
        return;
    }

    list.forEach((track, index) => {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2 border rounded px-2 py-1';
        const icon = document.createElement('sl-icon');
        icon.name = 'music-note';
        const name = document.createElement('span');
        name.className = 'text-truncate flex-grow-1';
        name.title = track.name;
        name.textContent = track.name;
        const size = document.createElement('small');
        size.className = 'text-secondary';
        size.textContent = music_size(track.size);
        row.append(icon, name, size);

        const up = document.createElement('sl-button');
        up.size = 'small'; up.variant = 'text'; up.circle = true; up.disabled = index === 0; up.title = '上移';
        up.innerHTML = `<sl-icon name='arrow-up'></sl-icon>`;
        up.addEventListener('click', async () => { await window.MusicPlaylist.move(track.id, -1); render_music_playlist(); });

        const down = document.createElement('sl-button');
        down.size = 'small'; down.variant = 'text'; down.circle = true; down.disabled = index === list.length - 1; down.title = '下移';
        down.innerHTML = `<sl-icon name='arrow-down'></sl-icon>`;
        down.addEventListener('click', async () => { await window.MusicPlaylist.move(track.id, 1); render_music_playlist(); });

        const remove = document.createElement('sl-button');
        remove.size = 'small'; remove.variant = 'text'; remove.circle = true; remove.title = '移除';
        remove.innerHTML = `<sl-icon name='trash'></sl-icon>`;
        remove.addEventListener('click', async () => {
            await window.MusicPlaylist.delete(track.id);
            render_music_playlist();
        });

        row.append(up, down, remove);
        music_playlist.append(row);
    });
};

const add_music_files = async (files) => {
    try {
        const result = await window.MusicPlaylist.add_files(files);
        render_music_playlist();
        if (result.skipped > 0) toast.error(`歌单最多保存${MUSIC_MAX_TRACKS}首，部分文件未添加。`);
        else toast.success(`已添加 ${result.added.length} 首音乐。`);
    } catch (error) {
        toast.error(error.message || '添加音乐失败！');
    }
};



// 对话框防误触关闭
(() => {
    dialog_init.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_local.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_user.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_clear.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
    dialog_onboard.addEventListener('sl-request-close', (event) => event.detail.source === 'overlay' && event.preventDefault());
})();

const is_logged_in = () => Boolean(localStorage.getItem('token'));

const show_login = () => {
    dialog_init.classList.remove('d-none');
    dialog_init.show();
};

const require_login = () => {
    if (is_logged_in()) return true;
    show_login();
    return false;
};

const HOME_FREE_PATHS = new Set([
    '/pages/local/debug.html',
    '/pages/local/ai.html',
    '/pages/local/replay.html',
    '/pages/docs/tip.html',
    '/pages/docs/rule.html',
]);

const is_home_free_target = (target) => {
    const actionable = target.closest('sl-button, button, a');
    if (!actionable) return false;
    if (actionable.id === 'button_local') return true;
    const href = actionable.getAttribute('href');
    return href ? HOME_FREE_PATHS.has(new URL(href, location.href).pathname) : false;
};

const is_home_gated_target = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('#dialog_init, #dialog_onboard, #dialog_local, #button_music_toggle, #global_music_toggle')) return false;
    if (target.closest('footer')) return false;
    if (is_home_free_target(target)) return false;
    return Boolean(target.closest('sl-button, button, a'));
};

const gate_home_action = (event) => {
    if (is_logged_in()) return;
    if (is_home_free_target(event.target)) {
        if (event.type !== 'click') return;
        const actionable = event.target.closest('sl-button, button, a');
        const href = actionable && actionable.getAttribute('href');
        if (href) {
            event.preventDefault();
            event.stopImmediatePropagation();
            location.assign(new URL(href, location.href).href);
        }
        return;
    }
    if (!is_home_gated_target(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    show_login();
};

document.addEventListener('pointerdown', gate_home_action, true);
document.addEventListener('click', gate_home_action, true);

HOME_FREE_PATHS.forEach((pathname) => {
    const link = document.querySelector(`sl-button[href='${pathname}']`);
    if (!link) return;
    link.addEventListener('click', (event) => {
        if (is_logged_in()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        location.assign(new URL(pathname, location.href).href);
    });
});




const { check_login_ident, check_mail_phone, check_account, check_password, check_password_repeat, check_code } = window.AuthExports;

// 当前登录/注册面板
let init_tab = 'login';

/**
 * @description: 切换登录/注册面板
 * @param {'login' | 'register'} tab
 * @return {void}
 */
const switch_init_tab = (tab) => {
    init_tab = tab === 'register' ? 'register' : 'login';
    const is_login = init_tab === 'login';

    panel_init_login.classList.toggle('d-none', !is_login);
    panel_init_login.classList.toggle('d-flex', is_login);
    panel_init_register.classList.toggle('d-none', is_login);
    panel_init_register.classList.toggle('d-flex', !is_login);

    button_init_login.variant = is_login ? 'primary' : 'default';
    button_init_register.variant = is_login ? 'default' : 'primary';
    button_init_submit.innerText = is_login ? '登录' : '注册';
};

/**
 * @description: 发送验证码（先做前端校验，再请求后端）
 * @param {string} ident
 * @param {(value: string) => string} check
 * @return {Promise<void>}
 */
const ident_sms = async (ident, check) => {
    const message = check(ident);
    if (message) return toast.error(message);

    try {
        const result = await window.http_user_sms(ident);
        if (!result) return toast.error('验证码发送失败！');
        // 后端未配置短信服务商时，手机号回退固定占位验证码，此处同步提示；已配置则真实下发。
        if (result.dev) toast.success(`验证码发送成功！测试阶段手机验证码固定为 ${window.AuthExports.PHONE_DEV_CODE}`);
        else toast.success('验证码发送成功！');

    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 登录（密码与验证码二选一）
 * @param {string} ident
 * @param {string} pass
 * @param {string} code
 * @return {Promise<void>}
 */
const login_submit = async (ident, pass, code) => {
    try {
        const token = await window.http_user_login(ident, pass, code);
        if (!token) return toast.error('账号/手机号/邮箱、密码或验证码错误！');

        window.set_token(token);
        toast.success('登录成功！');
        await window.sleep(888);
        location.reload();

    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 注册（注册成功后不自动登录，切回登录面板并带出标识）
 * @param {string} ident
 * @param {string} code
 * @param {string} account
 * @param {string} pass
 * @param {string} name
 * @return {Promise<void>}
 */
const register_submit = async (ident, code, account, pass, name) => {
    try {
        const status = await window.http_user_register(ident, code, account, pass, name);
        if (!status) return toast.error('注册失败，请检查验证码，或账号/邮箱/手机号已被占用！');

        toast.success('注册成功，可以使用注册的手机号/邮箱或账号进行账密登录，也可以验证码登录。');
        switch_init_tab('login');
        input_login_ident.value = ident;

    } catch (_) {
        toast.error('请求错误！');
    }
};

// ==================== 新手引导（萌新证） ====================
// 注册时由后端发放萌新证；登录后检测到萌新证才弹出引导，并在弹出后立即销毁，保证只出现一次

/**
 * @description: 弹出新手引导
 * @return {void}
 */
const show_onboard = () => {
    dialog_onboard.classList.remove('d-none');
    dialog_onboard.show();
};

/**
 * @description: 登录状态下检测萌新证：有则弹出新手引导并销毁萌新证
 * @return {Promise<void>}
 */
const onboard_sync = async () => {
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token || typeof window.http_user_info !== 'function') return;

    try {
        const info = await window.http_user_info(token);
        if (!info || !info.newbie) return;

        show_onboard();
        // 弹出即销毁，避免下次登录重复引导；销毁失败不影响本次展示
        if (typeof window.http_user_newbie_clear === 'function') await window.http_user_newbie_clear(token);
    } catch (_) {
        // 检测失败不影响主页正常使用
    }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onboard_sync, { 'once': true });
else onboard_sync();

// 通过剧情对话了解玩法：直接进入剧情第一关
button_onboard_story.addEventListener('click', () => {
    location.assign('/pages/docs/story-play.html?level=1');
});

// 通过文档了解玩法：进入游戏规则页
button_onboard_rule.addEventListener('click', () => {
    location.assign('/pages/docs/rule.html');
});

// 已了解规则：关闭弹窗（萌新证已在弹出时销毁，不再重复出现）
button_onboard_skip.addEventListener('click', () => {
    dialog_onboard.hide();
});

/**
 * @description: 用户信息获取
 * @param {string} token
 * @return {Promise<void>}
 */
const render_user_level = (level) => {
    const safe_level = Math.min(4, Math.max(1, Number(level) || 1));
    span_user_level.innerText = `等级 ${safe_level} · ${USER_LEVEL_NAMES[safe_level]}`;
    span_user_level.dataset.level = safe_level;
    const roles = {
        1: '权限：普通用户（浏览与对战）',
        2: '权限：可投稿残局（每日残局 / 残局闯关）· 可设置昵称颜色（单色）',
        3: '权限：可审核残局投稿 · 可设置昵称颜色（彩色渐变）',
        4: '权限：残局管理 + 在线玩家好友 + 流动彩虹昵称',
    };
    if (span_user_role) span_user_role.innerText = roles[safe_level];
    // 昵称颜色设置等级 2 及以上可见；彩色渐变等级 3 及以上可见；流动彩虹仅等级 4 可见
    block_user_color.classList.toggle('d-none', safe_level < 2);
    block_user_color_gradient.classList.toggle('d-none', safe_level < 3);
    block_user_color_rainbow.classList.toggle('d-none', safe_level !== 4);
    if (block_notice_admin) block_notice_admin.classList.toggle('d-none', safe_level !== 4);
};

// 当前昵称颜色选择：'' 表示未选择，单色为 '#rrggbb'，彩色渐变为 'linear-gradient(...)'，流动彩虹为 'rainbow'
let user_color_selection = '';
let user_color_name = '';

/**
 * @description: 将昵称颜色应用到节点（渲染实现统一放在 must 模块的 window.name_color_apply）
 * @param {HTMLElement} node
 * @param {string} color
 * @return {void}
 */
const apply_name_color = (node, color) => {
    if (!node) return;
    if (typeof window.name_color_apply === 'function') return window.name_color_apply(node, color);
};

// 高亮当前选中的色块
const render_user_color_swatches = () => {
    ['#div_user_color_solids .color-swatch', '#div_user_color_gradients .color-swatch', '#div_user_color_rainbows .color-swatch'].forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
            node.style.boxShadow = user_color_selection === node.dataset.color
                ? '0 0 0 2px var(--sl-color-primary-600)' : 'none';
        });
    });
};

// 刷新预览与选中态
const render_user_color = () => {
    span_user_color_preview.innerText = user_color_name || '昵称';
    apply_name_color(span_user_color_preview, user_color_selection);
    render_user_color_swatches();
    // 单色时同步取色器位置，便于在常用色基础上微调
    if (input_user_color_custom && /^#[0-9a-fA-F]{6}$/.test(user_color_selection)) input_user_color_custom.value = user_color_selection.toLowerCase();
};

// 密码以摘要存储，前端只能展示“是否已设置”的状态
const render_user_pass_status = (has_pass) => {
    const set = Boolean(has_pass);
    span_user_pass_status.innerText = set ? '已设置' : '未设置';
    span_user_pass_status.classList.toggle('text-success', set);
    span_user_pass_status.classList.toggle('text-secondary', !set);
};

/**
 * @description: 渲染账号头像（有图用图片，无图用昵称首字占位）
 * @return {void}
 */
const render_user_avatar = () => {
    const name = input_user_name.value || '';
    if (user_avatar_data) {
        span_user_avatar.image = user_avatar_data;
        span_user_avatar.initials = '';
    } else {
        span_user_avatar.image = '';
        span_user_avatar.initials = name ? name.trim().slice(0, 1) : '?';
    }
};

/**
 * @description: 把本地图片居中裁剪压缩为 256×256 的 JPEG data URL
 * @param {File} file
 * @return {Promise<string>}
 */
const read_avatar_file = (file) => new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) return reject(new Error('请选择图片文件！'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(url);
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片解析失败！'));
    };
    image.src = url;
});

/**
 * @description: 把账号已购皮肤写入本机缓存，供本地设置与对局画布读取
 * @param {string[]} skins
 * @return {void}
 */
const sync_owned_skins = (skins) => {
    if (!Skins || !Array.isArray(skins)) return;
    try {
        localStorage.setItem('4a_skins', JSON.stringify({
            piece: skins.includes('piece'),
            piece_rouge: skins.includes('piece_rouge'),
            piece_atlantis: skins.includes('piece_atlantis'),
            grass: skins.includes('grass'),
            grass_gold: skins.includes('grass_gold'),
            grass_jade: skins.includes('grass_jade'),
            grass_firesteel: skins.includes('grass_firesteel'),
            board: skins.includes('board'),
            board_gold: skins.includes('board_gold'),
            board_atlantis: skins.includes('board_atlantis'),
            theme: skins.includes('theme'),
            theme_black: skins.includes('theme_black'),
            theme_liuqing: skins.includes('theme_liuqing'),
        }));
    } catch (_) {
        // 隐私模式下 localStorage 可能不可用，忽略即可
    }
};

const user_info = async (token) => {
    try {
        const info = await window.http_user_info(token);
        if (!info) return toast.error('获取账号信息失败！');
        const { name, mail, phone, account, level, has_pass } = info;
        input_user_name.value = name;
        span_user_mail.innerText = mail || phone || account || '';
        span_user_account.innerText = account || '未设置';
        // 账号仅未设置时可设置，设置后固定
        block_user_account_set.style.display = account ? 'none' : 'flex';
        render_user_pass_status(has_pass);
        user_ident = mail || phone || '';
        render_user_level(level);
        // 经济系统：经验等级与「我的背包」入口（棋币与道具都在背包中查看）
        if (block_user_wallet && window.WalletUI) window.WalletUI.render_panel(block_user_wallet, info, { backpack: true });
        // 账号已购皮肤同步到本机缓存，供本地设置的皮肤开关识别
        if (Skins && Array.isArray(info.skins)) {
            sync_owned_skins(info.skins);
            Skins.apply_theme();
        }
        user_avatar_data = info.avatar || '';
        render_user_avatar();
        user_color_name = name || '';
        user_color_selection = info.name_color || '';
        render_user_color();

    } catch (_) {
        toast.error('请求错误！');
    }
};

const user_unlock_level = async (token, secret) => {
    try {
        const level = await window.http_user_unlock_level(token, secret);
        if (!level) return toast.error('秘钥无效或账号权限未升级！');
        render_user_level(level);
        input_user_secret.value = '';
        toast.success(`权限已解锁至等级 ${level}，本枚秘钥已作废！`);
    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 设置/清除昵称颜色（空字符串表示清除）
 * @param {string} token
 * @param {string} color
 * @return {Promise<void>}
 */
const user_set_color = async (token, color) => {
    try {
        const status = await window.http_user_set_color(token, color);
        if (!status) return toast.error(color ? '保存昵称颜色失败！' : '清除昵称颜色失败！');
        user_color_selection = color;
        render_user_color();
        toast.success(color ? '昵称颜色已保存！' : '已清除昵称颜色！');
    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 用户信息更新
 * @param {string} token
 * @param {string} name
 * @param {string} avatar
 * @return {Promise<void>}
 */
const user_update = async (token, name, avatar) => {
    try {
        const status = await window.http_user_update(token, name, avatar);
        if (status) {
            dialog_user.hide();
            // 头像与昵称改动同步到好友抽屉
            if (typeof window.friends_refresh === 'function') window.friends_refresh();
            return toast.success('更新账号信息成功！');
        }
        toast.error('更新账号信息失败！');

    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 设置/修改登录密码（验证码校验通过后更新）
 * @param {string} token
 * @param {string} code
 * @param {string} pass
 * @return {Promise<void>}
 */
const user_set_pass = async (token, code, pass) => {
    try {
        const status = await window.http_user_set_pass(token, code, pass);
        if (!status) return toast.error('设置密码失败，请检查验证码是否正确！');

        [input_user_pass_code, input_user_pass, input_user_pass2].forEach((element) => { element.value = ''; });
        render_user_pass_status(true);
        toast.success('密码设置成功，可使用新密码登录！');

    } catch (_) {
        toast.error('请求错误！');
    }
};

/**
 * @description: 设置登录账号（仅账号未设置时可设置，验证码校验通过后写入；设置后固定不可再改）
 * @param {string} token
 * @param {string} code
 * @param {string} account
 * @return {Promise<void>}
 */
const user_set_account = async (token, code, account) => {
    try {
        const status = await window.http_user_set_account(token, code, account);
        if (!status) return toast.error('设置账号失败，请检查验证码，或该账号已被占用！');

        [input_user_account_code, input_user_account].forEach((element) => { element.value = ''; });
        span_user_account.innerText = account;
        block_user_account_set.style.display = 'none';
        toast.success('账号设置成功，可使用该账号登录！');

    } catch (_) {
        toast.error('请求错误！');
    }
};




// 访问主页不自动弹出登录；未登录时点击主页任意操作再弹出

// 登录 / 注册面板切换
button_init_login.addEventListener('click', () => switch_init_tab('login'));
button_init_register.addEventListener('click', () => switch_init_tab('register'));

// 验证码输入限制：仅 5 位数字
const bind_code_input = (element) => {
    element.addEventListener('sl-input', (event) => {
        if (event.target !== element) return;
        element.value = element.value.replace(/\D/g, '').slice(0, 5);
    });
};
bind_code_input(input_login_code);
bind_code_input(input_reg_code);
bind_code_input(input_user_pass_code);

// 登录：发送验证码
button_login_sms.addEventListener('pointerdown', (event) => {
    if (event.target !== button_login_sms) return;

    window.sleep_task(
        [button_init_submit, input_login_ident, input_login_pass, input_login_code],
        button_login_sms,
        async () => ident_sms(input_login_ident.value.trim(), check_login_ident),
    );
});

// 注册：发送验证码
button_reg_sms.addEventListener('pointerdown', (event) => {
    if (event.target !== button_reg_sms) return;

    window.sleep_task(
        [button_init_submit, input_reg_ident, input_reg_code, input_reg_account, input_reg_pass, input_reg_pass2],
        button_reg_sms,
        async () => ident_sms(input_reg_ident.value.trim(), check_mail_phone),
    );
});

// 登录 / 注册提交
button_init_submit.addEventListener('pointerdown', (event) => {
    if (event.target !== button_init_submit) return;

    if (init_tab === 'login') {
        const ident = input_login_ident.value.trim();
        const pass = input_login_pass.value;
        const code = input_login_code.value.trim();

        const message = check_login_ident(ident) || (pass ? check_password(pass) : '') || (code ? check_code(code) : '');
        if (message) return toast.error(message);
        if (!pass && !code) return toast.error('请输入密码或验证码！');

        window.sleep_task(
            [button_login_sms, input_login_ident, input_login_pass, input_login_code],
            button_init_submit,
            async () => login_submit(ident, pass, code),
        );
        return;
    }

    const ident = input_reg_ident.value.trim();
    const code = input_reg_code.value.trim();
    const account = input_reg_account.value.trim();
    const name = input_reg_name.value.trim();
    const pass = input_reg_pass.value;
    const pass2 = input_reg_pass2.value;

    const message = check_mail_phone(ident) || check_code(code) || check_account(account) || check_password(pass) || check_password_repeat(pass, pass2);
    if (message) return toast.error(message);
    if (name && window.name_length(name) > 16) return toast.error('昵称最长16个字符！');

    window.sleep_task(
        [button_reg_sms, input_reg_ident, input_reg_code, input_reg_account, input_reg_name, input_reg_pass, input_reg_pass2],
        button_init_submit,
        async () => register_submit(ident, code, account, pass, name),
    );
});

// 关闭后清空表单并复位到登录面板
dialog_init.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_init) return;

    switch_init_tab('login');
    [input_login_ident, input_login_pass, input_login_code, input_reg_ident, input_reg_code, input_reg_account, input_reg_name, input_reg_pass, input_reg_pass2]
        .forEach((element) => { element.value = ''; });
});


// 账号设置，对话框
button_user.addEventListener('pointerdown', () => {
    if (!require_login()) return;

    window.sleep_task(
        [input_user_name, button_user_submit],
        null,
        async () => user_info(window.get_token())
    );

    dialog_user.classList.remove('d-none');
    dialog_user.show();
});

// 解锁权限
button_user_unlock.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_unlock) return;
    const secret = input_user_secret.value.trim();
    if (!secret) return toast.error('请输入权限秘钥！');

    window.sleep_task(
        [button_user_unlock, input_user_secret],
        button_user_unlock,
        async () => user_unlock_level(window.get_token(), secret)
    );
});

// 权限指南
button_user_permission_guide.addEventListener('click', () => {
    dialog_permission_guide.classList.remove('d-none');
    dialog_permission_guide.show();
});

// 昵称颜色：选择色块（单色 / 彩色渐变 / 流动彩虹）
block_user_color.addEventListener('click', (event) => {
    const swatch = event.target.closest ? event.target.closest('.color-swatch') : null;
    if (!swatch) return;
    user_color_selection = swatch.dataset.color || '';
    render_user_color();
});

// 昵称颜色：取色器自定义单色（任意 #rrggbb）
if (input_user_color_custom) input_user_color_custom.addEventListener('input', () => {
    user_color_selection = input_user_color_custom.value || '';
    render_user_color();
});

// 昵称颜色：清除
button_user_color_clear.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_color_clear) return;

    window.sleep_task(
        [button_user_color_clear, button_user_color_save],
        button_user_color_clear,
        async () => user_set_color(window.get_token(), '')
    );
});

// 昵称颜色：保存
button_user_color_save.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_color_save) return;

    window.sleep_task(
        [button_user_color_clear, button_user_color_save],
        button_user_color_save,
        async () => user_set_color(window.get_token(), user_color_selection)
    );
});

// 设置账号：发送验证码（发往当前绑定的邮箱或手机号）
button_user_account_sms.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_account_sms) return;
    if (!user_ident) return toast.error('当前账号未绑定邮箱或手机号，无法发送验证码！');

    window.sleep_task(
        [button_user_account_sms, input_user_account_code, input_user_account],
        button_user_account_sms,
        async () => ident_sms(user_ident, check_mail_phone),
    );
});

// 设置账号：提交（验证码 + 登录账号）
button_user_account_submit.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_account_submit) return;

    const code = input_user_account_code.value.trim();
    const account = input_user_account.value.trim();

    const message = check_code(code) || check_account(account);
    if (message) return toast.error(message);

    window.sleep_task(
        [button_user_account_sms, input_user_account_code, input_user_account],
        button_user_account_submit,
        async () => user_set_account(window.get_token(), code, account),
    );
});

// 设置密码：发送验证码（发往当前绑定的邮箱或手机号）
button_user_pass_sms.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_pass_sms) return;
    if (!user_ident) return toast.error('当前账号未绑定邮箱或手机号，无法发送验证码！');

    window.sleep_task(
        [button_user_pass_sms, input_user_pass_code, input_user_pass, input_user_pass2],
        button_user_pass_sms,
        async () => ident_sms(user_ident, check_mail_phone),
    );
});

// 设置密码：提交（验证码 + 新密码 + 重复新密码）
button_user_pass_submit.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_pass_submit) return;

    const code = input_user_pass_code.value.trim();
    const pass = input_user_pass.value;
    const pass2 = input_user_pass2.value;

    const message = check_code(code) || check_password(pass) || check_password_repeat(pass, pass2);
    if (message) return toast.error(message);

    window.sleep_task(
        [button_user_pass_sms, input_user_pass_code, input_user_pass, input_user_pass2],
        button_user_pass_submit,
        async () => user_set_pass(window.get_token(), code, pass),
    );
});

// 修改设置
button_user_submit.addEventListener('pointerdown', (event) => {
    if (event.target !== button_user_submit) return;
    const name = input_user_name.value;

    if (!name) return toast.error('昵称不能为空！');
    else if (window.name_length(name) > 16) return toast.error('昵称最长16个字符！');

    window.sleep_task(
        [button_user_submit, input_user_name],
        button_user_submit,
        async () => user_update(window.get_token(), name, user_avatar_data)
    );
});

// 选择本地图片作为头像，压缩后仅预览，随“保存修改”一并提交
button_user_avatar_pick.addEventListener('click', () => input_user_avatar_file.click());

input_user_avatar_file.addEventListener('change', async () => {
    const file = input_user_avatar_file.files && input_user_avatar_file.files[0];
    input_user_avatar_file.value = '';
    if (!file) return;
    try {
        user_avatar_data = await read_avatar_file(file);
        render_user_avatar();
        toast.success('头像已选择，保存修改后生效！');
    } catch (error) {
        toast.error(error.message || '头像处理失败！');
    }
});

// 清理
dialog_user.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_user) return;

    input_user_name.value = '加载中...';
    span_user_mail.innerText = '加载中...';
    span_user_account.innerText = '加载中...';
    span_user_pass_status.innerText = '加载中...';
    span_user_pass_status.classList.remove('text-success', 'text-secondary');
    render_user_level(1);
    input_user_secret.value = '';
    [input_user_pass_code, input_user_pass, input_user_pass2].forEach((element) => { element.value = ''; });
    [input_user_account_code, input_user_account].forEach((element) => { element.value = ''; });
    block_user_account_set.style.display = 'none';
    user_avatar_data = '';
    span_user_avatar.image = '';
    span_user_avatar.initials = '';
    user_color_name = '';
    user_color_selection = '';
    render_user_color();
    user_ident = '';
});


// 账号退登，对话框
button_clear.addEventListener('pointerdown', () => {
    if (!require_login()) return;

    dialog_clear.classList.remove('d-none');
    dialog_clear.show();
});

// 账号退登
button_clear_submit.addEventListener('pointerdown', async (event) => {
    if (event.target !== button_clear_submit) return;

    await window.MusicPlaylist.clear();
    localStorage.clear();

    dialog_clear.hide();
    toast.success('清理成功！');
    window.sleep(888).then(() => location.reload());
});


// 皮肤开关：只展示本账号已拥有的皮肤，未拥有的整行不显示
const SKIN_ROWS = [
    { id: 'piece', switch_el: switch_skin_piece },
    { id: 'piece_rouge', switch_el: switch_skin_piece_rouge },
    { id: 'piece_atlantis', switch_el: switch_skin_piece_atlantis },
    { id: 'grass', switch_el: switch_skin_grass },
    { id: 'grass_gold', switch_el: switch_skin_grass_gold },
    { id: 'grass_jade', switch_el: switch_skin_grass_jade },
    { id: 'grass_firesteel', switch_el: switch_skin_grass_firesteel },
    { id: 'board', switch_el: switch_skin_board },
    { id: 'board_gold', switch_el: switch_skin_board_gold },
    { id: 'board_atlantis', switch_el: switch_skin_board_atlantis },
    { id: 'theme', switch_el: switch_skin_theme },
    { id: 'theme_black', switch_el: switch_skin_theme_black },
    { id: 'theme_liuqing', switch_el: switch_skin_theme_liuqing },
];

const render_skin_settings = () => {
    if (!Skins) return;

    const owned = Skins.owned();
    // 以实际生效状态回显：同组皮肤互斥，避免同时显示为开启
    const active = Skins.read();

    SKIN_ROWS.forEach((row) => {
        if (!row.switch_el) return;
        const has = !!owned[row.id];
        // 本地设置只展示已拥有的皮肤，未拥有的整行隐藏
        const row_el = row.switch_el.closest('[data-skin-row]');
        if (row_el) row_el.classList.toggle('d-none', !has);
        row.switch_el.disabled = !has;
        row.switch_el.checked = has && !!active[row.id];
    });
};

// 同组皮肤互斥：开启组内任一皮肤时自动关闭同组其余皮肤
[[switch_skin_piece, switch_skin_piece_rouge, switch_skin_piece_atlantis],
    [switch_skin_grass, switch_skin_grass_gold, switch_skin_grass_jade, switch_skin_grass_firesteel],
    [switch_skin_board, switch_skin_board_gold, switch_skin_board_atlantis],
    [switch_skin_theme, switch_skin_theme_black, switch_skin_theme_liuqing]]
    .forEach((group) => {
        group.forEach((self_el) => {
            if (!self_el) return;
            self_el.addEventListener('sl-change', () => {
                if (!self_el.checked) return;
                group.forEach((other_el) => {
                    if (other_el && other_el !== self_el) other_el.checked = false;
                });
            });
        });
    });


// ===== 我的背包 =====
const backpack_drawer = document.getElementById('backpack_drawer');
const backpack_backdrop = document.getElementById('backpack_backdrop');
const backpack_coin = document.getElementById('backpack_coin');
const backpack_pane = document.getElementById('backpack_pane');
const backpack_tabs = Array.from(document.querySelectorAll('.backpack-tab'));
const button_backpack_close = document.getElementById('button_backpack_close');
const dialog_gift_friend = document.getElementById('dialog_gift_friend');
const span_gift_friend_tip = document.getElementById('span_gift_friend_tip');
const div_gift_friend_list = document.getElementById('div_gift_friend_list');
const button_gift_friend_close = document.getElementById('button_gift_friend_close');

// 好友赠礼种类：500 棋币（每日限购）与 3000 棋币（每周限购，Lv.3+ 可购买）
const GIFT_KINDS = {
    gift500: { label: '500棋币', value: 500 },
    gift3000: { label: '3000棋币', value: 3000 },
};
let gift_friend_kind = 'gift500';

const BAG_SKIN_NAMES = {
    piece: '棋子皮肤：止变',
    piece_rouge: '棋子皮肤：Le Rouge et Le Noir',
    piece_atlantis: '棋子皮肤：亚拉弥赛亚的遗留',
    grass: '草皮肤：反曲点',
    grass_gold: '草皮肤：黄金',
    grass_jade: '草皮肤：白玉玲珑',
    grass_firesteel: '草皮肤：火与钢',
    board: '棋盘皮肤：玉中乾坤',
    board_gold: '棋盘皮肤：黑派',
    board_atlantis: '棋盘皮肤：亚特兰蒂斯',
    theme: 'UI替换：幽蓝时空',
    theme_black: 'UI替换：保存神域',
    theme_liuqing: 'UI替换：留青',
};

let backpack_tab = 'consume';
let backpack_info = null;

/**
 * @description: 背包外观图标（四种皮肤各一套迷你图形）
 * @param {string} id
 * @return {string}
 */
const backpack_skin_icon = (id) => {
    if (id === 'piece') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><circle cx='11' cy='16' r='8' fill='#26303c'/><circle cx='21' cy='16' r='8' fill='#f1eee5' stroke='#c3bcaa'/></svg>`;
    }
    if (id === 'piece_rouge') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><linearGradient id='bag-rouge-red' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e15a64'/><stop offset='1' stop-color='#6a1220'/></linearGradient><linearGradient id='bag-rouge-noir' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#33383f'/><stop offset='1' stop-color='#05070a'/></linearGradient></defs><circle cx='11' cy='16' r='8' fill='url(#bag-rouge-red)' stroke='#ffd9a0' stroke-width='0.9'/><path d='M6 12l10 4M5 17l12 4' stroke='rgba(255,230,200,.5)' stroke-width='1.2'/><circle cx='21' cy='16' r='8' fill='url(#bag-rouge-noir)' stroke='#c9a24f' stroke-width='0.9'/><path d='M21 9v14M21 13l5.5-3M21 13l-5.5-3M21 19l5.5 3M21 19l-5.5 3' stroke='#f0c86a' stroke-width='1.3'/></svg>`;
    }
    if (id === 'piece_atlantis') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><radialGradient id='bag-atl-tomato' cx='36%' cy='30%' r='70%'><stop offset='0' stop-color='#ff9a70'/><stop offset='0.5' stop-color='#d63c25'/><stop offset='1' stop-color='#6b0c07'/></radialGradient><radialGradient id='bag-atl-onion' cx='36%' cy='30%' r='72%'><stop offset='0' stop-color='#fffdf3'/><stop offset='0.62' stop-color='#ecdcb8'/><stop offset='1' stop-color='#a98f5e'/></radialGradient></defs><circle cx='11' cy='16' r='8' fill='url(#bag-atl-tomato)' stroke='#4d0805' stroke-width='0.9'/><path d='M8 9.5l1.5-2 1.5 2 1.5-2 1.5 2' fill='none' stroke='#4d8a45' stroke-width='1.4'/><ellipse cx='7.6' cy='15.4' rx='2.4' ry='1.4' fill='#f3e9dd'/><ellipse cx='13.4' cy='15.4' rx='2.4' ry='1.4' fill='#f3e9dd'/><circle cx='7.2' cy='15.4' r='0.9' fill='#17120f'/><circle cx='13.8' cy='15.4' r='0.9' fill='#17120f'/><circle cx='21' cy='16' r='8' fill='url(#bag-atl-onion)' stroke='#8a7048' stroke-width='0.9'/><path d='M18.5 8.5l1.8-2.6M21 8.2l.6-2.4' stroke='#6f955f' stroke-width='1.3'/><ellipse cx='17.6' cy='15.4' rx='2.4' ry='1.4' fill='#f7f0e4'/><ellipse cx='23.4' cy='15.4' rx='2.4' ry='1.4' fill='#f7f0e4'/><circle cx='17.2' cy='15.4' r='0.9' fill='#17120f'/><circle cx='23.8' cy='15.4' r='0.9' fill='#17120f'/></svg>`;
    }
    if (id === 'grass') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><circle cx='16' cy='16' r='12' fill='none' stroke='#c92b3e' stroke-width='3'/><circle cx='16' cy='16' r='6' fill='#3fa8f5'/></svg>`;
    }
    if (id === 'grass_gold') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><linearGradient id='bag-grass-gold' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff4c9'/><stop offset='0.5' stop-color='#dcae45'/><stop offset='1' stop-color='#70500e'/></linearGradient></defs><path d='M16 3l13 13-13 13L3 16z' fill='url(#bag-grass-gold)' stroke='#fff0c0' stroke-width='1.5'/><circle cx='16' cy='16' r='5' fill='#fff8dd'/></svg>`;
    }
    if (id === 'grass_jade') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><radialGradient id='bag-grass-jade' cx='38%' cy='34%' r='72%'><stop offset='0' stop-color='#fdfefb'/><stop offset='0.34' stop-color='#d5ecda'/><stop offset='0.68' stop-color='#63af82'/><stop offset='0.9' stop-color='#2c7350'/><stop offset='1' stop-color='#0d3a28'/></radialGradient></defs><circle cx='16' cy='16' r='13' fill='url(#bag-grass-jade)' stroke='#0b3223' stroke-width='1.4'/><path d='M7 20c3-2 5-6 9-6s5 3 9 5' fill='none' stroke='rgba(255,255,255,.5)' stroke-width='1.2'/><ellipse cx='12' cy='10' rx='4' ry='2.4' fill='rgba(255,255,255,.6)' transform='rotate(-24 12 10)'/></svg>`;
    }
    if (id === 'grass_firesteel') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><linearGradient id='bag-grass-fs' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff6a44'/><stop offset='0.45' stop-color='#e11f26'/><stop offset='1' stop-color='#87090f'/></linearGradient></defs><circle cx='16' cy='16' r='13.6' fill='none' stroke='#c91d27' stroke-width='1.5'/><path d='M16 4.5L27.4 26H4.6z' fill='url(#bag-grass-fs)' stroke='#420509' stroke-width='1.2'/><path d='M16 10.5l2.6 5.6h-5.2z' fill='#ffe6c4' stroke='#4a0508' stroke-width='0.7'/><path d='M16 16.2v6.4' stroke='#2b0407' stroke-width='1.6'/></svg>`;
    }
    if (id === 'board') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><rect x='4' y='4' width='24' height='24' rx='3' fill='#d7ebdd' stroke='#6f9c83'/><path d='M12 4v24M20 4v24M4 12h24M4 20h24' stroke='rgba(42,86,64,.45)'/></svg>`;
    }
    if (id === 'board_gold') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><rect x='4' y='4' width='24' height='24' rx='3' fill='#121418' stroke='#c9a24f'/><path d='M12 4v24M20 4v24M4 12h24M4 20h24' stroke='rgba(245,205,110,.85)'/></svg>`;
    }
    if (id === 'board_atlantis') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><defs><linearGradient id='bag-atl-board' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0b2a4d'/><stop offset='0.5' stop-color='#072038'/><stop offset='1' stop-color='#020b18'/></linearGradient></defs><rect x='4' y='4' width='24' height='24' rx='3' fill='url(#bag-atl-board)' stroke='#c9a24f'/><path d='M12 4v24M20 4v24M4 12h24M4 20h24' stroke='rgba(241,203,124,.85)'/><circle cx='16' cy='16' r='9' fill='none' stroke='rgba(233,198,124,.55)' stroke-width='1' stroke-dasharray='5 6'/><circle cx='9' cy='9' r='1' fill='#ffd77a'/><circle cx='23' cy='23' r='1' fill='#ffd77a'/></svg>`;
    }
    if (id === 'theme_black') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><rect x='3' y='3' width='26' height='26' rx='4' fill='#0c0c0f' stroke='#c9a24f'/><path d='M16 6v20M6 16h20M9.5 9.5l13 13M22.5 9.5l-13 13' stroke='rgba(230,191,110,.7)'/><circle cx='16' cy='16' r='3.4' fill='#f6e2ad'/><circle cx='16' cy='16' r='4.6' fill='none' stroke='#e6bf6e'/></svg>`;
    }
    if (id === 'theme_liuqing') {
        return `<svg viewBox='0 0 32 32' aria-hidden='true'><rect x='3' y='3' width='26' height='26' rx='4' fill='#fbfdf9' stroke='#2f6b4d'/><path d='M7 22c4-1 7-4 11-4 3 0 4 2 7 4' fill='none' stroke='rgba(79,155,109,.55)' stroke-width='1.4'/><path d='M7 10h10M7 14h6' stroke='#2f6b4d' stroke-width='1.6'/><path d='M23 8c2 2 3 5 1 8-2-2-3-4-1-8z' fill='#7fc79b'/></svg>`;
    }
    return `<svg viewBox='0 0 32 32' aria-hidden='true'><rect x='3' y='3' width='26' height='26' rx='4' fill='#0a1526' stroke='#4a9dff'/><circle cx='9' cy='9' r='2' fill='#f04056'/><path d='M9 17h14M9 22h9' stroke='#5eaaff' stroke-width='2'/></svg>`;
};

/**
 * @description: 渲染背包顶部棋币信息
 * @param {number} coin
 * @return {void}
 */
const backpack_render_coin = (coin) => {
    if (!backpack_coin) return;
    const icon = window.WalletUI ? window.WalletUI.coin_svg(34) : '';
    backpack_coin.innerHTML = `
<div class='bag-coin'>
    <span class='bag-coin-icon'>${icon}</span>
    <div class='bag-coin-main'>
        <div class='bag-coin-label'>棋币</div>
        <div class='bag-coin-value'>${Math.max(0, Math.trunc(Number(coin) || 0))}</div>
    </div>
</div>`;
};

/**
 * @description: 渲染消耗品类
 * @return {void}
 */
const backpack_render_consume = () => {
    if (!backpack_pane) return;
    const tickets = Math.max(0, Math.trunc(Number(backpack_info && backpack_info.tickets) || 0));
    const vouchers = Math.max(0, Math.trunc(Number(backpack_info && backpack_info.vouchers) || 0));
    const vouchers_500 = Math.max(0, Math.trunc(Number(backpack_info && backpack_info.vouchers_500) || 0));
    const gift_vouchers = Math.max(0, Math.trunc(Number(backpack_info && backpack_info.gift_vouchers) || 0));
    const gift_3000_vouchers = Math.max(0, Math.trunc(Number(backpack_info && backpack_info.gift3000_vouchers) || 0));
    const level = Math.max(1, Math.trunc(Number(backpack_info && backpack_info.level) || 1));
    // 3000 赠礼仅 Lv.3+ 可见；已持有的情况下始终展示，避免等级变动导致道具消失。
    const show_gift_3000 = level >= 3 || gift_3000_vouchers > 0;
    backpack_pane.innerHTML = `
<div class='bag-item'>
    <div class='bag-ticket-icon is-voucher'><span>3000</span><i>棋币</i></div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>3000棋币兑换券<span class='bag-count'>×${vouchers}</span></div>
        <div class='bag-item-desc'>消耗品：赛事冠军奖励，在背包中使用后获得 3000 棋币。</div>
    </div>
    ${vouchers > 0 ? `<sl-button size='small' variant='primary' data-bag-voucher-use>使用</sl-button>` : `<sl-button size='small' variant='primary' outline disabled>使用</sl-button>`}
</div>
<div class='bag-item'>
    <div class='bag-ticket-icon is-voucher-500'><span>500</span><i>棋币</i></div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>500棋币兑换券<span class='bag-count'>×${vouchers_500}</span></div>
        <div class='bag-item-desc'>消耗品：残局投稿审核通过奖励，在背包中使用后获得 500 棋币。</div>
    </div>
    ${vouchers_500 > 0 ? `<sl-button size='small' variant='primary' data-bag-voucher-500-use>使用</sl-button>` : `<sl-button size='small' variant='primary' outline disabled>使用</sl-button>`}
</div>
<div class='bag-item'>
    <div class='bag-ticket-icon is-gift'><span>500</span><i>赠礼</i></div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>好友赠礼：500棋币<span class='bag-count'>×${gift_vouchers}</span></div>
        <div class='bag-item-desc'>消耗品：每天限购 1 个。选择好友赠送后，对方背包获得 1 张 500 棋币兑换券。</div>
    </div>
    ${gift_vouchers > 0 ? `<sl-button size='small' variant='primary' data-bag-gift-send='gift500'>赠送好友</sl-button>` : `<sl-button size='small' variant='primary' outline disabled>赠送好友</sl-button>`}
</div>
${show_gift_3000 ? `<div class='bag-item'>
    <div class='bag-ticket-icon is-gift-3000'><span>3000</span><i>赠礼</i></div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>好友赠礼：3000棋币<span class='bag-count'>×${gift_3000_vouchers}</span></div>
        <div class='bag-item-desc'>消耗品：每周限购 1 个（周一 0 点刷新）。选择好友赠送后，对方背包获得 1 张 3000 棋币兑换券。</div>
    </div>
    ${gift_3000_vouchers > 0 ? `<sl-button size='small' variant='primary' data-bag-gift-send='gift3000'>赠送好友</sl-button>` : `<sl-button size='small' variant='primary' outline disabled>赠送好友</sl-button>`}
</div>` : ''}
<div class='bag-item'>
    <div class='bag-ticket-icon'><span>投稿</span><i>单局</i></div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>单局投稿券<span class='bag-count'>×${tickets}</span></div>
        <div class='bag-item-desc'>等级不足 2 时，可在残局投稿页凭券提交一次投稿。</div>
    </div>
    ${tickets > 0 ? '' : `<sl-button size='small' variant='primary' outline href='/pages/user/shop.html' target='_self'>去商店购买</sl-button>`}
</div>`;

    const use_button = backpack_pane.querySelector('[data-bag-voucher-use]');
    if (use_button) use_button.addEventListener('click', () => backpack_voucher_use(use_button));
    const use_500_button = backpack_pane.querySelector('[data-bag-voucher-500-use]');
    if (use_500_button) use_500_button.addEventListener('click', () => backpack_voucher_500_use(use_500_button));
    backpack_pane.querySelectorAll('[data-bag-gift-send]').forEach((button) => {
        button.addEventListener('click', () => gift_friend_open(button.dataset.bagGiftSend || 'gift500'));
    });
};

/**
 * @description: 在背包中使用一张 3000 棋币兑换券
 * @param {HTMLElement} button
 * @return {Promise<void>}
 */
const backpack_voucher_use = async (button) => {
    if (!backpack_info || !button || button.disabled) return;
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token || typeof window.http_user_voucher_use !== 'function') return;

    button.disabled = true;
    let result = null;
    try {
        result = await window.http_user_voucher_use(token);
    } catch (_) {
        result = null;
    } finally {
        button.disabled = false;
    }

    if (!result) return toast.error('使用失败，请稍后重试');
    if (!result.ok) return toast.error(result.reason === 'none' ? '没有可用的 3000 棋币兑换券' : '使用失败，请稍后重试');

    backpack_info.coin = Math.max(0, Math.trunc(Number(result.coin) || 0));
    backpack_info.vouchers = Math.max(0, Math.trunc(Number(result.vouchers) || 0));
    toast.success('已使用 1 张 3000 棋币兑换券，获得 3000 棋币');
    backpack_render_coin(backpack_info.coin);
    // 账号信息里的「我的背包」入口同步显示最新棋币
    if (block_user_wallet && window.WalletUI) window.WalletUI.render_panel(block_user_wallet, backpack_info, { backpack: true });
    await backpack_render();
};

/**
 * @description: 在背包中使用一张 500 棋币兑换券
 * @param {HTMLElement} button
 * @return {Promise<void>}
 */
const backpack_voucher_500_use = async (button) => {
    if (!backpack_info || !button || button.disabled) return;
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token || typeof window.http_user_voucher_500_use !== 'function') return;

    button.disabled = true;
    let result = null;
    try {
        result = await window.http_user_voucher_500_use(token);
    } catch (_) {
        result = null;
    } finally {
        button.disabled = false;
    }

    if (!result) return toast.error('使用失败，请稍后重试');
    if (!result.ok) return toast.error(result.reason === 'none' ? '没有可用的 500 棋币兑换券' : '使用失败，请稍后重试');

    backpack_info.coin = Math.max(0, Math.trunc(Number(result.coin) || 0));
    backpack_info.vouchers_500 = Math.max(0, Math.trunc(Number(result.vouchers_500) || 0));
    toast.success('已使用 1 张 500 棋币兑换券，获得 500 棋币');
    backpack_render_coin(backpack_info.coin);
    // 账号信息里的「我的背包」入口同步显示最新棋币
    if (block_user_wallet && window.WalletUI) window.WalletUI.render_panel(block_user_wallet, backpack_info, { backpack: true });
    await backpack_render();
};

/**
 * @description: 关闭赠送好友弹窗
 * @return {void}
 */
const gift_friend_hide = () => {
    if (!dialog_gift_friend) return;
    if (typeof dialog_gift_friend.hide === 'function') dialog_gift_friend.hide();
    else dialog_gift_friend.classList.add('d-none');
};

/**
 * @description: 赠送前二次确认（背包与聊天赠礼共用同一套确认弹窗）
 * @param {string} message
 * @return {Promise<boolean>}
 */
const gift_friend_confirm = async (message) => {
    if (typeof window.gift_confirm === 'function') return Boolean(await window.gift_confirm({ message }));
    return window.confirm(message);
};

/**
 * @description: 当前持有的某种赠礼数量
 * @param {string} kind
 * @return {number}
 */
const gift_friend_count = (kind) => Math.max(
    0,
    Math.trunc(Number(backpack_info && (kind === 'gift3000' ? backpack_info.gift3000_vouchers : backpack_info.gift_vouchers)) || 0)
);

/**
 * @description: 赠送 1 个好友赠礼给指定好友
 * @param {string} uuid
 * @param {string} name
 * @param {HTMLElement} button
 * @return {Promise<void>}
 */
const gift_friend_send = async (uuid, name, button) => {
    if (!uuid || !button || button.disabled) return;
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token || typeof window.http_user_voucher_gift_send !== 'function') return;

    const kind = gift_friend_kind;
    const detail = GIFT_KINDS[kind] || GIFT_KINDS.gift500;
    if (!(await gift_friend_confirm(`确定要把「好友赠礼：${detail.label}」送给 ${name || '该好友'} 吗？送出后无法撤回。`))) return;
    if (gift_friend_count(kind) < 1) return toast.info(`背包里没有「好友赠礼：${detail.label}」了`);

    button.disabled = true;
    let result = null;
    try {
        result = await window.http_user_voucher_gift_send(token, uuid, kind);
    } catch (_) {
        result = null;
    } finally {
        button.disabled = false;
    }

    if (!result) return toast.error('赠送失败，请稍后重试');
    if (!result.ok) {
        if (result.reason === 'none') return toast.info(`背包里没有「好友赠礼：${detail.label}」了`);
        return toast.error('赠送失败，请稍后重试');
    }

    if (backpack_info) {
        if (kind === 'gift3000') backpack_info.gift3000_vouchers = Math.max(0, Math.trunc(Number(result.gift3000_vouchers) || 0));
        else backpack_info.gift_vouchers = Math.max(0, Math.trunc(Number(result.gift_vouchers) || 0));
    }
    toast.success(`已送出好友赠礼，对方背包获得 1 张 ${detail.value} 棋币兑换券`);
    gift_friend_hide();
    await backpack_render();
};

/**
 * @description: 打开赠送好友弹窗并列出好友
 * @param {string} kind gift500（默认）或 gift3000
 * @return {Promise<void>}
 */
const gift_friend_open = async (kind = 'gift500') => {
    if (!dialog_gift_friend || !div_gift_friend_list) return;
    gift_friend_kind = kind === 'gift3000' ? 'gift3000' : 'gift500';
    const detail = GIFT_KINDS[gift_friend_kind];
    if (gift_friend_count(gift_friend_kind) < 1) return toast.info(`背包里没有「好友赠礼：${detail.label}」，去商店购买一个吧`);
    if (span_gift_friend_tip) {
        span_gift_friend_tip.textContent = `选择一位好友，赠送 1 个「好友赠礼：${detail.label}」，对方背包将获得 1 张 ${detail.value} 棋币兑换券。`;
    }

    div_gift_friend_list.innerHTML = `<div class='text-secondary small py-2'>正在加载好友…</div>`;
    dialog_gift_friend.classList.remove('d-none');
    if (typeof dialog_gift_friend.show === 'function') dialog_gift_friend.show();
    else customElements.whenDefined('sl-dialog').then(() => dialog_gift_friend.show());

    let result = null;
    try {
        result = await window.http_friend_list(window.get_token());
    } catch (_) {
        result = null;
    }
    const friends = result && Array.isArray(result.friends) ? result.friends : [];
    div_gift_friend_list.innerHTML = '';
    if (!friends.length) {
        div_gift_friend_list.innerHTML = `<div class='text-secondary small py-2'>还没有好友，先去添加好友吧</div>`;
        return;
    }

    friends.forEach((friend) => {
        const row = document.createElement('div');
        row.className = 'bag-item';
        const main = document.createElement('div');
        main.className = 'bag-item-main';
        const name = document.createElement('div');
        name.className = 'bag-item-name';
        name.textContent = friend.name || '无名氏';
        const desc = document.createElement('div');
        desc.className = 'bag-item-desc';
        desc.textContent = friend.online ? '在线' : '离线';
        main.append(name, desc);
        const button = document.createElement('sl-button');
        button.setAttribute('size', 'small');
        button.setAttribute('variant', 'primary');
        button.textContent = '赠送';
        button.addEventListener('click', () => gift_friend_send(friend.uuid, friend.name || '无名氏', button));
        row.append(main, button);
        div_gift_friend_list.append(row);
    });
};

/**
 * @description: 渲染成就类
 * @return {Promise<void>}
 */
const backpack_render_achievements = async () => {
    if (!backpack_pane) return;
    let items = [];
    try {
        // 装扮类成就以账号实际拥有的外观为准，查看成就前先按服务端列表同步一次
        if (typeof window.achievement_owned_skins_check === 'function') await window.achievement_owned_skins_check();
        items = typeof window.achievement_list === 'function' ? await window.achievement_list() : [];
    } catch (_) {
        items = [];
    }
    if (!items.length) {
        backpack_pane.innerHTML = `
<div class='bag-empty'>
    <sl-icon name='trophy'></sl-icon>
    <span>还没有获得成就，去完成对局与残局挑战吧</span>
</div>`;
        return;
    }
    backpack_pane.innerHTML = `
<div class='bag-ach-grid'>
    ${items.map((item) => `
    <div class='bag-ach'>
        <div class='bag-ach-art'>${item.art || `<sl-icon name='${item.icon || 'trophy'}'></sl-icon>`}</div>
        <div class='bag-ach-main'>
            <div class='bag-ach-name'>${item.name || item.id}</div>
            <div class='bag-ach-desc'>${item.desc || ''}</div>
        </div>
    </div>`).join('')}
</div>`;
};

/**
 * @description: 渲染外观类（已拥有的皮肤可在此开关）
 * @return {void}
 */
const backpack_render_skins = () => {
    if (!backpack_pane) return;
    const owned = Skins ? Skins.owned() : {};
    // 以实际生效状态回显：两套棋盘皮肤互斥，避免同时显示为开启
    const active = Skins ? Skins.read() : {};
    const rows = SKIN_ROWS.filter((row) => owned[row.id]);
    if (!rows.length) {
        backpack_pane.innerHTML = `
<div class='bag-empty'>
    <sl-icon name='palette'></sl-icon>
    <span>还没有外观道具，去棋币商店挑选喜欢的皮肤吧</span>
    <sl-button size='small' variant='primary' outline href='/pages/user/shop.html' target='_self'>去商店</sl-button>
</div>`;
        return;
    }
    backpack_pane.innerHTML = rows.map((row) => `
<div class='bag-item'>
    <div class='bag-item-icon'>${backpack_skin_icon(row.id)}</div>
    <div class='bag-item-main'>
        <div class='bag-item-name'>${BAG_SKIN_NAMES[row.id] || row.id}</div>
        <div class='bag-item-desc'>${row.desc}</div>
    </div>
    <sl-switch data-bag-skin='${row.id}' size='small' ${active[row.id] ? 'checked' : ''}></sl-switch>
</div>`).join('');

    backpack_pane.querySelectorAll('[data-bag-skin]').forEach((node) => {
        node.addEventListener('sl-change', () => {
            if (!Skins) return;
            const id = node.dataset.bagSkin;
            const next = Skins.prefs();
            next[id] = Boolean(node.checked);
            // 同组皮肤互斥：切换一套时关闭同组其余皮肤
            const SKIN_GROUPS = [
                ['piece', 'piece_rouge', 'piece_atlantis'],
                ['grass', 'grass_gold', 'grass_jade', 'grass_firesteel'],
                ['board', 'board_gold', 'board_atlantis'],
                ['theme', 'theme_black', 'theme_liuqing'],
            ];
            const group = SKIN_GROUPS.find((ids) => ids.includes(id));
            if (group) {
                group.forEach((other_id) => {
                    if (other_id === id) return;
                    next[other_id] = false;
                    const other_node = backpack_pane.querySelector(`[data-bag-skin='${other_id}']`);
                    if (other_node) other_node.checked = false;
                });
            }
            Skins.write_prefs(next);
            Skins.apply_theme();
            render_skin_settings();
        });
    });
};

/**
 * @description: 按当前分类渲染背包内容
 * @return {Promise<void>}
 */
const backpack_render = async () => {
    backpack_tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === backpack_tab));
    if (!backpack_pane) return;
    if (backpack_tab === 'achieve') return backpack_render_achievements();
    if (backpack_tab === 'skin') return backpack_render_skins();
    return backpack_render_consume();
};

/**
 * @description: 拉取最新账号数据并刷新背包
 * @return {Promise<void>}
 */
const backpack_refresh = async () => {
    let info = null;
    try {
        info = await window.http_user_info(window.get_token());
    } catch (_) {
        info = null;
    }
    if (!info) {
        backpack_info = null;
        if (backpack_coin) backpack_coin.innerHTML = '';
        if (backpack_pane) backpack_pane.innerHTML = `<div class='bag-empty'>数据加载失败，请稍后重试</div>`;
        return;
    }
    backpack_info = info;
    backpack_render_coin(info.coin);
    await backpack_render();
};

/**
 * @description: 打开我的背包
 * @return {Promise<void>}
 */
const backpack_open = async () => {
    if (!backpack_drawer || !require_login()) return;
    backpack_tab = 'consume';
    backpack_drawer.classList.add('open');
    await backpack_refresh();
};

/**
 * @description: 关闭我的背包
 * @return {void}
 */
const backpack_close = () => {
    if (backpack_drawer) backpack_drawer.classList.remove('open');
};

if (block_user_wallet) {
    block_user_wallet.addEventListener('click', (event) => {
        if (event.target.closest('#button_user_bag')) backpack_open();
    });
}
backpack_tabs.forEach((tab) => tab.addEventListener('click', () => {
    backpack_tab = tab.dataset.tab || 'consume';
    backpack_render();
}));
if (button_backpack_close) button_backpack_close.addEventListener('click', backpack_close);
if (backpack_backdrop) backpack_backdrop.addEventListener('click', backpack_close);
if (button_gift_friend_close) button_gift_friend_close.addEventListener('click', gift_friend_hide);


// 本地设置，对话框
const open_local_settings = () => {
    const { bgmv, stonev, plantv, matchv, tickv, annihilationv, hitv, orbitv, flyv, click_time, click_level } = JSON.parse(localStorage.getItem('opt'));

    render_skin_settings();

    select_music_mode.value = window.MusicPlaylist.get_mode();
    render_music_playlist();

    range_sound_bgm.value = Math.trunc(bgmv * 100 / 5);
    range_sound_stone.value = Math.trunc(stonev * 100 / 5);
    range_sound_plant.value = Math.trunc(plantv * 100 / 5);
    range_sound_match.value = Math.trunc(matchv * 100 / 5);
    range_sound_tick.value = Math.trunc(tickv * 100 / 5);
    range_sound_annihilation.value = Math.trunc((annihilationv ?? 0) * 100 / 5);
    range_sound_hit.value = Math.trunc((hitv ?? 0) * 100 / 5);
    range_sound_orbit.value = Math.trunc((orbitv ?? 0) * 100 / 5);
    range_sound_fly.value = Math.trunc((flyv ?? 0) * 100 / 5);

    range_click_time.value = click_time;
    range_click_level.value = click_level;


    dialog_local.classList.remove('d-none');
    dialog_local.show();

    // 换设备时本机可能还没有已购皮肤缓存，按账号最新数据刷新一次再回显
    if (window.get_token && window.get_token() && window.http_user_info) {
        window.http_user_info(window.get_token()).then((info) => {
            if (!info) return;
            sync_owned_skins(info.skins);
            render_skin_settings();
        }).catch(() => { });
    }
};

button_local.addEventListener('click', open_local_settings);

button_music_add.addEventListener('click', () => input_music_files.click());
input_music_files.addEventListener('change', async () => {
    await add_music_files(input_music_files.files);
    input_music_files.value = '';
});
select_music_mode.addEventListener('sl-change', (event) => {
    window.MusicPlaylist.set_mode(event.target.value);
});

// 修改设置
button_local_submit.addEventListener('click', () => {
    const bgmv = parseInt(range_sound_bgm.value, 10) / 100.0 * 5;
    const stonev = parseInt(range_sound_stone.value, 10) / 100.0 * 5;
    const plantv = parseInt(range_sound_plant.value, 10) / 100.0 * 5;
    const matchv = parseInt(range_sound_match.value, 10) / 100.0 * 5;
    const tickv = parseInt(range_sound_tick.value, 10) / 100.0 * 5;
    const annihilationv = parseInt(range_sound_annihilation.value, 10) / 100.0 * 5;
    const hitv = parseInt(range_sound_hit.value, 10) / 100.0 * 5;
    const orbitv = parseInt(range_sound_orbit.value, 10) / 100.0 * 5;
    const flyv = parseInt(range_sound_fly.value, 10) / 100.0 * 5;

    const click_time = range_click_time.value;
    const click_level = range_click_level.value;

    localStorage.setItem('opt', JSON.stringify({ bgmv, stonev, plantv, matchv, tickv, annihilationv, hitv, orbitv, flyv, click_time, click_level }));
    window.MusicPlaylist.set_mode(select_music_mode.value);

    // 只保存已购皮肤的开关状态，未拥有的保持原值，避免购买后皮肤默认关闭
    if (Skins) {
        const owned = Skins.owned();
        const prefs = Skins.prefs();
        SKIN_ROWS.forEach((row) => {
            if (owned[row.id] && row.switch_el) prefs[row.id] = !!row.switch_el.checked;
        });
        // 同组皮肤互斥：按优先级（数组靠前者优先）只保留当前开启的那一套
        const exclusive_groups = [
            [['piece_atlantis', switch_skin_piece_atlantis], ['piece_rouge', switch_skin_piece_rouge], ['piece', switch_skin_piece]],
            [['grass_firesteel', switch_skin_grass_firesteel], ['grass', switch_skin_grass], ['grass_gold', switch_skin_grass_gold], ['grass_jade', switch_skin_grass_jade]],
            [['board_atlantis', switch_skin_board_atlantis], ['board_gold', switch_skin_board_gold], ['board', switch_skin_board]],
            [['theme_liuqing', switch_skin_theme_liuqing], ['theme_black', switch_skin_theme_black], ['theme', switch_skin_theme]],
        ];
        exclusive_groups.forEach((group) => {
            const enabled = group.find(([id, el]) => owned[id] && el && el.checked);
            const enabled_id = enabled ? enabled[0] : null;
            group.forEach(([id]) => {
                if (owned[id]) prefs[id] = id === enabled_id;
            });
        });
        Skins.write_prefs(prefs);
        // 主题开关变化立即反映到当前页面
        Skins.apply_theme();
    }

    dialog_local.hide();
    toast.success('设置保存成功！');
});


// ===== 每日任务（主页右下角入口） =====
/**
 * @description: HTML 转义
 * @param {*} value
 * @return {string}
 */
const task_escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[char]));

/**
 * @description: 更新入口红点（显示已完成任务数）
 * @param {number} count
 * @return {void}
 */
const task_badge_update = (count) => {
    if (!badge_task_dot) return;
    const value = Math.max(0, Math.trunc(Number(count) || 0));
    if (value > 0) {
        badge_task_dot.textContent = value > 99 ? '99+' : String(value);
        badge_task_dot.classList.remove('d-none');
    } else {
        badge_task_dot.classList.add('d-none');
    }
};

/**
 * @description: 单个任务行
 * @param {Object} task
 * @return {string}
 */
const task_row_html = (task) => {
    const target = Math.max(1, Math.trunc(Number(task && task.target) || 1));
    const progress = Math.min(target, Math.max(0, Math.trunc(Number(task && task.progress) || 0)));
    const reward = Math.max(0, Math.trunc(Number(task && task.reward) || 0));
    const done = Boolean(task && task.done);
    const claimed = Boolean(task && task.claimed);
    const claimable = done && !claimed;
    // 投稿类固定任务保留，已完成任务无需重抽，这些都不显示刷新按钮
    const kind = String(task && task.kind);
    const refreshable = !done && kind !== 'puzzle' && kind !== 'story';
    const status = done ? (claimed ? '已完成，奖励已领取' : '已完成，待领取奖励') : `进度 ${progress} / ${target}`;
    const idle = `<sl-button class='task-row-refresh' size='small' variant='default' data-task-id='${task_escape(task && task.id)}'>刷新</sl-button>`;
    const action = claimable
        ? `<sl-button class='task-row-claim' size='small' variant='success' data-task-id='${task_escape(task && task.id)}'>领取奖励</sl-button>`
        : refreshable ? idle : '';
    return `<div class='task-row ${done ? 'done' : ''} ${claimable ? 'claimable' : ''}'>
    <span class='task-row-icon'><sl-icon name='${done ? 'check-circle-fill' : 'circle'}'></sl-icon></span>
    <div class='task-row-main'>
        <div class='task-row-title'>${task_escape(task && task.title)}</div>
        <div class='task-row-sub'>${status}</div>
    </div>
    <span class='task-row-reward'>+${reward} 棋币<br>+${reward} 经验</span>
    ${action}
</div>`;
};

/**
 * @description: 刷新次数与费用提示
 * @param {Object} data
 * @return {void}
 */
const task_refresh_update = (data) => {
    const free = Math.max(0, Math.trunc(Number(data && data.free_refresh) || 0));
    const cost = Math.max(0, Math.trunc(Number(data && data.refresh_cost) || 0));
    if (span_task_refresh) span_task_refresh.textContent = free > 0 ? `免费刷新剩余 ${free} 次` : `每次刷新消耗 ${cost} 棋币`;
};

/**
 * @description: 刷新指定的单个任务（进度清零，换成同组未抽到过的任务）
 * @param {string} id
 * @param {HTMLElement} button
 * @return {Promise<void>}
 */
const task_refresh_one = async (id, button) => {
    if (!id || !require_login() || typeof window.http_task_refresh !== 'function') return;
    if (button) button.disabled = true;
    try {
        const data = await window.http_task_refresh(window.get_token(), id);
        if (!data) throw Error('task refresh failed');
        if (!data.ok) {
            const reason = String(data.reason || '');
            const message = reason === 'coin' ? '棋币不足，刷新失败。'
                : reason === 'invalid' ? '该任务不可刷新（已完成或为投稿任务）。'
                : reason === 'no_candidate' ? '该组任务已全部抽到过，暂无新的可刷新任务。'
                : '刷新失败，请稍后重试。';
            toast.error(message);
            task_refresh_update(data);
            return;
        }
        const cost = Math.max(0, Math.trunc(Number(data.cost) || 0));
        toast.success(cost > 0 ? `任务已刷新，消耗 ${cost} 棋币。` : '任务已刷新（免费）。');
        task_badge_update(data.claimable_count);
        task_render(data);
    } catch (_) {
        toast.error('刷新失败，请稍后重试。');
        if (button) button.disabled = false;
    }
};

/**
 * @description: 领取指定已完成任务的奖励；全部领取后右下角红点消失
 * @param {string} id
 * @param {HTMLElement} button
 * @return {Promise<void>}
 */
const task_claim_one = async (id, button) => {
    if (!id || !require_login() || typeof window.http_task_claim !== 'function') return;
    if (button) button.disabled = true;
    try {
        const data = await window.http_task_claim(window.get_token(), id);
        if (!data) throw Error('task claim failed');
        if (!data.ok) {
            toast.error(String(data.reason || '') === 'invalid' ? '该任务当前不可领取奖励。' : '领取失败，请稍后重试。');
            task_badge_update(data.claimable_count);
            return;
        }
        const reward = Math.max(0, Math.trunc(Number(data.reward) || 0));
        toast.success(`已领取 ${reward} 棋币 · ${reward} 经验。`);
        task_badge_update(data.claimable_count);
        task_render(data);
    } catch (_) {
        toast.error('领取失败，请稍后重试。');
        if (button) button.disabled = false;
    }
};

/**
 * @description: 渲染任务列表（多人 / 单人 / 投稿 / 剧情投稿分组）
 * @param {Object} data
 * @return {void}
 */
const task_render = (data) => {
    if (!div_task_list) return;
    const tasks = (data && Array.isArray(data.tasks) ? data.tasks : []).filter(Boolean);
    if (!tasks.length) {
        div_task_list.innerHTML = `<div class='text-secondary small'>暂无任务，请稍后重试。</div>`;
        return;
    }
    const groups = [['multi', '多人任务'], ['single', '单人任务'], ['puzzle', '投稿任务'], ['story', '剧情投稿任务']];
    div_task_list.innerHTML = groups.map(([kind, label]) => {
        const list = tasks.filter((task) => task.kind === kind);
        if (!list.length) return '';
        return `<div class='task-group-title'>${label}</div>${list.map(task_row_html).join('')}`;
    }).join('');
    // 每行按钮独立绑定：刷新只换该任务，领取只结算该任务
    div_task_list.querySelectorAll('.task-row-refresh').forEach((button) => {
        button.addEventListener('click', () => task_refresh_one(button.dataset.taskId, button));
    });
    div_task_list.querySelectorAll('.task-row-claim').forEach((button) => {
        button.addEventListener('click', () => task_claim_one(button.dataset.taskId, button));
    });
    task_refresh_update(data);
};

/**
 * @description: 同步入口显隐与红点
 * @return {Promise<void>}
 */
const task_sync = async () => {
    if (!button_task_wrap) return;
    button_task_wrap.classList.toggle('d-none', !is_logged_in());
    if (!is_logged_in() || typeof window.http_task_query !== 'function') return;
    try {
        const data = await window.http_task_query(window.get_token());
        if (data) task_badge_update(data.claimable_count);
    } catch (_) {
        // 任务入口失败不影响主页其它功能
    }
};

if (button_task_toggle) {
    button_task_toggle.addEventListener('click', async () => {
        if (!require_login()) return;
        div_task_list.innerHTML = `<div class='text-secondary small'>任务加载中…</div>`;
        dialog_task.classList.remove('d-none');
        dialog_task.show();
        try {
            const data = await window.http_task_query(window.get_token());
            if (!data) throw Error('task query failed');
            task_badge_update(data.claimable_count);
            task_render(data);
        } catch (_) {
            div_task_list.innerHTML = `<div class='text-secondary small'>任务加载失败，请稍后重试。</div>`;
        }
    });
}
if (button_task_close) button_task_close.addEventListener('click', () => dialog_task.hide());

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', task_sync, { once: true });
else task_sync();


// ===== 全服消息（主页右上角喇叭入口） =====
const button_notice_wrap = document.getElementById('button_notice_wrap');
const button_notice_toggle = document.getElementById('button_notice_toggle');
const dialog_notice = document.getElementById('dialog_notice');
const button_notice_close = document.getElementById('button_notice_close');
const span_notice_title = document.getElementById('span_notice_title');
const span_notice_time = document.getElementById('span_notice_time');
const div_notice_content = document.getElementById('div_notice_content');

// 当前生效的全服消息（null 表示没有）
let notice_current = null;

/**
 * @description: 格式化消息时间
 * @param {number} value
 * @return {string}
 */
const notice_time_text = (value) => {
    const stamp = Math.trunc(Number(value) || 0);
    if (!stamp) return '';
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', { hour12: false });
};

/**
 * @description: 渲染全服消息入口与弹窗内容
 * @param {Object | null} record
 * @return {void}
 */
const notice_render = (record) => {
    const content = String(record && record.content || '').trim();
    notice_current = content ? record : null;

    if (button_notice_wrap) button_notice_wrap.classList.toggle('d-none', !notice_current);
    if (!notice_current) {
        if (dialog_notice && dialog_notice.open) dialog_notice.hide();
        return;
    }

    const title = String(notice_current.title || '').trim();
    if (span_notice_title) {
        span_notice_title.textContent = title;
        span_notice_title.classList.toggle('d-none', !title);
    }
    if (div_notice_content) div_notice_content.textContent = content;
    if (span_notice_time) span_notice_time.textContent = notice_time_text(notice_current.created_at);
};

/**
 * @description: 同步全服消息（失败时保持当前状态）
 * @return {Promise<void>}
 */
const notice_sync = async () => {
    if (typeof window.http_notice_query !== 'function') return;
    try {
        const data = await window.http_notice_query();
        if (data) notice_render(data.notice);
    } catch (_) {
        // 查询失败不影响主页其它功能
    }
};

if (button_notice_toggle) {
    button_notice_toggle.addEventListener('click', async () => {
        await notice_sync();
        if (!notice_current) return;
        dialog_notice.classList.remove('d-none');
        dialog_notice.show();
    });
}
if (button_notice_close) button_notice_close.addEventListener('click', () => dialog_notice.hide());

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', notice_sync, { once: true });
else notice_sync();
setInterval(notice_sync, 60000);


// ===== 全服消息管理（账号信息弹窗内，仅管理员可见） =====
if (button_notice_publish) {
    button_notice_publish.addEventListener('click', async () => {
        if (!require_login() || typeof window.http_notice_publish !== 'function') return;
        const content = String(textarea_notice_content.value || '').trim();
        if (!content) return toast.error('请输入消息内容。');

        const token = window.get_token();
        const title = String(input_notice_title.value || '').trim();
        button_notice_publish.disabled = true;
        try {
            const ok = await window.http_notice_publish(token, title, content);
            if (!ok) return toast.error('发布失败，请稍后重试。');
            input_notice_title.value = '';
            textarea_notice_content.value = '';
            await notice_sync();
            toast.success('全服消息已发布。');
        } catch (_) {
            toast.error('发布失败，请稍后重试。');
        } finally {
            button_notice_publish.disabled = false;
        }
    });
}

if (button_notice_clear_admin) {
    button_notice_clear_admin.addEventListener('click', async () => {
        if (!require_login() || typeof window.http_notice_clear !== 'function') return;
        const token = window.get_token();
        button_notice_clear_admin.disabled = true;
        try {
            const ok = await window.http_notice_clear(token);
            if (!ok) return toast.error('清除失败，请稍后重试。');
            await notice_sync();
            toast.success('已清除全服消息。');
        } catch (_) {
            toast.error('清除失败，请稍后重试。');
        } finally {
            button_notice_clear_admin.disabled = false;
        }
    });
}