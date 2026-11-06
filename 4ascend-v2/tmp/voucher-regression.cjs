/*
 * 3000 棋币兑换券回归测试（SQLite 语义层）。
 * 运行： bun tmp/voucher-regression.cjs
 *
 * 覆盖后端实际使用的三条 SQL：
 * 1) 兑换券增减：`voucher_coin = MAX(0, voucher_coin + ?)`，扣减不会出现负数；
 * 2) 使用兑换券：`coin = coin + ?` 与 `voucher_coin = voucher_coin - 1` 在同一条
 *    UPDATE 中原子执行，且仅当 `voucher_coin >= 1` 时才生效；
 * 3) 冠军领取幂等：`INSERT OR IGNORE INTO champion_claims` 同一决赛方块只成功一次。
 * 4) 500 棋币兑换券：残局投稿审核通过发放一张，使用时原子加棋币并扣券，数量不会为负。
 */

const assert = require('node:assert/strict');
const { Database } = require('bun:sqlite');

const db = new Database(':memory:');

db.exec(`CREATE TABLE users (
    uuid TEXT PRIMARY KEY,
    coin INTEGER NOT NULL DEFAULT 0,
    voucher_coin INTEGER NOT NULL DEFAULT 0,
    voucher_coin_500 INTEGER NOT NULL DEFAULT 0
) STRICT`);
db.exec(`CREATE TABLE champion_claims (node_id TEXT PRIMARY KEY) STRICT`);

db.query('INSERT INTO users (uuid, coin, voucher_coin, voucher_coin_500) VALUES (?, ?, ?, ?)').run('u1', 100, 2, 2);

const wallet = () => db.query('SELECT coin, voucher_coin, voucher_coin_500 FROM users WHERE uuid = ?').get('u1');

// 1) 增减兑换券：负数扣减压到 0
db.query('UPDATE users SET voucher_coin = MAX(0, voucher_coin + ?) WHERE uuid = ?').run(-5, 'u1');
assert.equal(wallet().voucher_coin, 0, '负增量不能把兑换券压到 0 以下');
db.query('UPDATE users SET voucher_coin = MAX(0, voucher_coin + ?) WHERE uuid = ?').run(1, 'u1');
assert.equal(wallet().voucher_coin, 1, '增加兑换券应生效');

// 2) 使用兑换券：原子加棋币并扣一张
const use_sql = 'UPDATE users SET coin = coin + ?, voucher_coin = voucher_coin - 1 WHERE uuid = ? AND voucher_coin >= 1';
const use = db.query(use_sql);

const first = use.run(3000, 'u1');
assert.equal(first.changes, 1, '有券时应成功使用');
assert.deepEqual(wallet(), { coin: 3100, voucher_coin: 0, voucher_coin_500: 2 }, '使用一张后应加 3000 棋币并扣掉 1 张');
const second = use.run(3000, 'u1');
assert.equal(second.changes, 0, '没有券时不应扣减或加币');
assert.deepEqual(wallet(), { coin: 3100, voucher_coin: 0, voucher_coin_500: 2 }, '无券时余额保持不变');

// 重复使用不会把 voucher_coin 减成负数
db.query('UPDATE users SET voucher_coin = MAX(0, voucher_coin + ?) WHERE uuid = ?').run(-1, 'u1');
assert.equal(wallet().voucher_coin, 0, '兑换券数量始终不为负');

// 4) 500 棋币兑换券：投稿审核通过发放 1 张，使用时原子加 500 棋币并扣券
db.query('UPDATE users SET voucher_coin_500 = MAX(0, voucher_coin_500 + ?) WHERE uuid = ?').run(1, 'u1');
assert.equal(wallet().voucher_coin_500, 3, '审核通过应发放一张 500 棋币兑换券');

const use_500 = db.query(
    'UPDATE users SET coin = coin + ?, voucher_coin_500 = voucher_coin_500 - 1 WHERE uuid = ? AND voucher_coin_500 >= 1'
);
const use_500_first = use_500.run(500, 'u1');
assert.equal(use_500_first.changes, 1, '有 500 券时应成功使用');
assert.deepEqual(wallet(), { coin: 3600, voucher_coin: 0, voucher_coin_500: 2 }, '使用一张后应加 500 棋币并扣掉 1 张');

// 券清零后再使用不会扣成负数，也不会凭空加币
db.query('UPDATE users SET voucher_coin_500 = MAX(0, voucher_coin_500 - ?) WHERE uuid = ?').run(5, 'u1');
assert.equal(wallet().voucher_coin_500, 0, '500 券数量始终不为负');
const use_500_empty = use_500.run(500, 'u1');
assert.equal(use_500_empty.changes, 0, '没有 500 券时不应扣减或加币');
assert.deepEqual(wallet(), { coin: 3600, voucher_coin: 0, voucher_coin_500: 0 }, '无 500 券时余额保持不变');

// 3) 冠军领取幂等
const claim = db.query('INSERT OR IGNORE INTO champion_claims (node_id) VALUES (?)');
assert.equal(claim.run('node_1001').changes, 1, '首次领取决赛奖励应成功');
assert.equal(claim.run('node_1001').changes, 0, '同一决赛方块重复领取应被拒绝');
assert.equal(claim.run('node_1002').changes, 1, '不同决赛方块可分别领取');

console.log('voucher-regression: all assertions passed');
