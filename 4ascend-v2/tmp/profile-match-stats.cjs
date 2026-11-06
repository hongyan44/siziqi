/*
 * @Description: 账号资料累计对局统计回归测试
 *   1. 回放仍按玩家只保留最近 100 局
 *   2. 新增 player_stats 累计表，在线总场次 / 总胜场 / AI 总场次不受 100 局限制
 *   3. 双方重复上传同一局不重复计数
 *   4. 累计上限远高于 10000
 *   5. user_profile 用累计场次覆盖展示值，胜率仍按最近 100 场
 * 运行：node tmp/profile-match-stats.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const online = path.join(root, '..', '4ascend-online');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => fs.readFileSync(file, 'utf8');

// ---------- 1. 回放保留策略不变 ----------
const replay_h = read(path.join(online, 'src', 'manager', 'Replay.h'));
ok('回放仍按玩家保留最近 100 局', /MAX_PLAYER_REPLAYS = 100/.test(replay_h));
ok('累计上限常量存在', /MAX_STAT_GAMES = 1000000000/.test(replay_h));
const max_stat = Number((replay_h.match(/MAX_STAT_GAMES = (\d+)/) || [])[1] || 0);
ok('累计上限 > 10000', max_stat > 10000, `实际 ${max_stat}`);

// ---------- 2. 数据层 ----------
const replay_cpp = read(path.join(online, 'src', 'manager', 'Replay.cpp'));
ok('创建 player_stats 表', /CREATE TABLE IF NOT EXISTS player_stats/.test(replay_cpp));
ok('player_stats 含在线场次/胜场/AI 场次', /online_games[\s\S]{0,120}online_wins[\s\S]{0,120}ai_games/.test(replay_cpp));
ok('旧数据按保留回放补基线', /INSERT OR IGNORE INTO player_stats[\s\S]{0,500}FROM replay_players/.test(replay_cpp));
ok('新回放累加在线场次', /ON CONFLICT\(player_uuid\) DO UPDATE SET[\s\S]{0,160}online_games = MIN\(online_games \+ 1/.test(replay_cpp));
ok('胜场只给胜者累加', /const bool win = \(result == "A" && black_uuid == uuid\) \|\| \(result == "B" && white_uuid == uuid\)/.test(replay_cpp));
ok('仅新回放入库才累加', /if \(created\) \{[\s\S]{0,260}p_bump_player/.test(replay_cpp));
ok('AI 场次单独累加', /VALUES \(\?, 0, 0, 1\)[\s\S]{0,160}ai_games = MIN\(ai_games \+ 1/.test(replay_cpp));
ok('暴露累计统计读取', /bool stats_total\(std::string_view player, int64_t& games, int64_t& wins, int64_t& ai_games\) noexcept/.test(replay_cpp));
ok('暴露 AI 计数入口', /bool bump_ai_game\(std::string_view player\) noexcept/.test(replay_cpp));

// ---------- 3. 接口层 ----------
const replay_api = read(path.join(online, 'src', 'api', 'http', 'Replay.cpp'));
ok('上传回放接收 created 标记', /bool created = false;/.test(replay_api) && /created,\s*id\s*\)/.test(replay_api));
ok('人机结算累加 AI 场次', /replay_ai_reward[\s\S]{0,420}Manager::Replay::bump_ai_game\(uuid\)/.test(replay_api));

const user_api = read(path.join(online, 'src', 'api', 'http', 'User.cpp'));
ok('资料统计读取累计值', /Manager::Replay::stats_total\(uuid, total_games, total_wins, total_ai\)/.test(user_api));
ok('累计场次不小于最近 100 场', /total_games > retained_games \? total_games : retained_games/.test(user_api));
ok('AI 场次取服务端与客户端较大值', /if \(total_ai > ai_games\) ai_games = total_ai/.test(user_api));
ok('资料接口仍返回 real_games / real_wins / ai_games', /result\["real_games"\]/.test(user_api) && /result\["real_wins"\]/.test(user_api) && /result\["ai_games"\]/.test(user_api));
ok('资料接口返回胜率基数 recent_games / recent_wins', /result\["recent_games"\]/.test(user_api) && /result\["recent_wins"\]/.test(user_api));

// ---------- 4. 前端展示兼容 ----------
const friends = read(path.join(root, 'js', 'ref', 'friends.cjs'));
ok('账号资料展示累计账号对局', friends.includes("profile_row('账号对局'"));
ok('账号资料展示 AI 对局', friends.includes("profile_row('AI 对局'"));
ok('胜率仍标注近 100 场', friends.includes("profile_row('近100场胜率'"));
ok('胜率按 recent_games 计算而非累计场次', /recentGames = Number\(data\.recent_games/.test(friends) && /format_win_rate\(recentGames, wins\)/.test(friends));

if (failed > 0) {
    console.error(`\n${failed} 项断言失败`);
    process.exit(1);
}
console.log('\n全部断言通过');
