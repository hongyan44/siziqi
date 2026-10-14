/*
 * 残局正着优先级回归：作者写好的白方预案不得被战术逻辑改写。
 * 运行： node tmp/endgame-book-move-priority.cjs
 *
 * 背景：challenge.html 的 playWhite 曾在“黑方命中正着”时仍然调用战术 AI，
 * 并把 kill / anti-suicide / answer-ascend / nuke-expand 等结果当成“关键战术”
 * 覆盖作者预案，导致正解线被打断（页面提示“正着被防自杀/斩杀逻辑覆盖”）。
 * 修复后：命中正着 -> 直接使用 branchResult.white_move，不再调用战术搜索。
 *
 * 本测试分两部分：
 *   1) 功能契约：create_branch 命中正着时返回作者预案且不触发回退 AI；
 *   2) 源码守卫：challenge.html 的 playWhite 不再存在战术覆盖分支。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname, '../js/global');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(
        (p) => (p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p)),
        module,
        module.exports
    );
    return module.exports;
}

global.window = global;
load('endgame.cjs');
const { create_branch } = global.window.EndgameExports;

const blackBook = [[4, 4], [5, 5], [6, 4]];
const whiteTurns = [[4, 5], [5, 3], [6, 3]];

const main = async () => {
    let fallbackCalls = 0;
    const branch = create_branch(blackBook, whiteTurns, async () => {
        fallbackCalls += 1;
        return [0, 0];
    });

    const matched = await branch.black_move([4, 4], {});
    assert.equal(matched.matched, true, '黑方命中正着时 matched 必须为 true');
    assert.equal(matched.source, 'book', '命中正着时 source 必须为 book');
    assert.deepEqual(
        matched.white_move,
        [4, 5],
        '命中正着时必须返回作者写好的白方预案，而不是回退 AI 的落点'
    );
    assert.equal(fallbackCalls, 0, '命中正着时不允许调用回退战术 AI');

    const deviated = await branch.black_move([0, 0], {});
    assert.equal(deviated.matched, false, '黑方偏离正着时 matched 必须为 false');
    assert.equal(deviated.source, 'normal-ai', '偏离正着后应切换到普通 AI 模式');
    assert.equal(fallbackCalls, 1, '偏离正着后才允许调用回退战术 AI');

    const html = fs.readFileSync(path.resolve(__dirname, '../html/endgame/challenge.html'), 'utf8');
    assert.ok(
        html.includes('move = branchResult.white_move;'),
        'playWhite 命中正着分支必须直接采用作者预案落点'
    );
    assert.ok(!html.includes('criticalReasons'), 'playWhite 不得再保留“关键战术”覆盖白名单');
    assert.ok(!html.includes('bookWasOverridden'), 'playWhite 不得再存在正着被覆盖的分支');
    assert.ok(!html.includes('正着被防自杀'), '页面不得再提示“正着被防自杀/斩杀逻辑覆盖”');

    console.log('endgame-book-move-priority: PASS');
};

main().catch((error) => {
    console.error('endgame-book-move-priority: FAIL');
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
});