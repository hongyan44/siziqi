/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 文档页（游戏规则 / 使用手册）管理员可编辑回归测试
 *   1. 抽取 html/docs/rule.html、html/docs/tip.html 的内联逻辑，在最小 DOM/网络桩上执行
 *   2. 校验管理员门禁、正文加载优先级（服务端 > 静态文件）、保存链路与失败恢复
 *   3. 校验轮询同步、空内容与超长内容拦截
 *   4. 校验前端产物与后端接口接线完整
 * 运行：node tmp/docs-admin-edit.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const project = path.join(root, '..');
const rule_source = path.join(root, 'html', 'docs', 'rule.html');
const tip_source = path.join(root, 'html', 'docs', 'tip.html');
const rule_built = path.join(root, 'root', 'pages', 'docs', 'rule.html');
const tip_built = path.join(root, 'root', 'pages', 'docs', 'tip.html');
const http_built = path.join(root, 'root', 'js', 'ref', 'http.min.js');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

// ---------- 最小 DOM / 浏览器环境桩 ----------
class StubEl {
    constructor(tag = 'div') {
        this.tagName = tag;
        this.children = [];
        this.style = {};
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.className = '';
        this.disabled = false;
        this.open = false;
        this._cls = new Set();
        this._handlers = {};
        const self = this;
        this.classList = {
            add: (n) => self._cls.add(n),
            remove: (n) => self._cls.delete(n),
            toggle: (n, f) => { (f === undefined ? !self._cls.has(n) : f) ? self._cls.add(n) : self._cls.delete(n); },
            contains: (n) => self._cls.has(n)
        };
    }
    addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
    async fire(type, ev = {}) { for (const fn of (this._handlers[type] || [])) await fn(ev); }
    appendChild(child) { this.children.push(child); return child; }
    append(...items) { this.children.push(...items); }
    remove() { this.removed = true; }
    querySelectorAll() { return []; }
}

const extract_logic = (htmlPath) => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    return { html, code: scripts[scripts.length - 1] };
};

const build_env = (overrides = {}) => {
    const elements = new Map();
    const getEl = (id) => { if (!elements.has(id)) elements.set(id, new StubEl()); return elements.get(id); };

    // 编辑入口默认隐藏，脚本应按身份决定是否移除 d-none
    getEl('admin_bar').classList.add('d-none');
    const dialog = getEl('dialog_edit');
    dialog.show = () => { dialog.open = true; };
    dialog.hide = () => { dialog.open = false; };

    const calls = { update: [], query: 0, lastKey: null };
    const window_stub = {
        loaded: false,
        addEventListener: () => {},
        alert: () => {},
        get_token: () => (overrides.token === undefined ? new Uint8Array([1, 2, 3]) : overrides.token),
        http_docs_query: async (key) => {
            calls.query += 1;
            calls.lastKey = key;
            return overrides.query ? overrides.query(key) : undefined;
        },
        http_user_info: async () => (overrides.info === undefined ? { level: 4 } : overrides.info),
        http_docs_update: async (token, key, data) => {
            calls.update.push({ token, key, data });
            return overrides.updateOk === undefined ? true : overrides.updateOk;
        }
    };

    const document_stub = {
        readyState: 'complete',
        hidden: false,
        images: [],
        fonts: { ready: Promise.resolve() },
        getElementById: getEl,
        createElement: (tag) => new StubEl(tag),
        querySelectorAll: () => [],
        addEventListener: () => {}
    };

    const localStorage_stub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

    let interval_cb = null;
    const setInterval_stub = (fn) => { interval_cb = fn; return 0; };

    const customElements_stub = { whenDefined: () => Promise.resolve() };
    const marked_stub = (md) => `MD:${md}`;
    marked_stub.setOptions = () => {};
    marked_stub.Renderer = class {};
    const hljs_stub = { getLanguage: () => false, highlight: () => '' };
    const fetch_stub = async () => ({ text: async () => 'STATIC' });

    return {
        getEl, calls, dialog,
        window_stub, document_stub, localStorage_stub, setInterval_stub,
        customElements_stub, marked_stub, hljs_stub, fetch_stub,
        get_interval: () => interval_cb
    };
};

