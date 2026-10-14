/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友/对战邀请实时到达（长轮询 + 短轮询兜底）回归测试
 *   1. 静态接线：前端长轮询封装与循环、后端 /friend/wait 路由与版本号机制是否齐备
 *   2. 行为模拟：在伪造的浏览器环境下驱动 friends.cjs 的长轮询循环，校验版本号推进与兜底
 * 运行：node tmp/friend-realtime.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server_root = path.join(root, '..', '4ascend-online');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

// ---------- 1. 静态接线 ----------
console.log('静态接线');

const http_src = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('前端：定义 http_friend_wait', /window\.http_friend_wait\s*=/.test(http_src));
ok('前端：长轮询指向 /friend/wait', http_src.includes('/friend/wait'));
ok('前端：长轮询上报版本号（字符串化）', /version:\s*String\(/.test(http_src));

const friends_src = read(path.join(root, 'js', 'ref', 'friends.cjs'));
ok('前端：循环调用 http_friend_wait', friends_src.includes('window.http_friend_wait('));
ok('前端：维护 state.version', /state\.version/.test(friends_src));
ok('前端：存在兜底重试间隔', /WAIT_RETRY_MS/.test(friends_src));
ok('前端：保留心跳兜底', friends_src.includes('http_friend_heartbeat'));
ok('前端：移除旧的定时器心跳', !/setInterval\(heartbeat/.test(friends_src));

const api_src = read(path.join(server_root, 'src', 'api', 'http', 'Friend.cpp'));
ok('后端：定义 friend_wait 协程处理器', /friend_wait\s*\(/.test(api_src));
ok('后端：注册 /friend/wait 路由', api_src.includes('"/friend/wait"'));
ok('后端：解析客户端版本号', /parse_version/.test(api_src));
ok('后端：等待期间挂起协程', /async_simple::coro::sleep/.test(api_src));
ok('后端：等待上限低于前端 5s 超时', /MAX_WAIT_MS\s*=\s*3000/.test(api_src));

const manager_src = read(path.join(server_root, 'src', 'manager', 'Friend.cpp'));
ok('后端：变更版本号 bump/version 已实现', /void bump\(/.test(manager_src) && /uint64_t version\(/.test(manager_src));
ok('后端：加好友触发通知', /add_friend[\s\S]{0,900}?bump\(a\)/.test(manager_src));
ok('后端：删除好友触发通知', /remove_friend[\s\S]{0,400}?bump\(a\)/.test(manager_src));
ok('后端：好友申请触发通知', /add_request[\s\S]{0,400}?bump\(to\)/.test(manager_src));
ok('后端：移除申请触发通知', /remove_request[\s\S]{0,400}?bump\(from\)/.test(manager_src));
ok('后端：对战邀请触发通知', /add_invite[\s\S]{0,900}?bump\(to\)/.test(manager_src));

// ---------- 2. 行为模拟 ----------
const friends_path = path.join(root, 'js', 'ref', 'friends.cjs');

const make_document = () => ({
    readyState: 'complete',
    getElementById: () => null,
    addEventListener: () => {}
});

// 长轮询循环：每次返回递增版本号，循环应把新版本号回传给下一次请求
const run_long_poll = async () => {
    const calls = [];
    let count = 0;
    global.window = {
        get_token: () => (count < 5 ? 'tok' : ''),
        http_friend_wait: async (token, version) => {
            calls.push(version);
            count += 1;
            return { version: count, requests: count, invite: null };
        },
        http_friend_heartbeat: async () => ({ requests: 0, invite: null }),
        http_friend_list: async () => ({ friend_id: 'X', friends: [], incoming: [], outgoing: [] })
    };
    global.document = make_document();

    delete require.cache[require.resolve(friends_path)];
    require(friends_path);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return calls;
};

// 兜底：长轮询接口不可用时，循环应退回普通心跳
const run_fallback = async () => {
    const calls = [];
    let count = 0;
    global.window = {
        get_token: () => (count < 1 ? 'tok' : ''),
        http_friend_wait: undefined,
        http_friend_heartbeat: async () => {
            calls.push('hb');
            count += 1;
            return { requests: 0, invite: null };
        },
        http_friend_list: async () => ({ friend_id: 'X', friends: [], incoming: [], outgoing: [] })
    };
    global.document = make_document();

    // 缩短兜底等待，避免测试真的等 2 秒
    const real_timeout = global.setTimeout;
    global.setTimeout = (fn) => { fn(); return 0; };
    try {
        delete require.cache[require.resolve(friends_path)];
        require(friends_path);
        for (let i = 0; i < 200; i += 1) await Promise.resolve();
    } finally {
        global.setTimeout = real_timeout;
    }
    return calls;
};

(async () => {
    console.log('行为模拟');

    const long_poll_calls = await run_long_poll();
    ok('长轮询：首轮以版本号 0 请求', long_poll_calls[0] === 0, JSON.stringify(long_poll_calls));
    ok('长轮询：版本号逐轮回传（0,1,2,3,4）',
        JSON.stringify(long_poll_calls) === JSON.stringify([0, 1, 2, 3, 4]),
        JSON.stringify(long_poll_calls));

    const fallback_calls = await run_fallback();
    ok('兜底：长轮询不可用时改走心跳', fallback_calls[0] === 'hb', JSON.stringify(fallback_calls));

    // ---------- 3. 构建产物 ----------
    console.log('构建产物');
    const built_http = read(path.join(root, 'root', 'js', 'ref', 'http.min.js'));
    const built_friends = read(path.join(root, 'root', 'js', 'ref', 'friends.min.js'));
    ok('产物：http.min.js 含 friend/wait', built_http.includes('/friend/wait'));
    ok('产物：friends.min.js 含长轮询调用', built_friends.includes('http_friend_wait'));
    ok('产物：friends.min.js 不再使用定时器心跳', !built_friends.includes('setInterval'));

    if (failed) {
        console.log(`\n${failed} 项失败`);
        process.exit(1);
    }
    console.log('\n全部通过');
})();