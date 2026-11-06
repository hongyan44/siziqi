/*
 * @Description: 成就规则回归测试（目录/稀有度/解锁阈值/进度不封顶/残局去重/登录门禁）
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ===== 浏览器环境桩 =====
const storage = new Map();
const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
};

const create_element = () => {
    const node = {
        'className': '',
        'id': '',
        'name': '',
        'textContent': '',
        'innerHTML': '',
        'style': {},
        'classList': { add() { }, remove() { }, toggle() { }, contains: () => false },
        'append': () => { },
        'appendChild': () => { },
        'addEventListener': () => { },
        'remove': () => { },
    };
    return node;
};

const document = {
    'head': { 'appendChild': () => { } },
    'body': { 'appendChild': () => { } },
    'getElementById': () => null,
    'createElement': create_element,
};

const window = {};
window.get_token = () => 'token';
window.http_user_info = async () => ({ 'uuid': 'u1' });
window.http_user_stats_update = async () => true;

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'ref', 'achievement.cjs'), 'utf8');
new Function('window', 'localStorage', 'document', 'requestAnimationFrame', 'setTimeout', source)(
    window, localStorage, document, () => { }, () => { }
);

const run = async () => {
    // 1. 目录完整性
    const catalog = window.achievement_catalog();
    assert.strictEqual(catalog.length, 32, '应登记 32 个成就');
    assert.deepStrictEqual(catalog.map((item) => item.id), [
        'kindred', 'craftsman', 'first_win', 'endgame_rookie',
        'endgame_expert', 'endgame_master',
        'ten_wins', 'hundred_wins', 'master', 'ai_master',
        'fast_win', 'fast_loss',
        'black_school', 'saved_faith', 'red_school', 'terminal_desire',
        'precise_elegant', 'board_full',
        'speed_win', 'speed_blitz', 'owed_blood',
        'nuke_rookie', 'nuke_adept', 'nuke_master',
        'one_hp_win', 'grass_expansion', 'grass_overload',
        'projection', 'woven_projection',
        'slay_deity', 'burn_civilization', 'erase_light',
    ]);
    const rarities = catalog.map((item) => item.rarity);
    assert.ok(rarities.every((rarity) => ['bronze', 'silver', 'gold', 'diamond'].includes(rarity)), '稀有度必须为四档');
    assert.strictEqual(new Set(catalog.map((item) => item.art)).size, 32, '每个成就必须有独立插画');
    assert.strictEqual(catalog.find((item) => item.id === 'precise_elegant').name, '精准且优雅');
    assert.ok(catalog.find((item) => item.id === 'precise_elegant').desc.includes('场上没有剩下己方棋子'), '精准且优雅应描述己方空场条件');
    assert.ok(catalog.find((item) => item.id === 'red_school').desc.includes('连续进攻两手棋'), '红派应描述连续进攻两手棋');
    assert.ok(catalog.find((item) => item.id === 'terminal_desire').desc.includes('连续进攻三手棋'), '终结的渴望应描述连续进攻三手棋');
    assert.strictEqual(catalog.find((item) => item.id === 'endgame_expert').rarity, 'silver');
    assert.strictEqual(catalog.find((item) => item.id === 'endgame_master').rarity, 'gold');
    assert.strictEqual(catalog.find((item) => item.id === 'fast_win').name, '快棋手');
    assert.strictEqual(catalog.find((item) => item.id === 'fast_loss').name, '快棋苦手');
    assert.deepStrictEqual(
        catalog.filter((item) => item.rarity === 'silver').map((item) => item.id),
        ['endgame_expert', 'ten_wins', 'fast_win', 'black_school', 'red_school', 'speed_win', 'nuke_adept', 'one_hp_win', 'woven_projection']
    );
    assert.deepStrictEqual(
        catalog.filter((item) => item.rarity === 'gold').map((item) => item.id),
        ['endgame_master', 'hundred_wins', 'master', 'ai_master', 'saved_faith', 'terminal_desire', 'precise_elegant', 'board_full', 'speed_blitz', 'owed_blood', 'nuke_master', 'grass_expansion', 'grass_overload']
    );
    assert.deepStrictEqual(await window.achievement_progress('endgame_expert'), { 'current': 0, 'goal': 10 });
    assert.deepStrictEqual(await window.achievement_progress('endgame_master'), { 'current': 0, 'goal': 100 });
    assert.strictEqual(catalog.find((item) => item.id === 'board_full').name, '填棋盘的胜利');
    assert.strictEqual(catalog.find((item) => item.id === 'board_full').rarity, 'gold');
    assert.ok(catalog.find((item) => item.id === 'board_full').desc.includes('填满棋盘'), '填棋盘的胜利应描述填满棋盘条件');
    assert.strictEqual(catalog.find((item) => item.id === 'speed_win').name, '必胜的速度');
    assert.strictEqual(catalog.find((item) => item.id === 'speed_win').rarity, 'silver');
    assert.ok(catalog.find((item) => item.id === 'speed_win').desc.includes('50 回合内'), '必胜的速度应描述 50 回合内取胜');
    assert.strictEqual(catalog.find((item) => item.id === 'speed_blitz').name, '必胜的神速');
    assert.strictEqual(catalog.find((item) => item.id === 'speed_blitz').rarity, 'gold');
    assert.ok(catalog.find((item) => item.id === 'speed_blitz').desc.includes('30 回合内'), '必胜的神速应描述 30 回合内取胜');
    assert.strictEqual(catalog.find((item) => item.id === 'owed_blood').name, '你还欠我管血');
    assert.strictEqual(catalog.find((item) => item.id === 'owed_blood').rarity, 'gold');
    assert.ok(catalog.find((item) => item.id === 'owed_blood').desc.includes('-6'), '你还欠我管血应描述对手血量不高于 -6');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_rookie').name, '爆破新手');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_rookie').rarity, 'bronze');
    assert.ok(catalog.find((item) => item.id === 'nuke_rookie').desc.includes('7 子'), '爆破新手应描述 7 子以上核弹');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_adept').name, '爆破高手');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_adept').rarity, 'silver');
    assert.ok(catalog.find((item) => item.id === 'nuke_adept').desc.includes('12 子'), '爆破高手应描述 12 子以上核弹');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_master').name, '爆破大师');
    assert.strictEqual(catalog.find((item) => item.id === 'nuke_master').rarity, 'gold');
    assert.ok(catalog.find((item) => item.id === 'nuke_master').desc.includes('18 子'), '爆破大师应描述 18 子以上核弹');
    assert.strictEqual(catalog.find((item) => item.id === 'projection').name, '投影');
    assert.ok(catalog.find((item) => item.id === 'projection').desc.includes('首次购买装扮'), '投影应描述首次购买装扮');
    assert.strictEqual(catalog.find((item) => item.id === 'woven_projection').name, '交织的投影');
    assert.ok(catalog.find((item) => item.id === 'woven_projection').desc.includes('购买 3 种装扮'), '交织的投影应描述购买 3 种装扮');
    assert.deepStrictEqual(await window.achievement_progress('woven_projection'), { 'current': 0, 'goal': 3 });

    // 2. 未登录时不记录
    window.get_token = () => null;
    await window.achievement_event('online_win');
    assert.deepStrictEqual(await window.achievement_records(), {}, '未登录不应获得成就');
    assert.strictEqual((await window.achievement_stats()).online_wins, 0, '未登录不应累计胜场');
    window.get_token = () => 'token';

    // 3. 首次进入真人对局
    await window.achievement_event('online_enter');
    assert.ok((await window.achievement_records()).kindred > 0, '志同道合应解锁');

    // 4. 首次真人对局胜利 + 第 10 胜解锁十次
    for (let index = 0; index < 9; index += 1) await window.achievement_event('online_win');
    assert.ok((await window.achievement_records()).first_win > 0, '首次应解锁');
    assert.ok(!(await window.achievement_records()).ten_wins, '第 9 胜不应解锁十次');
    await window.achievement_event('online_win');
    assert.ok((await window.achievement_records()).ten_wins > 0, '第 10 胜应解锁十次');
    assert.deepStrictEqual(await window.achievement_progress('ten_wins'), { 'current': 10, 'goal': 10 });

    // 5. 第 500 胜一次补齐百次与大师；进度达成后不封顶
    const stats_key = [...storage.keys()].find((key) => key.startsWith('achievement_stats:'));
    assert.ok(stats_key, '应存在成就统计存储');
    const stats = JSON.parse(storage.get(stats_key));
    stats.online_wins = 499;
    storage.set(stats_key, JSON.stringify(stats));
    await window.achievement_event('online_win');
    const records = await window.achievement_records();
    assert.ok(records.hundred_wins > 0, '百次应解锁');
    assert.ok(records.master > 0, '大师应解锁');
    assert.deepStrictEqual(await window.achievement_progress('ten_wins'), { 'current': 500, 'goal': 10 }, '达成后应继续展示实际次数');
    assert.deepStrictEqual(await window.achievement_progress('hundred_wins'), { 'current': 500, 'goal': 100 }, '百次进度不封顶');
    assert.deepStrictEqual(await window.achievement_progress('master'), { 'current': 500, 'goal': 500 }, '大师进度应存在');

    // 6. AI 胜利：入门难度不计入简单及以上
    await window.achievement_event('ai_win', { 'easy_or_above': false });
    let ai_stats = await window.achievement_stats();
    assert.ok((await window.achievement_records()).craftsman > 0, '能工智人应解锁');
    assert.strictEqual(ai_stats.ai_wins, 1);
    assert.strictEqual(ai_stats.ai_easy_wins, 0, '入门难度不计入简单及以上');

    // 7. 简单及以上 100 胜解锁 AI 掌控者
    ai_stats.ai_easy_wins = 99;
    storage.set(stats_key, JSON.stringify(ai_stats));
    await window.achievement_event('ai_win', { 'easy_or_above': true });
    assert.ok((await window.achievement_records()).ai_master > 0, 'AI掌控者应解锁');
    assert.strictEqual((await window.achievement_stats()).ai_easy_wins, 100);
    assert.deepStrictEqual(await window.achievement_progress('ai_master'), { 'current': 100, 'goal': 100 }, 'AI掌控者进度应存在');

    // 8. 残局首胜
    await window.achievement_event('endgame_win');
    assert.ok((await window.achievement_records()).endgame_rookie > 0, '残局新手应解锁');

    // 9. 不同残局去重：同一残局重复破解只计一次
    for (let index = 1; index <= 9; index += 1) await window.achievement_event('endgame_win', { 'endgame_id': `e${index}` });
    assert.deepStrictEqual(await window.achievement_progress('endgame_expert'), { 'current': 9, 'goal': 10 });
    assert.ok(!(await window.achievement_records()).endgame_expert, '第 9 个不同残局不应解锁残局高手');
    await window.achievement_event('endgame_win', { 'endgame_id': 'e1' });
    assert.deepStrictEqual(await window.achievement_progress('endgame_expert'), { 'current': 9, 'goal': 10 }, '重复残局不应累计');
    await window.achievement_event('endgame_win', { 'endgame_id': 'e10' });
    assert.ok((await window.achievement_records()).endgame_expert > 0, '第 10 个不同残局应解锁残局高手');

    // 10. 累计到 100 个不同残局解锁残局大师，达成后进度不封顶
    for (let index = 11; index <= 100; index += 1) await window.achievement_event('endgame_win', { 'endgame_id': `e${index}` });
    assert.ok((await window.achievement_records()).endgame_master > 0, '第 100 个不同残局应解锁残局大师');
    assert.deepStrictEqual(await window.achievement_progress('endgame_master'), { 'current': 100, 'goal': 100 });
    await window.achievement_event('endgame_win', { 'endgame_id': 'e1' });
    assert.deepStrictEqual(await window.achievement_progress('endgame_master'), { 'current': 100, 'goal': 100 }, '重复残局不增加不同残局数');
    assert.strictEqual((await window.achievement_stats()).endgame_wins, 103, '总残局胜场照常累计');

    // 11. 已解锁成就不会重复记录时间
    const before = (await window.achievement_records()).first_win;
    await window.achievement_event('online_win');
    assert.strictEqual((await window.achievement_records()).first_win, before, '已解锁成就时间不应被覆盖');

    // 12. 快棋成就：快棋苦手与快棋手各自独立解锁，重复触发不覆盖时间
    await window.achievement_event('fast_loss');
    assert.ok((await window.achievement_records()).fast_loss > 0, '快棋苦手应解锁');
    assert.ok(!(await window.achievement_records()).fast_win, '快棋苦手不应连带解锁快棋手');
    await window.achievement_event('fast_win');
    assert.ok((await window.achievement_records()).fast_win > 0, '快棋手应解锁');
    const fast_before = (await window.achievement_records()).fast_win;
    await window.achievement_event('fast_win');
    assert.strictEqual((await window.achievement_records()).fast_win, fast_before, '已解锁快棋手时间不应被覆盖');

    // 12.5 速胜成就：50 回合内解锁银档，30 回合内解锁金档；缺回合明细不解锁
    assert.ok(!(await window.achievement_records()).speed_win, '默认不应解锁必胜的速度');
    await window.achievement_event('online_win', { 'turn_count': 51, 'attack_turns': [] });
    assert.ok(!(await window.achievement_records()).speed_win, '51 回合不应解锁必胜的速度');
    assert.ok(!(await window.achievement_records()).speed_blitz, '51 回合不应解锁必胜的神速');
    await window.achievement_event('online_win', { 'turn_count': 50, 'attack_turns': [] });
    assert.ok((await window.achievement_records()).speed_win > 0, '50 回合应解锁必胜的速度');
    assert.ok(!(await window.achievement_records()).speed_blitz, '50 回合不应解锁必胜的神速');
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'turn_count': 30, 'attack_turns': [] });
    assert.ok((await window.achievement_records()).speed_blitz > 0, '30 回合应解锁必胜的神速（人机同样计入）');
    const speed_before = (await window.achievement_records()).speed_win;
    await window.achievement_event('online_win', { 'turn_count': 18, 'attack_turns': [] });
    assert.strictEqual((await window.achievement_records()).speed_win, speed_before, '已解锁成就时间不应被覆盖');

    // 13. 黑派：未满 100 回合不解锁，满 100 回合解锁
    await window.achievement_event('online_win', { 'turn_count': 99, 'attack_turns': [] });
    assert.ok(!(await window.achievement_records()).black_school, '99 回合不应解锁黑派');
    await window.achievement_event('online_win', { 'turn_count': 100, 'attack_turns': [] });
    assert.ok((await window.achievement_records()).black_school > 0, '100 回合应解锁黑派');
    assert.ok(!(await window.achievement_records()).saved_faith, '100 回合不应解锁保存的信念');

    // 14. 保存的信念：120 回合解锁（同时满足黑派）
    await window.achievement_event('online_win', { 'turn_count': 120, 'attack_turns': [] });
    assert.ok((await window.achievement_records()).saved_faith > 0, '120 回合应解锁保存的信念');
    assert.ok(!(await window.achievement_records()).red_school, '无进攻不应解锁红派');

    // 15. 红派：连续两个本方回合都发起进攻；中间隔一手安静棋不算
    await window.achievement_event('online_win', { 'turn_count': 40, 'attack_turns': [10, 14] });
    assert.ok(!(await window.achievement_records()).red_school, '中间隔一手不应解锁红派');
    await window.achievement_event('online_win', { 'turn_count': 40, 'attack_turns': [10, 12] });
    assert.ok((await window.achievement_records()).red_school > 0, '连续两手进攻应解锁红派');
    assert.ok(!(await window.achievement_records()).terminal_desire, '连续两手进攻不应解锁终结的渴望');

    // 16. 终结的渴望：连续三个本方回合都发起进攻
    await window.achievement_event('online_win', { 'turn_count': 40, 'attack_turns': [10, 12, 16] });
    assert.ok(!(await window.achievement_records()).terminal_desire, '第三手断开不应解锁终结的渴望');
    await window.achievement_event('ai_win', {
        'easy_or_above': false,
        'turn_count': 30,
        'attack_turns': [10, 12, 14],
    });
    assert.ok((await window.achievement_records()).terminal_desire > 0, '连续三手进攻应解锁终结的渴望（人机同样计入）');

    // 17. 缺少回合/进攻明细（如对方逃跑判胜）不解锁风格成就
    const before_red = (await window.achievement_records()).red_school;
    await window.achievement_event('online_win');
    assert.strictEqual((await window.achievement_records()).red_school, before_red, '缺明细不应改写已解锁记录');

    // 18. 精准且优雅：仅在获胜时场上没有剩下己方棋子解锁；人机胜利同样计入
    assert.ok(!(await window.achievement_records()).precise_elegant, '默认不应解锁精准且优雅');
    await window.achievement_event('online_win', { 'turn_count': 20, 'attack_turns': [], 'own_board_empty': false });
    assert.ok(!(await window.achievement_records()).precise_elegant, '己方仍有棋子不应解锁');
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'own_board_empty': true });
    assert.ok((await window.achievement_records()).precise_elegant > 0, '己方空场获胜应解锁精准且优雅');
    const precise_before = (await window.achievement_records()).precise_elegant;
    await window.achievement_event('online_win', { 'turn_count': 20, 'attack_turns': [], 'own_board_empty': true });
    assert.strictEqual((await window.achievement_records()).precise_elegant, precise_before, '已解锁成就时间不应被覆盖');
    await window.achievement_event('ai_game', { 'own_board_empty': true });
    assert.strictEqual((await window.achievement_records()).precise_elegant, precise_before, 'AI 败局不应解锁');

    // 18.5 填棋盘的胜利：仅在获胜时棋盘已填满解锁；人机胜利同样计入
    assert.ok(!(await window.achievement_records()).board_full, '默认不应解锁填棋盘的胜利');
    await window.achievement_event('online_win', { 'turn_count': 81, 'attack_turns': [], 'board_full': false });
    assert.ok(!(await window.achievement_records()).board_full, '棋盘未填满不应解锁');
    await window.achievement_event('online_win', { 'turn_count': 81, 'attack_turns': [], 'board_full': true });
    assert.ok((await window.achievement_records()).board_full > 0, '填满棋盘获胜应解锁填棋盘的胜利');
    const full_before = (await window.achievement_records()).board_full;
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'board_full': true });
    assert.strictEqual((await window.achievement_records()).board_full, full_before, '已解锁成就时间不应被覆盖');
    await window.achievement_event('ai_game', { 'board_full': true });
    assert.strictEqual((await window.achievement_records()).board_full, full_before, 'AI 败局不应解锁填棋盘的胜利');

    // 18.6 你还欠我管血：结算后对手血量不高于 -6 解锁；人机胜利同样计入
    assert.ok(!(await window.achievement_records()).owed_blood, '默认不应解锁你还欠我管血');
    await window.achievement_event('online_win', { 'turn_count': 81, 'attack_turns': [], 'foe_hp': -5 });
    assert.ok(!(await window.achievement_records()).owed_blood, '对手血量 -5 不应解锁');
    await window.achievement_event('online_win', { 'turn_count': 81, 'attack_turns': [], 'foe_hp': -6 });
    assert.ok((await window.achievement_records()).owed_blood > 0, '对手血量不高于 -6 应解锁你还欠我管血');
    const owed_before = (await window.achievement_records()).owed_blood;
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'foe_hp': -20 });
    assert.strictEqual((await window.achievement_records()).owed_blood, owed_before, '已解锁成就时间不应被覆盖');
    await window.achievement_event('ai_game', { 'foe_hp': -20 });
    assert.strictEqual((await window.achievement_records()).owed_blood, owed_before, 'AI 败局不应解锁你还欠我管血');

    // 18.7 爆破成就：按单次升变的核弹规模分档解锁，与胜负无关
    assert.ok(!(await window.achievement_records()).nuke_rookie, '默认不应解锁爆破新手');
    await window.achievement_event('nuke_launch', { 'size': 6 });
    assert.ok(!(await window.achievement_records()).nuke_rookie, '6 子不应解锁爆破新手');
    await window.achievement_event('nuke_launch', { 'size': 7 });
    assert.ok((await window.achievement_records()).nuke_rookie > 0, '7 子应解锁爆破新手');
    assert.ok(!(await window.achievement_records()).nuke_adept, '7 子不应解锁爆破高手');
    await window.achievement_event('nuke_launch', { 'size': 12 });
    assert.ok((await window.achievement_records()).nuke_adept > 0, '12 子应解锁爆破高手');
    assert.ok(!(await window.achievement_records()).nuke_master, '12 子不应解锁爆破大师');
    await window.achievement_event('nuke_launch', { 'size': 18 });
    assert.ok((await window.achievement_records()).nuke_master > 0, '18 子应解锁爆破大师');
    const nuke_before = (await window.achievement_records()).nuke_master;
    await window.achievement_event('nuke_launch', { 'size': 20 });
    assert.strictEqual((await window.achievement_records()).nuke_master, nuke_before, '已解锁成就时间不应被覆盖');
    await window.achievement_event('nuke_launch');
    assert.strictEqual((await window.achievement_records()).nuke_master, nuke_before, '缺规模明细不应改写爆破记录');

    // 18.8 命悬一线：获胜时己方血量恰好为 1 解锁；2 点血不解锁，人机 / 残局同样计入
    assert.ok(!(await window.achievement_records()).one_hp_win, '默认不应解锁命悬一线');
    await window.achievement_event('online_win', { 'own_hp': 2 });
    assert.ok(!(await window.achievement_records()).one_hp_win, '2 点血不应解锁命悬一线');
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'own_hp': 1 });
    assert.ok((await window.achievement_records()).one_hp_win > 0, '1 点血获胜应解锁命悬一线（人机同样计入）');
    const one_hp_before = (await window.achievement_records()).one_hp_win;
    await window.achievement_event('endgame_win', { 'endgame_id': 'hp1', 'own_hp': 1 });
    assert.strictEqual((await window.achievement_records()).one_hp_win, one_hp_before, '已解锁成就时间不应被覆盖');

    // 18.9 草神系列：一次攻击消耗 10 颗草解锁过载；全部棋子双草解锁膨胀；空攻击不解锁
    assert.ok(!(await window.achievement_records()).grass_overload, '默认不应解锁草神的过载');
    assert.ok(!(await window.achievement_records()).grass_expansion, '默认不应解锁草神的膨胀');
    await window.achievement_event('grass_attack', { 'size': 4, 'grass': 9, 'all_double': false });
    assert.ok(!(await window.achievement_records()).grass_overload, '9 颗草不应解锁草神的过载');
    await window.achievement_event('grass_attack', { 'size': 0, 'grass': 0, 'all_double': true });
    assert.ok(!(await window.achievement_records()).grass_expansion, '空攻击不应解锁草神的膨胀');
    await window.achievement_event('grass_attack', { 'size': 4, 'grass': 10, 'all_double': false });
    assert.ok((await window.achievement_records()).grass_overload > 0, '10 颗草应解锁草神的过载');
    await window.achievement_event('grass_attack', { 'size': 4, 'grass': 4, 'all_double': false });
    assert.ok(!(await window.achievement_records()).grass_expansion, '非全双草不应解锁草神的膨胀');
    await window.achievement_event('grass_attack', { 'size': 4, 'grass': 8, 'all_double': true });
    assert.ok((await window.achievement_records()).grass_expansion > 0, '全部棋子双草应解锁草神的膨胀');
    const overload_before = (await window.achievement_records()).grass_overload;
    await window.achievement_event('grass_attack', { 'size': 4, 'grass': 11, 'all_double': false });
    assert.strictEqual((await window.achievement_records()).grass_overload, overload_before, '已解锁成就时间不应被覆盖');

    // 19. 装扮成就：按账号实际拥有的外观列表判定，拥有 1 种解锁「投影」，拥有 3 种解锁「交织的投影」，数量不随换设备回退
    await window.achievement_event('skin_owned', { 'skins': [] });
    assert.ok(!(await window.achievement_records()).projection, '未拥有装扮不应解锁投影');
    await window.achievement_event('skin_owned', { 'skins': ['piece'] });
    assert.ok((await window.achievement_records()).projection > 0, '拥有 1 种外观应解锁投影');
    assert.ok(!(await window.achievement_records()).woven_projection, '拥有 1 种外观不应解锁交织的投影');
    assert.deepStrictEqual(await window.achievement_progress('woven_projection'), { 'current': 1, 'goal': 3 });
    await window.achievement_event('skin_owned', { 'skins': ['piece', 'piece', 'grass'] });
    assert.deepStrictEqual(await window.achievement_progress('woven_projection'), { 'current': 2, 'goal': 3 }, '重复外观 id 只计 1 种');
    await window.achievement_event('skin_owned', { 'skins': ['piece', 'grass', 'theme'] });
    assert.ok((await window.achievement_records()).woven_projection > 0, '拥有 3 种外观应解锁交织的投影');
    assert.deepStrictEqual(await window.achievement_progress('woven_projection'), { 'current': 3, 'goal': 3 });
    await window.achievement_event('skin_owned', { 'skins': ['piece', 'grass'] });
    assert.strictEqual((await window.achievement_stats()).skins_owned, 3, '已拥有外观数量不应回退');

    // 20. 打开成就页等场景直接按服务端拥有列表同步，不再依赖购买动作
    window.http_user_info = async () => ({ 'uuid': 'u1', 'skins': ['piece', 'grass', 'board_gold', 'theme'] });
    await window.achievement_owned_skins_check();
    assert.strictEqual((await window.achievement_stats()).skins_owned, 4, '应按服务端拥有的外观列表统计');
    assert.ok((await window.achievement_records()).projection > 0);
    assert.ok((await window.achievement_records()).woven_projection > 0);

    // 21. 隐藏成就：击败指定选手（多身份 uuid 均计数；仅真人对局胜利触发）
    const su_jin = '019dc068-42a6-7000-8c75-5da387765b80';
    const su_jin_small = '019dc908-946c-7000-9bf3-8b1a60879da1';
    const hong_yan = '019dc06d-cd5f-7000-a68c-8d19a4a133fe';
    const hong_yan_dada = '019dd831-5f71-7000-876b-7aa22250fb50';
    const jue_xin = '019dc083-209c-7000-b9c1-74e63a305dd6';
    const hidden_ids = ['slay_deity', 'burn_civilization', 'erase_light'];

    assert.ok(hidden_ids.every((id) => catalog.find((item) => item.id === id).hidden), '三个隐藏成就必须标记 hidden');
    assert.strictEqual(catalog.filter((item) => !item.hidden).length, 29, '「所有成就」应只展示 29 个非隐藏成就');
    assert.deepStrictEqual(
        catalog.filter((item) => item.rarity === 'diamond').map((item) => item.id),
        hidden_ids,
        '钻石稀有度仅用于三个隐藏成就'
    );
    assert.ok(hidden_ids.every((id) => catalog.find((item) => item.id === id).rarity === 'diamond'), '三个隐藏成就必须为钻石稀有度');
    // 成就页必须提供钻石质感的卡片 / 详情 / 列表纹理样式（浅色 + 两套替换 UI）
    const page = fs.readFileSync(path.join(__dirname, '..', 'html', 'user', 'achievements.html'), 'utf8');
    ['achievement-card', 'achievement-detail-art', 'achievement-all-row'].forEach((name) => {
        assert.ok(page.includes(`.${name}.rarity-diamond`), `${name} 必须提供钻石稀有度样式`);
    });
    assert.ok(page.includes('html.theme-void .achievement-card.rarity-diamond'), '幽蓝时空主题需适配钻石稀有度');
    assert.ok(page.includes('html.theme-black .achievement-card.rarity-diamond'), '黑派主题需适配钻石稀有度');
    assert.ok(hidden_ids.every((id) => String(catalog.find((item) => item.id === id).desc).includes('水平较强')), '隐藏成就应使用社区强手描述');
    assert.deepStrictEqual(catalog.find((item) => item.id === 'slay_deity').foe_uuids, [su_jin, su_jin_small]);
    assert.deepStrictEqual(catalog.find((item) => item.id === 'burn_civilization').foe_uuids, [hong_yan, hong_yan_dada]);
    assert.deepStrictEqual(catalog.find((item) => item.id === 'erase_light').foe_uuids, [jue_xin]);

    assert.ok(!(await window.achievement_records()).slay_deity, '默认不应解锁击坠神明');
    // 未击败目标则不解锁，击败任意普通玩家也不解锁
    await window.achievement_event('online_win', { 'foe_uuid': '019dffff-ffff-7000-ffff-ffffffffffff' });
    assert.ok(!(await window.achievement_records()).slay_deity, '击败非目标选手不应解锁');
    // 苏瑾两个身份都算
    await window.achievement_event('online_win', { 'foe_uuid': su_jin_small });
    assert.ok((await window.achievement_records()).slay_deity > 0, '击败苏瑾小号应解锁击坠神明');
    assert.ok(!(await window.achievement_records()).burn_civilization, '不应连带解锁其他隐藏成就');
    const slay_before = (await window.achievement_records()).slay_deity;
    await window.achievement_event('online_win', { 'foe_uuid': su_jin });
    assert.strictEqual((await window.achievement_records()).slay_deity, slay_before, '已解锁隐藏成就时间不应被覆盖');
    // 红颜两个身份都算
    await window.achievement_event('online_win', { 'foe_uuid': hong_yan_dada });
    assert.ok((await window.achievement_records()).burn_civilization > 0, '击败红颜小号应解锁焚毁文明');
    await window.achievement_event('online_win', { 'foe_uuid': hong_yan });
    assert.ok((await window.achievement_records()).burn_civilization > 0);
    // 决心
    await window.achievement_event('online_win', { 'foe_uuid': jue_xin });
    assert.ok((await window.achievement_records()).erase_light > 0, '击败决心应解锁湮没光明');
    // 人机 / 残局不判定隐藏成就
    await window.achievement_event('ai_win', { 'easy_or_above': false, 'foe_uuid': su_jin });
    assert.ok(!(await window.achievement_records()).slay_deity || slay_before === (await window.achievement_records()).slay_deity, '人机对局不应影响隐藏成就');
    await window.achievement_event('endgame_win', { 'foe_uuid': hong_yan });
    assert.ok((await window.achievement_records()).burn_civilization > 0);

    // 冠军成就：钻石稀有度，历史记录自动同步为当前奖杯样式且保留获得时间
    assert.strictEqual(window.achievement_find('champion_614574a5').rarity, 'diamond', '冠军成就必须为钻石稀有度');
    assert.ok(page.includes('html.theme-void .achievement-card.champion'), '幽蓝时空主题需适配钻石冠军');
    assert.ok(page.includes('html.theme-black .achievement-card.champion'), '黑派主题需适配钻石冠军');
    const champion_id = 'champion_614574a5';
    const champion_time = 1700000000000;
    const records_before = JSON.parse(localStorage.getItem('achievement:u1') || '{}');
    records_before[champion_id] = {
        'time': champion_time,
        'name': '红颜杯——周赛：冠军',
        'desc': '赢得「红颜杯——周赛」决赛，夺得冠军',
        'rarity': 'gold',
        'icon': 'trophy',
        'art': '<svg>旧奖杯</svg>',
        'champion': true,
        'event': '红颜杯——周赛',
        'node': 'node_1791646923349',
    };
    localStorage.setItem('achievement:u1', JSON.stringify(records_before));
    const champion_item = (await window.achievement_list()).find((item) => item.id === champion_id);
    assert.strictEqual(champion_item.rarity, 'diamond', '冠军卡片必须按钻石渲染');
    assert.strictEqual(champion_item.time, champion_time, '同步奖杯时不得改动获得时间');
    assert.strictEqual(champion_item.art, window.achievement_find(champion_id).art, '冠军奖杯必须替换为当前发放样式');
    const champion_stored = JSON.parse(localStorage.getItem('achievement:u1'))[champion_id];
    assert.strictEqual(champion_stored.rarity, 'diamond', '冠军记录须回写钻石稀有度');
    assert.strictEqual(champion_stored.art, champion_item.art, '冠军记录须回写当前奖杯样式');
    assert.strictEqual(champion_stored.time, champion_time, '回写记录不得改动获得时间');

    console.log('成就规则回归测试通过（32 个成就 / 25 组断言）');
};

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
