/*
 * @Description: 人机对战棋盘上方 ID 取登录昵称的回归测试
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/ai.cjs'), 'utf8');

const matched = source.match(/\/\*\*[\s\S]*?\*\/\nconst login_profile_self = async \(\) => \{[\s\S]*?\n\};/);
assert(matched, '未找到 login_profile_self 实现');

const load = async (window) => new Function('window', `${matched[0]}; return login_profile_self;`)(window);

(async () => {
    // 未登录：没有 token，沿用本地玩家名
    assert.strictEqual(await (await load({ 'get_token': () => null }))(), null);

    // 未加载 http 模块或请求失败：回退本地玩家名
    assert.strictEqual(await (await load({ 'get_token': () => new Uint8Array([1]) }))(), null);

    // 请求抛错：回退本地玩家名
    assert.strictEqual(await (await load({
        'get_token': () => new Uint8Array([1]),
        'http_user_info': async () => { throw new Error('network'); },
    }))(), null);

    // 登录且有昵称：使用昵称，并保留昵称颜色
    const profile = await (await load({
        'get_token': () => new Uint8Array([1]),
        'http_user_info': async () => ({ 'name': '神秘下棋猫', 'name_color': '#ff0000' }),
    }))();
    assert.deepStrictEqual(profile, { 'name': '神秘下棋猫', 'color': '#ff0000' });

    // 登录但昵称为空：仍按未登录处理
    assert.strictEqual(await (await load({
        'get_token': () => new Uint8Array([1]),
        'http_user_info': async () => ({ 'name': '' }),
    }))(), null);

    // 未设置昵称颜色：昵称为空字符串，仍使用登录昵称
    assert.deepStrictEqual(await (await load({
        'get_token': () => new Uint8Array([1]),
        'http_user_info': async () => ({ 'name': '天牛' }),
    }))(), { 'name': '天牛', 'color': '' });

    // 页面必须加载 http 模块，否则无法取得昵称
    const page = fs.readFileSync(path.join(ROOT, 'root/pages/local/ai.html'), 'utf8');
    assert(page.includes('/js/ref/http.min.js'), '人机对战页面缺少 http.min.js');
    assert(!page.includes('?v=replace'), '人机对战页面存在未替换的缓存占位符');

    console.log('ai-name-login: all assertions passed');
})();
