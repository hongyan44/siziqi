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
    assert.deepEqual(game.config.points, [[3, 5], [4, 5], [5, 4]], '作者坐标 1-9 先横后竖应转为内部坐标');
    assert.deepEqual(game.config.schedule, [
        { turn: 3, cells: [[3, 5], [4, 5]] },
        { turn: 9, cells: [[1, 7]] },
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
    const bad = '[A] hi\n* 对局 x\n  刷草点=10,10\n结束';
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
    assert.deepEqual(marks[1].cell, [3, 5], '圈坐标 4,4 应按 1-9 先横后竖转为内部 [3,5]');
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
    const badCell = '[A] hi\n@ 圈 10,10\n结束';
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
        { turn: 3, cells: [[3, 5], [4, 5]] },
        { turn: 9, cells: [[1, 7]] },
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
    const badCell = '[A] hi\n* 对局 x\n  刷草计划=3:10,10\n结束';
    assert.ok(StoryScript.validate(badCell).some((e) => e.includes('刷草计划')), '应报刷草计划坐标无效');
    console.log('PASS: 刷草计划校验');
}

// 19) 刷草计划：解析坐标时过滤越界/缺失的点
{
    const parsed = StoryScript.parse('[A] hi\n* 对局 x\n  刷草计划=2:0,0;9,9;3,3\n结束');
    const game = parsed.nodes.find((n) => n.type === 'game');
    assert.deepEqual(game.config.schedule, [{ turn: 2, cells: [[8, 0], [2, 6]] }], '越界坐标应被丢弃，9,9 是合法角落');
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

// 21) 台词扩展：[角色|表情] 解析（向后兼容 [角色]）
{
    const parsed = StoryScript.parse('[导员ZERO|微笑] 早上好。\n[导员ZERO] 普通台词。\n[|生气] 无角色名。\n结束');
    assert.deepEqual(parsed.errors, [], '角色表情台词不应产生解析错误');
    const says = parsed.nodes.filter((n) => n.type === 'say');
    assert.deepEqual(
        { speaker: says[0].speaker, expression: says[0].expression, text: says[0].text },
        { speaker: '导员ZERO', expression: '微笑', text: '早上好。' }
    );
    assert.equal(says[1].expression, '', '未写表情时 expression 应为空（旧剧本不受影响）');
    assert.equal(says[1].speaker, '导员ZERO');
    assert.equal(says[2].speaker, '', '空角色名应保持为空');
    assert.equal(says[2].expression, '生气', '角色名可留空，表情仍生效');
    console.log('PASS: [角色|表情] 台词解析');
}

// 22) 台词扩展：还原（stringify）只在有表情时输出 |
{
    const out = StoryScript.stringify(StoryScript.parse('[导员ZERO|微笑] 早上好。\n[导员ZERO] 普通台词。\n结束'));
    assert.ok(out.includes('[导员ZERO|微笑] 早上好。'), `带表情应还原出 |：${out}`);
    assert.ok(out.includes('[导员ZERO] 普通台词。'), '无表情不应多出 |');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 角色表情台词还原');
}

// 23) 条件分支：% IF / % ELSE 解析
{
    const src = [
        '[A] 打完这局。',
        '* 对局 第一场',
        '% IF 胜利 -> 赢',
        '% IF lose -> 输',
        '% ELSE -> 平',
        ':赢', '[A] 赢了', '结束',
        ':输', '[A] 输了', '结束',
        ':平', '[A] 平了', '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '条件分支不应产生解析错误');
    const conds = parsed.nodes.filter((n) => n.type === 'cond');
    assert.equal(conds.length, 3);
    assert.deepEqual(conds[0], { type: 'cond', kind: 'if', condition: 'win', target: '赢', indent: 0 });
    assert.deepEqual(conds[1], { type: 'cond', kind: 'if', condition: 'lose', target: '输', indent: 0 });
    assert.deepEqual(conds[2], { type: 'cond', kind: 'else', condition: null, target: '平', indent: 0 }, 'ELSE 无判定条件');
    assert.deepEqual(StoryScript.validate(src), []);
    console.log('PASS: 条件分支解析');
}

// 24) 条件分支：校验与还原
{
    const badTarget = '[A] hi\n% IF 胜利 -> 不存在\n结束';
    assert.ok(StoryScript.validate(badTarget).some((e) => e.includes('不存在')), '条件分支目标不存在应报错');
    const badCond = '[A] hi\n% IF 大胜 -> 结束';
    assert.ok(StoryScript.validate(badCond).some((e) => e.includes('条件无效')), '未知条件应报错');
    const badArrow = '[A] hi\n% IF 胜利\n结束';
    assert.ok(StoryScript.validate(badArrow).some((e) => e.includes('缺少')), '缺少 -> 标签应报错');

    const src = '[A] hi\n% IF 胜利 -> 赢\n% ELSE -> 输\n:赢\n[A] 赢\n结束\n:输\n[A] 输\n结束';
    const out = StoryScript.stringify(StoryScript.parse(src));
    assert.ok(out.includes('% IF 胜利 -> 赢'), `IF 应还原：${out}`);
    assert.ok(out.includes('% ELSE -> 输'), `ELSE 应还原：${out}`);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 条件分支校验与还原');
}

// 25) 运行时：对局结果写入 last_outcome，供条件分支判定
{
    const src = [
        '[A] 开打。',
        '* 对局 第一场',
        '  我方=黑',
        '  胜利=赢', '  失败=输', '  平局=平',
        ':赢', '[A] 赢了', '结束',
        ':输', '[A] 输了', '结束',
        ':平', '[A] 平了', '结束',
    ].join('\n');
    const rt = new StoryRuntime(StoryScript.parse(src));
    assert.equal(rt.last_outcome, null, '初始应无对局结果上下文');
    assert.equal(rt.advance().type, 'game');
    assert.equal(rt.finish_game('lose').text, '输了');
    assert.equal(rt.last_outcome, 'lose', '对局结束应记录结果供条件分支使用');
    console.log('PASS: 对局结果写入条件上下文');
}

// 26) 运行时：step_cond 命中跳转 / 未命中前进 / ELSE 兜底
{
    const src = [
        '[A] 开打。',
        '* 对局 第一场',
        '  我方=黑',
        '% IF 胜利 -> 赢',
        '% ELSE -> 输',
        ':赢', '[A] 赢了', '结束',
        ':输', '[A] 输了', '结束',
    ].join('\n');

    // 命中：先手推进到 IF 节点，结果为胜利时跳转胜利分支
    const hit = new StoryRuntime(StoryScript.parse(src));
    assert.equal(hit.advance().type, 'game');
    assert.equal(hit.advance().type, 'cond');
    hit.last_outcome = 'win';
    assert.equal(hit.step_cond(hit.current()).text, '赢了', '命中 IF 胜利 应跳转');

    // 未命中：结果为失败时跳过 IF，继续走到 ELSE 并跳转失败分支
    const miss = new StoryRuntime(StoryScript.parse(src));
    assert.equal(miss.advance().type, 'game');
    assert.equal(miss.advance().type, 'cond');
    miss.last_outcome = 'lose';
    assert.equal(miss.step_cond(miss.current()).kind, 'else', '未命中 IF 应前进到 ELSE');
    assert.equal(miss.step_cond(miss.current()).text, '输了', 'ELSE 应兜底跳转');

    // 无结果（未打过对局）时 IF 不命中，由 ELSE 兜底
    const none = new StoryRuntime(StoryScript.parse(src));
    none.advance(); none.advance();
    assert.equal(none.step_cond(none.current()).kind, 'else', '无对局结果时 IF 不命中');
    assert.equal(none.step_cond(none.current()).text, '输了');
    console.log('PASS: step_cond 条件跳转');
}

// 27) 结束对局：解析归一化（步数:N / 胜负 / 未配置）
{
    const gameOf = (text) => StoryScript.parse(text).nodes.find((n) => n.type === 'game');

    const steps = StoryScript.parse('[A] x\n* 对局\n  结束对局=步数:12\n结束');
    assert.deepEqual(steps.errors, [], '结束对局不应产生解析错误');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:12\n结束').config.end_kind, 'steps');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:12\n结束').config.end_steps, 12);
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:12\n结束').config.end_text, '步数:12');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数：8\n结束').config.end_steps, 8, '全角冒号也接受');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:0\n结束').config.end_kind, 'steps', '步数:0 仍是步数模式');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:0\n结束').config.end_steps, 0, '步数允许为 0（点击屏幕结束本局）');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=步数:0\n结束').config.end_text, '步数:0');

    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=胜负\n结束').config.end_kind, 'outcome');
    assert.equal(gameOf('[A] x\n* 对局\n  结束对局=胜负\n结束').config.end_steps, 0);
    assert.equal(gameOf('[A] x\n* 对局\n  我方=黑\n结束').config.end_kind, '', '未配置时无结束条件（等价胜负）');
    assert.equal(gameOf('[A] x\n* 对局\n  结束残局=步数:5\n结束').config.end_steps, 5, '旧键 结束残局 仍兼容');
    console.log('PASS: 结束对局解析');
}

