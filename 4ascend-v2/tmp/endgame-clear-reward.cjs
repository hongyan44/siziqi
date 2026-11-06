/*
 * 残局首次通关奖励回归测试
 * 运行： node tmp/endgame-clear-reward.cjs
 *
 * 覆盖点：
 *   1) puzzle_clears 的 (uuid, target, ref) 唯一约束：首次插入返回 1、重复返回 0；
 *   2) 不同账号、不同关卡、不同每日版本互相独立；
 *   3) 后端源码守卫：奖励常量 50/50、接口注册、关卡必须已发布、每日按 updated_at 去重；
 *   4) 前端源码守卫：仅在黑方获胜 + 已载入真实残局时领奖，并在结算弹窗展示奖励行。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const backend = path.resolve(root, '../4ascend-online');

const db = new DatabaseSync(':memory:');
db.exec(
    'CREATE TABLE puzzle_clears (' +
    'uuid TEXT NOT NULL, target TEXT NOT NULL, ref INTEGER NOT NULL, cleared_at INTEGER NOT NULL, ' +
    'PRIMARY KEY(uuid, target, ref)) STRICT'
);
const claim = db.prepare('INSERT OR IGNORE INTO puzzle_clears(uuid, target, ref, cleared_at) VALUES (?, ?, ?, ?)');

const first_clear = (uuid, target, ref, at = 1) => claim.run(uuid, target, ref, at).changes === 1;

// 1) 同一账号同一位置只算一次
assert.equal(first_clear('u1', 'level', 12), true, '首次通关应为 true');
assert.equal(first_clear('u1', 'level', 12), false, '重复通关应为 false');

// 2) 不同账号 / 不同关卡 / 不同每日版本互相独立
assert.equal(first_clear('u2', 'level', 12), true, '另一个账号应能领奖');
assert.equal(first_clear('u1', 'level', 13), true, '不同关卡应能领奖');
assert.equal(first_clear('u1', 'daily', 1000), true, '每日首次应能领奖');
assert.equal(first_clear('u1', 'daily', 1000), false, '同一每日版本重复应为 false');
assert.equal(first_clear('u1', 'daily', 2000), true, '每日换题后应能再次领奖');
assert.equal(first_clear('u1', 'level', 12, 2), false, '重复插入不应覆盖原记录');

const rows = db.prepare('SELECT COUNT(*) AS n FROM puzzle_clears').get();
assert.equal(rows.n, 5, '应只保留 5 条唯一通关记录');

// 2.1) 玩家资料计数：不同残局数按 uuid 统计
const count = db.prepare('SELECT COUNT(*) AS n FROM puzzle_clears WHERE uuid = ?');
assert.equal(count.get('u1').n, 4, 'u1 应破解 4 个不同残局');
assert.equal(count.get('u2').n, 1, 'u2 应破解 1 个不同残局');
assert.equal(count.get('u3').n, 0, '无通关记录应为 0');

// 3) 后端源码守卫
const manager = fs.readFileSync(path.join(backend, 'src/manager/Puzzle.cpp'), 'utf8');
assert.match(manager, /INSERT OR IGNORE INTO puzzle_clears/, '缺少去重插入语句');
assert.match(manager, /PRIMARY KEY\(uuid, target, ref\)/, '缺少唯一约束');
assert.match(manager, /SELECT COUNT\(\*\) FROM puzzle_clears WHERE uuid = \?/, '缺少破解残局数统计语句');
assert.match(manager, /bool count_clears\(std::string_view uuid, int64_t& count\)/, '缺少 count_clears 实现');

const puzzle_h = fs.readFileSync(path.join(backend, 'src/manager/Puzzle.h'), 'utf8');
assert.match(puzzle_h, /bool count_clears\(std::string_view uuid, int64_t& count\) noexcept;/, '头文件缺少 count_clears 声明');

const user_api = fs.readFileSync(path.join(backend, 'src/api/http/User.cpp'), 'utf8');
assert.match(user_api, /Manager::Puzzle::count_clears\(uuid, puzzle_clears\)/, '玩家资料接口未统计破解残局数');
assert.match(user_api, /result\["puzzle_clears"\] = puzzle_clears;/, '玩家资料接口未回传 puzzle_clears');

const api = fs.readFileSync(path.join(backend, 'src/api/http/Puzzle.cpp'), 'utf8');
assert.match(api, /constexpr int64_t reward_coin = 50;/, '棋币奖励应为 50');
assert.match(api, /constexpr int64_t reward_exp  = 50;/, '经验奖励应为 50');
assert.match(api, /"\/puzzle\/claim_clear"/, '缺少领奖接口注册');
assert.match(api, /ref = static_cast<int64_t>\(daily\.updated_at\);/, '每日应以版本号去重');
assert.match(api, /published = true;/, '关卡领奖前必须校验已发布');

// 4) 前端源码守卫
const wrapper = fs.readFileSync(path.join(root, 'js/ref/http.cjs'), 'utf8');
assert.match(wrapper, /window\.http_puzzle_claim_clear = async/, '缺少前端领奖封装');

const friends = fs.readFileSync(path.join(root, 'js/ref/friends.cjs'), 'utf8');
assert.match(friends, /profile_row\('破解残局数'/, '玩家资料卡缺少破解残局数');
assert.match(friends, /Number\(data\.puzzle_clears\) \|\| 0/, '破解残局数应读取 puzzle_clears');

const page = fs.readFileSync(path.join(root, 'html/endgame/challenge.html'), 'utf8');
assert.match(page, /if \(playerWon\) claimClearReward\(\);/, '只应在获胜后领奖');
assert.match(page, /!token \|\| !importedArchive/, '未登录或非真实残局时不应领奖');
assert.match(page, /id='challenge_result_reward'/, '结算弹窗缺少奖励展示行');
assert.match(page, /target === 'level' \? challengeLevel : 0/, '领奖参数应区分关卡与每日挑战');

console.log('endgame-clear-reward: all assertions passed');
