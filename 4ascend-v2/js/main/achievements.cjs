/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 我的成就页面
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const achievement_grid = document.getElementById('achievement_grid');
const achievement_empty = document.getElementById('achievement_empty');
const achievement_empty_title = document.getElementById('achievement_empty_title');
const achievement_empty_tip = document.getElementById('achievement_empty_tip');
const achievement_summary = document.getElementById('achievement_summary');
const achievement_count = document.getElementById('achievement_count');
const achievement_showcase_row = document.getElementById('achievement_showcase');
const button_achievement_showcase = document.getElementById('button_achievement_showcase');

const achievement_pager = document.getElementById('achievement_pager');
const button_achievement_prev = document.getElementById('button_achievement_prev');
const button_achievement_next = document.getElementById('button_achievement_next');
const achievement_page_info = document.getElementById('achievement_page_info');

const button_achievement_all = document.getElementById('button_achievement_all');
const dialog_achievement = document.getElementById('dialog_achievement');
const dialog_achievement_all = document.getElementById('dialog_achievement_all');
const achievement_all_list = document.getElementById('achievement_all_list');

const detail_art = document.getElementById('detail_art');
const detail_name = document.getElementById('detail_name');
const detail_desc = document.getElementById('detail_desc');
const detail_progress = document.getElementById('detail_progress');
const detail_progress_fill = document.getElementById('detail_progress_fill');
const detail_progress_text = document.getElementById('detail_progress_text');
const detail_time = document.getElementById('detail_time');

// 展示柜每页 4 列 × 3 行
const ACHIEVEMENT_PAGE_SIZE = 12;

let achievement_items = [];
let achievement_page = 0;
// 顶部 3 个展示位（服务端持久化）
let achievement_showcase_ids = [];
// 详情弹窗当前成就
let achievement_detail_item = null;

/**
 * @description: 格式化获得时间
 * @param {number} ms
 * @param {boolean} [with_seconds]
 * @return {string}
 */
const achievement_format_time = (ms, with_seconds = false) => {
    const date = new Date(Number(ms) || 0);
    const pad = (value) => String(value).padStart(2, '0');
    const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return with_seconds ? `${ymd} ${hm}:${pad(date.getSeconds())}` : `${ymd} ${hm}`;
};

/**
 * @description: 成就专属美术
 * @param {Object} item
 * @return {HTMLElement}
 */
const achievement_create_art = (item, class_name) => {
    const art = document.createElement('div');
    art.className = class_name;
    if (item.art) art.innerHTML = item.art;
    else {
        const icon = document.createElement('sl-icon');
        icon.name = item.icon || 'trophy';
        art.append(icon);
    }
    return art;
};

/**
 * @description: 进度条
 * @param {{current: number, goal: number}} progress
 * @return {?HTMLElement}
 */
const achievement_create_progress = (progress) => {
    if (!progress || !progress.goal) return null;

    const wrap = document.createElement('div');
    wrap.className = 'achievement-card-progress';

    const track = document.createElement('div');
    track.className = 'achievement-card-progress-track';
    const fill = document.createElement('div');
    fill.className = 'achievement-card-progress-fill';
    fill.style.width = `${Math.min(100, (progress.current / progress.goal) * 100)}%`;
    track.append(fill);

    const text = document.createElement('div');
    text.className = 'achievement-card-progress-text';
    text.textContent = `${progress.current} / ${progress.goal}`;

    wrap.append(track, text);
    return wrap;
};

/**
 * @description: 单张成就卡片
 * @param {Object} item
 * @return {HTMLElement}
 */
const achievement_create_card = (item) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `achievement-card rarity-${item.rarity || 'bronze'}`;
    if (item.champion) card.classList.add('champion');
    card.title = item.desc || item.name;

    const art = achievement_create_art(item, 'achievement-card-art');

    const name = document.createElement('div');
    name.className = 'achievement-card-name';
    name.textContent = item.name || item.id;

    const date = document.createElement('div');
    date.className = 'achievement-card-date';
    date.textContent = achievement_format_time(item.time);

    card.append(art, name, date);

    // 赛事冠军专属角标（金色斜带），与普通金色成就区分
    if (item.champion) {
        const ribbon = document.createElement('div');
        ribbon.className = 'achievement-champion-ribbon';
        ribbon.textContent = '冠军';
        card.append(ribbon);
    }

    const progress = achievement_create_progress(item.progress);
    if (progress) card.append(progress);

    card.addEventListener('click', () => achievement_open_detail(item));
    return card;
};

