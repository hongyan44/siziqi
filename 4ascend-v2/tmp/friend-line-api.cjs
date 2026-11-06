/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 线路联机域名解析 + 好友接受兜底 回归测试
 *   1. 行为：resolve_api_host 按当前线路解析联机域名（国际线路走 online.glb.siziqi.net）
 *   2. 行为：game_server_host 让对局 WS 跟随线路
 *   3. 行为：accept_friend 在响应丢失时以服务端好友列表兜底判定
 *   4. 静态：好友接口超时常量接线、接受调用点统一走 accept_friend
 * 运行：node tmp/friend-line-api.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

// ---------- 1. 联机域名按线路解析 ----------
const http_path = path.join(root, 'js', 'ref', 'http.cjs');
const http_src = read(http_path);

// 直接执行生产代码片段（避免加载整个 http.cjs 触发登录态检查等副作用）
const api_block = (http_src.match(/window\.http_protocol = `\$\{location\.protocol\}\/\/`;[\s\S]*?window\.online_api = resolve_api_host\(\);/) || [])[0];
ok('http.cjs 定义线路解析块', Boolean(api_block));

const load_api_for = (hostname, protocol = 'https:') => {
    const win = {};
    const location = { 'hostname': hostname, 'protocol': protocol };
    new Function('window', 'location', api_block)(win, location);
    return win.online_api;
};

console.log('联机域名解析');
const api_cases = [
    ['siziqi.net', 'online.siziqi.net'],
    ['www.siziqi.net', 'online.siziqi.net'],
    ['glb.siziqi.net', 'online.glb.siziqi.net'],
    ['online.siziqi.net', 'online.siziqi.net'],
    ['online.glb.siziqi.net', 'online.glb.siziqi.net'],
    ['siziqi.cc.cd', 'online.siziqi.cc.cd'],
    ['glb.siziqi.cc.cd', 'online.glb.siziqi.cc.cd'],
    ['127.0.0.1', '127.0.0.1:50001'],
    ['localhost', 'localhost:50001'],
    ['192.168.1.151', '192.168.1.151:50001'],
    ['8.135.3.189', 'online.siziqi.net'],
    ['', 'online.siziqi.net'],
    ['unknown.example.com', 'online.siziqi.net'],
];
if (api_block) api_cases.forEach(([host, expect]) => {
    const actual = load_api_for(host);
    ok(`${host || '(空域名)'} -> ${expect}`, actual === expect, String(actual));
});

const ws_protocol = api_block ? (() => {
    const win = {};
    new Function('window', 'location', api_block)(win, { 'hostname': 'glb.siziqi.net', 'protocol': 'https:' });
    return win.ws_protocol;
})() : '';
ok('ws 协议随页面协议切换', ws_protocol === 'wss://', ws_protocol);

// ---------- 2. 对局服务器跟随线路 ----------
console.log('对局服务器解析');
const must_src = read(path.join(root, 'js', 'ref', 'must.cjs'));
const game_host_src = (must_src.match(/window\.game_server_host\s*=\s*\((server)\)\s*=>\s*\{[\s\S]*?\n\};/) || [])[0];
ok('must.cjs 定义 game_server_host', Boolean(game_host_src));

if (game_host_src) {
    const make_host = (online_api) => new Function(
        'window',
        `window.online_api=${JSON.stringify(online_api)};\n${game_host_src}\nreturn window.game_server_host;`
    )({ 'online_api': online_api });
    const host = make_host('online.glb.siziqi.net');
    ok('默认节点跟随线路', host('online.siziqi.net') === 'online.glb.siziqi.net', host('online.siziqi.net'));
    ok('空值跟随线路', host('') === 'online.glb.siziqi.net', host(''));
    ok('自定义节点保持不变', host('192.168.1.151:50001') === '192.168.1.151:50001', host('192.168.1.151:50001'));
    ok('线路缺失时回退默认节点', make_host(undefined)('online.siziqi.net') === 'online.siziqi.net');

    ['friend', 'match-game', 'view'].forEach((name) => {
        const src = read(path.join(root, 'js', 'main', `${name}.cjs`));
        ok(`${name}.cjs 加入房间使用 game_server_host`, src.includes('window.game_server_host(server)'));
    });
}

