/*
 * 剧情编辑器：复制模式的行模型拷贝 / 本地缓存粘贴还原
 * 运行： bun tmp/story-editor-copy.test.cjs
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

const html = fs.readFileSync(path.resolve(__dirname, '../html/docs/story.html'), 'utf8');
const start = html.indexOf('const normalizeHex =');
const end = html.indexOf('const kindOptionsHtml');
assert.ok(start > 0 && end > start, '应能在 story.html 中定位行模型函数');
const code = html.slice(start, end);

// 行类型定义来自编辑器源码，保证粘贴校验与编辑器一致
const kindsStart = html.indexOf('const ROW_KINDS =');
const kindsEnd = html.indexOf('];', kindsStart);
assert.ok(kindsStart > 0 && kindsEnd > kindsStart, '应能在 story.html 中定位 ROW_KINDS');
const ROW_KINDS = new Function(`${html.slice(kindsStart, kindsEnd + 2)}; return ROW_KINDS;`)();

const storyCharacters = [
    { 'name': '导员ZERO', 'expressions': [{ 'name': '微笑' }] },
];
const nextBoxColor = () => '#6f42c1';
const editor = new Function(
    'window', 'StoryScript', 'COND_TEXT', 'storyCharacters', 'nextBoxColor', 'lastFace', 'ROW_KINDS',
    `let rows = [];
${code}
return {
    rowsFromScript,
    toScript: (list) => rowsToScript(list),
    load: (script) => { const list = rowsFromScript(script); rows = list; return list; },
    rowsValue: () => rows,
    selectionRows,
    normalizeCopiedRows,
    state: () => ({ rows, lastFace }),
};`
)(globalThis.window, StoryScript, COND_TEXT, storyCharacters, nextBoxColor, { 'character': '', 'expression': '' }, ROW_KINDS);

// 1) 单选：只拷贝被勾选的行，顺序按原列表，字段与手动缩进完整保留
{
    const rows = editor.load([
        '框 序章 色=#6f42c1',
        '  [导员ZERO] 第一句',
        '  [导员ZERO|微笑] 第二句',
        '结束框',
    ].join('\n'));
    const picked = editor.selectionRows(rows, new Set([rows[2]]));
    assert.deepEqual(picked, [{ 'kind': 'say', 'character': '导员ZERO', 'expression': '微笑', 'text': '第二句', 'indent': 0 }]);
    // 克隆后修改不影响编辑器里的原行
    picked[0].text = '改过的台词';
    assert.equal(rows[2].text, '第二句');
    console.log('PASS: 单行复制按选择过滤且为深拷贝');
}

// 2) 多选：即使选择顺序打乱也按原行顺序输出，保留结构缩进
{
    const rows = editor.load([
        '* 对局 第一场',
        '  残局码=abc123',
        '  [导员ZERO] 对局台词',
        '结束此对局',
        '[导员ZERO] 场外台词',
    ].join('\n'));
    const picked = editor.selectionRows(rows, new Set([rows[3], rows[1]]));
    assert.deepEqual(picked.map((row) => row.kind), ['config', 'game_end']);
    assert.equal(picked[0].key, '残局码');
    assert.equal(picked[0].value, 'abc123');
    assert.deepEqual(picked[1], { 'kind': 'game_end', 'indent': 0 });
    console.log('PASS: 多选按原顺序复制');
}

// 3) 本地缓存往返：JSON 序列化后能原样还原，且是新的对象
{
    const rows = editor.load('框 A 色=#0d6efd\n  [导员ZERO] 一段台词\n结束框\n[导员ZERO] 结尾');
    const selected = new Set([rows[0], rows[1], rows[2]]);
    const copied = editor.selectionRows(rows, selected);
    const payload = JSON.parse(JSON.stringify({ 'v': 1, 'rows': copied }));
    const restored = editor.normalizeCopiedRows(payload);
    assert.deepEqual(restored, copied, '缓存还原应完全一致');
    assert.notEqual(restored[0], copied[0], '还原应为全新对象');
    // 粘贴回原脚本后仍是同样的 DSL
    const list = editor.rowsValue();
    list.splice(3, 0, ...restored);
    assert.equal(editor.toScript(list), '框 A 色=#0d6efd\n  [导员ZERO] 一段台词\n结束框\n框 A 色=#0d6efd\n  [导员ZERO] 一段台词\n结束框\n[导员ZERO] 结尾');
    console.log('PASS: 本地缓存往返与粘贴还原');
}

// 4) 兼容纯数组缓存，过滤非法行，避免损坏缓存污染编辑器
{
    const payload = [null, { 'kind': 'bogus' }, { 'kind': 'say', 'character': '导员ZERO', 'text': 'ok' }, 'x'];
    const restored = editor.normalizeCopiedRows(payload);
    assert.deepEqual(restored, [{ 'kind': 'say', 'character': '导员ZERO', 'text': 'ok' }]);
    assert.deepEqual(editor.normalizeCopiedRows(null), []);
    assert.deepEqual(editor.normalizeCopiedRows({}), []);
    console.log('PASS: 纯数组缓存兼容与非法行过滤');
}

// 5) 选择为空时不产生拷贝内容（复制按钮会给出提示而不是写缓存）
{
    const rows = editor.load('[导员ZERO] 台词');
    assert.deepEqual(editor.selectionRows(rows, new Set()), []);
    console.log('PASS: 空选择不产生拷贝内容');
}

console.log('story-editor-copy: ALL PASS');
