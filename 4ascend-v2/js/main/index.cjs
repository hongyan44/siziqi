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
const span_user_mail = document.getElementById('span_user_mail');
const span_user_level = document.getElementById('span_user_level');
const span_user_role = document.getElementById('span_user_role');
const input_user_secret = document.getElementById('input_user_secret');
const button_user_unlock = document.getElementById('button_user_unlock');

const input_user_pass_code = document.getElementById('input_user_pass_code');
const button_user_pass_sms = document.getElementById('button_user_pass_sms');
const input_user_pass = document.getElementById('input_user_pass');
const input_user_pass2 = document.getElementById('input_user_pass2');
const button_user_pass_submit = document.getElementById('button_user_pass_submit');

// 当前账号绑定的邮箱或手机号，用于发送设置密码的验证码
let user_ident = '';

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




const { is_phone, check_login_ident, check_mail_phone, check_account, check_password, check_password_repeat, check_code } = window.AuthExports;

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
        const status = await window.http_user_sms(ident);
        if (!status) return toast.error('验证码发送失败！');
        // 手机号暂未接入短信服务商，后端使用固定占位验证码，此处同步提示。
        if (is_phone(ident)) toast.success(`验证码发送成功！测试阶段手机验证码固定为 ${window.AuthExports.PHONE_DEV_CODE}`);
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
 * @return {Promise<void>}
 */
const register_submit = async (ident, code, account, pass) => {
    try {
        const status = await window.http_user_register(ident, code, account, pass);
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
    if (span_user_role) span_user_role.innerText = safe_level === 4 ? '残局投稿：可管理昵称、提交并管理残局' : '残局投稿：可管理昵称并提交残局';
};

const user_info = async (token) => {
    try {
        const info = await window.http_user_info(token);
        if (!info) return toast.error('获取账号信息失败！');
        const { name, mail, phone, account, level } = info;
        input_user_name.value = name;
        span_user_mail.innerText = mail || phone || account || '';
        user_ident = mail || phone || '';
        render_user_level(level);

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
        toast.success('密码设置成功，可使用新密码登录！');

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
    const pass = input_reg_pass.value;
    const pass2 = input_reg_pass2.value;

    const message = check_mail_phone(ident) || check_code(code) || check_account(account) || check_password(pass) || check_password_repeat(pass, pass2);
    if (message) return toast.error(message);

    window.sleep_task(
        [button_reg_sms, input_reg_ident, input_reg_code, input_reg_account, input_reg_pass, input_reg_pass2],
        button_init_submit,
        async () => register_submit(ident, code, account, pass),
    );
});

// 关闭后清空表单并复位到登录面板
dialog_init.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_init) return;

    switch_init_tab('login');
    [input_login_ident, input_login_pass, input_login_code, input_reg_ident, input_reg_code, input_reg_account, input_reg_pass, input_reg_pass2]
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
        async () => user_update(window.get_token(), name, '')
    );
});

// 清理
dialog_user.addEventListener('sl-after-hide', (event) => {
    if (event.target !== dialog_user) return;

    input_user_name.value = '加载中...';
    span_user_mail.innerText = '加载中...';
    render_user_level(1);
    if (span_user_role) span_user_role.innerText = '残局投稿：登录后可提交';
    input_user_secret.value = '';
    [input_user_pass_code, input_user_pass, input_user_pass2].forEach((element) => { element.value = ''; });
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