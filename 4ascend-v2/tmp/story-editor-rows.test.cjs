/*
 * 剧情编辑器：行模型 <-> DSL 往返（缩进 / 分组框）
 * 运行： bun tmp/story-editor-rows.test.cjs
 * 说明：直接抽取 html/docs/story.html 内联脚本中的纯函数，避免复制代码。
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

const { StoryScript, COND_TEXT } = load('story.cjs');
globalThis.window = { 'StoryExports': globalThis.StoryExports };

// 抽取编辑器内联脚本里的行模型函数（normalizeHex ~ defaultFace）
const html = fs.readFileSync(path.resolve(__dirname, '../html/docs/story.html'), 'utf8');
const start = html.indexOf('const normalizeHex =');
const end = html.indexOf('const kindOptionsHtml');
assert.ok(start > 0 && end > start, '应能在 story.html 中定位行模型函数');
const code = html.slice(start, end);

const storyCharacters = [
    { 'name': '导员ZERO', 'expressions': [{ 'name': '微笑' }, { 'name': '严肃' }] },
    { 'name': 'Zero', 'expressions': [] },
];
const nextBoxColor = () => '#6f42c1';
const build = (characters) => new Function(
    'window', 'StoryScript', 'COND_TEXT', 'storyCharacters', 'nextBoxColor', 'lastFace',
    `let rows = [];
${code}
return {
    rowsFromScript,
    rowsToScript: () => rowsToScript(),
    rowsToJQBJ: () => rowsToJQBJ(),
    defaultFace,
    load: (script) => { const list = rowsFromScript(script); rows = list; return list; },
    state: () => ({ rows, lastFace }),
};`
)(globalThis.window, StoryScript, COND_TEXT, characters, nextBoxColor, { 'character': '', 'expression': '' });

const editor = build(storyCharacters);
const roundTrip = (script) => { editor.load(script); return editor.rowsToScript(); };

const shape = (script) => StoryScript.parse(script).nodes.map((node) => {
    const base = { 'type': node.type, 'indent': node.indent };
    if (node.type === 'say') return { ...base, 'speaker': node.speaker, 'expression': node.expression, 'text': node.text };
    if (node.type === 'box') return { ...base, 'title': node.title, 'color': node.color };
    if (node.type === 'game') return { ...base, 'title': node.title, 'config_raw': node.config_raw };
    if (node.type === 'label') return { ...base, 'name': node.name };
    if (node.type === 'jump') return { ...base, 'target': node.target };
    return base;
});

// 1) 分组框 + 嵌套 + 手动缩进：往返后语义与缩进完全一致
{
    const script = [
        '框 序章 色=#6f42c1',
        '  [导员ZERO] 开场白',
        '  框 回忆 色=#0d6efd',
        '    [导员ZERO|微笑] 很久以前……',
        '  结束框',
        '    [导员ZERO] 手动缩进的台词',
        '结束框',
        '[导员ZERO] 回到主线',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `应无损往返：\n${out}`);
    assert.deepEqual(shape(out), shape(script));
    console.log('PASS: 分组框嵌套 + 手动缩进往返');
}

// 2) 旧剧本（对局配置 2 空格、无分组框）往返后缩进保持不变
{
    const script = [
        '[导员ZERO] 你好',
        '* 对局 第一场',
        '  残局码=abc123',
        '  刷草点=4,4;5,4',
        '  胜利=胜利',
        '结束此对局',
        ':胜利',
        '  [导员ZERO] 手动缩进',
        '结束',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `旧剧本应无损往返：\n${out}`);
    console.log('PASS: 旧剧本往返');
}

// 3) 分组框颜色归一化（3 位缩写展开）与默认色兜底
{
    editor.load('框 A 色=#abc\n结束框');
    const rows = editor.state().rows;
    assert.equal(rows[0].color, '#abc', '解析应保留原始颜色写法');
    const out = editor.rowsToScript();
    assert.ok(out.includes('色=#abc'), `应保留颜色：${out}`);
    console.log('PASS: 分组框颜色往返');
}

// 4) 新台词默认角色：沿用上一次台词的角色/表情；表情无效时回退代表图
{
    editor.load('[导员ZERO|微笑] 第一句\n[导员ZERO] 第二句');
    assert.equal(editor.state().lastFace.character, '导员ZERO');
    assert.deepEqual(editor.defaultFace(), { 'character': '导员ZERO', 'expression': '' });
    editor.load('[导员ZERO|微笑] 只有一句');
    assert.deepEqual(editor.defaultFace(), { 'character': '导员ZERO', 'expression': '微笑' });
    console.log('PASS: 台词默认角色沿用');
}

// 5) 角色列表为空时默认角色为空，不报错
{
    const empty = build([]);
    assert.equal(empty.state().rows.length, 0);
    assert.deepEqual(empty.defaultFace(), { 'character': '', 'expression': '' });
    console.log('PASS: 空角色列表兜底');
}

// 6) 结束后=继续 配置行往返
{
    const script = [
        '[导员ZERO] 你好',
        '* 对局 第一场',
        '  结束对局=步数:12',
        '  结束后=继续',
        '结束此对局',
        '[导员ZERO] 继续剧情',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `结束后配置应无损往返：\n${out}`);
    assert.ok(editor.state().rows.some((row) => row.kind === 'config' && row.key === '结束后' && row.value === '继续'), '应还原结束后配置行');
    console.log('PASS: 结束后=继续 配置行往返');
}

// 7) 结构化菜单块：选项 + 内容 + 结束选择 无损往返
{
    const script = [
        '? 你要去哪？',
        '  - 左边',
        '    [导员ZERO] 往左走',
        '  - 右边',
        '    [导员ZERO] 往右走',
        '结束选择',
        '[导员ZERO] 汇合',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `菜单块应无损往返：\n${out}`);
    const rows = editor.state().rows;
    assert.equal(rows[0].kind, 'menu', '应还原为菜单块行');
    assert.equal(rows.filter((row) => row.kind === 'option').length, 2, '应还原两个选项行');
    assert.ok(rows.some((row) => row.kind === 'choice_end'), '应还原结束选择行');
    assert.deepEqual(shape(out), shape(script));
    console.log('PASS: 结构化菜单块往返');
}

// 8) 结构化菜单块：嵌套菜单无损往返
{
    const script = [
        '? 外层',
        '  - A',
        '    ? 内层',
        '      - A1',
        '        [导员ZERO] 叶子',
        '    结束选择',
        '结束选择',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `嵌套菜单应无损往返：\n${out}`);
    const rows = editor.state().rows;
    assert.equal(rows.filter((row) => row.kind === 'menu').length, 2, '应保留两层菜单');
    assert.equal(rows.filter((row) => row.kind === 'option').length, 2, '每层各有一个选项');
    console.log('PASS: 嵌套结构化菜单块往返');
}

// 9) 封装块 + 菜单 + 返回：无损往返
{
    const script = [
        '定义 流程',
        '  ? 继续？',
        '    - 是',
        '      [导员ZERO] 继续',
        '    - 否',
        '      [导员ZERO] 结束',
        '  结束选择',
        '  返回',
        '结束定义',
        '调用 流程',
        '[导员ZERO] 之后',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `封装块应无损往返：\n${out}`);
    const rows = editor.state().rows;
    assert.equal(rows[0].kind, 'def', '应还原封装块行');
    assert.ok(rows.some((row) => row.kind === 'def_end'), '应还原结束封装行');
    assert.ok(rows.some((row) => row.kind === 'call' && row.target === '流程'), '应还原调用封装行');
    assert.ok(rows.some((row) => row.kind === 'return'), '应还原返回行');
    assert.deepEqual(shape(out), shape(script));
    console.log('PASS: 封装块 + 菜单 + 返回往返');
}

// 10) 对话框不透明度：行模型还原与 DSL 往返（默认 60）
{
    const script = [
        '[导员ZERO] 你好',
        '对话框不透明度=35',
        '? 继续？',
        '  - 是',
        '    [导员ZERO] 继续',
        '结束选择',
    ].join('\n');
    const out = roundTrip(script);
    assert.equal(out, script, `透明度设置应无损往返：\n${out}`);
    const row = editor.state().rows.find((item) => item.kind === 'opacity');
    assert.ok(row, '应还原为对话框透明度行');
    assert.equal(row.value, 35, '应还原透明度数值');
    console.log('PASS: 对话框不透明度行往返');
}

// 11) 对话框不透明度：缺省值 60、带 % 号、边界与非法值
{
    editor.load('对话框不透明度=60%');
    const row = editor.state().rows.find((item) => item.kind === 'opacity');
    assert.equal(row.value, 60, '应支持带 % 号的写法');
    assert.equal(editor.rowsToScript(), '对话框不透明度=60');

    const parsed = StoryScript.parse('对话框不透明度=0\n对话框不透明度=100\n对话框不透明度=120\n对话框不透明度=abc');
    assert.deepEqual(parsed.nodes.map((node) => node.value), [0, 100, 60, 60], '边界值保留，非法值回退默认 60');
    assert.equal(parsed.errors.length, 2, '120 与 abc 应各报一条错误');
    console.log('PASS: 对话框不透明度默认值与边界');
}

// 12) 检测落子：平铺 JQBJ -> 行模型 -> JQBJ 无损往返
{
    const script = [
        '对局 教学',
        '  残局码 = abc123',
        '  检测 2 4,4 -> 中心',
        '结束对局',
        '标签 中心',
        '说 [导员ZERO|微笑] 第二手落在中心。',
        '继续对局',
    ].join('\n');
    editor.load(script);
    const rows = editor.state().rows;
    const detect = rows.find((row) => row.kind === 'detect');
    assert.ok(detect, '应还原检测落子行');
    assert.equal(detect.step, 2, '应还原检测步数');
    assert.equal(detect.cell, '4,4', '应还原检测坐标');
    assert.equal(detect.target, '中心', '应还原检测目标标签');
    assert.ok(!rows.some((row) => row.kind === 'detect_end'), '不应再有结束检测行');
    const out = editor.rowsToJQBJ();
    assert.equal(out, script, `检测落子行应无损往返：\n${out}`);
    const parsed = StoryScript.parse(out);
    assert.deepEqual(parsed.errors, [], '往返后的检测落子应仍可解析');
    const game = parsed.nodes.find((node) => node.type === 'game');
    assert.equal(game.config.detections.length, 1, '往返后检测规则仍应存在');
    console.log('PASS: 检测落子行往返');
}

// 13) IF / ELIF 扩展条件：行模型还原与 JQBJ 往返
{
    const script = [
        '% IF 胜利 -> 甲',
        '% ELIF 检测 1 4,4 -> 乙',
        '% ELIF 第 3 步 -> 丙',
        '% ELIF 选项 2 -> 丁',
        '% ELSE -> 戊',
        '标签 甲',
        '结束',
        '标签 乙',
        '结束',
        '标签 丙',
        '结束',
        '标签 丁',
        '结束',
        '标签 戊',
        '结束',
    ].join('\n');
    editor.load(script);
    const conds = editor.state().rows.filter((row) => row.kind === 'cond');
    assert.deepEqual(conds.map((row) => row.mode), ['if', 'elif', 'elif', 'elif', 'else'], '应还原 IF/ELIF/ELSE');
    assert.deepEqual(conds.map((row) => row.condition), ['win', 'move', 'step', 'option', ''], '应还原条件类型');
    assert.equal(conds[1].step, 1, '检测落子条件应还原步数');
    assert.equal(conds[1].cell, '4,4', '检测落子条件应还原坐标');
    assert.equal(conds[2].step, 3, '第几步落子应还原步数');
    assert.equal(conds[3].option, '2', '选项条件应还原内容');
    const out = editor.rowsToJQBJ();
    assert.equal(out, script, `IF/ELIF 条件应无损往返：\n${out}`);
    assert.deepEqual(StoryScript.parse(out).errors, [], '往返后的条件链应仍可解析');
    console.log('PASS: IF/ELIF 扩展条件往返');
}

console.log('story-editor-rows: ALL PASS');
