/*
 * 赛事「两组同时进行时，另一组被误结算」回归。
 * 运行：node tmp/contest-cross-room-leave.cjs
 *
 * 现象：两组人在各自房间同时打，其中一组打完（有人退出房间）后，
 *       另一组会在没有正常对局的情况下被立刻结算胜负。
 *
 * 根因：服务端 Online::Player::client 保存的是原始连接指针，连接关闭时只从
 *       ws_clients 里移除，没有清空房间里的指针；地址被新连接复用后，
 *       sync_player2player 会把本房间的 {type:'game_leave'} 投递给另一个房间的玩家。
 *       两个玩家随后都会按“对方逃跑”判胜并上传同一份回放，服务端按 hash 只保留
 *       先到的那份 result，于是胜负看起来是随机的。
 *
 * 本测试覆盖：
 *   1) 服务端断开必须清理房间/观战者的连接指针，且在 Init.h 的连接回收处被调用；
 *   2) 客户端退出通知必须带房间号，接收方必须校验房间号；
 *   3) game_leave 轮询必须在本局结算/换局后停止，不能残留到下一局。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const online_path = path.join(root, 'js', 'core', 'online.cjs');
const server_friend_cpp = path.join(root, '..', '4ascend-online', 'src', 'online', 'Friend.cpp');
const server_friend_h = path.join(root, '..', '4ascend-online', 'src', 'online', 'Friend.h');
const server_init_h = path.join(root, '..', '4ascend-online', 'src', 'Init.h');
const online_built = path.join(root, 'root', 'js', 'core', 'online.min.js');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const online_src = fs.readFileSync(online_path, 'utf8');
const friend_cpp = fs.readFileSync(server_friend_cpp, 'utf8');
const friend_h = fs.readFileSync(server_friend_h, 'utf8');
const init_h = fs.readFileSync(server_init_h, 'utf8');

// ---------- 1. 服务端：断开时清理连接指针 ----------
console.log('\n[1] 服务端断开清理');
ok('Friend.h 声明 client_detach', /void client_detach\(cinatra::coro_http_connection\* client\) noexcept;/.test(friend_h));
ok('Friend.cpp 实现 client_detach', /void client_detach\(cinatra::coro_http_connection\* client\) noexcept \{/.test(friend_cpp));
ok('清空玩家槽位上的失效指针', /if \(room->player1->client == client\) room->player1->client = nullptr;/.test(friend_cpp)
    && /if \(room->player2->client == client\) room->player2->client = nullptr;/.test(friend_cpp));
ok('清空观战者身上的失效指针', /if \(observer->client == client\) observer->client = nullptr;/.test(friend_cpp));
ok('Init.h 连接回收前调用 client_detach', /Online::Friend::client_detach\(connect\);[\s\S]{0,80}std::erase\(ws_clients, connect\)/.test(init_h));

// ---------- 2. 客户端：退出通知带房间号并在接收端校验 ----------
console.log('\n[2] 客户端房间校验');
ok('逃跑通知携带 room', /type': 'game_leave', 'room': gl_cf_room/.test(online_src));
ok('接收端拒绝其它房间的 game_leave', /if \(result\.room !== gl_cf_room\) continue;/.test(online_src));

// ---------- 3. game_leave 生命周期 ----------
console.log('\n[3] game_leave 生命周期');
ok('绑定本局棋盘', /const board = gl_board;/.test(online_src));
ok('本局结算/换局后退出检测', /if \(gl_end_active \|\| gl_board !== board\) break;/.test(online_src));
ok('判定离开后结束本轮循环', /gl_ui\.notify_click\('\$', null\);\s*\n\s*break;/.test(online_src));

// ---------- 4. 行为：其它房间的退出通知不得结算本局 ----------
console.log('\n[4] 行为验证：串房退出通知');
const fn_match = online_src.match(/const rematch_listen = async \(client\) => \{[\s\S]*?\n\};/);
ok('抽取到真实 rematch_listen 源码', Boolean(fn_match));

const run_rematch_listen = async (events) => {
    const raw = fn_match ? fn_match[0] : 'const rematch_listen = async (client) => {};';
    // 取函数花括号之间的真实函数体
    const body = raw.slice(raw.indexOf('{') + 1, raw.lastIndexOf('};'));
    const source = `
        return (async () => {
            const gl_cf_room = 'ROOMAA';
            let gl_opponent_left = false;
            let gl_leave = false;
            const rematch_on_foe_leave = () => { gl_opponent_left = true; gl_leave = true; };
            const rematch_on_foe = () => {};
            const rematch_listen = async (client) => { ${body} };
            await rematch_listen(events);
            return { opponent_left: gl_opponent_left, leave: gl_leave };
        })();
    `;
    return await new Function('events', source)(events);
};

const events_for = (room) => ({
    async *[Symbol.asyncIterator]() {
        yield { type: 'message', data: { op: 'sync_player2player', result: { type: 'game_leave', room } } };
        yield { type: '$', data: null };
    }
});

(async () => {
    const foreign = await run_rematch_listen(events_for('ROOMBB'));
    ok('其它房间的 game_leave 被忽略', foreign.opponent_left === false && foreign.leave === false, JSON.stringify(foreign));

    const own = await run_rematch_listen(events_for('ROOMAA'));
    ok('本房间的 game_leave 正常结算', own.opponent_left === true && own.leave === true, JSON.stringify(own));

    // ---------- 5. 发布产物 ----------
    console.log('\n[5] 发布产物');
    ok('已构建 online.min.js', fs.existsSync(online_built));

    console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAIL`}`);
    process.exit(failed === 0 ? 0 : 1);
})();
