/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 主界面
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const button_local = document.getElementById('button_local');
const button_user = document.getElementById('button_user');
const button_clear = document.getElementById('button_clear');


const dialog_init = document.getElementById('dialog_init');

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
const input_user_secret = document.getElementById('input_user_secret');
const button_user_unlock = document.getElementById('button_user_unlock');

const button_user_permission_guide = document.getElementById('button_user_permission_guide');
const block_user_color = document.getElementById('block_user_color');
const block_user_color_gradient = document.getElementById('block_user_color_gradient');
const block_user_color_rainbow = document.getElementById('block_user_color_rainbow');
const span_user_color_preview = document.getElementById('span_user_color_preview');
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


const { ShToast } = window.UiExports;
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
    if (target.closest('#dialog_init, #dialog_local, #button_music_toggle, #global_music_toggle')) return false;
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


// 本地设置，对话框
const open_local_settings = () => {
    const { bgmv, stonev, plantv, matchv, tickv, annihilationv, hitv, orbitv, flyv, click_time, click_level } = JSON.parse(localStorage.getItem('opt'));

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

    dialog_local.hide();
    toast.success('设置保存成功！');
});