/*
 * @Description: 观战系统「结算后立即重赛」竞态回归测试
 *   背景：第 1 局结束时 view_accept 不会被终止；玩家立即重赛时，它会抢先消费新对局的
 *        view_sync，并把共享变量 gl_gameing 置为 false，导致新对局主循环在第一步落子前
 *        就 break（观战界面卡在初始局面）。
 *   修复（方案 2）：引入模块级世代号 gl_run；run() 开头 ++gl_run，view_accept 接收 run_id
 *        并在每轮循环与退出循环后各校验一次，过期接收器直接退场，绝不再改动全局状态。
 *
 * 测试策略：
 *   1. 从 js/core/view.cjs 抽取【真实】的 view_accept 源码与 run() 的等待循环源码，
 *      在最小作用域桩上执行，避免测“重写的替身”。
 *   2. 用与 js/global/game/client.cjs 一致的广播语义（notify 唤醒全部 waiter）模拟客户端。
 *   3. 断言修复点、原设计意图、以及对照组（去掉守卫的旧实现必须复现卡死）。
 * 运行：node tmp/view-rematch-race.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'js', 'core', 'view.cjs');
const built_path = path.join(root, 'root', 'js', 'core', 'view.min.js');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const source = fs.readFileSync(source_path, 'utf8');

// ---------- 1. 结构断言：守卫确实写在源码里 ----------
console.log('\n[1] 源码结构（世代号守卫）');
ok('声明模块级 gl_run', /let gl_run = 0;/.test(source));
ok('run() 开头递增世代号', /const run_id = \+\+gl_run;/.test(source));
ok('view_accept 接收 run_id', /const view_accept = async \(run_id\) =>/.test(source));
ok('调用点传入 run_id', /view_accept\(run_id\);/.test(source));
ok('循环内世代校验', /if \(run_id !== gl_run\) return;/.test(source));
ok('退出循环后二次校验', (source.match(/if \(run_id !== gl_run\) return;/g) || []).length >= 2);

// ---------- 2. 抽取真实源码片段 ----------
const fn_match = source.match(/const view_accept = async \([^)]*\) => \{[\s\S]*?\n\};/);
ok('抽取到真实 view_accept 源码', Boolean(fn_match));
const fn_src = fn_match ? fn_match[0] : 'const view_accept = async () => {};';

const loop_match = source.match(/for await \(const event of gl_cf_client\) if \(event\.type === 'message' && event\.data\.op === 'sync_player2observers'\) \{[\s\S]*?\n    \}/);
ok('抽取到真实 run() 等待循环源码', Boolean(loop_match));
const loop_src = loop_match ? loop_match[0] : '';

// 把抽取到的真实片段放进最小作用域：gl_time / gl_cf_client / dialog_tip 为入参，
// gl_gameing / gl_run / gl_turns 为本作用域内的可变全局（与源码同名，可被片段赋值）。
const build_harness = (body_src) => new Function(
    'gl_cf_client', 'gl_time', 'gl_turns_init', 'gl_gameing_init', 'gl_run_init', 'dialog_tip',
    [
        'let gl_gameing = gl_gameing_init;',
        'let gl_run = gl_run_init;',
        'let gl_turns = gl_turns_init;',
        body_src,
        'return {',
        '    view_accept,',
        '    gameing: () => gl_gameing,',
        '    turns: () => gl_turns,',
        '    bump_run: () => (gl_run += 1)',
        '};'
    ].join('\n')
);

// run() 的等待循环：真实片段 + 外层补一个 result 变量，返回收到的对局数据
const build_wait = () => new Function(
    'gl_cf_client', 'gl_time',
    `return async () => { let result; ${loop_src} return result; };`
);

// ---------- 3. 与 client.cjs 一致的广播式客户端桩 ----------
class MockClient {
    constructor() { this.waiters = new Set(); }
    // notify：同一消息派发给所有正在等待的消费者（广播，非队列）
    notify(type, data) {
        const waiters = Array.from(this.waiters);
        this.waiters.clear();
        waiters.forEach((resolve) => resolve({ type, data }));
    }
    async *[Symbol.asyncIterator]() {
        while (true) yield await new Promise((resolve) => this.waiters.add(resolve));
    }
}

const T1 = 1000;
const T2 = 2000;
const view_sync = (time, turns = []) => ({
    type: 'message',
    data: { op: 'sync_player2observers', result: { type: 'view_sync', time, turns } }
});
const make_tip = () => ({ shown: 0, classList: { remove() {}, add() {} }, show() { this.shown += 1; } });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
    // ---------- 4. 修复点：过期接收器不得扼杀新局 ----------
    console.log('\n[2] 修复点：上一局残留的 view_accept');
    {
        const client = new MockClient();
        const tip = make_tip();
        const h = build_harness(fn_src)(client, T1, [], true, 1, tip);
        const stale = h.view_accept(1);          // 第 1 局的接收器
        h.bump_run();                            // run(第 2 局) 开始 → gl_run = 2
        client.notify('message', view_sync(T2).data);   // 第 2 局的 view_sync 广播
        await stale;
        ok('过期接收器不改 gl_gameing', h.gameing() === true, `got ${h.gameing()}`);
        ok('过期接收器不弹提示', tip.shown === 0, `shown=${tip.shown}`);
    }

    // ---------- 5. 保留原设计意图：当前局接收器仍能提示新对局 ----------
    console.log('\n[3] 原设计意图：当前局的 view_accept');
    {
        const client = new MockClient();
        const tip = make_tip();
        const h = build_harness(fn_src)(client, T1, [], true, 5, tip);
        const current = h.view_accept(5);
        client.notify('message', view_sync(T2).data);
        await current;
        ok('当前局检测到新对局 → 结束本局', h.gameing() === false);
        ok('当前局检测到新对局 → 弹出提示', tip.shown === 1, `shown=${tip.shown}`);
    }

    // ---------- 6. 同一局的 view_sync 不得误判为“新对局” ----------
    console.log('\n[4] 同局 view_sync（time 相同）');
    {
        const client = new MockClient();
        const tip = make_tip();
        const h = build_harness(fn_src)(client, T1, [], true, 1, tip);
        const p = h.view_accept(1);
        client.notify('message', view_sync(T1, [7, 8, 9]).data);
        await tick();
        ok('同局 view_sync 不结束对局', h.gameing() === true);
        ok('同局 view_sync 同步落子数据', JSON.stringify(h.turns()) === '[7,8,9]', JSON.stringify(h.turns()));
        client.notify('message', view_sync(T2).data);   // 收尾
        await p;
    }

    // ---------- 7. 端到端竞态：残留接收器 + 新局等待循环并发 ----------
    console.log('\n[5] 端到端：残留接收器与新局等待循环并发');
    {
        const client = new MockClient();
        const tip = make_tip();
        const h = build_harness(fn_src)(client, T1, [], true, 1, tip);
        const stale = h.view_accept(1);              // 第 1 局残留接收器
        h.bump_run();                                // run(第 2 局)：递增世代号
        const wait = build_wait()(client, T1)();     // 新局等待循环（真实源码）
        client.notify('message', view_sync(T2).data);
        const got = await wait;
        await stale;
        ok('新局等待循环收到 T2 对局数据', got && got.time === T2, got && got.time);
        ok('残留接收器未中断新局', h.gameing() === true);
        ok('残留接收器未弹提示', tip.shown === 0);
    }

    // ---------- 8. 对照组：去掉守卫的旧实现必须复现卡死 ----------
    console.log('\n[6] 对照组：无守卫的旧实现');
    {
        const legacy_src = fn_src.replace(/if \(run_id !== gl_run\) return;/g, ';');
        ok('对照组确实移除了守卫', !/if \(run_id !== gl_run\) return;/.test(legacy_src));
        const client = new MockClient();
        const tip = make_tip();
        const h = build_harness(legacy_src)(client, T1, [], true, 1, tip);
        const stale = h.view_accept(1);
        h.bump_run();
        client.notify('message', view_sync(T2).data);
        await stale;
        ok('旧实现会把 gl_gameing 置为 false（复现缺陷）', h.gameing() === false);
        ok('旧实现会误弹提示（复现缺陷）', tip.shown === 1);
    }

    // ---------- 9. 发布产物 ----------
    console.log('\n[7] 发布产物 root/js/core/view.min.js');
    const built_exists = fs.existsSync(built_path);
    ok('产物存在', built_exists);
    if (built_exists) {
        const built = fs.readFileSync(built_path, 'utf8');
        const src_stat = fs.statSync(source_path);
        const built_stat = fs.statSync(built_path);
        ok('产物不早于源码（已重新构建）', built_stat.mtimeMs >= src_stat.mtimeMs,
            `${built_stat.mtime.toISOString()} < ${src_stat.mtime.toISOString()}`);
        let syntax_ok = true, syntax_err = '';
        try { new Function(built); } catch (error) { syntax_ok = false; syntax_err = error.message; }
        ok('产物语法有效', syntax_ok, syntax_err);
        ok('产物导出 MainExports.View', built.includes('MainExports'));
        ok('产物保留两处观察者同步入口', (built.match(/sync_player2observers/g) || []).length === 2);
    }

    console.log(failed === 0 ? '\nview-rematch-race: ALL PASS' : `\n失败 ${failed} 项`);
    process.exit(failed === 0 ? 0 : 1);
})();