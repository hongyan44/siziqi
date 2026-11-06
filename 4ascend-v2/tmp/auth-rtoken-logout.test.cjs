/*
 * @Description: 回归：凭证刷新失败不等于过期——网络失败/超时不得清除登录态与跳转
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

process.chdir(path.join(__dirname, '..'));
const code = fs.readFileSync('js/ref/http.cjs', 'utf8');

const run = async (fetchImpl) => {
    const state = { 'toasts': [], 'replaced': [], 'set': [], 'removed': [], 'workers': [], 'timeout': undefined };
    const sandbox = {
        'console': { 'error': () => {}, 'log': () => {} },
        'location': { 'protocol': 'https:', 'hostname': 'siziqi.net', 'host': 'siziqi.net', 'pathname': '/pages/docs/story-characters.html', 'replace': (url) => state.replaced.push(url) },
        'localStorage': { 'getItem': () => null, 'setItem': () => {}, 'removeItem': (key) => state.removed.push(key) },
        'setInterval': (fn) => { state.workers.push(fn); return 1; },
        'clearInterval': () => {},
        'setTimeout': () => 0,
        'clearTimeout': () => {},
        'UiExports': { 'ShToast': class { error(message) { state.toasts.push(message); } } },
        'get_token': () => new Uint8Array([1, 2, 3]),
        'set_token': (token) => state.set.push(token),
        'sleep': async () => {},
        'fetch_task': async (_url, _params, timeout) => { state.timeout = timeout; return fetchImpl(); },
        'loaded': true,
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    await state.workers[0]();
    return state;
};

(async () => {
    const failed = await run(() => null);
    if (failed.removed.length || failed.replaced.length || failed.toasts.length) throw new Error('请求失败时不应登出');
    if (failed.timeout !== 15000) throw new Error(`凭证刷新超时应放宽，实际 ${failed.timeout}`);

    const expired = await run(() => ({ 'status': false }));
    if (expired.removed[0] !== 'token' || expired.replaced[0] !== '/' || !expired.toasts.includes('您的登录已过期！')) throw new Error('服务端明确判定失效时应登出');

    const ok = await run(() => ({ 'status': true, 'result': new Uint8Array([9]) }));
    if (ok.set.length !== 1 || ok.removed.length || ok.replaced.length) throw new Error('刷新成功时应保留登录态');

    const thrown = await run(() => { throw new Error('network'); });
    if (thrown.removed.length || thrown.replaced.length) throw new Error('请求异常时不应登出');

    console.log('auth-rtoken-logout: PASS');
})();
