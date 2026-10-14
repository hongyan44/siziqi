/*
 * 赛事/在线对局「重赛」回归。
 * 运行：node tmp/contest-rematch-rotation.cjs
 *
 * 需求：
 *   1) 重赛必须轮换先后手（原缺陷：重赛沿用上一局先手）；
 *   2) 重赛改为双方共识：一方点“重赛”后，另一方按钮变为“接受重赛”，双方都同意才开新局；
 *   3) 开新局时【强制交换先后手，并保持黑白方不变】。
 *
 * 测试策略：
 *   1. 源码结构断言；
 *   2. 抽取【真实】重赛共识代码块（marker 之间），在最小桩作用域执行，验证共识状态机、
 *      按钮文案/禁用、广播、以及最终交换先手 + 保持阵营；
 *   3. 双方互补性（同一局面下两个玩家算出的 first/color 必须互补，否则会“对局配置冲突”）；
 *   4. 发布产物完整性。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const online_path = path.join(root, 'js', 'core', 'online.cjs');
const match_path = path.join(root, 'js', 'main', 'match-game.cjs');
const online_built = path.join(root, 'root', 'js', 'core', 'online.min.js');
const match_built = path.join(root, 'root', 'js', 'main', 'match-game.min.js');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const online_src = fs.readFileSync(online_path, 'utf8');
const match_src = fs.readFileSync(match_path, 'utf8');

// ---------- 1. 源码结构 ----------
console.log('\n[1] 源码结构');
ok('存在重赛共识代码块', /\/\/ >>> rematch-handshake-begin/.test(online_src) && /\/\/ <<< rematch-handshake-end/.test(online_src));
ok('声明共识状态变量', /let gl_rematch_my = false;/.test(online_src) && /let gl_rematch_foe = false;/.test(online_src) && /let gl_end_active = false;/.test(online_src));
ok('按钮处理器调用 rematch_agree', /button_end_restart\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*?rematch_agree\(\);/.test(online_src));
ok('run_once 起始重置共识', /rematch_reset\(\);\s*\n\s*gl_cf_client\.stop_resend\(910\);/.test(online_src));
ok('结算画面开启共识窗口', /gl_end_active = true;\s*\n\s*dialog_end\.classList\.remove\('d-none'\);/.test(online_src));
ok('setup 启动重赛监听', /rematch_listen\(gl_cf_client\);/.test(online_src));
ok('监听 game_rematch 消息', /result\.type !== 'game_rematch'/.test(online_src));
ok('match-game 串行化上报链路', /end_report_chain = end_report_chain\.then\(task, task\);/.test(match_src));
ok('match-game 已移除 contest_refresh_first', /contest_refresh_first/.test(match_src) === false);

// ---------- 2. 抽取真实重赛共识块 ----------
const block_match = online_src.match(/\/\/ >>> rematch-handshake-begin([\s\S]*?)\/\/ <<< rematch-handshake-end/);
ok('抽取到真实重赛共识块', Boolean(block_match));
const block_src = block_match ? block_match[1] : '';

const make_harness = (src, initial = {}) => {
    const state = {
        run_calls: 0,
        hide_calls: 0,
        resent: [],
        label: '重赛'
    };

    const label_node = { nodeType: 3, get textContent() { return state.label; }, set textContent(v) { state.label = v; } };
    const button_end_restart = { lastChild: label_node, disabled: false, append: (t) => { state.label = t; } };
    const dialog_end = { hide: () => { state.hide_calls += 1; } };
    const client = {
        stop_resend: (id) => { state.resent.push(['stop', id]); },
        start_resend: (msg, duration, id) => { state.resent.push(['start', id, msg]); }
    };
    const GameMessage = { sync_player2player: (room, token, data) => ({ room, token, data }) };
    const run = () => { state.run_calls += 1; };

    const factory = new Function(
        'button_end_restart', 'dialog_end', 'gl_cf_client', 'GameMessage', 'gl_cf_room', 'gl_cf_token', 'run',
        [
            'let gl_rematch_my = false;',
            'let gl_rematch_foe = false;',
            'let gl_rematch_starting = false;',
            'let gl_end_active = false;',
            'let gl_run_promise = Promise.resolve();',
            'let gl_first_index = 0;',
            'let gl_my_index = 0;',
            'let gl_cf_first = "rand";',
            'let gl_cf_color = "rand";',
            src,
            'return {',
            '    rematch_agree, rematch_on_foe, rematch_reset, rematch_next_config, rematch_update_ui,',
            '    get: () => ({ my: gl_rematch_my, foe: gl_rematch_foe, starting: gl_rematch_starting, end: gl_end_active, first: gl_cf_first, color: gl_cf_color }),',
            '    set: (o) => {',
            '        if ("end" in o) gl_end_active = o.end;',
            '        if ("my" in o) gl_rematch_my = o.my;',
            '        if ("foe" in o) gl_rematch_foe = o.foe;',
            '        if ("first_index" in o) gl_first_index = o.first_index;',
            '        if ("my_index" in o) gl_my_index = o.my_index;',
            '        if ("run_promise" in o) gl_run_promise = o.run_promise;',
            '    },',
            '    next_config: rematch_next_config',
            '};'
        ].join('\n')
    );

    const api = factory(button_end_restart, dialog_end, client, GameMessage, 'room1', 'token1', run);
    api.set(initial);
    return { state, api, button_end_restart };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
    console.log('\n[2] 重赛共识状态机（真实片段）');
    {
        // 未结算时不响应点击
        const h = make_harness(block_src);
        h.api.rematch_agree();
        ok('非结算期点击无效', h.api.get().my === false && h.state.run_calls === 0);
    }
    {
        // 我方先点：按钮变“等待对方接受”并禁用，广播同意，但不立即开局
        const h = make_harness(block_src, { end: true });
        h.api.rematch_agree();
        await tick();
        const s = h.api.get();
        ok('我方同意被登记', s.my === true);
        ok('按钮文案变为等待对方接受', h.state.label === '等待对方接受', h.state.label);
        ok('等待期间按钮禁用', h.button_end_restart.disabled === true);
        ok('广播重赛同意（resend id=910）', h.state.resent.some((r) => r[0] === 'start' && r[1] === 910));
        ok('对方未同意前不开局', h.state.run_calls === 0);
    }
    {
        // 对方先点：我方按钮变“接受重赛”且可点
        const h = make_harness(block_src, { end: true });
        h.api.rematch_on_foe({ type: 'game_rematch', agree: true });
        await tick();
        ok('对方同意被登记', h.api.get().foe === true);
        ok('按钮文案变为接受重赛', h.state.label === '接受重赛', h.state.label);
        ok('接受重赛按钮可点击', h.button_end_restart.disabled === false);
        ok('仅一方同意不开局', h.state.run_calls === 0);
    }
    {
        // 双方都同意 -> 开局：交换先手 + 保持黑白方
        const h = make_harness(block_src, { end: true, my_index: 0, first_index: 0 }); // 我方黑方且上一局先手
        h.api.rematch_agree();
        h.api.rematch_on_foe({ type: 'game_rematch', agree: true });
        await tick();
        await tick();
        const s = h.api.get();
        ok('双方同意后开新局', h.state.run_calls === 1, String(h.state.run_calls));
        ok('关闭结算弹窗', h.state.hide_calls === 1);
        ok('交换先手（上一局我方先手 -> 本局对方先手）', s.first === 'foe', s.first);
        ok('保持我方黑方阵营', s.color === 'my', s.color);
        ok('开局前停止重赛广播', h.state.resent.some((r) => r[0] === 'stop' && r[1] === 910));
    }
    {
        // 对方先同意，我方再点“接受重赛”
        const h = make_harness(block_src, { end: true, my_index: 1, first_index: 1 }); // 我方白方且上一局先手
        h.api.rematch_on_foe({ type: 'game_rematch', agree: true });
        h.api.rematch_agree();
        await tick();
        await tick();
        const s = h.api.get();
        ok('接受重赛也能达成共识并开局', h.state.run_calls === 1);
        ok('交换先手（我方先手 -> 对方先手）', s.first === 'foe', s.first);
        ok('保持我方白方阵营', s.color === 'foe', s.color);
    }
    {
        // 非法/重复消息
        const h = make_harness(block_src, { end: true });
        h.api.rematch_on_foe({ type: 'game_rematch', agree: false });
        ok('agree=false 被忽略', h.api.get().foe === false);
        h.api.rematch_on_foe(null);
        ok('空消息被忽略', h.api.get().foe === false);
    }
    {
        // 重置
        const h = make_harness(block_src, { end: true });
        h.api.rematch_agree();
        h.api.rematch_reset();
        const s = h.api.get();
        ok('重置清空双方同意', s.my === false && s.foe === false);
        ok('重置恢复按钮文案', h.state.label === '重赛', h.state.label);
        ok('重置关闭共识窗口', s.end === false);
    }
    {
        // 重入保护：开局流程未完成时重复触发只开一局
        const h = make_harness(block_src, { end: true });
        let resolve_run;
        h.api.set({ run_promise: new Promise((resolve) => { resolve_run = resolve; }) });
        h.api.rematch_agree();
        h.api.rematch_on_foe({ type: 'game_rematch', agree: true });
        await tick();
        h.api.rematch_on_foe({ type: 'game_rematch', agree: true });
        h.api.rematch_agree();
        resolve_run();
        await tick();
        await tick();
        ok('重复触发只开一局', h.state.run_calls === 1, String(h.state.run_calls));
    }

    console.log('\n[3] 交换先手 / 保持阵营（双方互补）');
    {
        // 同一局：A 黑方且先手，B 白方且后手
        const a = make_harness(block_src, { my_index: 0, first_index: 0 });
        const b = make_harness(block_src, { my_index: 1, first_index: 0 });
        const ca = a.api.next_config();
        const cb = b.api.next_config();
        ok('A 交换为先手为对方(foe)', ca.first === 'foe', ca.first);
        ok('B 交换为先手为自己(my)', cb.first === 'my', cb.first);
        ok('先手配置互补', ca.first !== cb.first);
        ok('A 保持黑方(my)', ca.color === 'my', ca.color);
        ok('B 保持白方(foe)', cb.color === 'foe', cb.color);
        ok('阵营配置互补', ca.color !== cb.color);
    }
    {
        // 另一局面：A 白方且先手，B 黑方且后手
        const a = make_harness(block_src, { my_index: 1, first_index: 1 });
        const b = make_harness(block_src, { my_index: 0, first_index: 1 });
        const ca = a.api.next_config();
        const cb = b.api.next_config();
        ok('A 交换为先手为对方', ca.first === 'foe', ca.first);
        ok('B 交换为先手为自己', cb.first === 'my', cb.first);
        ok('A 保持白方(foe)', ca.color === 'foe', ca.color);
        ok('B 保持黑方(my)', cb.color === 'my', cb.color);
    }

    // ---------- 4. 发布产物 ----------
    console.log('\n[4] 发布产物');
    for (const [name, src_path, built_path, must_have] of [
        ['online.min.js', online_path, online_built, ['game_rematch', '接受重赛', '等待对方接受']],
        ['match-game.min.js', match_path, match_built, []]
    ]) {
        ok(`${name} 存在`, fs.existsSync(built_path));
        if (!fs.existsSync(built_path)) continue;
        const built = fs.readFileSync(built_path, 'utf8');
        for (const marker of must_have) ok(`${name} 含 ${marker}`, built.includes(marker));
        ok(`${name} 不早于源码（已重建）`, fs.statSync(built_path).mtimeMs >= fs.statSync(src_path).mtimeMs);
        let syntax_ok = true, syntax_err = '';
        try { new Function(built); } catch (error) { syntax_ok = false; syntax_err = error.message; }
        ok(`${name} 语法有效`, syntax_ok, syntax_err);
    }
    ok('match-game.min.js 不含 contest_refresh_first', fs.readFileSync(match_built, 'utf8').includes('contest_refresh_first') === false);

    console.log(failed === 0 ? '\ncontest-rematch-rotation: ALL PASS' : `\n失败 ${failed} 项`);
    process.exit(failed === 0 ? 0 : 1);
})();
