/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 通用判断与调整
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const msgpack_lite = require('msgpack-lite');

const risk_encrypt = window.RiskExports.Api.encrypt;
const risk_decrypt = window.RiskExports.Api.decrypt;


/**
 * @description: 等待函数
 * @param {number} ms
 * @return {Promise<void>}
 */
window.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description: UI任务
 * @param {HTMLButtonElement[]} buttons
 * @param {HTMLButtonElement} loading
 * @param {() => Promise<void>} task
 * @return {Promise<void>}
 */
window.sleep_task = async (buttons, loading, task) => {
    buttons.forEach((button) => {
        button.disabled = true;
        button.classList.add('pe-none');
    });
    if (loading) {
        loading.loading = true;
        loading.disabled = true;
        loading.classList.add('pe-none');
    }

    await window.sleep(388);

    try {
        await task();

    } catch (error) {
        console.error(error);

    } finally {
        if (loading) {
            loading.loading = false;
            loading.disabled = false;
            loading.classList.remove('pe-none');
        }
        buttons.forEach((button) => {
            button.disabled = false;
            button.classList.remove('pe-none');
        });
    }
};

/**
 * @description: 页面请求
 * @param {string} url
 * @param {Object} params
 * @param {number} [timeout] 超时毫秒数，默认 5000（大图上传等场景可放宽）
 * @return {Promise<Object>}
 */
window.fetch_task = async (url, params, timeout = 5000) => {
    const controller = new AbortController();
    const signal = controller.signal;
    const timer = setTimeout(() => controller.abort(), timeout); // 毫秒

    try {
        params = Array.from(msgpack_lite.encode(params));
        const response = await fetch(url, {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/octet-stream'
            },
            'body': new Uint8Array(risk_encrypt(params)),
            'signal': signal
        });

        const body = Array.from(new Uint8Array(await response.arrayBuffer()));
        // console.log(msgpack_lite.decode(risk_decrypt(body)));
        return msgpack_lite.decode(risk_decrypt(body));

    } catch (error) {
        console.error(error);

    } finally {
        clearTimeout(timer);
    }
};


/**
 * @description: 计算尺寸
 * @param {HTMLElement} main
 * @param {HTMLElement[]} elements
 * @return {number}
 */
window.math_size = (main, elements) => {
    const rect = main.getBoundingClientRect();
    let main_w = rect.width;
    let main_h = rect.height;

    const gap = parseFloat(window.getComputedStyle(main).rowGap) || 0;
    const gap_h = (Math.max(0, elements.length - 1) + 1) * gap; // 多元素

    const elements_h = elements.map((value) => value ? value.getBoundingClientRect().height : 0);

    elements_h.forEach((value) => main_h -= value);
    main_h -= gap_h;

    main_w -= 2;

    //取最小值
    return Math.min(main_w, main_h);
};

/**
 * @description: 切换主界面动画
 * @param {HTMLElement} show
 * @param {HTMLElement} hide
 * @return {void}
 */
window.switch_wection = (show, hide) => {
    show.classList.replace('main-hide', 'main-show');
    hide.classList.replace('main-show', 'main-hide');
};


/**
 * @description: 检测名字占用长度
 * @param {string} name
 * @return {number}
 */
window.name_length = (name) => {
    let length = 0;
    for (let index = 0; index < name.length; index++) {
        const a = name.charAt(index);
        if (a.match(/[^\x00-\xff]/ig) != null) length += 2 // 中文占2单位
        else length += 1; // 半角占1个单位
    }
    return length;
};


/**
 * @description: UUID
 * @return {string}
 */
