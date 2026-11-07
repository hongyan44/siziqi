/*
 * 剧情 JQBJ：检测落子（平铺 -> 标签）与 IF / ELIF 扩展条件。
 * 运行： bun tmp/story-detect-move.test.cjs
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

// 1) 平铺检测：编译进对局配置，指向标签，不再自动插入“继续对局”
{
    const script = [
        '对局 教学',
        '  残局码=abc123',
        '  检测 1 4,4 -> 中心',
        '结束对局',
        ':中心',
        '说 [导员ZERO] 第一手就下在中心。',
        '继续对局',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(script);
    assert.deepEqual(parsed.errors, [], '平铺检测不应产生解析错误');
    const game = parsed.nodes.find((node) => node.type === 'game');
    assert.ok(game, '应存在对局节点');
    assert.equal(game.config.detections.length, 1, '应编译 1 条检测规则');
    const rule = game.config.detections[0];
    assert.equal(rule.step, 1, '检测步数应为 1');
    assert.equal(rule.cell_text, '4,4', '应保留作者坐标文本');
    assert.equal(rule.x, 3, '横坐标 4 应换算为棋盘 x=3');
    assert.equal(rule.y, 5, '竖坐标 4 应换算为棋盘 y=5');
    assert.equal(rule.target, '中心', '应记录跳转标签');
    assert.ok(!parsed.nodes.some((node) => node.type === 'resume' && node.auto), '不应再自动生成继续对局节点');
    const targetIndex = parsed.labels['中心'];
    assert.equal(parsed.nodes[targetIndex].type, 'label', '标签处应为标签节点');
    assert.equal(parsed.nodes[targetIndex + 1].type, 'say', '标签之后应为作者写的台词');
    assert.equal(parsed.nodes[targetIndex + 2].type, 'resume', '作者写的继续对局仍在原位');
}

// 1b) 「在 / 不在」：检测不在选点落子
{
    const script = [
        '对局 教学',
        '  残局码=abc123',
        '  检测 在 1 4,4 -> 中心',
        '  检测 不在 1 4,4 -> 偏离',
        '结束对局',
        ':中心',
        '继续对局',
        ':偏离',
        '继续对局',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(script);
    assert.deepEqual(parsed.errors, [], '在/不在写法不应产生解析错误');
    const game = parsed.nodes.find((node) => node.type === 'game');
    const [atRule, notRule] = game.config.detections;
    assert.equal(atRule.negate, false, '「在」应记为不取反');
    assert.equal(notRule.negate, true, '「不在」应记为取反');
    assert.equal(notRule.step, 1, '「不在」仍应记录步数');
    assert.equal(notRule.cell_text, '4,4', '「不在」应保留坐标文本');
    assert.equal(notRule.target, '偏离', '「不在」应记录跳转标签');
}

// 1c) 省略「在 / 不在」保持旧行为（按「在」处理）
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  检测 2 5,5 -> 中心',
        '结束对局',
        ':中心',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const rule = parsed.nodes.find((node) => node.type === 'game').config.detections[0];
    assert.equal(rule.negate, false, '省略时应按「在」处理');
}

// 2) 缺少 “-> 标签” 应报错
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  检测 1 4,4',
        '结束对局',
        '结束',
    ].join('\n'));
    assert.ok(parsed.errors.some((message) => message.includes('-> 标签')), '缺少目标标签应报错');
}

// 3) 坐标越界与步数非法应报错
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  检测 1 10,4 -> 甲',
        '  检测 0 4,4 -> 乙',
        '结束对局',
        ':甲',
        ':乙',
        '结束',
    ].join('\n'));
    assert.ok(parsed.errors.some((message) => message.includes('坐标无效')), '越界坐标应报错');
    assert.ok(parsed.errors.some((message) => message.includes('步数必须是')), '步数 0 应报错');
}

// 4) IF / ELIF / ELSE 支持胜负、检测落子、第几步落子、选项（检测落子必须写在「对局」块内）
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '  % IF 胜利 -> 甲',
        '  % ELIF 检测 1 4,4 -> 乙',
        '  % ELIF 第 3 步 -> 丙',
        '  % ELIF 选项 2 -> 丁',
        '  % ELSE -> 戊',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
        ':丙',
        '结束',
        ':丁',
        '结束',
        ':戊',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, [], '扩展条件不应产生解析错误');
    const conds = parsed.nodes.filter((node) => node.type === 'cond');
    assert.deepEqual(conds.map((node) => node.kind), ['if', 'elif', 'elif', 'elif', 'else'], '应生成 IF/ELIF/ELSE 链');
    assert.deepEqual(conds.map((node) => node.condition), ['win', 'move', 'step', 'option', null], '条件类型应正确');
    assert.equal(conds[1].step, 1, '检测落子应记录步数');
    assert.equal(conds[1].x, 4, '检测落子应保留作者横坐标');
    assert.equal(conds[1].y, 4, '检测落子应保留作者竖坐标');
    assert.equal(conds[2].step, 3, '第几步落子应记录步数');
    assert.equal(conds[3].option, '2', '选项条件应记录内容');
}

// 4b) IF / ELIF 条件支持 检测 在 / 不在（必须写在「对局」块内）
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '  % IF 检测 不在 1 4,4 -> 甲',
        '  % ELIF 检测 在 2 5,5 -> 乙',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, [], '条件里的在/不在写法不应报错');
    const conds = parsed.nodes.filter((node) => node.type === 'cond');
    assert.equal(conds[0].negate, true, '「检测 不在」条件应取反');
    assert.equal(conds[1].negate, false, '「检测 在」条件不应取反');
}

// 5) 非法条件应报错并给出可用写法
{
    const parsed = StoryScript.parse([
        '% IF 随便写写 -> 甲',
        ':甲',
        '结束',
    ].join('\n'));
    assert.ok(parsed.errors.some((message) => message.includes('条件无效')), '未知条件应报错');
}

// 6) 运行时：落子历史 / 选项 / 胜负驱动条件判定
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '  % IF 检测 1 4,4 -> 甲',
        '  % ELIF 第 2 步 -> 乙',
        '  % ELIF 选项 2 -> 丙',
        '  % ELSE -> 丁',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
        ':丙',
        '结束',
        ':丁',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const runtime = new StoryRuntime(parsed);
    runtime.record_move('ai', 0, 0);
    runtime.record_move('player', 3, 5);
    const conds = runtime.nodes.filter((node) => node.type === 'cond');
    assert.equal(runtime.player_moves.length, 1, '只记录玩家自己的落子');
    assert.equal(runtime.cond_matches(conds[0]), true, '检测 1 4,4 应命中玩家第一手 4,4');
    assert.equal(runtime.cond_matches(conds[1]), false, '玩家只下了 1 手，第 2 步不应命中');
    runtime.record_move('player', 4, 4);
    assert.equal(runtime.cond_matches(conds[1]), true, '玩家已下满 2 手');
    runtime.last_choice = { 'index': 1, 'text': '右边' };
    assert.equal(runtime.cond_matches(conds[2]), true, '选项 2 应按序号命中');
    runtime.last_choice = { 'index': 0, 'text': '右边' };
    runtime.last_outcome = 'win';
    assert.equal(runtime.cond_matches(conds[2]), false, '序号不匹配时按文字兜底也不命中');
    assert.equal(runtime.cond_matches(conds[3]), false, 'ELSE 节点没有条件，返回 false');
    runtime.last_choice = { 'index': 0, 'text': '右边' };
    assert.equal(runtime.cond_matches({ 'condition': 'option', 'option': '右边' }), true, '选项文字应能命中');
}

// 6b) 运行时：「不在」条件在该手没有落在指定点时命中
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '  % IF 检测 不在 1 4,4 -> 甲',
        '  % ELSE -> 乙',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const runtime = new StoryRuntime(parsed);
    const cond = runtime.nodes.filter((node) => node.type === 'cond')[0];
    assert.equal(runtime.cond_matches(cond), false, '玩家还没落子时「不在」不应命中');
    runtime.record_move('player', 3, 5);
    assert.equal(runtime.cond_matches(cond), false, '第 1 手正好落在 4,4 时「不在」不应命中');
    const other = new StoryRuntime(parsed);
    other.record_move('player', 4, 4);
    assert.equal(other.cond_matches(cond), true, '第 1 手偏离 4,4 时「不在」应命中');
}

// 7) 序列化：检测与 IF/ELIF 条件可无损往返
{
    const script = [
        '对局 教学',
        '  残局码=abc123',
        '  检测 2 5,5 -> 中心',
        '  % IF 检测 1 4,4 -> 甲',
        '  % ELIF 第 3 步 -> 乙',
        '  % ELIF 选项 2 -> 丙',
        '  % ELSE -> 丁',
        '结束对局',
        ':中心',
        '继续对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
        ':丙',
        '结束',
        ':丁',
        '结束',
    ].join('\n');
    const first = StoryScript.parse(script);
    assert.deepEqual(first.errors, []);
    const out = StoryScript.stringify(first);
    assert.ok(out.includes('检测 2 5,5 -> 中心'), `应输出检测规则：\n${out}`);
    assert.ok(out.includes('% IF 检测 1 4,4 -> 甲'), `应输出检测条件：\n${out}`);
    assert.ok(out.includes('% ELIF 第 3 步 -> 乙'), `应输出步数条件：\n${out}`);
    assert.ok(out.includes('% ELIF 选项 2 -> 丙'), `应输出选项条件：\n${out}`);
    const second = StoryScript.parse(out);
    assert.deepEqual(second.errors, [], '往返后应仍可解析');
    const gameA = first.nodes.find((node) => node.type === 'game');
    const gameB = second.nodes.find((node) => node.type === 'game');
    assert.deepEqual(gameB.config.detections, gameA.config.detections, '检测规则应无损往返');
    assert.deepEqual(
        second.nodes.filter((node) => node.type === 'cond').map((node) => [node.kind, node.condition, node.step, node.option]),
        first.nodes.filter((node) => node.type === 'cond').map((node) => [node.kind, node.condition, node.step, node.option]),
        '条件链应无损往返'
    );
}

// 7b) 序列化：「不在」写法保留取反标记
{
    const script = [
        '对局 教学',
        '  残局码=abc123',
        '  检测 不在 2 5,5 -> 中心',
        '  % IF 检测 不在 1 4,4 -> 甲',
        '  % ELSE -> 乙',
        '结束对局',
        ':中心',
        '继续对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n');
    const first = StoryScript.parse(script);
    assert.deepEqual(first.errors, []);
    const out = StoryScript.stringify(first);
    assert.ok(out.includes('检测 不在 2 5,5 -> 中心'), `应保留检测的「不在」：\n${out}`);
    assert.ok(out.includes('% IF 检测 不在 1 4,4 -> 甲'), `应保留条件的「不在」：\n${out}`);
    const second = StoryScript.parse(out);
    assert.deepEqual(second.errors, [], '往返后应仍可解析');
    assert.equal(second.nodes.find((node) => node.type === 'game').config.detections[0].negate, true, '检测取反应无损往返');
    assert.equal(second.nodes.filter((node) => node.type === 'cond')[0].negate, true, '条件取反应无损往返');
}

// 8) 旧语法解析器：对局框外的「检测落子」条件不可用
{
    const parsed = StoryScript.parse([
        '% IF 检测 1 4,4 -> 甲',
        '% ELIF 第 3 步 -> 乙',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    assert.ok(parsed.errors.some((message) => message.includes('必须位于「对局」块内')), '对局框外应报错');
    assert.ok(!parsed.nodes.some((node) => node.type === 'cond' && node.condition === 'move'), '对局框外的检测落子条件不应生效');
    assert.ok(parsed.nodes.some((node) => node.type === 'cond' && node.condition === 'step'), '「第 N 步」条件不受限制');
}

// 9) JQBJ 解析器：对局框内可用，框外报错
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  % IF 检测 1 4,4 -> 甲',
        '结束对局',
        '% IF 检测 2 5,5 -> 乙',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    const scopeErrors = parsed.errors.filter((message) => message.includes('必须位于「对局」块内'));
    assert.equal(scopeErrors.length, 1, '只应对框外的检测落子条件报错');
    const conds = parsed.nodes.filter((node) => node.type === 'cond');
    assert.equal(conds.length, 1, '框外的检测落子条件不应进入节点流');
    assert.equal(conds[0].step, 1, '框内的检测落子条件应保留');
}

// 10) 平铺「检测」写在对局框外同样报错
{
    const parsed = StoryScript.parse([
        '检测 1 4,4 -> 甲',
        ':甲',
        '结束',
    ].join('\n'));
    assert.ok(parsed.errors.some((message) => message.includes('只能写在「对局」块内')), '框外平铺检测应报错');
}

// 11) 对局框内 IF 检测 / ELSE：抽成对局内即时触发（含 ELSE 兜底），条件节点不再参与对局后流程
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '  % IF 检测 1 4,4 -> 甲',
        '  % ELSE -> 乙',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const game = parsed.nodes.find((node) => node.type === 'game');
    assert.equal(game.config.detections.length, 2, '应抽出 1 条检测触发 + 1 条 ELSE 兜底触发');
    const [hitRule, elseRule] = game.config.detections;
    assert.equal(hitRule.step, 1);
    assert.equal(hitRule.x, 3, '条件里的 4,4 应换算为棋盘 x=3');
    assert.equal(hitRule.y, 5, '条件里的 4,4 应换算为棋盘 y=5');
    assert.equal(hitRule.target, '甲');
    assert.equal(hitRule.from_cond, true, '应标记来自条件行，序列化时不重复输出');
    assert.equal(elseRule.fallback, true, 'ELSE 应为兜底触发');
    assert.equal(elseRule.step, 1, 'ELSE 应在同一手立即判定');
    assert.equal(elseRule.target, '乙');
    const conds = parsed.nodes.filter((node) => node.type === 'cond');
    assert.ok(conds.every((node) => node.consumed === true), '条件节点应标记为已由对局内触发消费');
}

// 11b) 多条 ELIF 检测 + ELSE：ELSE 在最后一条检测的步数兜底
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  % IF 检测 1 4,4 -> 甲',
        '  % ELIF 检测 2 5,5 -> 乙',
        '  % ELSE -> 丙',
        '结束对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
        ':丙',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const rules = parsed.nodes.find((node) => node.type === 'game').config.detections;
    assert.equal(rules.length, 3);
    assert.deepEqual(rules.map((item) => [item.step, item.target, Boolean(item.fallback)]), [[1, '甲', false], [2, '乙', false], [2, '丙', true]], 'ELSE 应在第 2 手兜底且排在明确检测之后');
}

// 12) 旧语法 `* 对局` 内的检测条件同样即时触发
{
    const parsed = StoryScript.parse([
        '* 教学',
        '  残局码=abc123',
        '% IF 检测 1 4,4 -> 甲',
        '% ELSE -> 乙',
        '结束此对局',
        ':甲',
        '结束',
        ':乙',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const game = parsed.nodes.find((node) => node.type === 'game');
    assert.equal(game.config.detections.length, 2, '旧语法也应抽出检测触发与 ELSE 兜底');
    assert.equal(game.config.detections[0].target, '甲');
    assert.equal(game.config.detections[1].fallback, true);
    assert.ok(parsed.nodes.filter((node) => node.type === 'cond').every((node) => node.consumed), '旧语法条件也应标记为已消费');
}

// 13) 运行时跳过已消费的条件节点，不再在对局结束后重复跳转
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  % IF 检测 1 4,4 -> 甲',
        '  % ELSE -> 乙',
        '结束对局',
        ':甲',
        '说 [导员ZERO] 命中',
        '结束',
        ':乙',
        '说 [导员ZERO] 未命中',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const runtime = new StoryRuntime(parsed);
    const conds = runtime.nodes.filter((node) => node.type === 'cond');
    const start = runtime.nodes.indexOf(conds[0]);
    runtime.index = start;
    runtime.step_cond(conds[0]);
    assert.equal(runtime.index, start + 1, '已消费的条件应直接推进而不是跳转');
}

console.log('story-detect-move: all assertions passed');