/**
 * @description: 渲染顶部 3 个展示位
 * @return {void}
 */
const achievement_render_showcase = () => {
    achievement_showcase_row.innerHTML = '';
    for (let index = 0; index < 3; index++) {
        const id = achievement_showcase_ids[index];
        const def = id ? window.achievement_find(id) : null;
        const slot = document.createElement('div');

        if (!def) {
            slot.className = 'achievement-showcase-item';
            const tip = document.createElement('div');
            tip.className = 'achievement-showcase-empty';
            tip.textContent = '空展示位，在成就详情中添加';
            slot.append(tip);
            achievement_showcase_row.append(slot);
            continue;
        }

        slot.className = 'achievement-showcase-item filled';
        slot.title = def.desc || def.name;
        slot.append(achievement_create_art(def, 'achievement-showcase-art'));

        const name = document.createElement('div');
        name.className = 'achievement-showcase-name';
        name.textContent = def.name || def.id;
        slot.append(name);

        slot.addEventListener('click', () => {
            const item = achievement_items.find((entry) => entry.id === def.id);
            if (item) achievement_open_detail(item);
        });
        achievement_showcase_row.append(slot);
    }
};

/**
 * @description: 更新详情弹窗里「设为展示 / 取消展示」按钮状态
 * @return {void}
 */
const achievement_render_showcase_button = () => {
    if (!achievement_detail_item) return;
    const shown = achievement_showcase_ids.includes(achievement_detail_item.id);
    const full = achievement_showcase_ids.length >= 3;
    button_achievement_showcase.textContent = shown ? '取消展示' : '设为展示';
    button_achievement_showcase.disabled = !shown && full;
    button_achievement_showcase.title = (!shown && full) ? '展示位已满，请先取消一个' : '';
};

/**
 * @description: 打开成就详情
 * @param {Object} item
 * @return {void}
 */
const achievement_open_detail = (item) => {
    achievement_detail_item = item;
    achievement_render_showcase_button();
    detail_art.className = `achievement-detail-art rarity-${item.rarity || 'bronze'}`;
    detail_art.innerHTML = item.art || '';
    if (!item.art) {
        const icon = document.createElement('sl-icon');
        icon.name = item.icon || 'trophy';
        detail_art.append(icon);
    }
    detail_name.textContent = item.name || item.id;
    detail_desc.textContent = item.desc || '成就描述暂未补充。';
    detail_time.textContent = achievement_format_time(item.time, true);

    const progress = item.progress;
    detail_progress.classList.toggle('d-none', !progress || !progress.goal);
    if (progress && progress.goal) {
        detail_progress_fill.style.width = `${Math.min(100, (progress.current / progress.goal) * 100)}%`;
        detail_progress_text.textContent = `进度：${progress.current} / ${progress.goal}`;
    }

    dialog_achievement.show();
};

/**
 * @description: 渲染当前页
 * @return {void}
 */
const achievement_render = () => {
    const total = achievement_items.length;
    const pages = Math.max(1, Math.ceil(total / ACHIEVEMENT_PAGE_SIZE));
    achievement_page = Math.min(Math.max(0, achievement_page), pages - 1);

    const start = achievement_page * ACHIEVEMENT_PAGE_SIZE;
    const page_items = achievement_items.slice(start, start + ACHIEVEMENT_PAGE_SIZE);

    achievement_grid.innerHTML = '';
    page_items.forEach((item) => achievement_grid.append(achievement_create_card(item)));

    achievement_grid.classList.toggle('d-none', total === 0);
    achievement_empty.classList.toggle('d-none', total > 0);

    achievement_count.textContent = `${total} 个成就`;
    achievement_summary.textContent = total > 0 ? `已完成 ${total} 项成就收集` : '成就展示柜';

    achievement_pager.classList.toggle('d-none', pages <= 1);
    achievement_page_info.textContent = `第 ${achievement_page + 1} / ${pages} 页`;
    button_achievement_prev.disabled = achievement_page <= 0;
    button_achievement_next.disabled = achievement_page >= pages - 1;
};