// 28) 结束对局：校验与还原
{
    assert.deepEqual(StoryScript.validate('[A] x\n* 对局\n  结束对局=胜负\n结束'), []);
    assert.deepEqual(StoryScript.validate('[A] x\n* 对局\n  结束对局=步数:12\n结束'), []);
    assert.deepEqual(StoryScript.validate('[A] x\n* 对局\n  结束对局=步数:0\n结束'), [], '步数:0 应通过校验');
    assert.ok(
        StoryScript.validate('[A] x\n* 对局\n  结束对局=随便\n结束').some((e) => e.includes('结束对局')),
        '非法结束对局应报错'
    );

    const out = StoryScript.stringify(StoryScript.parse('[A] x\n* 对局\n  残局码=AB12\n  结束对局=步数:12\n:赢\n[A] 赢\n结束'));
    assert.ok(out.includes('结束对局=步数:12'), `结束对局应还原：${out}`);
    assert.ok(out.indexOf('残局码=AB12') < out.indexOf('结束对局=步数:12'), '结束对局应紧随残局码');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 结束对局校验与还原');
}

// 29) 步数对话：解析 / 校验 / 还原
{
    const src = '[A] x\n* 对局\n  步数对话=3:中场|6:结尾\n:中场\n[A] 中场\n继续对局\n:结尾\n[A] 结尾\n结束';
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '步数对话不应产生解析错误');
    const game = parsed.nodes.find((n) => n.type === 'game');
    assert.deepEqual(game.config.dialogues, [
        { type: 'step', step: 3, target: '中场' },
        { type: 'step', step: 6, target: '结尾' },
    ], '步数对话应解析为 类型+手数+标签');
    assert.equal(game.config.dialogues_text, '3:中场|6:结尾');
    assert.equal(StoryScript.parse('[A] x\n* 对局\n  步数对话=2：中场\n:中场\n[A] 中场\n结束').nodes.find((n) => n.type === 'game').config.dialogues[0].step, 2, '全角冒号也接受');

    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('步数对话=3:中场|6:结尾'), `步数对话应还原：${out}`);
    const ordered = StoryScript.stringify(StoryScript.parse('[A] x\n* 对局\n  残局码=AB\n  结束对局=胜负\n  步数对话=3:中场\n:中场\n[A] 中场\n继续对局\n结束'));
    assert.ok(ordered.indexOf('结束对局=胜负') < ordered.indexOf('步数对话=3:中场'), '步数对话应排在结束对局之后');
    assert.deepEqual(StoryScript.validate(src), [], '应校验通过');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');

    assert.ok(
        StoryScript.validate('[A] x\n* 对局\n  步数对话=abc:中场\n:中场\n[A] x\n结束').some((e) => e.includes('步数对话')),
        '格式无效应报错'
    );
    assert.ok(
        StoryScript.validate('[A] x\n* 对局\n  步数对话=3:不存在\n结束').some((e) => e.includes('不存在')),
        '目标标签不存在应报错'
    );
    console.log('PASS: 步数对话解析/校验/还原');
}

