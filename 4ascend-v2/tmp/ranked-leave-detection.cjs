/*
 * @Description: 排位对局「对方离线」判定回归测试
 *   背景：js/core/ranked.cjs 的 game_leave 原先用
 *        `if (!lef && result >= await window.http_time_ms() - 25 * 1000) continue;`
 *        两个缺陷：
 *        1) http_time_ms() 失败时返回 undefined，`result >= NaN` 恒为 false，
 *           于是直接判定对方离线并发送 ranked_endgame（服务端据此强制结算）；
 *        2) 阈值仅 25 秒，短暂切后台被节流即可被对手判成逃跑。
 *        两者都会造成「双方血量未归零、棋盘未下满」却突然结算。
 *   修复：与好友对局（js/core/online.cjs）保持一致——阈值 60 秒、心跳必须为正数、
 *        服务端时间必须有效；任何数据缺失都视为“无法判断”，不得结算。
 *
 * 测试策略：从源码抽取【真实】game_leave 片段，在最小作用域桩上执行，
 *          用与 js/global/game/client.cjs 一致的广播式客户端语义驱动。
 * 运行：node tmp/ranked-leave-detection.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'js', 'core', 'ranked.cjs');
const server_path = path.join(__dirname, '..', '..', '4ascend-online', 'src', 'online', 'Ranked.cpp');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) {
        console.log(`  PASS  ${name}`);
        return;
    }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const source = fs.readFileSync(source_path, 'utf8');

// ---------- 1. 结构断言 ----------
console.log('\n[1] 源码结构（判定必须防御空数据）');
ok('心跳读取使用数值兜底', /exp = Number\(event\.data\.result\) \|\| 0;/.test(source));
ok('离开标记布尔化', /const lef = Boolean\(result\);/.test(source));
ok('服务端时间必须有限', /Number\.isFinite\(server_now\)/.test(source));
ok('心跳必须为正数才参与判定', /exp > 0 && exp < server_now - 60 \* 1000/.test(source));
ok('阈值与好友对局一致（60 秒）', /60 \* 1000/.test(source));
ok('不再出现 < NaN 即结算的旧写法', !/result >= await window\.http_time_ms\(\) - 25 \* 1000/.test(source));

// ---------- 2. 抽取真实源码 ----------
const fn_match = source.match(/const game_leave = async \(\) => \{[\s\S]*?\n\};/);
ok('抽取到真实 game_leave 源码', Boolean(fn_match));
const fn_src = fn_match ? fn_match[0] : 'const game_leave = async () => {};';

// ---------- 3. 执行桩 ----------
/**
 * @description: 运行一轮检测，返回发送给服务端的结算请求
 * @param {{foele:boolean, foeex:number|undefined|null, http_time:number|undefined, sleep_rounds?:number}} scenario
 * @return {Promise<{claims:any[], leavevv:boolean}>}
 */
const run_case = async (scenario) => {
    const claims = [];
    const ctl = { set_end: null };

    // 与 client.cjs 一致：notify 广播给全部 waiter
    const client = {
        waiters: new Set(),
        notify(type, data) {
            const waiters = Array.from(this.waiters);
            this.waiters.clear();
            waiters.forEach((resolve) => resolve({ type, data }));
        },
        start_resend(msg) {
            const data = msg.op === 'room_foele'
                ? { op: 'room_foele', status: true, result: scenario.foele }
                : { op: 'room_foeex', status: true, result: scenario.foeex };
            queueMicrotask(() => this.notify('message', data));
        },
        stop_resend(_id) { },
        send(msg) {
            if (msg.op === 'ranked_endgame') claims.push(msg.args);
        },
        async *[Symbol.asyncIterator]() {
            while (true) yield await new Promise((resolve) => this.waiters.add(resolve));
        }
    };

    let rounds = 0;
    const win = {
        sleep: async () => {
            rounds += 1;
            // 第 2 轮开头让循环退出（只观察第 1 轮判定结果）
            if (rounds >= 2 && ctl.set_end) ctl.set_end(true);
        },
        http_time_ms: async () => scenario.http_time,
        get_token: () => 'TOKEN'
    };

    const GameMessage = {
        room_foele: (id, token) => ({ op: 'room_foele', id, token }),
        room_foeex: (id, token) => ({ op: 'room_foeex', id, token }),
        ranked_endgame: (...args) => ({ op: 'ranked_endgame', args })
    };

    const factory = new Function(
        'gl_board', 'gl_cf_client', 'gl_cf_room', 'gl_cf_token', 'GameMessage', 'window',
        [
            'let gl_end = false;',
            'let gl_leavevv = false;',
            fn_src,
            'return { game_leave, set_end: (v) => { gl_end = v; }, leavevv: () => gl_leavevv };'
        ].join('\n')
    );

    const api = factory({}, client, 'ROOM1', 'TOKEN', GameMessage, win);
    ctl.set_end = api.set_end;

    await api.game_leave();

    return { claims, leavevv: api.leavevv() };
};

