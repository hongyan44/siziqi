/*
 * 剧情按关卡加载：验证 StoryScript.faces 只收集本关用到的角色/表情，以及页面/接口的懒加载接线。
 * 运行： bun tmp/story-lazy-load.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const ok = (name, condition) => { assert.ok(condition, name); console.log(`ok - ${name}`); };

// 加载剧情引擎（源码混用 export，按项目惯例改写后求值）
{
    const source = path.resolve(root, 'js/global/story.cjs');
    const module = { exports: {} };
    const text = fs.readFileSync(source, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(require, module, module.exports);
    globalThis.__story = module.exports;
}
const { StoryScript } = globalThis.__story;

// 1) faces：台词与选择都统计，同名表情去重，空表情保留角色代表图
{
    const parsed = StoryScript.parse([
        '[导员ZERO] 你好',
        '[导员ZERO|微笑] 很高兴见到你',
        '? [导员ZERO|疑惑] 要不要继续？',
        '- 继续 -> 下一段',
        '- 结束 -> 结束',
        ':下一段',
        '[???] 只是旁白',
        '[|微笑] 没有角色的台词被忽略',
        '结束',
    ].join('\n'));
    assert.deepEqual(parsed.errors, [], '示例剧本不应有解析错误');
    const faces = StoryScript.faces(parsed);
    assert.deepEqual(faces, [
        { 'name': '导员ZERO', 'expressions': ['微笑', '疑惑'] },
        { 'name': '???', 'expressions': [] },
    ], 'faces 应只收集本关角色与用到的表情');
    ok('faces 收集角色与表情', true);
    assert.deepEqual(StoryScript.faces({ 'nodes': [] }), [], '空剧本没有角色');
    assert.deepEqual(StoryScript.faces(null), [], '缺省参数安全');
    ok('faces 空输入安全', true);
}

// 2) 渲染层接线
{
    const page = read('html/docs/story.html');
    ok('剧情目录改用按关卡接口', page.includes('http_story_level_query()'));
    ok('进入剧情模式不再预取角色图', !page.includes('Promise.allSettled([loadAccount(), loadCharacters()])'));
    ok('角色数据改为编辑时懒加载', page.includes('const ensureCharacters = async () =>') && page.includes('await ensureCharacters()'));
    ok('保存前合并服务端完整目录', page.includes('loadServerCatalog') && page.includes('persistCatalog(full)'));
}

{
    const page = read('html/docs/story-play.html');
    ok('播放页只取本关剧本', page.includes('http_story_level_query(targetLevel)'));
    ok('播放页用剧本收集角色', page.includes('StoryScript.faces(parsed)'));
    ok('播放页按角色集过滤请求', page.includes('loadCharacters(faces)'));
    ok('播放页进入前预加载角色图', page.includes('preloadFaces(faces)'));
    ok('播放页不再全量拉取角色', !page.includes('http_story_character_query()'));
}

{
    const http = read('js/ref/http.cjs');
    ok('http 新增关卡接口', http.includes('/story/level_query') && http.includes('window.http_story_level_query'));
    ok('http 角色接口支持 faces 过滤', http.includes('faces && faces.length ? { faces } : {}'));
}

// 3) 后端接口
{
    const backend = read('../4ascend-online/src/api/http/Story.cpp');
    ok('后端注册 level_query', backend.includes('/story/level_query') && backend.includes('void level_query('));
    ok('后端角色接口支持 faces', backend.includes('bool parse_faces(') && backend.includes('character_json(record, &found->second)'));
}

// 4) 产物：min.js 与线上页面
{
    const story_min = read('root/js/global/story.min.js');
    ok('story.min 产物包含 faces', story_min.includes('faces'));
    const http_min = read('root/js/ref/http.min.js');
    ok('http.min 产物包含 /story/level_query', http_min.includes('/story/level_query'));
    const built_page = read('root/pages/docs/story.html');
    ok('产物页面使用关卡接口', built_page.includes('http_story_level_query'));
    ok('产物页面无角色预取', !built_page.includes('Promise.allSettled([loadAccount(),loadCharacters()])'));
    const built_play = read('root/pages/docs/story-play.html');
    ok('产物播放页使用关卡接口', built_play.includes('http_story_level_query'));
    ok('产物播放页含预加载', built_play.includes('preloadFaces'));
}

console.log('全部剧情按关卡加载用例通过');