// 30) 继续对局：节点解析与运行时前进
{
    const parsed = StoryScript.parse('[A] hi\n继续对局\n[A] 之后\n结束');
    assert.deepEqual(parsed.errors, [], '继续对局不应产生解析错误');
    assert.deepEqual(parsed.nodes.map((n) => n.type), ['say', 'resume', 'say', 'end']);
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('继续对局'), '继续对局应还原');

    const rt = new StoryRuntime(parsed);
    assert.equal(rt.advance().type, 'resume', '继续对局应为 resume 节点');
    assert.equal(rt.advance().text, '之后', 'resume 之后应能继续推进');
    console.log('PASS: 继续对局节点解析');
}

// 31) 步数对话：按落子总手数匹配（模拟播放页触发判定）
{
    const config = StoryScript.parse('[A] x\n* 对局\n  步数对话=1:开场|2:中场|3:结尾\n:开场\n[A] 开场\n继续对局\n:中场\n[A] 中场\n继续对局\n:结尾\n[A] 结尾\n继续对局\n结束').nodes.find((n) => n.type === 'game').config;
    const triggered = new Set();
    const pick = (plies) => (config.dialogues || []).find((item) => item.step === plies && !triggered.has(item.step));
    assert.equal(pick(0), undefined, '尚未落子（总手数 0）不触发');
    assert.equal(pick(1).target, '开场', '总手数 1（玩家第一步）触发开场');
    triggered.add(1);
    assert.equal(pick(1), undefined, '同一手不重复触发');
    assert.equal(pick(2).target, '中场', '总手数 2（AI 应手）触发中场');
    assert.equal(pick(3).target, '结尾', '总手数 3（玩家第二次）触发结尾');
    console.log('PASS: 步数对话按落子总手数匹配');
}

// 32) 结束此对局：对局块结束标记的解析 / 还原 / 运行时跳过
{
    const src = '[A] x\n* 对局 第一场\n  残局码=AB\n[A] 场内对白\n结束此对局\n[A] 场外对白\n结束';
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '结束此对局不应产生解析错误');
    assert.deepEqual(
        parsed.nodes.map((n) => n.type),
        ['say', 'game', 'say', 'game_end', 'say', 'end'],
        '结束此对局应为独立的 game_end 节点'
    );
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('结束此对局'), `结束此对局应还原：${out}`);
    assert.deepEqual(StoryScript.validate(src), [], '结束此对局剧本应校验通过');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');

    // 运行时把 game_end 当普通节点跳过，不影响后续推进
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.advance().type, 'game');
    assert.equal(rt.advance().type, 'say');
    assert.equal(rt.advance().type, 'game_end');
    assert.equal(rt.advance().text, '场外对白', 'game_end 之后应能继续推进');
    console.log('PASS: 结束此对局块标记');
}

