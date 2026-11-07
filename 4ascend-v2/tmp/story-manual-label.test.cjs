/*
 * 剧情脚本：标签「不顺序播放」解析 / 运行时跳过 / 调用与跳转 / 还原
 * 运行： bun tmp/story-manual-label.test.cjs
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

// 1) 解析：标签行的 不顺序播放 选项不影响名称与颜色
{
    const parsed = StoryScript.parse([
        '标签 隐藏回忆 色=#6f42c1 不顺序播放',
        '  [A] 回忆',
        '结束标签',
    ].join('\n'));
    assert.deepEqual(parsed.errors, []);
    const label = parsed.nodes.find((node) => node.type === 'label');
    assert.equal(label.name, '隐藏回忆', '选项不应混入标签名');
    assert.equal(label.color, '#6f42c1');
    assert.equal(label.manual, true, '应记录「不顺序播放」');
    assert.equal(label.block, true);
    console.log('PASS: 不顺序播放标签解析');
}

// 2) 顺序播放：整块跳过，直接进入标签块之后的内容
{
    const parsed = StoryScript.parse([
        '[A] 开场',
        '标签 隐藏 不顺序播放',
        '  [A] 不该出现',
        '结束标签',
        '[A] 后续',
        '结束',
    ].join('\n'));
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, '开场');
    assert.equal(rt.advance().text, '后续', '顺序播放应跳过不顺序播放标签块');
    assert.equal(rt.advance().type, 'end');
    console.log('PASS: 顺序播放跳过标签块');
}

// 3) 调用标签：正常播放，并在「结束标签」后返回调用点下一行
{
    const parsed = StoryScript.parse([
        '调用标签 隐藏',
        '[A] 回来之后',
        '结束',
        '标签 隐藏 不顺序播放',
        '  [A] 调用时播放',
        '结束标签',
    ].join('\n'));
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, '调用时播放', '调用后应进入标签块');
    assert.equal(rt.advance().text, '回来之后', '结束标签后应返回调用点下一行');
    console.log('PASS: 调用标签播放并返回');
}

// 4) 跳转（goto）：即使标记为不顺序播放也能进入
{
    const parsed = StoryScript.parse([
        '[A] 开场',
        '标签 隐藏 不顺序播放',
        '  [A] 跳转播放',
        '结束标签',
        '结束',
    ].join('\n'));
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, '开场');
    assert.equal(rt.goto('隐藏').text, '跳转播放', 'goto 应能进入不顺序播放标签');
    assert.equal(rt.advance().type, 'end', '跳转进入后顺序走完标签块');
    console.log('PASS: 跳转进入不顺序播放标签');
}

// 5) 嵌套：调用外层标签时，内层不顺序播放标签被跳过且不破坏返回栈
{
    const parsed = StoryScript.parse([
        '调用标签 外层',
        '[A] 主线继续',
        '结束',
        '标签 外层 不顺序播放',
        '  [A] 外层开头',
        '  标签 内层 不顺序播放',
        '    [A] 内层内容',
        '  结束标签',
        '  [A] 外层结尾',
        '结束标签',
    ].join('\n'));
    const rt = new StoryRuntime(parsed);
    assert.equal(rt.current().text, '外层开头');
    assert.equal(rt.advance().text, '外层结尾', '内层块应被顺序播放跳过');
    assert.equal(rt.advance().text, '主线继续', '外层结束标签应正常返回调用点');
    console.log('PASS: 嵌套不顺序播放标签');
}

// 6) stringify：保留选项并可再次解析
{
    const src = [
        '标签 回忆 色=#6f42c1 不顺序播放',
        '  [A] 回忆',
        '结束标签',
        '[A] 主线',
    ].join('\n');
    const out = StoryScript.stringify(StoryScript.parse(src));
    assert.equal(out, src, `应无损还原：\n${out}`);
    assert.equal(StoryScript.parse(out).nodes.find((node) => node.type === 'label').manual, true);
    console.log('PASS: 不顺序播放标签还原');
}

console.log('story-manual-label: ALL PASS');