const run_page = async (htmlPath, overrides = {}) => {
    const { code } = extract_logic(htmlPath);
    const env = build_env(overrides);
    const factory = new Function(
        'window', 'document', 'localStorage', 'setInterval', 'customElements', 'fetch', 'marked', 'hljs', 'requestAnimationFrame',
        `return ${code.trim()}`
    );
    await factory(
        env.window_stub, env.document_stub, env.localStorage_stub, env.setInterval_stub,
        env.customElements_stub, env.fetch_stub, env.marked_stub, env.hljs_stub, (cb) => cb()
    );
    return env;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

(async () => {
    console.log('\n[1] 管理员门禁与正文加载');
    const guest = await run_page(rule_source, { info: { level: 3 } });
    ok('非管理员不显示编辑入口', guest.getEl('admin_bar').classList.contains('d-none'));
    ok('无服务端内容时回退静态 Markdown', guest.getEl('content').innerHTML === 'MD:STATIC');
    ok('查询携带 rule 键', guest.calls.lastKey === 'rule');

    const no_token = await run_page(rule_source, { token: null });
    ok('未登录不显示编辑入口', no_token.getEl('admin_bar').classList.contains('d-none'));

    const admin = await run_page(rule_source, { info: { level: 4 } });
    ok('管理员显示编辑入口', !admin.getEl('admin_bar').classList.contains('d-none'));

    console.log('\n[2] 服务端内容优先与轮询同步');
    let remote_data = '# 远端正文';
    let remote_ts = 100;
    const live = await run_page(rule_source, {
        info: { level: 3 },
        query: () => ({ data: remote_data, updated_at: remote_ts })
    });
    ok('有服务端内容时优先展示', live.getEl('content').innerHTML === 'MD:# 远端正文');
    remote_data = '# 更新后的正文';
    remote_ts = 200;
    live.get_interval()();
    await tick();
    ok('轮询同步服务端改动', live.getEl('content').innerHTML === 'MD:# 更新后的正文');

    console.log('\n[3] 管理员保存链路');
    const saver = await run_page(rule_source, { info: { level: 4 } });
    await saver.getEl('button_edit').fire('click');
    ok('打开编辑器填充当前正文', saver.getEl('edit_content').value === 'STATIC');
    ok('对话框已打开', saver.dialog.open === true);
    saver.getEl('edit_content').value = '# 新正文';
    await saver.getEl('button_edit_save').fire('click');
    const up = saver.calls.update[0] || {};
    ok('保存调用 docs/update 且键与内容正确', saver.calls.update.length === 1 && up.key === 'rule' && up.data === '# 新正文');
    ok('保存后正文即时刷新', saver.getEl('content').innerHTML === 'MD:# 新正文');
    ok('保存后关闭对话框', saver.dialog.open === false);
    ok('保存后按钮恢复可用', saver.getEl('button_edit_save').disabled === false);

    console.log('\n[4] 保存失败与校验拦截');
    const failing = await run_page(rule_source, { info: { level: 4 }, updateOk: false });
    await failing.getEl('button_edit').fire('click');
    failing.getEl('edit_content').value = 'X';
    await failing.getEl('button_edit_save').fire('click');
    ok('保存失败给出提示', failing.getEl('edit_status').textContent.includes('保存失败'));
    ok('保存失败按钮恢复可用', failing.getEl('button_edit_save').disabled === false);
    ok('保存失败不刷新正文', failing.getEl('content').innerHTML === 'MD:STATIC');

    const blank = await run_page(rule_source, { info: { level: 4 } });
    await blank.getEl('button_edit').fire('click');
    blank.getEl('edit_content').value = '   ';
    await blank.getEl('button_edit_save').fire('click');
    ok('空内容拒绝提交', blank.calls.update.length === 0);
    ok('空内容给出提示', blank.getEl('edit_status').textContent.includes('不能为空'));

    const oversized = await run_page(rule_source, { info: { level: 4 } });
    await oversized.getEl('button_edit').fire('click');
    oversized.getEl('edit_content').value = 'x'.repeat(65537);
    await oversized.getEl('button_edit_save').fire('click');
    ok('超长内容拒绝提交', oversized.calls.update.length === 0);
    ok('超长内容给出提示', oversized.getEl('edit_status').textContent.includes('64KB'));

    console.log('\n[5] 使用手册页绑定');
    const tip = await run_page(tip_source, { info: { level: 4 } });
    ok('手册页查询携带 tip 键', tip.calls.lastKey === 'tip');
    ok('手册页管理员可见入口', !tip.getEl('admin_bar').classList.contains('d-none'));
    const tip_src = fs.readFileSync(tip_source, 'utf8');
    ok('手册页静态兜底为 tip.md', tip_src.includes("STATIC_MD = '/md/tip.md'"));

    console.log('\n[6] 前端产物完整性');
    const rule_built_text = fs.readFileSync(rule_built, 'utf8');
    ok('规则页产物含查询接口', rule_built_text.includes('http_docs_query'));
    ok('规则页产物含更新接口', rule_built_text.includes('http_docs_update'));
    ok('规则页产物含编辑入口', rule_built_text.includes('admin_bar'));
    ok('规则页产物无 ?v=replace 残留', !rule_built_text.includes('v=replace'));
    const tip_built_text = fs.readFileSync(tip_built, 'utf8');
    ok('手册页产物含更新接口', tip_built_text.includes('http_docs_update'));
    ok('手册页产物无 ?v=replace 残留', !tip_built_text.includes('v=replace'));

    const built_scripts = [...rule_built_text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let syntax_ok = true;
    let syntax_err = '';
    try {
        new Function(built_scripts[built_scripts.length - 1]);
    } catch (error) {
        syntax_ok = false;
        syntax_err = error.message;
    }
    ok('压缩产物逻辑脚本语法有效', syntax_ok, syntax_err);

    const http_min = fs.readFileSync(http_built, 'utf8');
    ok('http.min 含 /docs/query', http_min.includes('/docs/query'));
    ok('http.min 含 /docs/update', http_min.includes('/docs/update'));

    console.log('\n[6.1] 加密脚本加载顺序（否则 fetch_task/get_token 不可用，管理员入口永不显示）');
    const rule_src_text = fs.readFileSync(rule_source, 'utf8');
    ok('规则页源引用 risk 加密脚本', rule_src_text.includes('/js/risk/api.min.js'));
    ok('规则页源 risk 先于 must', rule_src_text.indexOf('/js/risk/api.min.js') < rule_src_text.indexOf('/js/ref/must.min.js'));
    ok('规则页源引用 ui 组件脚本', rule_src_text.includes('/js/global/ui.min.js'));
    ok('规则页源 ui 先于 must', rule_src_text.indexOf('/js/global/ui.min.js') < rule_src_text.indexOf('/js/ref/must.min.js'));
    ok('规则页产物引用 risk 加密脚本', rule_built_text.includes('/js/risk/api.min.js'));
    ok('规则页产物 risk 先于 must', rule_built_text.indexOf('/js/risk/api.min.js') < rule_built_text.indexOf('/js/ref/must.min.js'));
    ok('规则页产物引用 ui 组件脚本', rule_built_text.includes('/js/global/ui.min.js'));
    ok('手册页源 risk 先于 must', tip_src.indexOf('/js/risk/api.min.js') < tip_src.indexOf('/js/ref/must.min.js'));
    ok('手册页产物 risk 先于 must', tip_built_text.indexOf('/js/risk/api.min.js') < tip_built_text.indexOf('/js/ref/must.min.js'));

    console.log('\n[7] 后端接线');
    const api_cpp = fs.readFileSync(path.join(project, '4ascend-online', 'src', 'api', 'http', 'Docs.cpp'), 'utf8');
    ok('后端注册 /docs/query', api_cpp.includes('"/docs/query"'));
    ok('后端注册 /docs/update', api_cpp.includes('"/docs/update"'));
    ok('后端仅放行固定文档键', api_cpp.includes('key == "rule"') && api_cpp.includes('key == "tip"'));
    ok('后端更新校验管理员等级', api_cpp.includes('level == 4'));
    const init_h = fs.readFileSync(path.join(project, '4ascend-online', 'src', 'Init.h'), 'utf8');
    ok('Init 初始化 Docs 管理模块', init_h.includes('Manager::Docs::init'));
    ok('Init 关闭 Docs 管理模块', init_h.includes('Manager::Docs::close'));
    ok('Init 加载 Docs 接口', init_h.includes('Api::Http::Docs::load'));

    console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`);
    process.exit(failed === 0 ? 0 : 1);
})();