// 33) 选择节点可携带角色表情：? [角色|表情] 提示
{
    const src = '[A] hi\n? [导员ZERO|微笑] 选择是否观看\n- 观看 -> 教程\n- 不观看 -> 结束\n:教程\n[A] 开始\n结束';
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '选择角色表情不应产生解析错误');
    const choice = parsed.nodes[1];
    assert.equal(choice.type, 'choice');
    assert.equal(choice.speaker, '导员ZERO', '应解析出角色名');
    assert.equal(choice.expression, '微笑', '应解析出表情名');
    assert.equal(choice.prompt, '选择是否观看', '提示文字不应带角色前缀');
    assert.equal(choice.options.length, 2, '选项不应受影响');

    // 只写角色不写表情
    const onlyChar = StoryScript.parse('? [导员ZERO] 提示\n- 继续 -> 结束\n结束').nodes[0];
    assert.equal(onlyChar.speaker, '导员ZERO');
    assert.equal(onlyChar.expression, '');
    assert.equal(onlyChar.prompt, '提示');

    // 旧写法：无角色表情，保持兼容
    const legacy = StoryScript.parse('? 旧提示\n- 继续 -> 结束\n结束').nodes[0];
    assert.equal(legacy.speaker, '');
    assert.equal(legacy.expression, '');
    assert.equal(legacy.prompt, '旧提示');

    // 还原后保持角色表情，并可再次解析
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('? [导员ZERO|微笑] 选择是否观看'), `选择角色表情应完整还原：${out}`);
    const again = StoryScript.parse(out).nodes[1];
    assert.equal(again.speaker, '导员ZERO');
    assert.equal(again.expression, '微笑');
    assert.equal(again.prompt, '选择是否观看');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');

    // 运行时选择逻辑不变
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.advance().type, 'choice');
    assert.equal(rt.choose(0).text, '开始', '选项仍能跳转到目标标签');
    console.log('PASS: 选择节点角色表情');
}

// 34) 分组框：解析 / 颜色 / 缩进 / 运行时跳过
{
    const src = [
        '框 开场 色=#6f42c1',
        '  [A] 开场白',
        '  框 分支 色=#dc3545',
        '    [A] 分支白',
        '  结束框',
        '  结束框',
        '[A] 收尾',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '分组框不应产生解析错误');
    assert.deepEqual(
        parsed.nodes.map((n) => n.type),
        ['box', 'say', 'box', 'say', 'box_end', 'box_end', 'say', 'end'],
        '分组框与结束框应是独立节点'
    );
    assert.equal(parsed.nodes[0].title, '开场');
    assert.equal(parsed.nodes[0].color, '#6f42c1');
    assert.equal(parsed.nodes[2].title, '分支');
    assert.equal(parsed.nodes[2].color, '#dc3545');
    assert.equal(parsed.nodes[1].indent, 1, '第二行应记录 1 级缩进');
    assert.equal(parsed.nodes[3].indent, 2, '嵌套框内的台词应记录 2 级缩进');
    assert.equal(parsed.nodes[4].indent, 1, '结束框也应记录缩进');
    assert.deepEqual(StoryScript.validate(src), [], '分组框剧本应校验通过');

    // 运行时把分组框当普通节点跳过
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().type, 'box');
    assert.equal(rt.advance().text, '开场白', 'box 之后应到达台词');
    assert.equal(rt.advance().type, 'box');
    assert.equal(rt.advance().text, '分支白');
    assert.equal(rt.advance().type, 'box_end');
    assert.equal(rt.advance().type, 'box_end');
    assert.equal(rt.advance().text, '收尾', '结束框之后应能继续推进');

    // stringify 保留标题、颜色与缩进
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('{ 开场 色=#6f42c1'), `框应还原：${out}`);
    assert.ok(out.includes('  { 分支 色=#dc3545'), `嵌套框应带缩进还原：${out}`);
    assert.ok(out.includes('  }'), `结束框应带缩进还原：${out}`);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 分组框解析/缩进/还原');
}

// 35) 分组框：颜色非法 / 结束框缺失或多余
{
    assert.ok(
        StoryScript.validate('框 标题 色=red\n结束框\n结束').some((e) => e.includes('颜色无效')),
        '非法颜色应报错'
    );
    assert.ok(
        StoryScript.validate('框 标题\n[A] hi\n结束').some((e) => e.includes('缺少')),
        '框缺少结束框应报错'
    );
    assert.ok(
        StoryScript.validate('结束框\n结束').some((e) => e.includes('没有对应')),
        '多余结束框应报错'
    );
    console.log('PASS: 分组框校验');
}

