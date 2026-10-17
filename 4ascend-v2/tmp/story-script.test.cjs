/*
 * 剧情脚本引擎：验证 StoryScript 解析/校验/还原 与 StoryRuntime 状态机。
 * 运行： bun tmp/story-script.test.cjs
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

const { StoryScript, StoryRuntime, DEFAULT_CATALOG } = load('story.cjs');

const CLEAN = [
    '# 注释行被忽略',
    '[导员ZERO] 你好，<玩家名称>。',
    '? 选择是否观看',
    '- 观看 -> 教程',
    '- 不观看 -> 结束',
    ':教程',
    '[导员ZERO] 我们开始吧。',
    '* 对局 第一场',
    '  残局码=abc123',
    '  刷草点=4,4;5,4;6,5',
    '  刷草计划=3:4,4;5,4|9:2,2',
    '  我方=黑',
    '  先手=白',
    '  胜利=胜利',
    '  失败=失败',
    ':胜利',
    '[导员ZERO] 干得漂亮！',
    '结束',
    ':失败',
    '[导员ZERO] 再来一次。',
    '-> 教程',
].join('\n');

const TYPES = ['say', 'choice', 'label', 'say', 'game', 'label', 'say', 'end', 'label', 'say', 'jump'];

// 1) 解析：节点流与标签表
{
    const parsed = StoryScript.parse(CLEAN);
    assert.deepEqual(parsed.errors, [], '正常剧本不应有解析错误');
    assert.deepEqual(parsed.nodes.map((n) => n.type), TYPES, '节点类型序列应一致');
    assert.deepEqual(Object.keys(parsed.labels).sort(), ['教程', '胜利', '失败'].sort(), '标签表应包含教程/胜利/失败');
    assert.equal(parsed.nodes[0].speaker, '导员ZERO');
    assert.equal(parsed.nodes[0].text, '你好，<玩家名称>。');
    console.log('PASS: 解析节点流与标签表');
}

// 2) 选择节点与选项
{
    const parsed = StoryScript.parse(CLEAN);
    const choice = parsed.nodes[1];
    assert.equal(choice.type, 'choice');
    assert.equal(choice.prompt, '选择是否观看');
    assert.equal(choice.options.length, 2);
    assert.deepEqual(choice.options[0], { text: '观看', target: '教程' });
    assert.deepEqual(choice.options[1], { text: '不观看', target: '结束' });
    console.log('PASS: 选择节点与选项');
}

// 3) 对局节点配置归一化
{
    const parsed = StoryScript.parse(CLEAN);
    const game = parsed.nodes[4];
    assert.equal(game.type, 'game');
    assert.equal(game.title, '对局 第一场');
    assert.equal(game.config.archive, 'abc123');
    assert.deepEqual(game.config.points, [[4, 4], [5, 4], [6, 5]]);
    assert.deepEqual(game.config.schedule, [
        { turn: 3, cells: [[4, 4], [5, 4]] },
        { turn: 9, cells: [[2, 2]] },
    ], '刷草计划应解析为回合+坐标数组');
    assert.equal(game.config.self, 'black');
    assert.equal(game.config.first, 'white');
    assert.equal(game.config.win, '胜利');
    assert.equal(game.config.lose, '失败');
    assert.equal(game.config.draw, '');
    console.log('PASS: 对局配置归一化');
}

// 4) 校验：正常剧本无错误
{
    assert.deepEqual(StoryScript.validate(CLEAN), []);
    console.log('PASS: 校验正常剧本无错误');
}

// 5) 校验：跳转到不存在的标签
{
    const bad = '[A] hi\n-> 不存在\n结束';
    assert.ok(StoryScript.validate(bad).some((e) => e.includes('不存在')), '应报跳转目标不存在');
    console.log('PASS: 校验跳转目标不存在');
}

// 6) 校验：非法阵营
{
    const bad = '[A] hi\n* 对局 x\n  我方=绿\n结束';
    assert.ok(StoryScript.validate(bad).some((e) => e.includes('我方')), '应报我方非法');
    console.log('PASS: 校验非法阵营');
}

// 7) 校验：刷草点格式无效
{
    const bad = '[A] hi\n* 对局 x\n  刷草点=9,9\n结束';
    assert.ok(StoryScript.validate(bad).some((e) => e.includes('刷草点')), '应报刷草点无效');
    console.log('PASS: 校验刷草点无效');
}

// 8) 校验：选择节点没有选项
{
    const bad = '[A] hi\n? 空选择\n结束';
    assert.ok(StoryScript.validate(bad).some((e) => e.includes('选项为空')), '应报选项为空');
    console.log('PASS: 校验空选项');
}

// 9) 还原（stringify）能重新解析且校验通过
{
    const parsed = StoryScript.parse(CLEAN);
    const out = StoryScript.stringify(parsed);
    const again = StoryScript.parse(out);
    assert.deepEqual(again.nodes.map((n) => n.type), TYPES, '还原后节点类型序列一致');
    assert.deepEqual(Object.keys(again.labels).sort(), Object.keys(parsed.labels).sort());
    assert.deepEqual(StoryScript.validate(out), [], '还原后校验通过');
    console.log('PASS: stringify 圆环还原');
}

// 10) 运行时：推进 / 选择 / 对局结果跳转 / 结束
{
    const parsed = StoryScript.parse(CLEAN);
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().type, 'say');
    assert.equal(rt.is_end(), false);

    assert.equal(rt.advance().type, 'choice');
    assert.equal(rt.choose(0).text, '我们开始吧。', '选择“观看”应跳到教程标签');
    assert.equal(rt.advance().type, 'game');

    assert.equal(rt.resolve_game('win'), '胜利');
    assert.equal(rt.resolve_game('lose'), '失败');
    assert.equal(rt.resolve_game('draw'), null);

    assert.equal(rt.finish_game('win').text, '干得漂亮！');
    assert.equal(rt.advance().type, 'end');
    assert.equal(rt.is_end(), true);

    assert.equal(rt.goto('失败').text, '再来一次。');
    assert.equal(rt.advance().type, 'jump');
    assert.equal(rt.current().target, '教程');
    assert.equal(rt.goto(rt.current().target).text, '我们开始吧。');

    assert.equal(rt.goto('结束').type, 'end');
    assert.equal(rt.is_end(), true);
    console.log('PASS: StoryRuntime 状态机');
}

// 11) 对局未配置结局标签时推进到下一节点
{
    const parsed = StoryScript.parse('[A] hi\n* 对局 x\n  我方=黑\n[A] done\n结束');
    const rt = new StoryRuntime(parsed);
    rt.advance();
    assert.equal(rt.current().type, 'game');
    assert.equal(rt.finish_game('win').text, 'done', '无配置时应直接推进');
    console.log('PASS: 对局无结局配置时推进');
}

// 12) 内置目录每关剧本都能通过校验
{
    assert.ok(DEFAULT_CATALOG.levels.length >= 1);
    DEFAULT_CATALOG.levels.forEach((level) => {
        assert.deepEqual(StoryScript.validate(level.script), [], `内置关卡“${level.title}”应校验通过`);
    });
    console.log('PASS: 内置目录剧本校验通过');
}

// 13) 标注节点：箭头 / 圈 / 清除 解析
{
    const parsed = StoryScript.parse('[A] hi\n@ 箭头 名字\n@ 圈 4,4\n@ 清除\n结束');
    assert.deepEqual(parsed.errors, [], '标注行不应产生解析错误');
    const marks = parsed.nodes.filter((n) => n.type === 'mark');
    assert.equal(marks.length, 3);
    assert.equal(marks[0].kind, 'arrow');
    assert.equal(marks[0].target, '名字');
    assert.equal(marks[0].color, null);
    assert.equal(marks[1].kind, 'circle');
    assert.deepEqual(marks[1].cell, [4, 4], '圈坐标应解析为 [4,4]');
    assert.equal(marks[2].kind, 'clear');
    console.log('PASS: 标注节点解析');
}

// 14) 标注颜色覆盖 色=
{
    const parsed = StoryScript.parse('[A] hi\n@ 箭头 棋盘 色=#12ab34\n结束');
    const mark = parsed.nodes.find((n) => n.type === 'mark');
    assert.equal(mark.target, '棋盘');
    assert.equal(mark.color, '#12ab34');
    console.log('PASS: 标注颜色覆盖');
}

// 15) 标注校验：未知锚点 / 非法圈坐标 / 未知类型
{
    const badAnchor = '[A] hi\n@ 箭头 不存在的东西\n结束';
    assert.ok(StoryScript.validate(badAnchor).some((e) => e.includes('锚点未知')), '应报锚点未知');
    const badCell = '[A] hi\n@ 圈 9,9\n结束';
    assert.ok(StoryScript.validate(badCell).some((e) => e.includes('圈坐标无效')), '应报圈坐标无效');
    const badKind = '[A] hi\n@ 涂鸦 名字\n结束';
    assert.ok(StoryScript.validate(badKind).some((e) => e.includes('标注类型无效')), '应报标注类型无效');
    console.log('PASS: 标注校验');
}

// 16) 标注还原（stringify）可重新解析且保持语义
{
    const src = '[A] hi\n@ 箭头 名字 色=#ff3b30\n@ 圈 2,6\n@ 清除\n结束';
    const out = StoryScript.stringify(StoryScript.parse(src));
    assert.ok(out.includes('@ 箭头 名字 色=#ff3b30'), `箭头应完整还原：${out}`);
    assert.ok(out.includes('@ 圈 2,6'), '圈应完整还原');
    assert.ok(out.includes('@ 清除'), '清除应完整还原');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 标注还原');
}

// 17) 刷草计划：解析与还原
{
    const src = '[A] hi\n* 对局 x\n  刷草计划=3:4,4;5,4|9:2,2\n结束';
    const parsed = StoryScript.parse(src);
    const game = parsed.nodes.find((n) => n.type === 'game');
    assert.deepEqual(game.config.schedule, [
        { turn: 3, cells: [[4, 4], [5, 4]] },
        { turn: 9, cells: [[2, 2]] },
    ]);
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('刷草计划=3:4,4;5,4|9:2,2'), `刷草计划应完整还原：${out}`);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 刷草计划解析与还原');
}

// 18) 刷草计划：格式无效应报错
{
    const badTurn = '[A] hi\n* 对局 x\n  刷草计划=abc:4,4\n结束';
    assert.ok(StoryScript.validate(badTurn).some((e) => e.includes('刷草计划')), '应报刷草计划回合无效');
    const badCell = '[A] hi\n* 对局 x\n  刷草计划=3:9,9\n结束';
    assert.ok(StoryScript.validate(badCell).some((e) => e.includes('刷草计划')), '应报刷草计划坐标无效');
    console.log('PASS: 刷草计划校验');
}

// 19) 刷草计划：解析坐标时过滤越界/缺失的点
{
    const parsed = StoryScript.parse('[A] hi\n* 对局 x\n  刷草计划=2:0,0;9,9;3,3\n结束');
    const game = parsed.nodes.find((n) => n.type === 'game');
    assert.deepEqual(game.config.schedule, [{ turn: 2, cells: [[0, 0], [3, 3]] }], '越界坐标应被丢弃');
    console.log('PASS: 刷草计划过滤越界坐标');
}

// 20) GameStory：定时刷草按回合触发 / 去重 / 非法宿主跳过
{
    const { PLANT_ENUM: PLANT, STONE_ENUM: STONE } = load('fascend/enum.cjs');
    const { Board } = load('fascend/board.cjs');
    const { State } = load('fascend/state.cjs');
    const { RandAIC, RandUnity } = load('fascend/rand.cjs');
    const { GameStory } = load('fascend/game_story.cjs');

    const board = new Board(9, 9);
    const state = new State();
    const game = new GameStory(board, state, new RandAIC(1), new RandUnity(2));
    // 隔离自然刷草，只验证定时刷草
    game.natural_plant = false;
    game.plant_schedule = [{ turn: 3, cells: [[4, 4], [5, 4]] }, { turn: 5, cells: [[1, 1]] }];

    state.turn_count = 2;
    assert.equal(game.ed_pl_1(), undefined, '未到回合不应刷草');

    state.turn_count = 3;
    const first = game.ed_pl_1();
    assert.equal(first.length, 2, '第 3 回合应刷 2 株草');
    assert.equal(board.get_pos(4, 4).plant, PLANT.ONE);
    assert.equal(board.get_pos(5, 4).plant, PLANT.ONE);

    state.turn_count = 4;
    assert.equal(game.ed_pl_1(), undefined, '已触发的计划不应重复触发');

    // 1,1 放置普通棋子后该点不再是合法宿主，应跳过
    state.turn_count = 5;
    board.set_pos(1, 1, STONE.BLACK, PLANT.NONE);
    const second = game.ed_pl_1();
    assert.equal(second, undefined, '宿主被占用的点应跳过，结果为 undefined');
    assert.equal(game.plant_fired.has(1), true, '跳过也要标记为已触发');
    console.log('PASS: GameStory 定时刷草');
}

console.log('story-script: ALL PASS');