// ---------- 4. 场景断言 ----------
const now = 2_000_000;

const main = async () => {
console.log('\n[2] 判定行为');

{
    // 对方在线：心跳 10 秒前
    const { claims } = await run_case({ foele: false, foeex: now - 10 * 1000, http_time: now });
    ok('对方在线（心跳 10s 前）不结算', claims.length === 0, `claims=${claims.length}`);
}

{
    // 服务端时间接口失败
    const { claims } = await run_case({ foele: false, foeex: now - 10 * 1000, http_time: undefined });
    ok('时间接口失败 → 不结算（修复前会误判离线）', claims.length === 0, `claims=${claims.length}`);
}

{
    // 心跳接口失败返回 null
    const { claims } = await run_case({ foele: false, foeex: null, http_time: now });
    ok('心跳数据为空 → 不结算', claims.length === 0, `claims=${claims.length}`);
}

{
    // 30 秒未上报：旧阈值内，新阈值外
    const { claims } = await run_case({ foele: false, foeex: now - 30 * 1000, http_time: now });
    ok('心跳 30s 前（旧 25s 阈值会结算）→ 不结算', claims.length === 0, `claims=${claims.length}`);
}

{
    // 真正离线：90 秒未上报
    const { claims } = await run_case({ foele: false, foeex: now - 90 * 1000, http_time: now });
    ok('心跳 90s 前 → 结算', claims.length >= 1, `claims=${claims.length}`);
    ok('结算声明的胜者为 A（己方）', claims.length >= 1 && claims[0][2] === 'A', JSON.stringify(claims[0] || null));
}

{
    // 对方主动离开标记
    const { claims } = await run_case({ foele: true, foeex: now - 2 * 1000, http_time: now });
    ok('对方标记离开 → 立即结算', claims.length >= 1, `claims=${claims.length}`);
}

// ---------- 5. 对照组：旧实现确实会误判 ----------
console.log('\n[3] 对照组（旧表达式）');
const old_would_settle = !(now - 10 * 1000 >= undefined - 25 * 1000);
ok('旧写法在时间接口失败时判定为离线（证明原缺陷）', old_would_settle === true);

// ---------- 6. 发布产物 ----------
console.log('\n[4] 发布产物');
const built_path = path.join(root, 'root', 'js', 'core', 'ranked.min.js');
if (fs.existsSync(built_path)) {
    const built = fs.readFileSync(built_path, 'utf8');
    ok('root/js/core/ranked.min.js 已更新（含有限数判定）', built.includes('isFinite'));
    ok('root/js/core/ranked.min.js 含 60 秒阈值', /60\*1e3|60\*1000|6e4/.test(built));
} else {
    ok('root/js/core/ranked.min.js 存在', false);
}

// ---------- 7. 服务端阈值一致 ----------
console.log('\n[5] 服务端结算阈值');
if (fs.existsSync(server_path)) {
    const server = fs.readFileSync(server_path, 'utf8');
    ok('服务端同样使用 60 秒判定离线', /exp < now - 60 \* 1000/.test(server));
    ok('服务端不再使用 25 秒阈值', !/exp < now - 25 \* 1000/.test(server));
    ok('服务端校验房间成员指针', /!my \|\| !foe/.test(server));
} else {
    ok('服务端 Ranked.cpp 存在', false);
}

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
};

main();