// 36) 结束后=继续：解析 / 校验 / 还原 / 运行时直接继续剧情
{
    const src = [
        '[A] hi',
        '* 对局 x',
        '  结束后=继续',
        '  胜利=胜利',
        '[A] 继续剧情',
        '% IF 胜利 -> 胜利',
        '[A] 后续',
        '结束',
        ':胜利',
        '[A] 胜',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '结束后=继续 不应产生解析错误');
    const game = parsed.nodes.find((n) => n.type === 'game');
    assert.equal(game.config.post, 'continue');
    assert.equal(game.config.post_text, '继续');
    assert.deepEqual(StoryScript.validate(src), [], '结束后=继续 应校验通过');

    // 结束后=结果 与留空等价
    const asResult = StoryScript.parse('[A] hi\n* 对局 x\n  结束后=结果\n结束').nodes.find((n) => n.type === 'game');
    assert.equal(asResult.config.post, 'result');

    // 还原保留该配置
    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('结束后=继续'), `结束后 应还原：${out}`);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');

    // 运行时：不跳胜利标签，直接进入下一段剧情；胜负结果仍保留给 % IF
    const rt = new StoryRuntime(parsed);
    rt.advance();
    assert.equal(rt.current().type, 'game');
    assert.equal(rt.last_outcome, null);
    assert.equal(rt.finish_game('win').text, '继续剧情', '结束后=继续 应直接前进而不是跳胜利标签');
    assert.equal(rt.last_outcome, 'win', '胜负结果仍应记录');
    assert.equal(rt.advance().type, 'cond');
    assert.equal(rt.step_cond(rt.current()).text, '胜', '% IF 仍可按获胜结果跳转');

    // 非法取值应报错
    assert.ok(
        StoryScript.validate('[A] hi\n* 对局 x\n  结束后=下一步\n结束').some((e) => e.includes('结束后')),
        '非法的结束后取值应报错'
    );
    console.log('PASS: 结束后=继续 解析/校验/还原/运行时');
}

// 37) 步数对话：四类触发条件解析 / 坐标统一 / 还原 / 非法坐标校验
{
    const src = '[A] x\n* 对局\n  步数对话=3:步数|落子5,5:落子|拿起:拿起|AI拿起:AI拿起\n:步数\n[A] 步数\n继续对局\n:落子\n[A] 落子\n继续对局\n:拿起\n[A] 拿起\n继续对局\n:AI拿起\n[A] AI\n继续对局\n结束';
    const config = StoryScript.parse(src).nodes.find((n) => n.type === 'game').config;
    assert.deepEqual(config.dialogues, [
        { type: 'step', step: 3, target: '步数' },
        { type: 'cell', x: 4, y: 4, cell_text: '5,5', target: '落子' },
        { type: 'pick', target: '拿起' },
        { type: 'ai_pick', target: 'AI拿起' },
    ], '四类触发条件应按顺序解析，5,5 对应内部正中心 [4,4]');
    assert.equal(config.dialogues_text, '3:步数|落子5,5:落子|拿起:拿起|AI拿起:AI拿起');
    assert.deepEqual(StoryScript.validate(src), [], '四类触发剧本应校验通过');

    // 角落与边界：1,1 为左下角、9,9 为右上角
    const corners = StoryScript.parse('[A] x\n* 对局\n  步数对话=落子1,1:左下|落子9,9:右上\n:左下\n[A] 左下\n继续对局\n:右上\n[A] 右上\n继续对局\n结束').nodes.find((n) => n.type === 'game').config;
    assert.deepEqual(corners.dialogues[0], { type: 'cell', x: 0, y: 8, cell_text: '1,1', target: '左下' });
    assert.deepEqual(corners.dialogues[1], { type: 'cell', x: 8, y: 0, cell_text: '9,9', target: '右上' });

    // 还原后语义不变
    const out = StoryScript.stringify(StoryScript.parse(src));
    assert.ok(out.includes('步数对话=3:步数|落子5,5:落子|拿起:拿起|AI拿起:AI拿起'), `四类触发应完整还原：${out}`);
    const again = StoryScript.parse(out).nodes.find((n) => n.type === 'game').config.dialogues;
    assert.deepEqual(again, config.dialogues, '还原后四类触发应一致');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');

    // 非法位置坐标：0、10 应报错
    ['0,5', '10,5', '5,0', '5,10'].forEach((cell) => {
        const bad = `[A] x\n* 对局\n  步数对话=落子${cell}:中场\n:中场\n[A] 中场\n继续对局\n结束`;
        assert.ok(StoryScript.validate(bad).some((e) => e.includes('对话触发坐标无效')), `${cell} 应报坐标无效`);
    });
    console.log('PASS: 四类对话触发解析与坐标统一');
}

