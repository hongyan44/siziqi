/*
 * 好友赠礼（500 棋币）回归测试（SQLite 语义层）。
 * 运行： bun tmp/gift-voucher-regression.cjs
 *
 * 覆盖后端实际使用的 SQL 与日序号逻辑：
 * 1) 每日限购：`gift_coin_500_day <> ?` 条件 UPDATE 同一天只能成功一次，次日恢复；
 * 2) 扣币原子性：`coin >= price` 不足时不扣币、不增礼物；
 * 3) 赠送：事务内先扣自己 1 个礼物，再给对方 `voucher_coin_500 + 1`，数量不会为负；
 * 4) 东八区日序号按自然日切换（23:30 与次日 00:30 属于不同天）。
 */

const assert = require('node:assert/strict');
const { Database } = require('bun:sqlite');

const db = new Database(':memory:');

db.exec(`CREATE TABLE users (
    uuid TEXT PRIMARY KEY,
    coin INTEGER NOT NULL DEFAULT 0,
    voucher_coin INTEGER NOT NULL DEFAULT 0,
    voucher_coin_500 INTEGER NOT NULL DEFAULT 0,
    gift_coin_500 INTEGER NOT NULL DEFAULT 0,
    gift_coin_500_day INTEGER NOT NULL DEFAULT 0,
    gift_coin_3000 INTEGER NOT NULL DEFAULT 0,
    gift_coin_3000_week INTEGER NOT NULL DEFAULT 0
) STRICT`);

db.query('INSERT INTO users (uuid, coin, voucher_coin_500, gift_coin_500, gift_coin_500_day) VALUES (?, ?, ?, ?, ?)').run('u1', 1000, 0, 0, 0);
db.query('INSERT INTO users (uuid, coin, voucher_coin_500, gift_coin_500, gift_coin_500_day) VALUES (?, ?, ?, ?, ?)').run('u2', 0, 0, 0, 0);

const wallet = (uuid) => db.query('SELECT coin, voucher_coin_500, gift_coin_500, gift_coin_500_day FROM users WHERE uuid = ?').get(uuid);

const DAY_1 = 1000;
const DAY_2 = 1001;

const buy = db.query(
    'UPDATE users SET coin = coin - ?, gift_coin_500 = gift_coin_500 + 1, gift_coin_500_day = ? WHERE uuid = ? AND coin >= ? AND gift_coin_500_day <> ?'
);

// 1) 首次购买成功：扣 500 棋币并存入 1 个赠礼
const first = buy.run(500, DAY_1, 'u1', 500, DAY_1);
assert.equal(first.changes, 1, '首次购买应成功');
assert.deepEqual(wallet('u1'), { coin: 500, voucher_coin_500: 0, gift_coin_500: 1, gift_coin_500_day: DAY_1 }, '购买后应扣币并增加赠礼');

// 同一天再次购买被拒绝，余额与数量不变
const twice = buy.run(500, DAY_1, 'u1', 500, DAY_1);
assert.equal(twice.changes, 0, '同一天重复购买应被拒绝');
assert.deepEqual(wallet('u1'), { coin: 500, voucher_coin_500: 0, gift_coin_500: 1, gift_coin_500_day: DAY_1 }, '重复购买不应改变余额');

// 2) 次日可以再买一个：扣到 0 棋币，赠礼变 2
const next_day = buy.run(500, DAY_2, 'u1', 500, DAY_2);
assert.equal(next_day.changes, 1, '次日应可再次购买');
assert.deepEqual(wallet('u1'), { coin: 0, voucher_coin_500: 0, gift_coin_500: 2, gift_coin_500_day: DAY_2 }, '次日购买后棋币归零、赠礼为 2');

// 棋币不足时不扣币也不增礼物，且不消耗当日限购
const poor = buy.run(500, DAY_2, 'u1', 500, DAY_2);
assert.equal(poor.changes, 0, '棋币不足时不应购买成功');
assert.deepEqual(wallet('u1'), { coin: 0, voucher_coin_500: 0, gift_coin_500: 2, gift_coin_500_day: DAY_2 }, '棋币不足时数据不变');

