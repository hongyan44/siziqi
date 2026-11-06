// 棋币 / 经验结算回归测试（在线对局与人机对战）
// 用法：bun tmp/ai-reward.cjs
// 规则：不足 1 分钟为快棋档——胜方与和棋 20，败方 1；其余时长按档位标准值（胜方双倍，人机向上取整），
//      排位棋币 ×3 / 经验 ×2、赛事棋币 ×5 / 经验 ×3 叠加在基础值之上。

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/**
 * @description: 对局时长 -> 在线对局基准值（向下取整）
 * @param {number} seconds
 * @return {number}
 */
const reward_base = (seconds) => {
    if (seconds < 60) return 0;
    if (seconds < 300) return 1 + Math.trunc((seconds - 60) * 6 / 239);
    if (seconds < 600) return 8 + Math.trunc((seconds - 300) * 2 / 299);
    if (seconds < 900) return 11 + Math.trunc((seconds - 600) * 3 / 299);
    return 15;
};

/**
 * @description: 对局时长 -> 人机对战标准值（向上取整）
 * @param {number} seconds
 * @return {number}
 */
const reward_base_up = (seconds) => {
    if (seconds < 60) return 0;
    if (seconds < 300) return 1 + Math.trunc(((seconds - 60) * 6 + 238) / 239);
    if (seconds < 600) return 8 + Math.trunc(((seconds - 300) * 2 + 298) / 299);
    if (seconds < 900) return 11 + Math.trunc(((seconds - 600) * 3 + 298) / 299);
    return 15;
};

/**
 * @description: 在线对局单方奖励（未乘模式倍率）
 * @param {number} seconds
 * @param {boolean} winner
 * @param {boolean} draw
 * @return {number}
 */
const online_reward = (seconds, winner, draw) => {
    if (seconds < 60) return draw ? 20 : (winner ? 20 : 1);
    const base = reward_base(seconds);
    return draw ? base : (winner ? base * 2 : base);
};

/**
 * @description: 人机对战单方奖励
 * @param {number} seconds
 * @param {boolean} win
 * @return {number}
 */
const ai_reward = (seconds, win) => {
    if (seconds < 60) return win ? 20 : 1;
    const base = reward_base_up(seconds);
    return win ? base * 2 : base;
};

let failed = 0;

/**
 * @description: 断言
 * @param {string} label
 * @param {*} actual
 * @param {*} expect
 * @return {void}
 */
const eq = (label, actual, expect) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expect);
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` != ${JSON.stringify(expect)}`}`);
};

// 档位边界与区间内向上取整
eq('0s', reward_base_up(0), 0);
eq('59s', reward_base_up(59), 0);
eq('60s', reward_base_up(60), 1);
eq('61s 向上取整', reward_base_up(61), 2);
eq('90s 向上取整', reward_base_up(90), 2);
eq('299s', reward_base_up(299), 7);
eq('300s', reward_base_up(300), 8);
eq('301s 向上取整', reward_base_up(301), 9);
eq('599s', reward_base_up(599), 10);
eq('600s', reward_base_up(600), 11);
eq('601s 向上取整', reward_base_up(601), 12);
eq('899s', reward_base_up(899), 14);
eq('900s', reward_base_up(900), 15);

// 人机：不足 1 分钟快捷奖励
eq('人机 0s 胜', ai_reward(0, true), 20);
eq('人机 59s 胜', ai_reward(59, true), 20);
eq('人机 0s 负', ai_reward(0, false), 1);
eq('人机 59s 负', ai_reward(59, false), 1);
eq('人机 60s 胜', ai_reward(60, true), 2);
eq('人机 60s 负', ai_reward(60, false), 1);
eq('人机 900s 胜', ai_reward(900, true), 30);

// 在线：不足 1 分钟快棋档（胜方与和棋 20，败方 1）
eq('在线 59s 胜', online_reward(59, true, false), 20);
eq('在线 59s 负', online_reward(59, false, false), 1);
eq('在线 59s 和', online_reward(59, false, true), 20);
eq('在线 60s 胜', online_reward(60, true, false), 2);
eq('在线 60s 负', online_reward(60, false, false), 1);
eq('在线 300s 胜', online_reward(300, true, false), 16);
eq('在线 900s 和', online_reward(900, false, true), 15);

// 模式倍率叠加：排位棋币 ×3 / 经验 ×2、赛事棋币 ×5 / 经验 ×3
eq('排位 30s 胜 棋币', online_reward(30, true, false) * 3, 60);
eq('排位 30s 胜 经验', online_reward(30, true, false) * 2, 40);
eq('排位 30s 负 棋币', online_reward(30, false, false) * 3, 3);
eq('排位 30s 负 经验', online_reward(30, false, false) * 2, 2);
eq('赛事 30s 胜 棋币', online_reward(30, true, false) * 5, 100);
eq('赛事 30s 胜 经验', online_reward(30, true, false) * 3, 60);
eq('赛事 30s 负 棋币', online_reward(30, false, false) * 5, 5);

// 静态接线：后端结算函数、前端请求与 AI 页面结算调用
const replay = read(path.join('..', '4ascend-online', 'src', 'api', 'http', 'Replay.cpp'));
const http = read('js/ref/http.cjs');
const ai = read('js/core/ai.cjs');
const online = read('js/core/online.cjs');
const ranked = read('js/core/ranked.cjs');
const shop = read('js/main/shop.cjs');

const check = (label, ok) => eq(label, Boolean(ok), true);

check('Replay.cpp 定义快棋档常量', replay.includes('FAST_REWARD_WIN') && replay.includes('FAST_REWARD_LOSE'));
check('Replay.cpp 定义在线快棋结算', replay.includes('int64_t online_reward('));
check('Replay.cpp 定义人机快棋结算', replay.includes('int64_t ai_reward('));
check('Replay.cpp 注册 /replay/ai_reward', replay.includes('"/replay/ai_reward"'));
check('Replay.cpp 人机按开局时间去重（无冷却）', replay.includes('json_i64(rjson, "time")') && replay.includes('claim_coin_match(uuid, "ai", match_time)'));
check('Replay.cpp 人机已移除 20 秒冷却', !replay.includes('timestamp_s() / 20') && !replay.includes('claim_coin_match(uuid, "ai", bucket)'));
check('Replay.cpp 在线按开局秒去重（无分钟冷却）', replay.includes('claim_coin_match(black_uuid, white_uuid, client_time)') && !replay.includes('client_time / 60'));
check('http.cjs 提供 http_ai_reward', http.includes('window.http_ai_reward'));
check('http.cjs 上报开局时间', http.includes('time: Math.max(0, Math.trunc(Number(time) || 0))'));
check('ai.cjs 调用 http_ai_reward', ai.includes('window.http_ai_reward'));
check('ai.cjs 上报开局时间', ai.includes('reward_ai(duration_s, my_wins, time)'));
check('ai.cjs 记录玩家胜负', ai.includes('my_wins = win === my_color'));
check('ai.cjs 触发快棋成就', ai.includes("'fast_win'") && ai.includes("'fast_loss'"));
check('online.cjs 触发快棋成就', online.includes("achievement_event('fast_win')") && online.includes("achievement_event('fast_loss')"));
check('ranked.cjs 触发快棋成就', ranked.includes("achievement_event('fast_win')") && ranked.includes("achievement_event('fast_loss')"));
check('商店收益规则含快棋奖励', shop.includes('快棋奖励'));
check('商店收益规则含人机对战', shop.includes("mode: '人机对战'"));

if (failed) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');