// 38) 结构化菜单块：解析 / 校验 / 还原 / 运行时按选项执行并汇合
{
    const src = [
        '? 你要去哪？',
        '  - 左边',
        '    [A] 走左边',
        '  - 右边',
        '    [A] 走右边',
        '结束选择',
        '[A] 汇合了',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '结构化菜单不应产生解析错误');
    assert.deepEqual(
        parsed.nodes.map((n) => n.type),
        ['choice', 'label', 'say', 'jump', 'label', 'say', 'jump', 'choice_end', 'label', 'say', 'end'],
        '每个选项应编译为「自动标签 + 内容 + 跳到块尾」'
    );
    const choice = parsed.nodes[0];
    assert.equal(choice.block, true, '结构化菜单应标记为 block');
    assert.deepEqual(choice.options.map((item) => item.text), ['左边', '右边']);
    assert.equal(choice.options[0].explicit, false);
    assert.equal(choice.options[0].body_nodes.length, 1, '选项内容应挂到 body_nodes 供编辑器还原');
    assert.deepEqual(StoryScript.validate(src), [], '结构化菜单剧本应校验通过');

    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().type, 'choice');
    assert.equal(rt.choose(0).text, '走左边', '选择左分支应进入对应内容');
    assert.equal(rt.advance().text, '汇合了', '选项内容播完后应自动汇合到「结束选择」之后');

    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('? 你要去哪？'), `菜单提示应还原：${out}`);
    assert.ok(out.includes('  - 左边') && out.includes('    [A] 走左边'), `选项内容应按层级还原：${out}`);
    assert.ok(out.includes('结束选择'), `结束选择应还原：${out}`);
    assert.ok(!out.includes('__menu_'), '内部自动标签不应出现在还原文本中');
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 结构化菜单块解析/运行时/还原');
}

// 39) 结构化菜单块：选项内嵌菜单，选择后逐层汇合
{
    const src = [
        '? 外层',
        '  - A',
        '    ? 内层',
        '      - A1',
        '        [X] 叶子1',
        '      - A2',
        '        [X] 叶子2',
        '    结束选择',
        '  - B',
        '    [X] B',
        '结束选择',
        '[X] 尾',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '嵌套菜单不应产生解析错误');
    const outer = parsed.nodes[0];
    assert.equal(outer.block, true);
    const inner = outer.options[0].body_nodes.find((n) => n.type === 'choice');
    assert.ok(inner && inner.block, '选项内应能再嵌套结构化菜单');
    assert.deepEqual(inner.options.map((item) => item.text), ['A1', 'A2']);

    const rt = new StoryRuntime(parsed);
    rt.choose(0);
    assert.equal(rt.current().type, 'choice', '选择外层 A 后应进入内层菜单');
    assert.equal(rt.choose(1).text, '叶子2');
    assert.equal(rt.advance().text, '尾', '内层与外层菜单都应逐层汇合到最外层之后');

    const out = StoryScript.stringify(parsed);
    const again = StoryScript.parse(out);
    assert.deepEqual(again.errors, [], '嵌套菜单还原后应能重新解析');
    assert.deepEqual(StoryScript.validate(out), [], '嵌套菜单还原后应校验通过');
    assert.equal(again.nodes[0].options[0].body_nodes.filter((n) => n.type === 'choice').length, 1, '嵌套结构应保留');
    console.log('PASS: 嵌套结构化菜单');
}

// 40) 封装块：定义跳过 / 调用进入 / 播完返回调用点
{
    const src = [
        '定义 打招呼',
        '  [A] 第一次',
        '  [A] 第二次',
        '结束定义',
        '[A] 开始',
        '调用 打招呼',
        '[A] 回来',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '封装块不应产生解析错误');
    assert.deepEqual(
        parsed.nodes.map((n) => n.type),
        ['def', 'say', 'say', 'def_end', 'say', 'call', 'say', 'end'],
        '封装块应是独立节点'
    );
    assert.deepEqual(StoryScript.validate(src), [], '封装块剧本应校验通过');

    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, '开始', '未调用前应跳过封装块定义');
    assert.equal(rt.advance().text, '第一次', '调用应进入封装块');
    assert.equal(rt.advance().text, '第二次');
    assert.equal(rt.advance().text, '回来', '封装块播完应回到调用点之后');
    assert.equal(rt.call_stack.length, 0, '返回后调用栈应清空');
    assert.equal(rt.advance().type, 'end');

    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('定义 打招呼'), `封装块定义应还原：${out}`);
    assert.ok(out.includes('结束定义'), `结束定义应还原：${out}`);
    assert.ok(out.includes('调用 打招呼'), `调用应还原：${out}`);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    console.log('PASS: 封装块定义/调用/返回');
}

