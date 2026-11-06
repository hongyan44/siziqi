// 每日任务回归测试（与服务端 manager/Task.cpp 保持一致）
// 用法：bun daily_task.cjs
// 规则：每天 3 个多人任务（6 选 3）+ 2 个单人任务（4 选 2）+ 1 个固定投稿任务，奖励在区间内随机；
//       以 sha256(uuid|day|4ascend-daily-task) 为确定性种子，同一账号同一天结果恒定。
//       每日可刷新任务：前 2 次免费，之后每次 50 棋币，只从未抽到过的同组任务里抽；投稿任务不刷新。
const crypto = require('node:crypto');

const MULTI_DEFS = [
    { id: 'm1', kind: 'multi', title: '进行 1 局排位匹配对战', target: 1, min: 50, max: 70 },
    { id: 'm2', kind: 'multi', title: '获得 1 局排位匹配对战的胜利', target: 1, min: 100, max: 150 },
    { id: 'm3', kind: 'multi', title: '进行 1 局房间号对战', target: 1, min: 50, max: 70 },
    { id: 'm4', kind: 'multi', title: '观战 1 局对战', target: 1, min: 50, max: 70 },
    { id: 'm5', kind: 'multi', title: '进行 3 局排位匹配对战', target: 3, min: 200, max: 250 },
    { id: 'm6', kind: 'multi', title: '获得 3 局排位匹配对战的胜利', target: 3, min: 500, max: 750 },
];

const SINGLE_DEFS = [
    { id: 's1', kind: 'single', title: '进行 1 局人机对战', target: 1, min: 50, max: 70 },
    { id: 's2', kind: 'single', title: '获得 1 局人机对战的胜利', target: 1, min: 100, max: 150 },
    { id: 's3', kind: 'single', title: '获得 1 局简单及以上难度人机对战的胜利', target: 1, min: 200, max: 250 },
    { id: 's4', kind: 'single', title: '进行 3 局人机对战', target: 3, min: 100, max: 150 },
];

// 每人每天固定的投稿任务：投稿 1 次（无论是否通过），固定 300 棋币
const PUZZLE_DEF = { id: 'p1', kind: 'puzzle', title: '投稿 1 次残局（无论是否通过）', target: 1, min: 300, max: 300 };

const EVENT_IDS = {
    ranked_play: ['m1', 'm5'],
    ranked_win: ['m2', 'm6'],
    room_play: ['m3'],
    spectate: ['m4'],
    ai_play: ['s1', 's4'],
    ai_win: ['s2'],
    ai_win_hard: ['s3'],
    puzzle_submit: ['p1'],
};

// 与服务端 SeedRandom 相同的字节流随机：连续读 4 字节拼成 uint32，拒绝采样保证均匀
class SeedRandom {
    constructor(digest) {
        this.bytes = digest;
        this.cursor = 0;
    }

    next(bound) {
        if (bound === 0) return 0;
        const limit = 0xffffffff - (0xffffffff % bound);
        while (true) {
            let value = 0;
            for (let index = 0; index < 4; index += 1) {
                const byte = this.bytes[this.cursor % this.bytes.length];
                this.cursor += 1;
                value = ((value << 8) | byte) >>> 0;
            }
            if (value < limit) return value % bound;
        }
    }
}

// 部分 Fisher-Yates：取前 count 个即选中项
const shuffle_first = (list, count, random) => {
    for (let index = 0; index < count && index < list.length; index += 1) {
        const pick = index + random.next(list.length - index);
        [list[index], list[pick]] = [list[pick], list[index]];
    }
};

// 生成某天任务（顺序与 ensure_day 一致：先多后单）
const generate_day = (uuid, day) => {
    const seed = crypto.createHash('sha256').update(`${uuid}|${day}|4ascend-daily-task`).digest();
    const random = new SeedRandom(seed);

    const multi_index = MULTI_DEFS.map((_, index) => index);
    shuffle_first(multi_index, 3, random);
    const single_index = SINGLE_DEFS.map((_, index) => index);
    shuffle_first(single_index, 2, random);

    const records = [];
    const pick = (defs, index) => {
        const def = defs[index];
        const span = def.max - def.min + 1;
        records.push({ ...def, reward: def.min + random.next(span), progress: 0, done: false });
    };
    for (let index = 0; index < 3; index += 1) pick(MULTI_DEFS, multi_index[index]);
    for (let index = 0; index < 2; index += 1) pick(SINGLE_DEFS, single_index[index]);
    records.push({ ...PUZZLE_DEF, reward: PUZZLE_DEF.min, progress: 0, done: false });
    return records;
};

