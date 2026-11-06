// 回归测试：剧情编辑器首屏卡死
//   1. risk api 的 DES 解密必须为线性实现，大响应体不得出现 O(n²) 阻塞
//   2. 剧情编辑器只能用 meta 模式拉取角色（不下发整库图片）
//   3. 后端 character_query 支持 meta 且可省略 rep / image
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const load_api = (file) => {
    const window = {};
    new Function('window', read(file).replace('verf();', ''))(window);
    return window.RiskExports.Api;
};

// 1. 加解密一致性 + 线性性能
{
    const legacy = load_api('risk/api.cjs');
    const current = load_api('js/risk/api.cjs');
    const payload = Array.from({ length: 120000 }, (_, i) => (i * 31 + 7) % 256);
    const cipher = legacy.encrypt(payload);
    const expected = legacy.decrypt(cipher);
    const t0 = Date.now();
    const actual = current.decrypt(cipher);
    const elapsed = Date.now() - t0;
    assert.strictEqual(actual.length, expected.length, '解密长度必须与旧实现一致');
    assert.ok(actual.every((value, index) => value === expected[index]), '解密结果必须与旧实现逐字节一致');
    assert.ok(elapsed < 2000, `120KB 解密耗时 ${elapsed}ms，应小于 2000ms（旧实现约 4000ms 以上）`);
    console.log(`decrypt ok: 120KB in ${elapsed}ms`);
}

// 2. 前端只能请求 meta
{
    const http = read('js/ref/http.cjs');
    assert.ok(http.includes('options.meta'), 'http.cjs 的 http_story_character_query 必须支持 meta 选项');
    const page = read('html/docs/story.html');
    assert.ok(page.includes('http_story_character_query(null, { \'meta\': true })'), '剧情编辑器必须以 meta 模式拉取角色');
}

// 3. 后端支持 meta
{
    const backend = read('../4ascend-online/src/api/http/Story.cpp');
    assert.ok(backend.includes('bool with_images'), 'character_json 必须支持省略图片');
    assert.ok(backend.includes('json_flag(value, "meta")'), 'character_query 必须解析 meta 参数');
    assert.ok(backend.includes('character_json(record, nullptr, !meta_only)'), 'character_query 必须把 meta 传给 character_json');
}

// 4. 产物校验
{
    const api_min = read('root/js/risk/api.min.js');
    assert.ok(!api_min.includes('.concat('), 'api.min.js 不应保留逐块 concat 的 O(n²) 解密');
    assert.ok(read('root/js/ref/http.min.js').includes('meta'), 'http.min.js 产物必须包含 meta');
    assert.ok(read('root/pages/docs/story.html').includes('meta'), 'story.html 产物必须包含 meta');
    assert.ok(!read('root/pages/docs/story.html').includes('?v=replace'), 'story.html 不应残留缓存占位符');
}

console.log('story-editor-freeze: all assertions passed');
