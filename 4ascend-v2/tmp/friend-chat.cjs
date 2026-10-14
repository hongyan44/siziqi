/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友私信（聊天框 + 未读红点）回归测试
 *   1. 纯逻辑：friend-list.cjs 的消息规范化 / 时间文案
 *   2. 静态接线：前端 http.cjs / friends.cjs、后端 manager 与 api 是否齐备
 *   3. 行为模拟：长轮询把未读数合入主页红点徽标
 * 运行：node tmp/friend-chat.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server_root = path.join(root, '..', '4ascend-online');
const FriendList = require(path.join(root, 'js', 'ref', 'friend-list.cjs'));

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

// ---------- 1. 纯逻辑 ----------
console.log('friend-list 消息纯逻辑');

ok('上限：MESSAGE_MAX_LEN 为 1000', FriendList.MESSAGE_MAX_LEN === 1000);
ok('规范化：去首尾空白', FriendList.normalize_message('  hi  ') === 'hi');
ok('规范化：非字符串返回空串', FriendList.normalize_message(null) === '');
ok('规范化：纯空白返回空串', FriendList.normalize_message('   ') === '');
ok('规范化：超长截断到上限', FriendList.normalize_message('x'.repeat(1500)).length === 1000);

(() => {
    const now = new Date(2026, 4, 10, 12, 0, 0).getTime();
    const same_day = new Date(2026, 4, 10, 9, 5, 0).getTime();
    const other_day = new Date(2026, 4, 8, 9, 5, 0).getTime();
    const other_year = new Date(2025, 4, 8, 9, 5, 0).getTime();
    ok('时间：当天只显示时分', FriendList.format_message_time(same_day, now) === '09:05');
    ok('时间：跨天带月日', FriendList.format_message_time(other_day, now) === '05-08 09:05');
    ok('时间：跨年带年份', FriendList.format_message_time(other_year, now) === '2025-05-08 09:05');
    ok('时间：无效时间戳返回空串', FriendList.format_message_time(0, now) === '');
})();

// ---------- 2. 静态接线 ----------
console.log('静态接线');

const http_src = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('前端：定义 http_friend_message_send', /window\.http_friend_message_send\s*=/.test(http_src));
ok('前端：定义 http_friend_message_list', /window\.http_friend_message_list\s*=/.test(http_src));
ok('前端：指向 /friend/message_send', http_src.includes('/friend/message_send'));
ok('前端：指向 /friend/message_list', http_src.includes('/friend/message_list'));

const friends_src = read(path.join(root, 'js', 'ref', 'friends.cjs'));
ok('前端：存在聊天框打开逻辑', /const open_chat\s*=/.test(friends_src));
ok('前端：存在会话刷新逻辑', /const refresh_chat\s*=/.test(friends_src));
ok('前端：存在发送逻辑', /const send_chat\s*=/.test(friends_src));
ok('前端：调用 message_send', friends_src.includes('http_friend_message_send'));
ok('前端：调用 message_list', friends_src.includes('http_friend_message_list'));
ok('前端：好友项含「消息」按钮', friends_src.includes('text: \'消息\''));
ok('前端：红点合计申请数 + 未读私信', /state\.requests \+ state\.messages/.test(friends_src));
ok('前端：apply_state 记录未读数', /state\.messages = Number\(result\.messages\)/.test(friends_src));

const html_src = read(path.join(root, 'html', 'index.html'));
ok('页面：抽屉宽度放大 1.5 倍（510px）', html_src.includes('width: 510px'));
ok('页面：含聊天框样式', html_src.includes('.friend-chat-list'));
ok('页面：含聊天气泡样式', html_src.includes('.friend-chat-bubble'));

