/*
 * 剧情条件分支（% IF / % ELIF / % ELSE）：目标支持「调用 封装块」的解析、校验、还原与运行时。
 * 运行： bun tmp/story-cond-call.test.cjs
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

const { StoryScript, StoryRuntime } = load('story.cjs');

// 1) 解析：IF / ELIF / ELSE 的目标都能写成「调用 封装块」
{
    const text = [
        '定义 奖励',
        '[导员ZERO] 这是封装块里的台词。',
        '结束定义',
        '% IF 胜利 -> 调用 奖励',
        '% ELIF 失败 -> 调用 奖励',
        '% ELSE -> 调用 奖励',
    ].join('\n');
    const parsed = StoryScript.parse(text);
    assert.deepEqual(parsed.errors, [], '正常剧本不应有解析错误');
    const conds = parsed.nodes.filter((item) => item.type === 'cond');
    assert.equal(conds.length, 3, '应解析出 3 个条件节点');
    conds.forEach((cond) => {
        assert.equal(cond.call, true, '条件目标应标记为封装块调用');
        assert.equal(cond.target, '奖励', '条件目标应去掉“调用”前缀');
    });
    assert.deepEqual(conds.map((item) => item.kind), ['if', 'elif', 'else'], '分支类型应依次为 IF / ELIF / ELSE');
}

// 2) 校验：封装块存在时通过；不存在时报错
{
    const ok = [
        '定义 奖励',
        '[导员ZERO] 奖励。',
        '结束定义',
        '% IF 胜利 -> 调用 奖励',
    ].join('\n');
    assert.deepEqual(StoryScript.validate(ok), [], '存在的封装块调用应通过校验');

    const missing = [
        '[导员ZERO] 开始。',
        '% IF 胜利 -> 调用 不存在',
    ].join('\n');
    const errors = StoryScript.validate(missing);
    assert.ok(errors.some((item) => item.includes('条件分支调用了不存在的封装块：不存在')), '缺少封装块时应报错');
}

// 3) 还原：stringify 保留「调用 封装块」写法，且可再次解析
{
    const text = [
        '定义 奖励',
        '[导员ZERO] 奖励。',
        '结束定义',
        '% IF 胜利 -> 调用 奖励',
        '% ELSE -> 调用 奖励',
    ].join('\n');
    const parsed = StoryScript.parse(text);
    const restored = StoryScript.stringify(parsed);
    assert.ok(restored.includes('% IF 胜利 -> 调用 奖励'), `还原结果应保留调用写法：\n${restored}`);
    assert.ok(restored.includes('% ELSE -> 调用 奖励'), `还原结果应保留 ELSE 调用写法：\n${restored}`);
    const again = StoryScript.parse(restored);
    assert.deepEqual(again.errors, [], '还原后的剧本应可再次解析');
    const cond = again.nodes.find((item) => item.type === 'cond');
    assert.equal(cond.call, true);
    assert.equal(cond.target, '奖励');
}

// 4) 运行时：命中 IF 后进入封装块，播完回到条件行的下一行
{
    const text = [
        '定义 奖励',
        '[导员ZERO] 封装块内容。',
        '结束定义',
        '[导员ZERO] 条件前。',
        '% IF 胜利 -> 调用 奖励',
        '[导员ZERO] 条件后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    assert.equal(runtime.current().text, '条件前。', '封装块不应顺序播放');
    runtime.advance();
    assert.equal(runtime.current().type, 'cond', '推进后应停在条件节点');
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).text, '封装块内容。', '命中 IF 应进入封装块');
    assert.equal(runtime.advance().text, '条件后。', '封装块播完应回到条件行下一行');
}

// 5) 运行时：ELSE 兜底同样可调用封装块
{
    const text = [
        '定义 兜底',
        '[导员ZERO] 兜底内容。',
        '结束定义',
        '% IF 胜利 -> 调用 兜底',
        '% ELSE -> 调用 兜底',
        '[导员ZERO] 条件后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.last_outcome = 'lose';
    const cond = runtime.current();
    assert.equal(cond.kind, 'if', '未命中 IF 时应停在 IF 节点');
    assert.equal(runtime.step_cond(cond).type, 'cond', '未命中 IF 应前进到 ELSE 节点');
    assert.equal(runtime.step_cond(runtime.current()).text, '兜底内容。', 'ELSE 应调用封装块');
    assert.equal(runtime.advance().text, '条件后。', '封装块播完应回到条件行下一行');
}

// 6) 原有行为：目标为标签时仍然跳转
{
    const text = [
        '% IF 胜利 -> 胜利标签',
        '[导员ZERO] 未命中。',
        '结束',
        ':胜利标签',
        '[导员ZERO] 命中标签。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).text, '命中标签。', '标签目标应保持跳转行为');
}

// 7) 对局内的「检测落子 -> 调用 封装块」不会被抽成即时触发，仍按普通条件节点保留
{
    const text = [
        '* 对局 测试',
        '  % IF 检测 1 4,4 -> 调用 辅助',
        '结束此对局',
        '定义 辅助',
        '[导员ZERO] 辅助内容。',
        '结束定义',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(text);
    const game = parsed.nodes.find((item) => item.type === 'game');
    assert.deepEqual(game.config.detections, [], '调用封装块的条件不应抽成对局内即时触发');
    const cond = parsed.nodes.find((item) => item.type === 'cond');
    assert.equal(cond.call, true);
    assert.equal(cond.consumed, undefined, '该条件不应被即时触发消费');
}

// 8) 解析与还原：调用标签 / 继续对局 / 结束
{
    const text = [
        '标签 支线 不顺序播放',
        '[导员ZERO] 支线内容。',
        '结束标签',
        '% IF 胜利 -> 调用标签 支线',
        '% ELIF 平局 -> 继续对局',
        '% ELSE -> 结束',
    ].join('\n');
    const parsed = StoryScript.parse(text);
    assert.deepEqual(parsed.errors, [], '三种目标写法都应可解析');
    const conds = parsed.nodes.filter((item) => item.type === 'cond');
    assert.equal(conds[0].call_label, true);
    assert.equal(conds[0].target, '支线');
    assert.equal(conds[1].action, 'resume');
    assert.equal(conds[2].target, '结束');
    assert.deepEqual(StoryScript.validate(text), [], '三种目标写法都应通过校验');
    const restored = StoryScript.stringify(parsed);
    assert.ok(restored.includes('% IF 胜利 -> 调用标签 支线'), restored);
    assert.ok(restored.includes('% ELIF 平局 -> 继续对局'), restored);
    assert.ok(restored.includes('% ELSE -> 结束'), restored);
}

// 9) 运行时：调用标签播到「结束标签」后回到条件行下一行
{
    const text = [
        '标签 支线 不顺序播放',
        '[导员ZERO] 支线内容。',
        '结束标签',
        '[导员ZERO] 条件前。',
        '% IF 胜利 -> 调用标签 支线',
        '[导员ZERO] 条件后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    assert.equal(runtime.current().text, '条件前。', '不顺序播放的标签块不应自动播放');
    runtime.advance();
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).text, '支线内容。', '命中后应进入标签');
    assert.equal(runtime.advance().text, '条件后。', '结束标签后应回到条件行下一行');
}

// 10) 运行时：继续对局停到其后的「继续对局」节点
{
    const text = [
        '[导员ZERO] 条件前。',
        '% IF 胜利 -> 继续对局',
        '[导员ZERO] 未命中内容。',
        '继续对局',
        '[导员ZERO] 之后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.advance();
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).type, 'resume', '命中后应停在继续对局节点');
    assert.equal(runtime.advance().text, '之后。', '继续对局之后应接着播下一行');
}

// 11) 运行时：结束目标直接收尾
{
    const text = [
        '% IF 胜利 -> 结束',
        '[导员ZERO] 未命中内容。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).type, 'end', '命中结束后应直接进入结尾节点');
}

// 12) 对局内「检测落子 -> 调用标签 / 继续对局」不抽取为即时触发
{
    const text = [
        '标签 支线 不顺序播放',
        '[导员ZERO] 支线内容。',
        '结束标签',
        '* 对局 测试',
        '  % IF 检测 1 4,4 -> 调用标签 支线',
        '  % ELIF 检测 2 5,5 -> 继续对局',
        '结束此对局',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(text);
    const game = parsed.nodes.find((item) => item.type === 'game');
    assert.deepEqual(game.config.detections, [], '调用标签 / 继续对局不应抽成对局内即时触发');
}

// 13) ELSE 只在同缩进 IF / ELIF 都未命中时执行
{
    const text = [
        '定义 甲',
        '[导员ZERO] 甲内容。',
        '结束定义',
        '定义 乙',
        '[导员ZERO] 乙内容。',
        '结束定义',
        '[导员ZERO] 开始。',
        '% IF 胜利 -> 调用 甲',
        '% ELSE -> 调用 乙',
        '[导员ZERO] 之后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.advance();
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).text, '甲内容。', 'IF 命中应执行 IF 分支');
    assert.equal(runtime.advance().type, 'cond', '封装块播完应回到 ELSE 行');
    assert.equal(runtime.step_cond(runtime.current()).text, '之后。', 'IF 已命中时 ELSE 不应执行');
}

// 14) ELIF 命中后 ELSE 不再执行
{
    const text = [
        '定义 甲',
        '[导员ZERO] 甲内容。',
        '结束定义',
        '定义 乙',
        '[导员ZERO] 乙内容。',
        '结束定义',
        '[导员ZERO] 开始。',
        '% IF 胜利 -> 调用 甲',
        '% ELIF 平局 -> 调用 乙',
        '% ELSE -> 调用 甲',
        '[导员ZERO] 之后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.advance();
    runtime.last_outcome = 'draw';
    assert.equal(runtime.step_cond(runtime.current()).type, 'cond', 'IF 未命中应前进到 ELIF');
    assert.equal(runtime.step_cond(runtime.current()).text, '乙内容。', 'ELIF 命中应执行 ELIF 分支');
    assert.equal(runtime.advance().type, 'cond', '封装块播完应回到 ELSE 行');
    assert.equal(runtime.step_cond(runtime.current()).text, '之后。', 'ELIF 已命中时 ELSE 不应执行');
}

// 15) IF / ELIF 都未命中时 ELSE 才执行
{
    const text = [
        '定义 乙',
        '[导员ZERO] 乙内容。',
        '结束定义',
        '[导员ZERO] 开始。',
        '% IF 胜利 -> 调用 乙',
        '% ELIF 平局 -> 调用 乙',
        '% ELSE -> 调用 乙',
        '[导员ZERO] 之后。',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    runtime.advance();
    runtime.last_outcome = 'lose';
    assert.equal(runtime.step_cond(runtime.current()).type, 'cond', 'IF 未命中应前进到 ELIF');
    assert.equal(runtime.step_cond(runtime.current()).type, 'cond', 'ELIF 未命中应前进到 ELSE');
    assert.equal(runtime.step_cond(runtime.current()).text, '乙内容。', '都未命中时 ELSE 应执行');
    assert.equal(runtime.advance().text, '之后。', 'ELSE 分支播完应继续往后');
}

// 16) 条件链被重复执行时，新 IF 会重置命中记录
{
    const text = [
        '定义 流程',
        '  % IF 胜利 -> 调用 甲',
        '  % ELSE -> 调用 乙',
        '结束定义',
        '定义 甲',
        '[导员ZERO] 甲内容。',
        '结束定义',
        '定义 乙',
        '[导员ZERO] 乙内容。',
        '结束定义',
        '[导员ZERO] 开始。',
        '调用 流程',
        '[导员ZERO] 中场。',
        '调用 流程',
        '结束',
    ].join('\n');
    const runtime = new StoryRuntime(StoryScript.parse(text));
    assert.equal(runtime.current().text, '开始。');
    runtime.advance();
    runtime.last_outcome = 'win';
    assert.equal(runtime.step_cond(runtime.current()).text, '甲内容。', '第一次应命中 IF');
    assert.equal(runtime.advance().type, 'cond', '封装块播完应回到 ELSE 行');
    assert.equal(runtime.step_cond(runtime.current()).text, '中场。', '第一次的 ELSE 应被跳过');
    runtime.advance();
    runtime.last_outcome = 'lose';
    assert.equal(runtime.current().kind, 'if', '第二次应重新从 IF 开始');
    assert.equal(runtime.step_cond(runtime.current()).kind, 'else', '第二次 IF 未命中');
    assert.equal(runtime.step_cond(runtime.current()).text, '乙内容。', '第二次应执行 ELSE');
}

console.log('PASS: 条件分支支持调用封装块');
