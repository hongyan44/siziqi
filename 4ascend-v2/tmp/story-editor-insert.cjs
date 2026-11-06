/*
 * 剧情编辑器：新增命令的插入位置（当前行之后）+ 右侧命令快捷栏
 * 运行： bun tmp/story-editor-insert.cjs
 * 说明：直接抽取 html/docs/story.html 内联脚本中的 insertIndexFor，避免复制代码。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.resolve(__dirname, '../html/docs/story.html'), 'utf8');
const start = html.indexOf('const insertIndexFor =');
const end = html.indexOf('const insertRow =');
assert.ok(start > 0 && end > start, '应能在 story.html 中定位 insertIndexFor');

const insertIndexFor = new Function(`${html.slice(start, end)}; return insertIndexFor;`)();

// 1) 未选中当前行时追加到末尾（保持原有行为）
{
    const list = ['a', 'b', 'c'];
    assert.equal(insertIndexFor(list, null), 3);
    assert.equal(insertIndexFor([], null), 0);
    console.log('PASS: 无当前行时追加到末尾');
}

// 2) 选中某行时插入到它之后（含首行、中间行、末行）
{
    const list = ['a', 'b', 'c'];
    assert.equal(insertIndexFor(list, list[0]), 1);
    assert.equal(insertIndexFor(list, list[1]), 2);
    assert.equal(insertIndexFor(list, list[2]), 3);
    console.log('PASS: 有当前行时插入到该行之后');
}

// 3) 当前行已被删除（引用不在列表中）时回退到末尾，不产生越界
{
    const list = ['a', 'b'];
    assert.equal(insertIndexFor(list, 'gone'), 2);
    const result = list.slice();
    result.splice(insertIndexFor(list, 'gone'), 0, 'x');
    assert.deepEqual(result, ['a', 'b', 'x']);
    console.log('PASS: 当前行失效时回退末尾');
}

// 4) 页面结构：右侧快捷栏存在，且与下方命令栏共享同一份命令定义
{
    assert.ok(/id='command_dock'/.test(html), '应存在右侧命令快捷栏容器');
    assert.ok(/id='command_dock_list'/.test(html), '应存在右侧快捷栏按钮列表');
    assert.ok(html.includes("dock.append(makeCommandButton(command, 'dock-label'))"), '右侧快捷栏应复用命令定义');
    assert.ok(html.includes('bar.append(makeCommandButton(command))'), '下方命令栏应保持原有渲染');
    console.log('PASS: 右侧快捷栏结构');
}

// 5) 当前行高亮：蓝色荧光虚线边框样式与选中监听
{
    assert.ok(html.includes('.editor-row.current-row'), '应有当前行高亮样式');
    assert.ok(html.includes('outline: 2px dashed #3b82f6'), '当前行应为蓝色虚线边框');
    assert.ok(html.includes("addEventListener('pointerdown'"), '应支持点击选中当前行');
    assert.ok(html.includes("addEventListener('focusin'"), '应支持聚焦选中当前行');
    assert.ok(html.includes('applyCurrentHighlight()'), '重渲染后应恢复当前行高亮');
    console.log('PASS: 当前行高亮');
}

console.log('story-editor-insert: ALL PASS');