const manager_src = read(path.join(server_root, 'src', 'manager', 'Friend.cpp'));
ok('后端：建 messages 表', manager_src.includes('CREATE TABLE IF NOT EXISTS messages'));
ok('后端：send_message 已实现', /bool send_message\(/.test(manager_src));
ok('后端：list_conversation 已实现', /bool list_conversation\(/.test(manager_src));
ok('后端：count_unread 已实现', /bool count_unread\(/.test(manager_src));
ok('后端：mark_read 已实现', /bool mark_read\(/.test(manager_src));
ok('后端：purge_expired 已实现', /void purge_expired\(/.test(manager_src));
ok('后端：发送私信触发通知', /send_message[\s\S]{0,900}?bump\(to\)/.test(manager_src));

const api_src = read(path.join(server_root, 'src', 'api', 'http', 'Friend.cpp'));
ok('后端：friend_message_send 处理器', /friend_message_send\s*\(/.test(api_src));
ok('后端：friend_message_list 处理器', /friend_message_list\s*\(/.test(api_src));
ok('后端：注册 /friend/message_send', api_src.includes('"/friend/message_send"'));
ok('后端：注册 /friend/message_list', api_src.includes('"/friend/message_list"'));
ok('后端：私信有效期 30 天', /MESSAGE_TTL_MS\s*=\s*30LL \* 24 \* 60 \* 60 \* 1000/.test(api_src));
ok('后端：心跳状态含未读私信数', /result\["messages"\]\s*=\s*unread/.test(api_src));

// ---------- 3. 行为模拟 ----------
const friends_path = path.join(root, 'js', 'ref', 'friends.cjs');

const make_badge = () => {
    const internal = { textContent: '', hidden: true, history: [] };
    return {
        get textContent() { return internal.textContent; },
        set textContent(value) { internal.textContent = value; internal.history.push(value); },
        classList: {
            add: (name) => { if (name === 'd-none') internal.hidden = true; },
            remove: (name) => { if (name === 'd-none') internal.hidden = false; },
            contains: (name) => (name === 'd-none' ? internal.hidden : false)
        },
        _internal: internal
    };
};

// 长轮询依次返回：无变化 -> 好友申请 -> 未读私信 -> 清空
const run_badge = async () => {
    const badge = make_badge();
    let count = 0;
    global.window = {
        get_token: () => (count < 4 ? 'tok' : ''),
        http_friend_wait: async () => {
            count += 1;
            return {
                version: count,
                requests: count === 2 ? 1 : 0,
                messages: count === 3 ? 2 : 0,
                invite: null
            };
        },
        http_friend_heartbeat: async () => ({ requests: 0, messages: 0, invite: null }),
        http_friend_list: async () => ({ friend_id: 'X', friends: [], incoming: [], outgoing: [], messages: 0 })
    };
    global.document = {
        readyState: 'complete',
        getElementById: (id) => (id === 'badge_friend_dot' ? badge : null),
        addEventListener: () => {}
    };

    delete require.cache[require.resolve(friends_path)];
    require(friends_path);
    await new Promise((resolve) => setTimeout(resolve, 60));
    return badge;
};

(async () => {
    console.log('行为模拟');
    const badge = await run_badge();
    const history = badge._internal.history;
    ok('红点：好友申请计入徽标', history.includes('1'), JSON.stringify(history));
    ok('红点：未读私信计入徽标', history.includes('2'), JSON.stringify(history));

    // ---------- 4. 构建产物 ----------
    console.log('构建产物');
    const built_http = read(path.join(root, 'root', 'js', 'ref', 'http.min.js'));
    const built_friends = read(path.join(root, 'root', 'js', 'ref', 'friends.min.js'));
    const built_index = read(path.join(root, 'root', 'index.html'));
    ok('产物：http.min.js 含 message_list', built_http.includes('/friend/message_list'));
    ok('产物：friends.min.js 含聊天逻辑', built_friends.includes('http_friend_message_send'));
    ok('产物：index.html 含聊天样式', built_index.includes('friend-chat-list'));
    ok('产物：index.html 抽屉宽度 510px', built_index.includes('width:510px'));

    if (failed) {
        console.log(`\n${failed} 项失败`);
        process.exit(1);
    }
    console.log('\n全部通过');
})();