/**
 * @description: 渲染「所有成就」弹窗
 * @return {Promise<void>}
 */
const achievement_render_all = async () => {
    // 隐藏成就（hidden）不进入「所有成就」列表，仅获得后出现在我的成就里
    const catalog = window.achievement_catalog().filter((def) => !def.hidden);
    const records = await window.achievement_records();
    const stats = await window.achievement_stats();

    achievement_all_list.innerHTML = '';
    if (!catalog.length) {
        const empty = document.createElement('div');
        empty.className = 'text-secondary small text-center py-3';
        empty.textContent = '成就暂未开放，敬请期待。';
        achievement_all_list.append(empty);
        return;
    }

    catalog.forEach((def) => {
        const unlocked_time = records[def.id];
        const unlocked = typeof unlocked_time === 'number' && unlocked_time > 0;

        const row = document.createElement('div');
        row.className = `achievement-all-row rarity-${def.rarity || 'bronze'} ${unlocked ? 'unlocked' : 'locked'}`;

        const art = achievement_create_art(def, 'achievement-all-art');

        const info = document.createElement('div');
        info.className = 'achievement-all-info';
        const name = document.createElement('div');
        name.className = 'achievement-all-name';
        name.textContent = def.name || def.id;
        const desc = document.createElement('div');
        desc.className = 'achievement-all-desc';
        desc.textContent = def.desc || '暂无成就描述';
        info.append(name, desc);

        const time = document.createElement('div');
        time.className = 'achievement-all-time';
        if (unlocked) time.textContent = achievement_format_time(unlocked_time);
        else time.textContent = '未获得';

        // 所有带进度的成就都展示进度（已解锁后仍继续展示实际次数，不封顶）
        if (def.goal && def.stat) {
            const progress = achievement_create_progress({
                'current': Number(stats[def.stat]) || 0,
                'goal': def.goal,
            });
            if (progress) info.append(progress);
        }

        row.append(art, info, time);
        achievement_all_list.append(row);
    });
};

// 翻页
button_achievement_prev.addEventListener('click', () => {
    achievement_page -= 1;
    achievement_render();
});

button_achievement_next.addEventListener('click', () => {
    achievement_page += 1;
    achievement_render();
});

// 所有成就
button_achievement_all.addEventListener('click', async () => {
    await achievement_render_all();
    dialog_achievement_all.show();
});

// 设为展示 / 取消展示
button_achievement_showcase.addEventListener('click', async () => {
    if (!achievement_detail_item) return;
    const list = achievement_showcase_ids.slice();
    const index = list.indexOf(achievement_detail_item.id);
    if (index >= 0) list.splice(index, 1);
    else if (list.length < 3) list.push(achievement_detail_item.id);
    else return;

    const saved = await window.achievement_showcase_set(list);
    if (!saved) return;

    achievement_showcase_ids = list;
    achievement_render_showcase();
    achievement_render_showcase_button();
});

// 初始化
(async () => {
    try {
        const logged_in = window.achievement_is_logged_in();
        // 装扮类成就以账号实际拥有的外观为准，打开成就页时先按服务端列表同步一次
        if (logged_in && typeof window.achievement_owned_skins_check === 'function') {
            await window.achievement_owned_skins_check();
        }
        // 补齐历史赛事冠军奖杯（只补该账号名下的冠军）
        if (logged_in && typeof window.achievement_champion_history_sync === 'function') {
            await window.achievement_champion_history_sync();
        }
        achievement_items = await window.achievement_list();
        achievement_showcase_ids = await window.achievement_showcase();
        achievement_render_showcase();

        // 未登录且本地没有成就记录时提示登录；登录后成就按账号隔离展示
        if (!logged_in && !achievement_items.length) {
            achievement_empty_title.textContent = '登录后查看你的成就';
            achievement_empty_tip.textContent = '成就与本账户绑定，登录后即可查看。';
            achievement_summary.textContent = '未登录';
            achievement_count.textContent = '0 个成就';
            return;
        }

        achievement_render();
    } catch (error) {
        console.error(error);
        achievement_empty_title.textContent = '成就加载失败';
        achievement_empty_tip.textContent = '请稍后刷新页面重试。';
    }
})();