window.uuidv4 = () => {
    // 1. 生成 16 字节（128位）的随机数据
    const uuid = crypto.getRandomValues(new Uint8Array(16));

    // 2. 设置版本号 (Version 4: 0100 -> 0x40)
    // 位于第 7 字节
    uuid[6] = (uuid[6] & 0x0f) | 0x40;

    // 3. 设置变体号 (Variant 10xx -> 0x80)
    // 位于第 9 字节
    uuid[8] = (uuid[8] & 0x3f) | 0x80;

    // 4. 转换为十六进制字符串并格式化
    const hex = Array.from(uuid).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * @description: 转换毫秒数值为时间
 * @param {number} ms
 * @return {string}
 */
window.format_ms = (ms) => {
    const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const SSS = (ms % 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s}`;
};


/**
 * @description: HEX
 * @param {Uint8Array} bytes
 * @return {string}
 */
window.hex_encode = (bytes) => {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * @description: HEX
 * @param {string} input
 * @return {string}
 */
window.hex_decode = (input) => {
    const clean = input.replace(/\s+/g, '');
    if (clean.length % 2 !== 0) return [];

    const result = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2)result[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    return result;
};


/**
 * @description: 设置凭证
 * @param {Uint8Array} token
 * @return {void}
 */
window.set_token = (token) => {
    localStorage.setItem('token', window.hex_encode(token));
};

/**
 * @description: 得到凭证
 * @return {Uint8Array | null}
 */
window.get_token = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return window.hex_decode(token);
};


// 拼写检查、自动纠正、自动建议、自动大写
// 全部关闭，全部取消
(() => {
    document.querySelectorAll('sl-input, sl-textarea, input, textarea').forEach((element) => {
        element.setAttribute('spellcheck', 'false');
        element.setAttribute('autocomplete', 'off');
        element.setAttribute('autocapitalize', 'off');
        element.setAttribute('autocorrect', 'off');
    });
})();

// 禁止右键
(() => {
    // window.addEventListener('contextmenu', (event) => event.preventDefault());
})();

// 移动端还是桌面端
(() => {
    // 只要设备支持粗略指针（手指），就认为是移动类设备
    const has_coarse_capability = window.matchMedia('(any-pointer: coarse)').matches;
    // 排除掉纯鼠标操作的设备
    const can_touch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    // 最终判断
    window.isphone = has_coarse_capability && can_touch;
})();

// 分配本地标识
(() => {
    // const uuid = localStorage.getItem('uuid');
    // if (uuid) return;

    // localStorage.setItem('uuid', `${Date.now()}-${window.uuidv4()}`);
})();

// 初始化本地设置
(() => {
    if (!localStorage.getItem('opt')) localStorage.setItem('opt', '{}');

    const opt = JSON.parse(localStorage.getItem('opt'));

    if (
        typeof opt.bgmv === 'number'
        &&
        typeof opt.stonev === 'number'
        &&
        typeof opt.plantv === 'number'
        &&
        typeof opt.matchv === 'number'
        &&
        typeof opt.tickv === 'number'
        &&
        typeof opt.annihilationv === 'number'
        &&
        typeof opt.hitv === 'number'
        &&
        typeof opt.orbitv === 'number'
        &&
        typeof opt.flyv === 'number'
        &&
        typeof opt.click_time === 'number'
        &&
        typeof opt.click_level === 'number'
    ) return;

    const bgmv = opt.bgmv || 1.00;
    const stonev = opt.stonev || 5.00;
    const plantv = opt.plantv || 5.00;
    const matchv = opt.matchv || 5.00;
    const tickv = opt.tickv || 5.00;
    const annihilationv = opt.annihilationv ?? 0;
    const hitv = opt.hitv ?? 0;
    const orbitv = opt.orbitv ?? 0;
    const flyv = opt.flyv ?? 0;

    const click_time = opt.click_time || 0;
    const click_level = opt.click_level || 1;

    localStorage.setItem('opt', JSON.stringify({ bgmv, stonev, plantv, matchv, tickv, annihilationv, hitv, orbitv, flyv, click_time, click_level }));
    if (!localStorage.getItem('music_mode')) localStorage.setItem('music_mode', 'order');
    if (!localStorage.getItem('music_playlist')) localStorage.setItem('music_playlist', '[]');
})();

// 本地界面数据储存
(() => {
    if (!localStorage.getItem('data')) localStorage.setItem('data', '{}');

    const data = JSON.parse(localStorage.getItem('data'));

    if (
        typeof data.server === 'string'
    ) return;

    const server = data.server || 'online.siziqi.net';

    localStorage.setItem('data', JSON.stringify({ server }));
})();