// 3) 赠送：事务内扣自己 1 个并给对方加 1 张 500 棋币兑换券
const take = db.query('UPDATE users SET gift_coin_500 = gift_coin_500 - 1 WHERE uuid = ? AND gift_coin_500 >= 1');
const give = db.query('UPDATE users SET voucher_coin_500 = voucher_coin_500 + 1 WHERE uuid = ?');

db.exec('BEGIN IMMEDIATE TRANSACTION');
const take_1 = take.run('u1');
assert.equal(take_1.changes, 1, '有赠礼时应扣减成功');
const give_1 = give.run('u2');
assert.equal(give_1.changes, 1, '好友应获得 1 张兑换券');
db.exec('COMMIT');

assert.deepEqual(wallet('u1'), { coin: 0, voucher_coin_500: 0, gift_coin_500: 1, gift_coin_500_day: DAY_2 }, '送出后自己剩 1 个赠礼');
assert.deepEqual(wallet('u2'), { coin: 0, voucher_coin_500: 1, gift_coin_500: 0, gift_coin_500_day: 0 }, '好友背包应增加 1 张 500 棋币兑换券');

// 送完最后 1 个后无法再送（模拟第二次赠送的 ROLLBACK 分支）
db.exec('BEGIN IMMEDIATE TRANSACTION');
assert.equal(take.run('u1').changes, 1, '第二个赠礼应可送出');
assert.equal(give.run('u2').changes, 1, '好友应再次获得 1 张兑换券');
db.exec('COMMIT');
assert.equal(wallet('u1').gift_coin_500, 0, '赠礼送完后从背包移除');

db.exec('BEGIN IMMEDIATE TRANSACTION');
assert.equal(take.run('u1').changes, 0, '没有赠礼时扣减应失败');
db.exec('ROLLBACK');
assert.equal(wallet('u1').gift_coin_500, 0, '回滚后赠礼数量不变');
assert.equal(wallet('u2').voucher_coin_500, 2, '回滚后好友兑换券不变');

// 好友收到的兑换券可正常使用（复用现有 500 券使用 SQL）
const use_500 = db.query('UPDATE users SET coin = coin + ?, voucher_coin_500 = voucher_coin_500 - 1 WHERE uuid = ? AND voucher_coin_500 >= 1');
assert.equal(use_500.run(500, 'u2').changes, 1, '好友可使用兑换券');
assert.equal(wallet('u2').coin, 500, '使用兑换券应增加 500 棋币');
assert.equal(wallet('u2').voucher_coin_500, 1, '使用后兑换券剩 1 张');

// 4) 东八区日序号：与后端 day_index 公式一致
const day_index = (now_ms) => (now_ms <= 0 ? 0 : Math.floor((now_ms + 8 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000)));
const late_night = Date.UTC(2026, 9, 31, 15, 30) - 0; // 2026-10-31 23:30 东八区
const next_morning = Date.UTC(2026, 9, 31, 16, 30) - 0; // 2026-11-01 00:30 东八区
assert.equal(day_index(late_night), 20757, '23:30 仍属于当天');
assert.equal(day_index(next_morning), 20758, '00:30 已跨入次日');
assert.equal(day_index(late_night) + 1, day_index(next_morning), '跨零点后日序号 +1');

// 5) 3000 好友赠礼：每周限购 1 个，周一 0 点刷新（自然周序号 = (日序号 + 3) / 7）
const week_index = (now_ms) => Math.floor((day_index(now_ms) + 3) / 7);
const sunday_night = Date.UTC(2026, 10, 1, 15, 30); // 2026-11-01 23:30 东八区（周日）
const monday_morning = Date.UTC(2026, 10, 1, 16, 30); // 2026-11-02 00:30 东八区（周一）
assert.equal(week_index(sunday_night), 2965, '周日 23:30 仍属于上一自然周');
assert.equal(week_index(monday_morning), 2966, '周一 00:30 已跨入新一周');

