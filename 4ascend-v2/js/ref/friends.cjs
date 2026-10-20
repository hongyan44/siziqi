/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友系统（全站心跳 + 主页左侧抽屉 + 对战邀请弹窗）
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

    const drawer = () => document.getElementById('friend_drawer');
    const drawer_open = () => { const node = drawer(); return Boolean(node && node.classList.contains('open')); };

    const state = { invite_key: null, running: false, version: 0, requests: 0, messages: 0, chat: null };

    // ---------- 心跳 ----------
    const badge = () => document.getElementById('badge_friend_dot');
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

    // 红点 = 待处理好友申请 + 未读私信（收到消息即在主页标红）
    const refresh_badge = () => update_badge(state.requests + state.messages);

    // 应用一次服务端返回的即时状态（红点 + 邀请弹窗 + 抽屉/会话刷新）
    const apply_state = (result) => {
        if (!result) return;
        const previous_version = state.version;
        const previous_messages = state.messages;
        if (result.version !== undefined && result.version !== null) state.version = Number(result.version) || 0;
        state.requests = Number(result.requests) || 0;
        state.messages = Number(result.messages) || 0;
        refresh_badge();
        if (result.invite && result.invite.from) handle_invite(result.invite);
        if (drawer_open()) refresh_list();
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

    // ---------- 抽屉 ----------
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

    const refresh_list = async () => {
        if (!logged_in() || !window.http_friend_list) return;
        const result = await window.http_friend_list(token());
        if (!result) return;
        const my_id = document.getElementById('span_friend_my_id');
        if (my_id) my_id.textContent = result.friend_id || '----';
        render_requests(result.incoming || []);
        render_friends(result.friends || []);
        state.requests = (result.incoming || []).length;
        state.messages = Number(result.messages) || 0;
        refresh_badge();
    };

    const render_requests = (incoming) => {
        const box = document.getElementById('div_friend_requests');
        if (!box) return;
        const section = document.getElementById('section_friend_requests');
        box.replaceChildren();
        if (!incoming.length) {
            if (section) section.classList.add('d-none');
            return;
        }
        if (section) section.classList.remove('d-none');
        incoming.forEach((user) => box.append(request_item(user)));
    };

    const request_item = (user) => {
        const item = h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(user, '2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    h('span', { class: 'fw-semibold text-truncate', text: FriendList.display_name(user.name) }),
                    FriendList.is_admin(user) ? admin_badge() : null
                ])
            ]),
            h('sl-button', { size: 'small', variant: 'success', outline: '', text: '接受' }),
            h('sl-button', { size: 'small', variant: 'danger', outline: '', text: '拒绝' })
        ]);
        const buttons = Array.from(item.querySelectorAll('sl-button'));
        buttons[0].addEventListener('click', () => accept_user(user));
        buttons[1].addEventListener('click', () => reject_user(user));
        return item;
    };

    const accept_user = async (user) => {
        const ok = await window.http_friend_accept(token(), user.uuid);
        if (!ok) return notify('error', '接受失败');
        notify('success', '已添加好友');
        refresh_list();
    };

    const reject_user = async (user) => {
        const ok = await window.http_friend_reject(token(), user.uuid);
        if (!ok) return notify('error', '操作失败');
        refresh_list();
    };

    const render_friends = (friends) => {
        const box = document.getElementById('div_friend_list');
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
                    h('span', { class: 'fw-semibold text-truncate', text: FriendList.display_name(friend.name) }),
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

    // ---------- 全部在线玩家（仅管理员） ----------
    const add_online_player = async (player) => {
        const outcome = await window.http_friend_request(token(), player.friend_id);
        if (!outcome) return notify('error', '发送申请失败');
        notify('success', outcome.relation === 'friend' ? '你们已成为好友' : '好友申请已发送');
        await refresh_list();
        await refresh_online();
    };

    const online_item = (player, now) => {
        const item = h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(player, '2.2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    h('span', { class: 'fw-semibold text-truncate', text: FriendList.display_name(player.name) }),
                    FriendList.is_admin(player) ? admin_badge() : null,
                    h('span', { class: player.online ? 'friend-dot online' : 'friend-dot' })
                ]),
                h('small', { class: 'text-secondary', text: FriendList.format_presence(player, now) })
            ])
        ]);
        if (player.relation === 'none') {
            const add = h('sl-button', { size: 'small', variant: 'primary', text: '添加好友' });
            add.addEventListener('click', () => add_online_player(player));
            item.append(add);
        } else {
            const label = FriendList.relation_label(player.relation);
            const holder = h('sl-button', { size: 'small', variant: 'default', outline: '', text: label.text });
            holder.setAttribute('disabled', '');
            item.append(holder);
        }
        return item;
    };

    const render_online = (players, my_uuid) => {
        const box = document.getElementById('div_friend_online');
        if (!box) return;
        box.replaceChildren();
        const sorted = FriendList.sort_friends(players || []);
        if (!sorted.length) {
            box.append(h('div', { class: 'text-secondary small py-2', text: '当前没有在线玩家' }));
            return;
        }
        const now = Date.now();
        sorted.forEach((player) => box.append(online_item(player, now)));
    };

    const refresh_online = async () => {
        const section = document.getElementById('section_friend_online');
        if (!section) return;
        if (!logged_in() || !window.http_friend_online) {
            section.classList.add('d-none');
            return;
        }
        const result = await window.http_friend_online(token());
        if (!result || !Array.isArray(result.players)) {
            // 非管理员或接口不可用：隐藏该区块
            section.classList.add('d-none');
            return;
        }
        section.classList.remove('d-none');
        render_online(result.players, result.uuid || '');
    };

    const do_refresh_online = async () => {
        const button = document.getElementById('button_friend_online_refresh');
        if (button) button.disabled = true;
        try {
            await refresh_online();
        } finally {
            if (button) button.disabled = false;
        }
    };

    // ---------- 私信会话 ----------
    // 打开与某位好友的聊天框：展示历史记录 + 输入发送，打开即清除该好友未读
    const open_chat = async (friend) => {
        if (state.chat) return;
        try {
            if (!customElements.get('sl-dialog')) await customElements.whenDefined('sl-dialog');
        } catch (_) {
            return;
        }

        const dialog = h('sl-dialog', { label: `与 ${FriendList.display_name(friend.name)} 聊天`, class: 'friend-chat-dialog' });
        const list = h('div', { class: 'friend-chat-list' });
        const input = h('sl-input', {
            placeholder: '输入消息…',
            maxlength: String(FriendList.MESSAGE_MAX_LEN),
            class: 'flex-grow-1'
        });
        const send = h('sl-button', { variant: 'primary', text: '发送' });
        const composer = h('div', { class: 'd-flex align-items-center gap-2 friend-chat-composer' }, [input, send]);
        dialog.append(h('div', { class: 'd-flex flex-column friend-chat-body' }, [list, composer]));
        document.body.append(dialog);

        state.chat = { friend, dialog, list, input, send };

        send.addEventListener('click', send_chat);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); send_chat(); }
        });
        dialog.addEventListener('sl-after-hide', () => {
            state.chat = null;
            dialog.remove();
            refresh_list();
        });

        dialog.show();
        await refresh_chat();
        input.focus();
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
        chat.list.replaceChildren();
        if (!messages.length) {
            chat.list.append(h('div', { class: 'text-secondary small text-center py-3', text: '还没有消息，打个招呼吧' }));
            return;
        }
        const now = Date.now();
        messages.forEach((message) => chat.list.append(chat_bubble(message, now)));
        chat.list.scrollTop = chat.list.scrollHeight;
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
        if (!chat) return;
        const content = FriendList.normalize_message(chat.input.value);
        if (!content) return;

        chat.input.value = '';
        chat.send.disabled = true;
        try {
            const ok = await window.http_friend_message_send(token(), chat.friend.uuid, content);
            if (!ok) return notify('error', '发送失败');
            await refresh_chat();
        } finally {
            if (state.chat === chat) chat.send.disabled = false;
        }
    };

    // ---------- 搜索 ----------
    const do_search = async () => {
        const input = document.getElementById('input_friend_search');
        const button = document.getElementById('button_friend_search');
        const box = document.getElementById('div_friend_search_result');
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
        const label = FriendList.relation_label(result.relation);
        const action = h('sl-button', { size: 'small', variant: 'primary', text: label.text });
        if (label.disabled) action.setAttribute('disabled', '');
        if (label.action) action.addEventListener('click', () => run_search_action(label.action, result));

        box.append(h('div', { class: 'd-flex align-items-center gap-2 p-2 rounded border' }, [
            avatar(result, '2rem'),
            h('div', { class: 'flex-grow-1 min-w-0' }, [
                h('div', { class: 'd-flex align-items-center gap-1' }, [
                    h('span', { class: 'fw-semibold text-truncate', text: FriendList.display_name(result.name) }),
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
            notify('success', outcome.relation === 'friend' ? '你们已成为好友' : '好友申请已发送');
        } else if (action === 'accept') {
            const ok = await window.http_friend_accept(token(), result.uuid);
            if (!ok) return notify('error', '接受失败');
            notify('success', '已添加好友');
        }

        const box = document.getElementById('div_friend_search_result');
        const fresh = await window.http_friend_search(token(), result.friend_id);
        if (box) render_search(fresh, box);
        refresh_list();
    };

    const copy_id = async () => {
        const node = document.getElementById('span_friend_my_id');
        const id = node ? node.textContent.trim() : '';
        if (!id || id === '----') return notify('error', '暂无好友ID');
        try {
            await navigator.clipboard.writeText(id);
            notify('success', '已复制好友ID');
        } catch (_) {
            notify('error', '复制失败');
        }
    };

    // ---------- 装配 ----------
    const wire = () => {
        if (!drawer()) return;

        const toggle = document.getElementById('button_friend_toggle');
        if (toggle) toggle.addEventListener('click', () => (drawer_open() ? close_drawer() : open_drawer()));

        const close = document.getElementById('button_friend_close');
        if (close) close.addEventListener('click', close_drawer);

        const backdrop = document.getElementById('friend_drawer_backdrop');
        if (backdrop) backdrop.addEventListener('click', close_drawer);

        const search = document.getElementById('button_friend_search');
        if (search) search.addEventListener('click', do_search);

        const input = document.getElementById('input_friend_search');
        if (input) input.addEventListener('keydown', (event) => { if (event.key === 'Enter') do_search(); });

        const copy = document.getElementById('button_friend_copy_id');
        if (copy) copy.addEventListener('click', copy_id);

        const refresh = document.getElementById('button_friend_online_refresh');
        if (refresh) refresh.addEventListener('click', do_refresh_online);
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
})();