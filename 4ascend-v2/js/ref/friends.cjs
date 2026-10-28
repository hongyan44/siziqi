/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友系统（全站心跳 + 75% 宽弹窗 + 内嵌聊天/资料 + 好友申请页）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const FriendList = require('./friend-list.cjs');

(() => {
    if (typeof window === 'undefined') return;

    // 长轮询：服务端单次最多挂起约 3s，前端 5s 请求超时内必定返回。
    // 兜底重试间隔：长轮询失败（网络抖动 / 旧服务端无该接口）时退回心跳短轮询。
    const WAIT_RETRY_MS = 2000;
    const FRIEND_PAGE = '/pages/online/friend.html';

    let toast = null;
    const notify = (variant, message) => {
        try {
            if (!toast && window.UiExports && window.UiExports.ShToast) toast = new window.UiExports.ShToast();
            if (!toast) return;
            if (variant === 'error') toast.error(message);
            else if (variant === 'info') toast.info(message);
            else toast.success(message);
        } catch (_) {
            // 提示组件不可用时静默，避免影响主流程
        }
    };

    const logged_in = () => Boolean(window.get_token && window.get_token());
    const token = () => window.get_token();
    const byId = (id) => document.getElementById(id);

    // ---------- DOM 工具 ----------
    const h = (tag, attrs, children) => {
        const node = document.createElement(tag);
        if (attrs) {
            for (const key of Object.keys(attrs)) {
                const value = attrs[key];
                if (value === undefined || value === null) continue;
                if (key === 'class') node.className = value;
                else if (key === 'text') node.textContent = value;
                else node.setAttribute(key, value);
            }
        }
        (children || []).forEach((child) => { if (child) node.append(child); });
        return node;
    };

    const avatar = (user, size) => {
        const node = h('sl-avatar', { style: `--size:${size || '2.2rem'};` });
        if (user && user.avatar) node.setAttribute('image', user.avatar);
        else node.setAttribute('initials', FriendList.display_name(user && user.name).slice(0, 1).toUpperCase());
        return node;
    };

    // 管理员标识徽章（权限等级 4 才渲染）
    const admin_badge = () => h('sl-badge', { variant: 'warning', pill: '', text: '管理员' });

    // ---------- 玩家昵称 ----------
    // 好友列表、活跃玩家、搜索结果与排行榜共用：昵称可点击，按 uuid 打开玩家资料。
    const name_node = (user, extra_class) => {
        const node = h('span', {
            class: `player-name fw-semibold text-truncate ${extra_class || ''}`.trim(),
            title: '查看玩家资料'
        });
        node.textContent = FriendList.display_name(user && user.name);
        node.addEventListener('click', (event) => {
            event.stopPropagation();
            if (user && user.uuid) open_profile(user.uuid);
        });
        return node;
    };

    const drawer = () => byId('friend_drawer');
    const drawer_open = () => { const node = drawer(); return Boolean(node && node.classList.contains('open')); };

    const state = {
        invite_key: null,
        running: false,
        version: 0,
        requests: 0,
        messages: 0,
        chat: null,
        request_mode: 'manual',
        profile_uuid: null
    };

    // ---------- 心跳 ----------
    const badge = () => byId('badge_friend_dot');
    const update_badge = (count) => {
        const node = badge();
        if (!node) return;
        const value = Number(count) || 0;
        if (value > 0) {
            node.textContent = value > 99 ? '99+' : String(value);
            node.classList.remove('d-none');
        } else {
            node.classList.add('d-none');
        }
    };

    // 申请按钮上的独立红点：只统计待处理申请
    const update_request_badge = (count) => {
        const node = byId('badge_friend_requests');
        if (!node) return;
        const value = Number(count) || 0;
        if (value > 0) {
            node.textContent = value > 99 ? '99+' : String(value);
            node.classList.remove('d-none');
        } else {
            node.classList.add('d-none');
        }
    };

    // 红点 = 待处理好友申请 + 未读私信（收到消息即在主页标红）
    const refresh_badge = () => {
        update_badge(state.requests + state.messages);
        update_request_badge(state.requests);
    };

    // 应用一次服务端返回的即时状态（红点 + 邀请弹窗 + 弹窗/会话刷新）
    const apply_state = (result) => {
        if (!result) return;
        const previous_version = state.version;
        const previous_messages = state.messages;
        const previous_requests = state.requests;
        if (result.version !== undefined && result.version !== null) state.version = Number(result.version) || 0;
        state.requests = Number(result.requests) || 0;
        state.messages = Number(result.messages) || 0;
        refresh_badge();
        if (result.invite && result.invite.from) handle_invite(result.invite);
        if (drawer_open() && (state.version !== previous_version || state.requests !== previous_requests)) refresh_list();
        // 好友系统有变更或未读数变化时，若会话窗口开着就刷新聊天记录
        if (state.chat && (state.version !== previous_version || state.messages !== previous_messages)) refresh_chat();
    };

    // 兜底短轮询：长轮询不可用或失败时退回普通心跳
    const heartbeat = async () => {
        if (!logged_in() || !window.http_friend_heartbeat) return;
        apply_state(await window.http_friend_heartbeat(token()));
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // 长轮询循环：服务端有变更立即返回；无变更则挂起至多约 3 秒。
    // 失败（网络抖动 / 旧服务端无该接口）时退回心跳短轮询，保证兜底不中断。
    const watch = async () => {
        while (state.running && logged_in()) {
            if (window.http_friend_wait) {
                const result = await window.http_friend_wait(token(), state.version);
                if (result) {
                    apply_state(result);
                    continue;
                }
            }
            await delay(WAIT_RETRY_MS);
            if (!state.running) break;
            await heartbeat();
        }
    };

    // ---------- 对战邀请 ----------
    const handle_invite = (invite) => {
        const key = `${invite.from}:${invite.created_at || 0}`;
        if (state.invite_key === key) return; // 同一邀请只提示一次
        state.invite_key = key;
        show_invite_dialog(invite);
    };

    const show_invite_dialog = async (invite) => {
        try {
            if (!customElements.get('sl-dialog')) await customElements.whenDefined('sl-dialog');
        } catch (_) {
            return;
        }

        const dialog = h('sl-dialog', { label: '对战邀请' });
        const body = h('div', { class: 'd-flex flex-column gap-3' }, [
            h('div', { class: 'd-flex align-items-center gap-2' }, [
                avatar(invite, '2.2rem'),
                h('span', { class: 'fw-bold', text: FriendList.display_name(invite.name) })
            ]),
            h('div', { text: '邀请你进行一场在线对局，是否接受？' })
        ]);
        const footer = h('div', { slot: 'footer', class: 'gap-2' }, [
            h('sl-button', { variant: 'neutral', text: '忽略' }),
            h('sl-button', { variant: 'primary', text: '接受对战' })
        ]);
        dialog.append(body, footer);
        document.body.append(dialog);

        const [ignore, accept] = Array.from(footer.children);
        ignore.addEventListener('click', async () => {
            dialog.hide();
            await window.http_friend_invite_clear(token(), invite.from);
        });
        accept.addEventListener('click', async () => {
            dialog.hide();
            await window.http_friend_invite_clear(token(), invite.from);
            join_room(invite.room);
        });
        dialog.addEventListener('sl-after-hide', () => dialog.remove());

        dialog.show();
    };

    const join_room = (room) => {
        const code = String(room || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
        if (code.length !== 6) return notify('error', '房间号无效');
        window.location.href = `${FRIEND_PAGE}?room=${code}`;
    };

    // ---------- 详情区（聊天 / 资料） ----------
    const show_detail = (mode) => {
        const empty = byId('friend_detail_empty');
        const chat = byId('friend_chat_view');
        const profile = byId('friend_profile_view');
        if (empty) empty.classList.toggle('d-none', mode !== 'empty');
        if (chat) chat.classList.toggle('d-none', mode !== 'chat');
        if (profile) profile.classList.toggle('d-none', mode !== 'profile');
    };

    // ---------- 玩家资料 ----------
    const profile_ensure_style = () => {
        if (document.getElementById('style_player_profile')) return;
        const style = document.createElement('style');
        style.id = 'style_player_profile';
        style.textContent = `
.player-name{cursor:pointer;transition:color .15s ease}
.player-name:hover,.player-name:focus-visible{color:var(--sl-color-primary-600);text-decoration:underline}
.player-profile-head{display:flex;align-items:center;gap:.85rem}
.player-profile-name{font-size:1.15rem;font-weight:700;min-width:0;word-break:break-word}
.player-profile-level{font-size:.72rem;color:var(--sl-color-neutral-500)}
.player-profile-rows{display:flex;flex-direction:column;gap:.35rem}
.player-profile-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.45rem .6rem;border:1px solid var(--sl-color-neutral-200);border-radius:.6rem;background:var(--sl-color-neutral-50)}
.player-profile-row .label{font-size:.8rem;color:var(--sl-color-neutral-600)}
.player-profile-row .value{font-size:.85rem;font-weight:600;color:var(--sl-color-neutral-800);text-align:right}
.player-profile-showcase{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}
.player-profile-ach{display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.45rem .3rem;border:1px solid var(--sl-color-neutral-200);border-radius:.6rem;background:#fff;text-align:center}
.player-profile-ach-art{width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center}
.player-profile-ach-art svg{width:100%;height:100%;display:block}
.player-profile-ach-name{font-size:.72rem;font-weight:600;color:var(--sl-color-neutral-700);word-break:break-word}
.player-profile-ach.empty{opacity:.55;font-size:.72rem;color:var(--sl-color-neutral-500);justify-content:center;min-height:4.4rem}
`;
        document.head.appendChild(style);
    };

    const profile_row = (label, value) => h('div', { class: 'player-profile-row' }, [
        h('span', { class: 'label', text: label }),
        h('span', { class: 'value', text: value })
    ]);

    const profile_ach_card = (id) => {
        const def = typeof window.achievement_find === 'function' ? window.achievement_find(id) : null;
        if (!def) {
            const missing = h('div', { class: 'player-profile-ach empty', text: '未设置' });
            return missing;
        }
        const art = h('div', { class: 'player-profile-ach-art' });
        if (def.art) art.innerHTML = def.art;
        else art.append(h('sl-icon', { name: def.icon || 'trophy' }));
        return h('div', { class: 'player-profile-ach', title: def.desc || '' }, [
            art,
            h('div', { class: 'player-profile-ach-name', text: def.name || id })
        ]);
    };

    // 资料卡操作按钮：接受申请 / 添加好友；对方不允许申请时禁用
    const profile_action = (data) => {
        if (!data) return null;

        let label = null;
        let disabled = false;
        if (data.relation === 'incoming') {
            label = '接受申请';
        } else if (data.relation === 'outgoing') {
            label = '已发送';
            disabled = true;
        } else if (data.relation === 'none') {
            if (data.request_mode === 'deny') {
                label = '对方不接受申请';
                disabled = true;
            } else {
                label = '添加好友';
            }
        }
        if (!label) return null;

        const button = h('sl-button', { variant: 'primary', text: label });
        if (disabled) button.setAttribute('disabled', '');
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                if (data.relation === 'incoming') {
                    const ok = await window.http_friend_accept(token(), data.uuid);
                    if (!ok) return notify('error', '接受失败');
                    notify('success', '已添加好友');
                } else {
                    const outcome = await window.http_friend_request(token(), data.friend_id);
                    if (!outcome) return notify('error', '发送申请失败');
                    if (outcome.relation === 'denied') return notify('info', '对方不接受好友申请');
                    notify('success', outcome.relation === 'friend' ? '你们已成为好友' : '好友申请已发送');
                }
                button.textContent = '已处理';
                refresh_list();
            } finally {
                button.disabled = true;
            }
        });
        return button;
    };

    const profile_render = (body, actions, data) => {
        const name = h('span', { class: 'player-profile-name', text: FriendList.display_name(data.name) });
        window.name_color_apply(name, data.name_color || '');

        const name_line = h('div', { class: 'd-flex align-items-center gap-2' }, [name]);
        if (FriendList.is_admin(data)) name_line.append(admin_badge());

        const head = h('div', { class: 'player-profile-head' }, [
            avatar(data, '4rem'),
            h('div', { class: 'd-flex flex-column gap-1 min-w-0' }, [
                name_line,
                h('div', { class: 'player-profile-level', text: `经验等级 Lv.${Math.max(1, Math.trunc(Number(data.exp_level) || 1))}` })
            ])
        ]);

        // 经济系统：公开资料只展示经验等级与棋币余额；经验进度仅本人可在账号信息中查看
        const wallet = h('div', { class: 'player-profile-wallet' });
        if (window.WalletUI) window.WalletUI.render_panel(wallet, data, { detail: false });

        const games = Number(data.real_games) || 0;
        const wins = Number(data.real_wins) || 0;
        const rate = FriendList.format_win_rate(games, wins);
        const rows = h('div', { class: 'player-profile-rows' }, [
            profile_row('最近登录', FriendList.format_presence(data, Date.now())),
            profile_row('账号对局', `${games} 场`),
            profile_row('AI 对局', `${Number(data.ai_games) || 0} 场`),
            profile_row('近100场胜率', games > 0 ? `${rate}（${wins}/${games}）` : rate)
        ]);

        const ids = Array.isArray(data.achievements) ? data.achievements.slice(0, 3) : [];
        const showcase = h('div', { class: 'player-profile-showcase' });
        for (let index = 0; index < 3; index++) showcase.append(profile_ach_card(ids[index]));

        body.append(
            head,
            wallet,
            rows,
            h('div', { class: 'text-secondary small', text: '展示的成就' }),
            showcase
        );

        const action = profile_action(data);
        if (action) actions.append(action);
    };

    // 弹窗内联资料：右侧详情区展示，返回按钮回到聊天或空态
    const open_profile = async (uuid) => {
        if (!uuid) return;

        if (!drawer()) return open_profile_dialog(uuid);

        profile_ensure_style();
        const body = byId('div_friend_profile_body');
        const actions = byId('div_friend_profile_actions');
        if (!body || !actions) return;

        state.profile_uuid = uuid;
        body.replaceChildren(h('div', { class: 'text-secondary small', text: '加载中...' }));
        actions.replaceChildren();
        show_detail('profile');

        const data = await window.http_user_profile(uuid, logged_in() ? token() : null);
        if (state.profile_uuid !== uuid) return;
        body.replaceChildren();
        if (!data) {
            body.append(h('div', { class: 'text-secondary small', text: '无法加载该玩家资料' }));
            return;
        }
        profile_render(body, actions, data);
    };

    // 无好友弹窗的页面（排行榜等）沿用独立资料弹窗
    let profile_dialog = null;

    const open_profile_dialog = async (uuid) => {
        try {
            if (!customElements.get('sl-dialog')) await customElements.whenDefined('sl-dialog');
        } catch (_) {
            return;
        }

        profile_ensure_style();
        if (profile_dialog) {
            profile_dialog.remove();
            profile_dialog = null;
        }

        const dialog = h('sl-dialog', { label: '玩家资料', class: 'player-profile-dialog' });
        const body = h('div', { class: 'd-flex flex-column gap-3' }, [
            h('div', { class: 'text-secondary small', text: '加载中...' })
        ]);
        const close = h('sl-button', { variant: 'neutral', text: '关闭' });
        const footer = h('div', { slot: 'footer', class: 'gap-2' }, [close]);
        dialog.append(body, footer);
        document.body.append(dialog);
        profile_dialog = dialog;

        close.addEventListener('click', () => dialog.hide());
        dialog.addEventListener('sl-after-hide', () => {
            if (profile_dialog === dialog) profile_dialog = null;
            dialog.remove();
        });
        dialog.show();

        const data = await window.http_user_profile(uuid, logged_in() ? token() : null);
        if (profile_dialog !== dialog) return;
        if (!data) {
            body.replaceChildren(h('div', { class: 'text-secondary small', text: '无法加载该玩家资料' }));
            return;
        }
        body.replaceChildren();
        profile_render(body, footer, data);
    };

    // ---------- 弹窗开关 ----------
    const open_drawer = () => {
        const node = drawer();
        if (!node) return;
        node.classList.add('open');
        refresh_list();
        refresh_online();
    };

    const close_drawer = () => {
        const node = drawer();
        if (node) node.classList.remove('open');
    };

    // ---------- 好友申请页 ----------
    const requests_view = () => byId('friend_requests_view');
    const requests_open = () => {
        const node = requests_view();
        return Boolean(node && !node.classList.contains('d-none'));
    };

    const open_requests = () => {
        const node = requests_view();
        if (!node) return;
        node.classList.remove('d-none');
        const select = byId('select_friend_request_mode');
        if (select) select.value = state.request_mode;
        render_requests_page_by_state();
        if (logged_in()) refresh_list();
    };

    const close_requests = () => {
        const node = requests_view();
        if (node) node.classList.add('d-none');
    };

    let latest_incoming = [];
    let latest_outgoing = [];

    const render_requests_page_by_state = () => {
        render_requests_page(latest_incoming);
        render_outgoing_page(latest_outgoing);
    };

    // ---------- 好友数据 ----------
    const refresh_list = async () => {
        if (!logged_in() || !window.http_friend_list) return;
        const result = await window.http_friend_list(token());
        if (!result) return;
        const my_id = byId('span_friend_my_id');
        if (my_id) my_id.textContent = result.friend_id || '----';
        state.request_mode = result.request_mode || 'manual';
        latest_incoming = result.incoming || [];
        latest_outgoing = result.outgoing || [];
        render_requests_page(latest_incoming);
        render_outgoing_page(latest_outgoing);
        render_friends(result.friends || []);
        state.requests = latest_incoming.length;
        state.messages = Number(result.messages) || 0;
        refresh_badge();
        if (requests_open()) {
            const select = byId('select_friend_request_mode');
            if (select) select.value = state.request_mode;
        }
    };

    const request_item = (user) => {
        const item = h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(user, '2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    name_node(user),
                    FriendList.is_admin(user) ? admin_badge() : null
                ]),
                h('small', { class: 'text-secondary', text: '请求添加你为好友' })
            ]),
            h('sl-button', { size: 'small', variant: 'success', outline: '', text: '接受' }),
            h('sl-button', { size: 'small', variant: 'danger', outline: '', text: '拒绝' })
        ]);
        const buttons = Array.from(item.querySelectorAll('sl-button'));
        buttons[0].addEventListener('click', () => accept_user(user));
        buttons[1].addEventListener('click', () => reject_user(user));
        return item;
    };

    const render_requests_page = (incoming) => {
        const box = byId('div_friend_requests_page');
        if (!box) return;
        box.replaceChildren();
        if (!incoming.length) {
            box.append(h('div', { class: 'text-secondary small py-2', text: '暂无待处理的好友申请' }));
            return;
        }
        incoming.forEach((user) => box.append(request_item(user)));
    };

    const render_outgoing_page = (outgoing) => {
        const box = byId('div_friend_outgoing_page');
        if (!box) return;
        box.replaceChildren();
        if (!outgoing.length) {
            box.append(h('div', { class: 'text-secondary small py-2', text: '还没有发出的申请' }));
            return;
        }
        outgoing.forEach((user) => {
            box.append(h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
                avatar(user, '2rem'),
                h('div', { class: 'flex-grow-1 min-w-0' }, [
                    h('div', { class: 'd-flex align-items-center gap-1' }, [
                        name_node(user),
                        FriendList.is_admin(user) ? admin_badge() : null
                    ]),
                    h('small', { class: 'text-secondary', text: '等待对方处理' })
                ])
            ]));
        });
    };

    const accept_user = async (user) => {
        const ok = await window.http_friend_accept(token(), user.uuid);
        if (!ok) return notify('error', '接受失败');
        notify('success', '已添加好友');
        refresh_list();
        if (drawer_open()) refresh_online();
    };

    const reject_user = async (user) => {
        const ok = await window.http_friend_reject(token(), user.uuid);
        if (!ok) return notify('error', '操作失败');
        refresh_list();
        if (drawer_open()) refresh_online();
    };

    const render_friends = (friends) => {
        const box = byId('div_friend_list');
        if (!box) return;
        box.replaceChildren();
        const sorted = FriendList.sort_friends(friends);
        if (!sorted.length) {
            box.append(h('div', { class: 'text-secondary small py-2', text: '还没有好友，快去添加吧' }));
            return;
        }
        const now = Date.now();
        sorted.forEach((friend) => box.append(friend_item(friend, now)));
    };

    const friend_item = (friend, now) => {
        const online = Boolean(friend.online);
        const item = h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(friend, '2.2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    name_node(friend),
                    FriendList.is_admin(friend) ? admin_badge() : null,
                    h('span', { class: online ? 'friend-dot online' : 'friend-dot' })
                ]),
                h('small', { class: 'text-secondary', text: FriendList.format_presence(friend, now) })
            ]),
            h('sl-button', { size: 'small', variant: 'default', outline: '', text: '消息' }),
            h('sl-button', { size: 'small', variant: 'primary', outline: '', text: '对战' }),
            h('sl-button', { size: 'small', variant: 'danger', outline: '', title: '删除好友' }, [h('sl-icon', { name: 'trash' })])
        ]);
        const buttons = Array.from(item.querySelectorAll('sl-button'));
        buttons[0].addEventListener('click', () => open_chat(friend));
        buttons[1].addEventListener('click', () => challenge(friend));
        buttons[2].addEventListener('click', () => remove_friend(friend));
        return item;
    };

    const challenge = async (friend) => {
        const room = FriendList.make_room_code();
        const ok = await window.http_friend_challenge(token(), friend.uuid, room);
        if (!ok) return notify('error', '邀请失败');
        notify('success', '已发出对战邀请');
        join_room(room);
    };

    const remove_friend = async (friend) => {
        const name = FriendList.display_name(friend.name);
        if (!window.confirm(`确定删除好友「${name}」吗？`)) return;
        const ok = await window.http_friend_remove(token(), friend.uuid);
        if (!ok) return notify('error', '删除失败');
        notify('success', '已删除好友');
        refresh_list();
    };

    // ---------- 近七天活跃玩家（所有玩家可见） ----------
    const add_online_player = async (player) => {
        const outcome = await window.http_friend_request(token(), player.friend_id);
        if (!outcome) return notify('error', '发送申请失败');
        if (outcome.relation === 'denied') return notify('info', '对方不接受好友申请');
        notify('success', outcome.relation === 'friend' ? '你们已成为好友' : '好友申请已发送');
        await refresh_list();
        await refresh_online();
    };

    // 关系按钮：陌生人可添加；对方禁止申请时禁用；其余关系只展示状态
    const online_relation_button = (player) => {
        if (player.relation === 'none' && player.request_mode === 'deny') {
            const holder = h('sl-button', { size: 'small', variant: 'default', outline: '', text: '不接受申请' });
            holder.setAttribute('disabled', '');
            return holder;
        }
        if (player.relation === 'none') {
            const add = h('sl-button', { size: 'small', variant: 'primary', text: '添加好友' });
            add.addEventListener('click', () => add_online_player(player));
            return add;
        }
        const label = FriendList.relation_label(player.relation);
        const holder = h('sl-button', { size: 'small', variant: 'default', outline: '', text: label.text });
        holder.setAttribute('disabled', '');
        return holder;
    };

    const online_item = (player, now) => {
        const item = h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(player, '2.2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    name_node(player),
                    FriendList.is_admin(player) ? admin_badge() : null,
                    h('span', { class: player.online ? 'friend-dot online' : 'friend-dot' })
                ]),
                h('small', { class: 'text-secondary', text: FriendList.format_presence(player, now) })
            ])
        ]);
        item.append(online_relation_button(player));
        return item;
    };

    const render_online = (players) => {
        const box = byId('div_friend_online');
        if (!box) return;
        box.replaceChildren();
        const sorted = FriendList.sort_friends(players || []);
        if (!sorted.length) {
            box.append(h('div', { class: 'text-secondary small py-2', text: '近七天内没有活跃玩家' }));
            return;
        }
        const now = Date.now();
        sorted.forEach((player) => box.append(online_item(player, now)));
    };

    const refresh_online = async () => {
        const section = byId('section_friend_online');
        if (!logged_in() || !window.http_friend_online) {
            if (section) section.classList.add('d-none');
            return;
        }
        const result = await window.http_friend_online(token());
        if (!result || !Array.isArray(result.players)) {
            if (section) section.classList.add('d-none');
            return;
        }
        if (section) section.classList.remove('d-none');
        render_online(result.players);
    };

    const do_refresh_online = async () => {
        const button = byId('button_friend_online_refresh');
        if (button) button.disabled = true;
        try {
            await refresh_online();
        } finally {
            if (button) button.disabled = false;
        }
    };

    // ---------- 私信会话（内嵌右侧详情区） ----------
    // 打开与某位好友的聊天：展示历史记录 + 输入发送，打开即清除该好友未读
    const open_chat = async (friend) => {
        if (!drawer() || !friend || !friend.uuid) return;
        if (state.chat && state.chat.friend.uuid === friend.uuid) {
            show_detail('chat');
            return;
        }

        state.chat = { friend };
        const title = byId('span_friend_chat_title');
        if (title) {
            title.textContent = '';
            const name = h('span', { text: FriendList.display_name(friend.name) });
            window.name_color_apply(name, friend.name_color || '');
            title.append(h('span', { text: '与 ' }), name, h('span', { text: ' 聊天' }));
        }
        const input = byId('input_friend_chat');
        if (input) input.value = '';

        show_detail('chat');
        await refresh_chat();
        if (input) input.focus();
    };

    // 拉取会话记录（服务端同时把对方来信标记为已读），并刷新未读红点
    const refresh_chat = async () => {
        const chat = state.chat;
        if (!chat || !logged_in() || !window.http_friend_message_list) return;
        const result = await window.http_friend_message_list(token(), chat.friend.uuid);
        if (state.chat !== chat || !result) return;
        state.messages = Number(result.unread) || 0;
        refresh_badge();
        render_chat_messages(chat, result.messages || []);
    };

    const render_chat_messages = (chat, messages) => {
        const list = byId('div_friend_chat_list');
        if (!list) return;
        list.replaceChildren();
        if (!messages.length) {
            list.append(h('div', { class: 'text-secondary small text-center py-3', text: '还没有消息，打个招呼吧' }));
            return;
        }
        const now = Date.now();
        messages.forEach((message) => list.append(chat_bubble(message, now)));
        list.scrollTop = list.scrollHeight;
    };

    const chat_bubble = (message, now) => {
        const mine = Boolean(message.mine);
        return h('div', { class: mine ? 'friend-chat-row mine' : 'friend-chat-row' }, [
            h('div', { class: mine ? 'friend-chat-bubble mine' : 'friend-chat-bubble' }, [
                h('div', { class: 'friend-chat-text', text: String(message.content || '') }),
                h('div', { class: 'friend-chat-time', text: FriendList.format_message_time(message.created_at, now) })
            ])
        ]);
    };

    const send_chat = async () => {
        const chat = state.chat;
        const input = byId('input_friend_chat');
        const send = byId('button_friend_chat_send');
        if (!chat || !input) return;
        const content = FriendList.normalize_message(input.value);
        if (!content) return;

        input.value = '';
        if (send) send.disabled = true;
        try {
            const ok = await window.http_friend_message_send(token(), chat.friend.uuid, content);
            if (!ok) return notify('error', '发送失败');
            await refresh_chat();
        } finally {
            if (state.chat === chat && send) send.disabled = false;
        }
    };

    // ---------- 搜索 ----------
    const do_search = async () => {
        const input = byId('input_friend_search');
        const button = byId('button_friend_search');
        const box = byId('div_friend_search_result');
        if (!input || !box) return;

        const friend_id = FriendList.normalize_friend_id(input.value);
        input.value = friend_id;
        if (!friend_id) return notify('error', '请输入好友ID');

        if (button) button.disabled = true;
        try {
            const result = await window.http_friend_search(token(), friend_id);
            render_search(result, box);
        } finally {
            if (button) button.disabled = false;
        }
    };

    const render_search = (result, box) => {
        box.replaceChildren();
        if (!result || !result.found) {
            box.append(h('div', { class: 'text-secondary small py-1', text: '未找到该ID对应的用户' }));
            return;
        }

        let label = FriendList.relation_label(result.relation);
        if (result.relation === 'none' && result.request_mode === 'deny') {
            label = { text: '不接受申请', action: null, disabled: true };
        }
        const action = h('sl-button', { size: 'small', variant: 'primary', text: label.text });
        if (label.disabled) action.setAttribute('disabled', '');
        if (label.action) action.addEventListener('click', () => run_search_action(label.action, result));

        box.append(h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(result, '2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    name_node(result),
                    FriendList.is_admin(result) ? admin_badge() : null
                ]),
                h('small', { class: 'text-secondary', text: result.friend_id || '' })
            ]),
            action
        ]));
    };

    const run_search_action = async (action, result) => {
        if (action === 'add') {
            const outcome = await window.http_friend_request(token(), result.friend_id);
            if (!outcome) return notify('error', '发送申请失败');
            if (outcome.relation === 'denied') return notify('info', '对方不接受好友申请');
            notify('success', outcome.relation === 'friend' ? '你们已成为好友' : '好友申请已发送');
        } else if (action === 'accept') {
            const ok = await window.http_friend_accept(token(), result.uuid);
            if (!ok) return notify('error', '接受失败');
            notify('success', '已添加好友');
        }

        const box = byId('div_friend_search_result');
        const fresh = await window.http_friend_search(token(), result.friend_id);
        if (box) render_search(fresh, box);
        refresh_list();
    };

    const copy_id = async () => {
        const node = byId('span_friend_my_id');
        const id = node ? node.textContent.trim() : '';
        if (!id || id === '----') return notify('error', '暂无好友ID');
        try {
            await navigator.clipboard.writeText(id);
            notify('success', '已复制好友ID');
        } catch (_) {
            notify('error', '复制失败');
        }
    };

    // ---------- 好友申请设置 ----------
    const change_request_mode = async (mode) => {
        const select = byId('select_friend_request_mode');
        if (!mode) return;
        if (select) select.disabled = true;
        try {
            const ok = await window.http_friend_settings(token(), mode);
            if (!ok) {
                notify('error', '设置保存失败');
                if (select) select.value = state.request_mode;
                return;
            }
            state.request_mode = mode;
            notify('success', '申请设置已保存');
        } finally {
            if (select) select.disabled = false;
        }
    };

    // ---------- 装配 ----------
    const wire = () => {
        if (!drawer()) return;

        const toggle = byId('button_friend_toggle');
        if (toggle) toggle.addEventListener('click', () => (drawer_open() ? close_drawer() : open_drawer()));

        const close = byId('button_friend_close');
        if (close) close.addEventListener('click', close_drawer);

        const backdrop = byId('friend_drawer_backdrop');
        if (backdrop) backdrop.addEventListener('click', close_drawer);

        const search = byId('button_friend_search');
        if (search) search.addEventListener('click', do_search);

        const input = byId('input_friend_search');
        if (input) input.addEventListener('keydown', (event) => { if (event.key === 'Enter') do_search(); });

        const copy = byId('button_friend_copy_id');
        if (copy) copy.addEventListener('click', copy_id);

        const refresh = byId('button_friend_online_refresh');
        if (refresh) refresh.addEventListener('click', do_refresh_online);

        // 好友申请页
        const requests = byId('button_friend_requests');
        if (requests) requests.addEventListener('click', open_requests);

        const requests_back = byId('button_friend_requests_back');
        if (requests_back) requests_back.addEventListener('click', close_requests);

        const select = byId('select_friend_request_mode');
        if (select) select.addEventListener('sl-change', () => change_request_mode(select.value));

        // 内嵌聊天
        const send = byId('button_friend_chat_send');
        if (send) send.addEventListener('click', send_chat);

        const chat_input = byId('input_friend_chat');
        if (chat_input) chat_input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); send_chat(); }
        });

        const chat_profile = byId('button_friend_chat_profile');
        if (chat_profile) chat_profile.addEventListener('click', () => {
            if (state.chat) open_profile(state.chat.friend.uuid);
        });

        const profile_back = byId('button_friend_profile_back');
        if (profile_back) profile_back.addEventListener('click', () => {
            state.profile_uuid = null;
            show_detail(state.chat ? 'chat' : 'empty');
        });
    };

    const start = () => {
        try { wire(); } catch (_) { /* 页面结构异常时不影响心跳 */ }
        if (drawer() && logged_in()) refresh_list();
        state.running = true;
        watch();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') heartbeat();
        });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();

    // 对外暴露：排行榜等页面点击昵称时复用同一张玩家资料卡
    window.player_profile_open = open_profile;
    // 账号信息更新头像后刷新好友列表，保证头像即时同步
    window.friends_refresh = refresh_list;
})();
