/*
 * 剧情编辑器：JQBJ 导入文件名解析（「序号-标题.jqbj」回填关卡信息）
 * 运行： bun tmp/story-editor-import.test.cjs
 * 说明：直接抽取 html/docs/story.html 内联脚本中的 parseJQBJFileName，避免复制代码。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.resolve(__dirname, '../html/docs/story.html'), 'utf8');
const start = html.indexOf('const parseJQBJFileName =');
assert.ok(start > 0, '应能在 story.html 中定位 parseJQBJFileName');
const end = html.indexOf('// 导入按钮', start);
assert.ok(end > start, 'parseJQBJFileName 定义应完整');
const parseJQBJFileName = new Function(`${html.slice(start, end)}; return parseJQBJFileName;`)();

// 标准导出文件名
assert.deepEqual(parseJQBJFileName('3-序章.jqbj'), { 'level': 3, 'title': '序章' });
// 标题含连字符时只按第一个「-」切分
assert.deepEqual(parseJQBJFileName('12-终章-回归.jqbj'), { 'level': 12, 'title': '终章-回归' });
// 扩展名大小写不敏感
assert.deepEqual(parseJQBJFileName('7-测试.JQBJ'), { 'level': 7, 'title': '测试' });
// 标题含空白字符时整体保留（导出侧已替换非法字符，这里只去首尾空白）
assert.deepEqual(parseJQBJFileName('5- 重逢 .jqbj'), { 'level': 5, 'title': '重逢' });
// 非导出格式不回填
assert.equal(parseJQBJFileName('script.jqbj'), null);
assert.equal(parseJQBJFileName('序章.jqbj'), null);
assert.equal(parseJQBJFileName('3-.jqbj'), null);
assert.equal(parseJQBJFileName('-序章.jqbj'), null);
assert.equal(parseJQBJFileName('3-序章.txt'), null);
assert.equal(parseJQBJFileName('3-序章.jqbj.bak'), null);
// 异常输入不抛错
assert.equal(parseJQBJFileName(''), null);
assert.equal(parseJQBJFileName(null), null);
assert.equal(parseJQBJFileName(undefined), null);

console.log('story-editor-import: 全部断言通过');