// ---------- 3. 接受好友申请兜底 ----------
console.log('接受好友申请兜底');
const friends_src = read(path.join(root, 'js', 'ref', 'friends.cjs'));
const accept_src = (friends_src.match(/const accept_friend = async \(uuid\) => \{[\s\S]*?\n    \};/) || [])[0];
ok('friends.cjs 定义 accept_friend', Boolean(accept_src));

// 用生产代码片段驱动 accept_friend：注入 window/token/get_friends，并记录列表刷新次数
const run_accept = async (uuid, accept_result, friends_after) => {
    const counter = { 'n': 0 };
    const run = new Function('token', 'window', 'get_friends', 'counter', 'uuid',
        `let latest_friends = [];
         const refresh_list = async () => { counter.n += 1; latest_friends = await get_friends(); };
         ${accept_src}
         return accept_friend(uuid);`);
    const value = await run(
        () => 'tok',
        { 'http_friend_accept': async () => accept_result },
        async () => friends_after,
        counter,
        uuid
    );
    return { 'value': value, 'counter': counter };
};

(async () => {
    if (accept_src) {
        const success = await run_accept('u-1', true, []);
        ok('接受成功直接返回 true', success.value === true, String(success.value));
        ok('接受成功不触发兜底刷新', success.counter.n === 0, String(success.counter.n));

        const lost = await run_accept('u-1', false, [{ 'uuid': 'u-1' }, { 'uuid': 'u-2' }]);
        ok('响应丢失时以好友列表判定成功', lost.value === true, String(lost.value));
        ok('兜底路径刷新一次好友列表', lost.counter.n === 1, String(lost.counter.n));

        const fail = await run_accept('u-1', false, [{ 'uuid': 'u-2' }]);
        ok('确实失败时返回 false', fail.value === false, String(fail.value));

        const empty = await run_accept('', true, []);
        ok('空 uuid 直接拒绝', empty.value === false, String(empty.value));
    }

    // ---------- 4. 静态接线 ----------
    console.log('静态接线');
    ok('超时常量：好友接口 12s', /const FRIEND_TIMEOUT = 12000;/.test(http_src));
    ok('超时常量：长轮询 15s', /const FRIEND_WAIT_TIMEOUT = 15000;/.test(http_src));
    const accept_line = http_src.split('\n').find((line) => line.includes('/friend/accept')) || '';
    ok('/friend/accept 使用好友超时', accept_line.includes('FRIEND_TIMEOUT'));
    const wait_line = http_src.split('\n').find((line) => line.includes('/friend/wait')) || '';
    ok('/friend/wait 使用长轮询超时', wait_line.includes('FRIEND_WAIT_TIMEOUT'));

    const accept_calls = (friends_src.match(/accept_friend\(/g) || []).length;
    ok('accept_friend 三处调用', accept_calls === 3, String(accept_calls));
    ok('不再直接调用 http_friend_accept 判定',
        !/if \(await window\.http_friend_accept/.test(friends_src.replace(accept_src, '')));

    // ---------- 5. 构建产物 ----------
    console.log('构建产物');
    const built_http = read(path.join(root, 'root', 'js', 'ref', 'http.min.js'));
    const built_must = read(path.join(root, 'root', 'js', 'ref', 'must.min.js'));
    const built_friends = read(path.join(root, 'root', 'js', 'ref', 'friends.min.js'));
    ok('产物：http.min.js 含联机域名映射', built_http.includes('siziqi.cc.cd') && built_http.includes('online.siziqi.net'));
    ok('产物：http.min.js 含好友超时数值', /12e3/.test(built_http) && /15e3/.test(built_http));
    ok('产物：must.min.js 含线路默认节点', built_must.includes('online.siziqi.net'));
    ok('产物：friends.min.js 含接受兜底', built_friends.includes('http_friend_accept'));

    const html = read(path.join(root, 'root', 'pages', 'online', 'friend.html'));
    ok('产物：friend.html 版本号已刷新', /min\.js\?v=\d+/.test(html) && !html.includes('?v=replace'));

    if (failed) {
        console.log(`\n${failed} 项失败`);
        process.exit(1);
    }
    console.log('\n全部通过');
})();