// 41) 封装块：多次调用复用 + 提前「返回」
{
    const src = [
        '定义 子过程',
        '  [A] 前',
        '  返回',
        '  [A] 不该出现',
        '结束定义',
        '调用 子过程',
        '调用 子过程',
        '[A] 收尾',
        '结束',
    ].join('\n');
    const rt = new StoryRuntime(StoryScript.parse(src));
    assert.equal(rt.current().text, '前');
    assert.equal(rt.advance().text, '前', '第二次调用应复用同一封装块');
    assert.equal(rt.advance().text, '收尾', '提前返回后不应执行其后的内容');
    assert.equal(rt.advance().type, 'end');
    console.log('PASS: 封装块多次调用与提前返回');
}

// 42) 封装块：菜单选项内调用封装块，返回后继续走选项后续内容
{
    const src = [
        '定义 提示',
        '  [A] 来自封装块',
        '结束定义',
        '? 选择',
        '  - 调用',
        '    调用 提示',
        '    [A] 选项后续',
        '  - 跳过',
        '    [A] 跳过内容',
        '结束选择',
        '[A] 尾',
        '结束',
    ].join('\n');
    const rt = new StoryRuntime(StoryScript.parse(src));
    rt.choose(0);
    assert.equal(rt.current().text, '来自封装块');
    assert.equal(rt.advance().text, '选项后续', '封装块返回点应在选项内容中');
    assert.equal(rt.advance().text, '尾', '选项后续播完应汇合到菜单块之后');
    console.log('PASS: 菜单选项内调用封装块');
}

// 43) 封装块与菜单块：结构/引用校验
{
    assert.ok(
        StoryScript.validate('调用 不存在\n结束').some((e) => e.includes('不存在的封装块')),
        '调用未定义的封装块应报错'
    );
    assert.ok(
        StoryScript.validate('定义 A\n[A] hi\n结束').some((e) => e.includes('缺少「结束定义」')),
        '封装块缺少结束定义应报错'
    );
    assert.ok(
        StoryScript.validate('结束定义\n结束').some((e) => e.includes('没有对应的开始标记')),
        '多余结束定义应报错'
    );
    assert.ok(
        StoryScript.validate('[A] hi\n返回\n结束').some((e) => e.includes('必须位于封装块内')),
        '封装块外的返回应报错'
    );
    assert.ok(
        StoryScript.validate('定义 A\n  定义 B\n  结束定义\n结束定义\n结束').some((e) => e.includes('不能嵌套')),
        '封装块不能嵌套'
    );
    assert.ok(
        StoryScript.validate('定义 A\n[A] hi\n结束定义\n定义 A\n[A] hi\n结束定义\n结束').some((e) => e.includes('名称重复')),
        '封装块名称重复应报错'
    );
    assert.ok(
        StoryScript.validate('? 提示\n  - A -> 结束\n    [X] 多余内容\n结束选择\n结束').some((e) => e.includes('二者只能选一种')),
        '菜单选项同时写跳转与内容应报错'
    );
    assert.ok(
        StoryScript.validate('? 提示\n结束选择\n结束').some((e) => e.includes('没有任何选项')),
        '空菜单块应报错'
    );
    console.log('PASS: 封装块与菜单块结构校验');
}

// 44) 角色资源收集：结构化菜单选项内的台词也应计入
{
    const src = [
        '? [旁白] 提示',
        '  - A',
        '    [左边|微笑] 左',
        '  - B',
        '    [右边] 右',
        '结束选择',
        '结束',
    ].join('\n');
    const faces = StoryScript.faces(StoryScript.parse(src));
    assert.deepEqual(
        faces.map((item) => item.name).sort(),
        ['旁白', '右边', '左边'].sort(),
        '选项内容中的角色也应被收集'
    );
    const left = faces.find((item) => item.name === '左边');
    assert.deepEqual(left.expressions, ['微笑'], '选项内容中的表情也应被收集');
    console.log('PASS: 菜单选项角色资源收集');
}

// 45) 结构化菜单选项内仍可写旧式「选择 + 跳转标签」，不能被父级「结束选择」误吞
{
    const src = [
        '? 外层',
        '  - A',
        '    ? [A] 旧式选择',
        '    - 进入 -> 左',
        '    - 离开 -> 右',
        '  - B',
        '    [A] B',
        '结束选择',
        ':左',
        '[A] 左边剧情',
        '结束',
        ':右',
        '[A] 右边剧情',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '菜单内容中的旧式选择不应产生错误');
    const outer = parsed.nodes[0];
    assert.equal(outer.block, true);
    const legacy = outer.options[0].body_nodes.find((node) => node.type === 'choice');
    assert.ok(legacy, '选项内容中应还原旧式选择节点');
    assert.equal(legacy.block, undefined, '旧式选择不应被标记为结构化菜单块');
    assert.deepEqual(legacy.options.map((item) => item.target), ['左', '右']);

    const rt = new StoryRuntime(parsed);
    rt.choose(0);
    assert.equal(rt.current().type, 'choice');
    assert.equal(rt.choose(0).text, '左边剧情');
    console.log('PASS: 菜单内容中的旧式选择');
}

