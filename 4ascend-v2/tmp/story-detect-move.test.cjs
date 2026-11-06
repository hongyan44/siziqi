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

// 4) IF / ELIF / ELSE 支持胜负、检测落子、第几步落子、选项
{
    const parsed = StoryScript.parse([
        '对局 教学',
        '  残局码=abc123',
        '结束对局',
        '% IF 胜利 -> 甲',
        '% ELIF 检测 1 4,4 -> 乙',
        '% ELIF 第 3 步 -> 丙',
        '% ELIF 选项 2 -> 丁',
        '% ELSE -> 戊',
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
        '结束对局',
        '% IF 检测 1 4,4 -> 甲',
        '% ELIF 第 2 步 -> 乙',
        '% ELIF 选项 2 -> 丙',
        '% ELSE -> 丁',
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

// 7) 序列化：检测与 IF/ELIF 条件可无损往返
{
    const script = [
        '对局 教学',
        '  残局码=abc123',
        '  检测 2 5,5 -> 中心',
        '结束对局',
        '% IF 检测 1 4,4 -> 甲',
        '% ELIF 第 3 步 -> 乙',
        '% ELIF 选项 2 -> 丙',
        '% ELSE -> 丁',
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

console.log('story-detect-move: all assertions passed');