// 模拟一次任务事件：只推进本页存在的任务，只置完成标记，不自动发奖；返回本次新完成的任务数
const apply_event = (records, name) => {
    let completed = 0;
    for (const id of EVENT_IDS[name] || []) {
        const record = records.find((item) => item.id === id);
        if (!record || record.done) continue;
        record.progress = Math.min(record.target, record.progress + 1);
        if (record.progress >= record.target) {
            record.done = true;
            completed += 1;
        }
    }
    return completed;
};

// 模拟领取奖励：仅已完成且未领取的任务可领取，同一任务只发一次
const claim_task = (records, id) => {
    const record = records.find((item) => item.id === id);
    if (!record || !record.done || record.claimed) return null;
    record.claimed = true;
    return record.reward;
};

let failed = 0;
const eq = (label, actual, expect) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expect);
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` != ${JSON.stringify(expect)}`}`);
};
const ok = (label, condition) => eq(label, Boolean(condition), true);

// 1. 任务定义与需求一致
eq('多人任务数量', MULTI_DEFS.length, 6);
eq('单人任务数量', SINGLE_DEFS.length, 4);
const spec = [
    ['m1', 1, 50, 70], ['m2', 1, 100, 150], ['m3', 1, 50, 70],
    ['m4', 1, 50, 70], ['m5', 3, 200, 250], ['m6', 3, 500, 750],
    ['s1', 1, 50, 70], ['s2', 1, 100, 150], ['s3', 1, 200, 250], ['s4', 3, 100, 150],
    ['p1', 1, 300, 300],
];
const defs = [...MULTI_DEFS, ...SINGLE_DEFS, PUZZLE_DEF];
eq('目标与奖励区间',
    defs.map((d) => [d.id, d.target, d.min, d.max]),
    spec.map((row) => row));
eq('id 唯一', new Set(defs.map((d) => d.id)).size, defs.length);

// 2. 每天固定 3 多 2 单 1 投稿、无重复、奖励在区间内
let shape_ok = true;
let range_ok = true;
for (let index = 0; index < 500; index += 1) {
    const uuid = `user-${index}`;
    const day = 46000 + (index % 30);
    const records = generate_day(uuid, day);
    if (records.length !== 6) shape_ok = false;
    if (records.filter((r) => r.kind === 'multi').length !== 3) shape_ok = false;
    if (records.filter((r) => r.kind === 'single').length !== 2) shape_ok = false;
    if (records.filter((r) => r.kind === 'puzzle').length !== 1) shape_ok = false;
    if (new Set(records.map((r) => r.id)).size !== 6) shape_ok = false;
    for (const record of records) {
        if (record.reward < record.min || record.reward > record.max) range_ok = false;
    }
}
ok('500 组均为 3 多 + 2 单 + 1 投稿且不重复', shape_ok);
ok('奖励始终落在区间内', range_ok);

// 3. 确定性：同一账号同一天两次生成结果完全一致
const day_a = generate_day('uuid-fixed', 46001);
const day_b = generate_day('uuid-fixed', 46001);
eq('同账号同一天恒定', day_a.map((r) => [r.id, r.reward]), day_b.map((r) => [r.id, r.reward]));

// 4. 不同天/不同账号会产生差异（抽样统计，至少出现多种组合）
const combos = new Set();
for (let index = 0; index < 200; index += 1) {
    combos.add(generate_day(`user-${index}`, 46000 + index).map((r) => r.id).sort().join(','));
}
ok('任务组合具备随机性', combos.size > 20);

// 5. 奖励区间两端可达（验证 next 覆盖 min..max 全区间）
const reached = { m1: new Set(), m2: new Set(), m3: new Set(), m4: new Set(), m5: new Set(), m6: new Set(), s1: new Set(), s2: new Set(), s3: new Set(), s4: new Set(), p1: new Set() };
for (let index = 0; index < 20000; index += 1) {
    for (const record of generate_day(`user-${index}`, 46000 + (index % 365))) reached[record.id].add(record.reward);
}
let endpoints_ok = true;
for (const def of defs) {
    if (!reached[def.id].has(def.min) || !reached[def.id].has(def.max)) endpoints_ok = false;
}
ok('每个任务奖励两端可达', endpoints_ok);
ok('奖励取值数量正确', defs.every((d) => reached[d.id].size === d.max - d.min + 1));

// 6. 事件推进：ranked_play 同时推进 m1/m5，只置完成标记，奖励需手动领取
const picked = (ids) => {
    // 构造固定任务集用于事件测试（奖励取自定义区间中值）
    return defs.filter((d) => ids.includes(d.id)).map((d) => ({
        ...d, reward: Math.floor((d.min + d.max) / 2), progress: 0, done: false, claimed: false,
    }));
};

let tasks = picked(['m1', 'm5', 's1']);
eq('首局排位：完成 1 个任务', apply_event(tasks, 'ranked_play'), 1);
eq('首局后 m1 已完 m5 进度 1', tasks.map((t) => [t.id, t.progress, t.done, t.claimed]), [['m1', 1, true, false], ['m5', 1, false, false], ['s1', 0, false, false]]);
eq('第二局排位：无新完成', apply_event(tasks, 'ranked_play'), 0);
eq('第三局排位：完成 m5', apply_event(tasks, 'ranked_play'), 1);
eq('三局后 m5 已完成', tasks.find((t) => t.id === 'm5').done, true);
eq('继续排位不再完成新任务', apply_event(tasks, 'ranked_play'), 0);
eq('领取 m1 奖励', claim_task(tasks, 'm1'), 60);
eq('m1 不可重复领取', claim_task(tasks, 'm1'), null);
eq('领取 m5 奖励', claim_task(tasks, 'm5'), 225);

// 7. 胜利类事件只推进对应任务
tasks = picked(['m2', 'm6', 's2']);
eq('一胜：完成 m2', apply_event(tasks, 'ranked_win'), 1);
eq('一胜后领取 m2', claim_task(tasks, 'm2'), 125);
apply_event(tasks, 'ranked_win');
eq('两胜：m6 进度 2 未完成', tasks.find((t) => t.id === 'm6').progress, 2);
eq('两胜后 m6 不可领取', claim_task(tasks, 'm6'), null);
eq('三胜：完成 m6', apply_event(tasks, 'ranked_win'), 1);
eq('三胜后领取 m6', claim_task(tasks, 'm6'), 625);

// 8. 房间 / 观战 / 人机事件
tasks = picked(['m3', 'm4']);
eq('房间号对战完成', apply_event(tasks, 'room_play'), 1);
eq('领取房间号任务', claim_task(tasks, 'm3'), 60);
eq('观战完成', apply_event(tasks, 'spectate'), 1);
eq('领取观战任务', claim_task(tasks, 'm4'), 60);
tasks = picked(['s1', 's4', 's3']);
eq('人机一局：完成 s1', apply_event(tasks, 'ai_play'), 1);
eq('领取 s1', claim_task(tasks, 's1'), 60);
eq('人机胜利：完成 s3', apply_event(tasks, 'ai_win_hard'), 1);
eq('领取 s3', claim_task(tasks, 's3'), 225);
eq('再两局人机：完成 s4', apply_event(tasks, 'ai_play') + apply_event(tasks, 'ai_play'), 1);
eq('领取 s4', claim_task(tasks, 's4'), 125);

// 9. 未刷出的任务不会因事件完成
tasks = picked(['m1', 's1']);
eq('无 m5 时三局排位只完成 m1', apply_event(tasks, 'ranked_play') + apply_event(tasks, 'ranked_play') + apply_event(tasks, 'ranked_play'), 1);
eq('领取 m1', claim_task(tasks, 'm1'), 60);

// 10. 投稿任务：投稿成功即完成，奖励只能领取一次
tasks = picked(['p1', 'm1']);
eq('投稿一次完成投稿任务', apply_event(tasks, 'puzzle_submit'), 1);
eq('领取投稿奖励', claim_task(tasks, 'p1'), 300);
eq('再次投稿不重复完成', apply_event(tasks, 'puzzle_submit'), 0);
eq('投稿奖励不可重复领取', claim_task(tasks, 'p1'), null);

// 10.1 未完成的普通任务不可领取
tasks = picked(['m1', 's1']);
eq('未完成不可领取', claim_task(tasks, 'm1'), null);
eq('未知任务不可领取', claim_task(tasks, 'unknown'), null);

// 11. 刷新规则：只刷新指定任务；前 2 次免费、之后 50 币；只从未抽到过的同组任务里抽；投稿与已完成任务不可刷新
const lcg = (seed) => {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
};

// 与服务端 refresh() 相同：由调用方指定 task_id，只替换该任务（随机源换成可复现的 LCG）
const refresh_task = (state, task_id, rng) => {
    const cost = state.refresh_count >= 2 ? 50 : 0;
    const target = state.records.find((record) => record.id === task_id);
    if (!target || target.kind === 'puzzle' || target.done) return { reason: 'invalid', cost };
    const pool = target.kind === 'multi' ? MULTI_DEFS : SINGLE_DEFS;
    const candidates = pool.filter((definition) => !state.drawn.has(definition.id));
    if (!candidates.length) return { reason: 'no_candidate', cost };
    const definition = candidates[Math.floor(rng() * candidates.length)];
    state.records = state.records.filter((record) => record !== target);
    state.records.push({
        ...definition,
        reward: definition.min + Math.floor(rng() * (definition.max - definition.min + 1)),
        progress: 0,
        done: false,
    });
    state.drawn.add(definition.id);
    state.refresh_count += 1;
    return { reason: '', cost, removed: target.id, added: definition.id };
};

const make_state = (uuid, day) => {
    const records = generate_day(uuid, day);
    return { records, drawn: new Set(records.map((record) => record.id)), refresh_count: 0 };
};

let cost_ok = true;
let composition_ok = true;
let never_repeat = true;
let target_ok = true;
for (let index = 0; index < 300; index += 1) {
    const state = make_state(`user-${index}`, 46000 + (index % 30));
    const rng = lcg(index + 1);
    for (let step = 0; step < 6; step += 1) {
        const replaceable = state.records.filter((record) => record.kind !== 'puzzle' && !record.done);
        if (!replaceable.length) break;
        const task_id = replaceable[Math.floor(rng() * replaceable.length)].id;
        const before_drawn = new Set(state.drawn);
        const expected_cost = state.refresh_count >= 2 ? 50 : 0;
        const result = refresh_task(state, task_id, rng);
        if (result.reason) break;
        if (result.cost !== expected_cost) cost_ok = false;
        if (result.removed !== task_id) target_ok = false;
        if (before_drawn.has(result.added)) never_repeat = false;
        if (result.added === 'p1' || result.removed === 'p1') never_repeat = false;
        if (state.records.length !== 6) composition_ok = false;
        if (state.records.filter((record) => record.kind === 'multi').length !== 3) composition_ok = false;
        if (state.records.filter((record) => record.kind === 'single').length !== 2) composition_ok = false;
        if (state.records.filter((record) => record.kind === 'puzzle').length !== 1) composition_ok = false;
    }
}
ok('刷新费用符合规则', cost_ok);
ok('刷新后仍为 3 多 + 2 单 + 1 投稿', composition_ok);
ok('刷新不会抽到已抽过或投稿任务', never_repeat);
ok('只替换指定任务', target_ok);

// 指定单个任务刷新时，其他未完成任务保持不变
const one_state = make_state('one-user', 46000);
const one_target = one_state.records.find((record) => record.kind === 'multi');
const one_other = one_state.records.filter((record) => record.id !== one_target.id).map((record) => record.id);
const one_rng = lcg(9001);
const one_result = refresh_task(one_state, one_target.id, one_rng);
eq('指定任务被替换', one_result.removed, one_target.id);
ok('其他任务保持原样', one_other.every((id) => one_state.records.some((record) => record.id === id)));

// 费用曲线：第 1、2 次免费，第 3 次起 50 币（对同一任务反复刷新）
const cost_state = make_state('cost-user', 46000);
const cost_rng = lcg(777);
const cost_curve = [];
for (let step = 0; step < 4; step += 1) {
    const target = cost_state.records.find((record) => record.kind !== 'puzzle' && !record.done);
    const result = refresh_task(cost_state, target.id, cost_rng);
    if (result.reason) break;
    cost_curve.push(result.cost);
}
eq('刷新费用曲线', cost_curve.slice(0, 4), [0, 0, 50, 50]);

// 同一组候选用尽后返回 no_candidate
const exhaust_state = make_state('exhaust-user', 46000);
const exhaust_rng = lcg(4242);
let last_reason = '';
for (let step = 0; step < 12; step += 1) {
    const target = exhaust_state.records.find((record) => record.kind !== 'puzzle' && !record.done);
    const result = refresh_task(exhaust_state, target.id, exhaust_rng);
    last_reason = result.reason;
    if (result.reason) break;
}
eq('同组候选用尽后提示 no_candidate', last_reason, 'no_candidate');

// 已完成任务、投稿任务、未知 id 都不可刷新
const done_state = make_state('done-user', 46000);
const done_target = done_state.records.find((record) => record.kind === 'multi');
done_target.done = true;
done_target.progress = done_target.target;
const done_rng = lcg(31337);
eq('已完成任务不可刷新', refresh_task(done_state, done_target.id, done_rng).reason, 'invalid');
eq('投稿任务不可刷新', refresh_task(done_state, 'p1', done_rng).reason, 'invalid');
eq('未知任务不可刷新', refresh_task(done_state, 'unknown', done_rng).reason, 'invalid');
ok('已完成任务不会被刷新替换', done_state.records.some((record) => record.id === done_target.id));
eq('不可刷新时不计刷新次数', done_state.refresh_count, 0);

// 12. 北京时间日期序号公式
const day_index = (timestamp_s) => Math.floor((timestamp_s + 8 * 3600) / 86400);
const day_16 = day_index(Date.UTC(2026, 9, 30, 16, 0, 0) / 1000);
eq('北京时间 0 点与 23 点属同一任务日', day_index(Date.UTC(2026, 9, 30, 23, 0, 0) / 1000), day_16);
eq('跨 0 点前进一天', day_index(Date.UTC(2026, 9, 30, 15, 59, 59) / 1000) + 1, day_16);

if (failed) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');