const gift_3000 = (uuid) => db.query('SELECT coin, voucher_coin, gift_coin_3000, gift_coin_3000_week FROM users WHERE uuid = ?').get(uuid);
db.query('UPDATE users SET coin = 3000, gift_coin_3000 = 0, gift_coin_3000_week = 0 WHERE uuid = ?').run('u1');
db.query('UPDATE users SET coin = 0, voucher_coin = 0 WHERE uuid = ?').run('u2');

const WEEK_1 = week_index(monday_morning);
const WEEK_2 = WEEK_1 + 1;
const buy_3000 = db.query(
    'UPDATE users SET coin = coin - ?, gift_coin_3000 = gift_coin_3000 + 1, gift_coin_3000_week = ? WHERE uuid = ? AND coin >= ? AND gift_coin_3000_week <> ?'
);

// 首次购买成功
assert.equal(buy_3000.run(3000, WEEK_1, 'u1', 3000, WEEK_1).changes, 1, '3000 赠礼首次购买应成功');
assert.deepEqual(gift_3000('u1'), { coin: 0, voucher_coin: 0, gift_coin_3000: 1, gift_coin_3000_week: WEEK_1 }, '购买后应扣 3000 棋币并存入 1 个赠礼');

// 同一周再次购买被拒绝
assert.equal(buy_3000.run(3000, WEEK_1, 'u1', 3000, WEEK_1).changes, 0, '同一周重复购买应被拒绝');
assert.equal(gift_3000('u1').gift_coin_3000, 1, '同一周重复购买不增加赠礼');

// 棋盘不足时不扣币、不消耗本周限购
db.query('UPDATE users SET coin = 100 WHERE uuid = ?').run('u1');
assert.equal(buy_3000.run(3000, WEEK_2, 'u1', 3000, WEEK_2).changes, 0, '棋币不足时购买失败');
assert.equal(gift_3000('u1').coin, 100, '棋币不足时不扣币');
assert.equal(gift_3000('u1').gift_coin_3000_week, WEEK_1, '棋币不足不消耗新一周限购');

// 下一周可以再买一个
db.query('UPDATE users SET coin = 3000 WHERE uuid = ?').run('u1');
assert.equal(buy_3000.run(3000, WEEK_2, 'u1', 3000, WEEK_2).changes, 1, '新的一周应可再次购买');
assert.equal(gift_3000('u1').gift_coin_3000, 2, '新一周购买后赠礼为 2');

// 赠送 3000 赠礼：扣自己 1 个，好友获得 1 张 3000 棋币兑换券（voucher_coin）
const take_3000 = db.query('UPDATE users SET gift_coin_3000 = gift_coin_3000 - 1 WHERE uuid = ? AND gift_coin_3000 >= 1');
const give_3000 = db.query('UPDATE users SET voucher_coin = voucher_coin + 1 WHERE uuid = ?');
db.exec('BEGIN IMMEDIATE TRANSACTION');
assert.equal(take_3000.run('u1').changes, 1, '送出 3000 赠礼应扣减成功');
assert.equal(give_3000.run('u2').changes, 1, '好友应获得 3000 棋币兑换券');
db.exec('COMMIT');
assert.equal(gift_3000('u1').gift_coin_3000, 1, '送出后自己剩 1 个 3000 赠礼');
assert.equal(gift_3000('u2').voucher_coin, 1, '好友背包应增加 1 张 3000 棋币兑换券');

const use_3000 = db.query('UPDATE users SET coin = coin + ?, voucher_coin = voucher_coin - 1 WHERE uuid = ? AND voucher_coin >= 1');
assert.equal(use_3000.run(3000, 'u2').changes, 1, '好友可使用 3000 棋币兑换券');
assert.equal(gift_3000('u2').coin, 3000, '使用兑换券应增加 3000 棋币');

console.log('gift-voucher-regression: all assertions passed');