// 46) 对话框不透明度：全局设置解析 / 校验 / 还原 / 运行时跳过
{
    const src = [
        '[A] hi',
        '对话框不透明度=35',
        '* 对局 x',
        '  残局码=AB',
        '  对话框不透明度=20',
        '  我方=黑',
        '结束',
    ].join('\n');
    const parsed = StoryScript.parse(src);
    assert.deepEqual(parsed.errors, [], '透明度设置不应产生解析错误');
    const settings = parsed.nodes.filter((n) => n.type === 'setting');
    assert.deepEqual(settings.map((n) => n.value), [35, 20], '全局与对局内设置都应解析');
    assert.equal(parsed.nodes.find((n) => n.type === 'game').config.self, 'black', '对局内的设置不应打断配置归属');
    assert.deepEqual(StoryScript.validate(src), [], '应校验通过');

    const out = StoryScript.stringify(parsed);
    assert.ok(out.includes('对话框不透明度=35') && out.includes('对话框不透明度=20'), `应完整还原：${out}`);
    const again = StoryScript.parse(out);
    assert.deepEqual(StoryScript.validate(out), [], '还原后应校验通过');
    assert.deepEqual(again.nodes.filter((n) => n.type === 'setting').map((n) => n.value), [35, 20]);

    // 播放时设置节点应被跳过，不阻挡台词与对局推进
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, 'hi');
    assert.equal(rt.advance().type, 'game', '设置节点应被跳过');
    assert.deepEqual(StoryScript.validate('对话框不透明度=999\n结束').some((e) => e.includes('对话框不透明度')), true, '越界应报错');
    console.log('PASS: 对话框不透明度解析/校验/还原/运行时');
}

// 47) JQBJ v0.4：变量定义、与/或/非、括号、四则运算与数值比较
{
    const src = [
        '设 分数 = 5',
        '设 目标 = 8',
        '设 已解锁 = 假',
        '赋值 分数 += 1',
        '如果 分数 + 5 > 目标 与 非 已解锁',
        '[A] 进入高分',
        '结束如果',
        '如果 分数 >= 3 或 目标 < 0',
        '[A] 进入兜底',
        '结束如果',
        '[A] 结束',
        '结束',
    ].join('\n');
    assert.deepEqual(StoryScript.validate(src), [], 'v0.4 条件应校验通过');
    const rt = new StoryRuntime(StoryScript.parse(src));
    assert.equal(rt.current().text, '进入高分', '与 / 非 / 算术比较应生效');
    assert.equal(rt.vars['分数'].value, 6, '变量赋值后应参与运算');
    assert.equal(rt.advance().text, '进入兜底', '或 条件应生效');
    assert.equal(rt.advance().text, '结束', '分支结束后应汇合');

    // 运算符别名、括号与优先级
    assert.deepEqual(StoryScript.validate('如果 (2 + 3 * 4 == 14) && !(1 > 2) || 假\n[A] x\n结束如果\n结束'), [], '别名运算符应校验通过');
    assert.deepEqual(StoryScript.validate('如果 3 >= 3 与 "a" != "b"\n[A] x\n结束如果\n结束'), [], '字面量数值/字符串比较应校验通过');
    assert.deepEqual(StoryScript.validate('设 名字 = "小明"\n如果 名字 == 小明\n[A] x\n结束如果\n结束'), [], '裸词应兼容为字符串常量');

    // 非法条件
    const bad = [
        ['如果 1 < 2 < 3\n[A] x\n结束如果\n结束', '连续比较'],
        ['如果 (1 > 2\n[A] x\n结束如果\n结束', '括号没有闭合'],
        ['如果 1 >\n[A] x\n结束如果\n结束', '条件不完整'],
        ['设 分数 = 1\n如果 分数\n[A] x\n结束如果\n结束', '结果必须是布尔值'],
        ['设 分数 = 1\n如果 分数 + "x" > 3\n[A] x\n结束如果\n结束', '两侧必须是数字'],
        ['设 分数 = 1\n如果 非 分数\n[A] x\n结束如果\n结束', '需要布尔值'],
        ['设 分数 = 1\n如果 分数 > 1 与 分数\n[A] x\n结束如果\n结束', '两侧必须是布尔条件'],
        ['如果 未声明 > 1\n[A] x\n结束如果\n结束', '未声明的变量'],
    ];
    bad.forEach(([script, keyword]) => {
        assert.ok(StoryScript.validate(script).some((e) => e.includes(keyword)), `${keyword} 应报错：${StoryScript.validate(script)}`);
    });
    console.log('PASS: JQBJ v0.4 变量/逻辑/数值比较');
}

console.log('story-script: ALL PASS');
