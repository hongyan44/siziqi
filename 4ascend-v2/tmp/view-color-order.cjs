/*
 * 观战黑白方 / 先手归属：view_sync 的 'my'/'foe' 是“相对发送方”的选择，
 * 观战必须结合发送方 uuid（uuids[0]）还原成绝对归属。
 * 旧逻辑直接把它当成“观战上方位(uuid 最小者)”，导致先收到哪一方的 view_sync
 * 就把黑白方反过来 —— 本测试锁死该不变量。
 * 运行： bun tmp/view-color-order.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const file = path.resolve(__dirname, '../js/core/view-color.cjs');
const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
const module_ = { exports: {} };
new Function('module', 'exports', text)(module_, module_.exports);
const { resolve_choice_uuid } = module_.exports;

// 观战上方位 = uuid 排序较小者（A），下方位 = 较大者（B）
const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const my_uuid = A;
const foe_uuid = B;

let n = 0;
const ok = (label) => { n++; console.log(`PASS: ${label}`); };

// 1) 基础映射：choice 相对发送方
assert.equal(resolve_choice_uuid(A, 'my', my_uuid, foe_uuid), A);
assert.equal(resolve_choice_uuid(A, 'foe', my_uuid, foe_uuid), B);
assert.equal(resolve_choice_uuid(B, 'my', my_uuid, foe_uuid), B);
assert.equal(resolve_choice_uuid(B, 'foe', my_uuid, foe_uuid), A);
ok('resolve_choice_uuid 四种组合按发送方正确还原');

// 2) 强制阵营场景：A 选 'my'（执黑），B 必选 'foe'（执白）。
//    无论观战先收到谁的 view_sync，黑方都必须解析为 A。
{
    const black_from_sender_A = resolve_choice_uuid(A, 'my', my_uuid, foe_uuid);
    const black_from_sender_B = resolve_choice_uuid(B, 'foe', my_uuid, foe_uuid);
    assert.equal(black_from_sender_A, A, '发送方 A 的 view_sync 应解析黑方=A');
    assert.equal(black_from_sender_B, A, '发送方 B 的 view_sync 应解析黑方=A');
    assert.equal(black_from_sender_A, black_from_sender_B, '两种到达顺序必须得到同一黑方');
    ok('强制阵营：两种到达顺序黑白方一致（不再反转）');
}

// 3) 强制阵营反向场景：A 选 'foe'（执白），B 必选 'my'（执黑）→ 黑方必须解析为 B。
{
    const black_from_sender_A = resolve_choice_uuid(A, 'foe', my_uuid, foe_uuid);
    const black_from_sender_B = resolve_choice_uuid(B, 'my', my_uuid, foe_uuid);
    assert.equal(black_from_sender_A, B, '发送方 A 执白时黑方应为 B');
    assert.equal(black_from_sender_B, B, '发送方 B 执黑时黑方应为 B');
    assert.equal(black_from_sender_A, black_from_sender_B, '两种到达顺序必须得到同一黑方');
    ok('强制阵营反向：两种到达顺序黑白方一致');
}

// 4) 强制先手场景：A 选 'my'（先手），B 必选 'foe' → 先手方必须解析为 A。
{
    const first_from_sender_A = resolve_choice_uuid(A, 'my', my_uuid, foe_uuid);
    const first_from_sender_B = resolve_choice_uuid(B, 'foe', my_uuid, foe_uuid);
    assert.equal(first_from_sender_A, A);
    assert.equal(first_from_sender_B, A);
    assert.equal(first_from_sender_A, first_from_sender_B);
    ok('强制先手：两种到达顺序先手方一致');
}

// 5) 反例锁死：旧逻辑（把相对选择直接套到观战上方位）在发送方为 B 时会反转。
{
    const buggy = (sender_uuid, choice) => (choice === 'my' ? my_uuid : foe_uuid);
    const buggy_A = buggy(A, 'my'); // 收到 A 的同步：误判黑方=my_uuid=A（巧合正确）
    const buggy_B = buggy(B, 'foe'); // 收到 B 的同步：误判黑方=foe_uuid=B（反转！）
    assert.notEqual(buggy_A, buggy_B, '旧逻辑在两种到达顺序下会给出不同黑方（复现 BUG）');
    ok('旧逻辑可复现黑白方反转（证明修复必要性）');
}

// 6) 集成护栏：view.cjs 必须通过 sender_uuid 调用该还原函数。
{
    const view = fs.readFileSync(path.resolve(__dirname, '../js/core/view.cjs'), 'utf8');
    assert.match(view, /resolve_choice_uuid\(sender_uuid,\s*gl_cf_color/, 'view.cjs 阵营决定必须按 sender_uuid 还原');
    assert.match(view, /resolve_choice_uuid\(sender_uuid,\s*gl_cf_first/, 'view.cjs 先手决定必须按 sender_uuid 还原');
    ok('view.cjs 已按发送方 uuid 还原阵营与先手');
}

console.log(`\n全部通过：${n} 项`);