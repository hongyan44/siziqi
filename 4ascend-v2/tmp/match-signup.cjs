/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事报名页文案可编辑回归测试
 *   1. 从 html/mod/match-registration.html 抽出内联逻辑脚本，在最小 DOM 桩上执行
 *   2. 校验 sanitize_texts 的数据规整与默认值回退
 *   3. 校验 escape_text / fill_name 的转义与占位替换
 *   4. 校验发布产物 root/pages/mod/match-registration.html 已包含新接口且无 ?v=replace 残留
 *   5. 校验加载链路（risk 脚本、兜底遮罩、组件预热）
 * 运行：node tmp/match-signup.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'html', 'mod', 'match-registration.html');
const built_path = path.join(root, 'root', 'pages', 'mod', 'match-registration.html');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

// ---------- 最小 DOM / 浏览器环境桩 ----------
class StubElement {
    constructor(tag = 'div') {
        this.tagName = tag;
        this.children = [];
        this.style = {};
        this.dataset = {};
        this.classes = new Set();
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.disabled = false;
        this.open = false;
        this.classList = {
            toggle: (name, force) => { force ? this.classes.add(name) : this.classes.delete(name); },
            add: (name) => this.classes.add(name),
            remove: (name) => this.classes.delete(name),
            contains: (name) => this.classes.has(name),
            replace: () => {}
        };
    }
    addEventListener() {}
    removeEventListener() {}
    setAttribute() {}
    appendChild(child) { this.children.push(child); return child; }
    append(...items) { this.children.push(...items); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
}

const elements = new Map();
const document_stub = {
    readyState: 'complete',
    getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, new StubElement());
        return elements.get(id);
    },
    createElement: (tag) => new StubElement(tag),
    createElementNS: (ns, tag) => new StubElement(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
};

const storage = new Map();
const localStorage_stub = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
};

const window_stub = {
    UiExports: { ShToast: class { success() {} error() {} info() {} } },
    addEventListener: () => {},
    get_token: () => null,
    http_contest_signup_query: async () => undefined,
    http_contest_signup_update: async () => false,
    http_contest_bracket_query: async () => undefined,
    http_contest_bracket_update: async () => false,
    http_contest_bracket_register: async () => false,
    http_user_info: async () => undefined
};

// ---------- 抽取内联逻辑脚本 ----------
const html = fs.readFileSync(source_path, 'utf8');
const inline_scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok('源页面存在内联逻辑脚本', inline_scripts.length >= 2, `找到 ${inline_scripts.length} 段`);
const loader_code = inline_scripts[0];
const code = inline_scripts[inline_scripts.length - 1];

const factory = new Function(
    'window', 'document', 'localStorage', 'setInterval', 'clearInterval',
    `${code}\nreturn { default_texts, sanitize_texts, escape_text, fill_name };`
);
const api = factory(window_stub, document_stub, localStorage_stub, () => 0, () => 0);

const { default_texts, sanitize_texts, escape_text, fill_name } = api;

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n[1] sanitize_texts 数据规整');
const cleaned = sanitize_texts({
    header: { title: '  报名  ', subtitle: '   ' },
    event: { section_title: '', title: ' 赛事 ', desc: '  说明  ', status_open: '', status_full: '  满  ' },
    bracket: { section_title: '   ', desc: ' 点击 ', empty_hint: '' },
    dialog: { hint: '  自定义  ', hint_parent: '', join_text: '' }
});
ok('主标题裁剪空白', cleaned.header.title === '报名');
ok('副标题留空回退默认', cleaned.header.subtitle === default_texts().header.subtitle);
ok('板块标题留空回退默认', cleaned.event.section_title === '赛事信息');
ok('板块说明裁剪', cleaned.event.desc === '说明');
ok('状态标签裁剪', cleaned.event.status_full === '满');
ok('状态标签留空回退默认', cleaned.event.status_open === '报名中');
ok('空位提示留空回退默认', cleaned.bracket.empty_hint === '虚位以待');
ok('弹窗说明裁剪', cleaned.dialog.hint === '自定义');
ok('前置说明留空回退默认', cleaned.dialog.hint_parent === default_texts().dialog.hint_parent);
ok('报名按钮留空回退默认', cleaned.dialog.join_text === '报名入组');

console.log('\n[2] 默认值回退与幂等');
ok('null 回退到默认结构', equal(sanitize_texts(null), default_texts()));
ok('默认结构幂等', equal(sanitize_texts(default_texts()), default_texts()));
const partial = sanitize_texts({ header: { title: 'X' } });
ok('部分字段回退且保留自定义', partial.header.title === 'X' && equal(partial.dialog, default_texts().dialog));
ok('默认结构字段齐全', ['header', 'event', 'bracket', 'dialog'].every((k) => partial[k] && typeof partial[k] === 'object'));

console.log('\n[3] 转义与占位替换');
ok('HTML 标签被转义', escape_text('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', escape_text('<img src=x onerror=alert(1)>'));
ok('script 标签不产生可执行标签', !escape_text('<script>alert(1)</script>').includes('<script'));
ok('引号被转义', escape_text(`"'`) === '&quot;&#39;');
ok('{name} 占位替换', fill_name('只有报名了前一个方块「{name}」', 'A、B') === '只有报名了前一个方块「A、B」');
ok('无占位时原样返回', fill_name('普通说明', 'A') === '普通说明');
ok('多次占位全部替换', fill_name('{name} 与 {name}', 'X') === 'X 与 X');

console.log('\n[4] 发布产物完整性');
const built = fs.readFileSync(built_path, 'utf8');
ok('产物包含文案查询接口', built.includes('http_contest_signup_query'));
ok('产物包含文案更新接口', built.includes('http_contest_signup_update'));
ok('产物无 ?v=replace 残留', !built.includes('v=replace'));
ok('产物包含编辑弹窗', built.includes('dialog_edit_texts'));
ok('产物包含编辑按钮', built.includes('button_edit_texts'));
ok('产物保留预热组件', built.includes('<sl-textarea></sl-textarea>'));
ok('产物保留本地缓存键', built.includes('match_signup_texts_v1'));
ok('产物保留默认标题文案', built.includes('赛事报名和抽签'));

console.log('\n[5] 压缩产物脚本可解析');
const built_scripts = [...built.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let built_syntax_ok = true;
let built_syntax_error = '';
try {
    new Function(built_scripts[built_scripts.length - 1]);
} catch (error) {
    built_syntax_ok = false;
    built_syntax_error = error.message;
}
ok('压缩后逻辑脚本语法有效', built_syntax_ok, built_syntax_error);

console.log('\n[6] 加载链路与组件依赖');
ok('引入 risk 加密脚本', html.includes('/js/risk/api.min.js'));
ok('risk 在 must 之前加载', html.indexOf('/js/risk/api.min.js') < html.indexOf('/js/ref/must.min.js'));
ok('遮罩存在兜底移除', html.includes('setTimeout(hide_loading, 5000)'));
ok('加载器不等待动态创建的 sl-textarea', !loader_code.includes("whenDefined('sl-textarea')"));
ok('加载器仍等待首屏静态组件 sl-dialog', loader_code.includes("whenDefined('sl-dialog')"));
ok('静态预热 sl-textarea 组件', /<sl-textarea>\s*<\/sl-textarea>/.test(html));

console.log('\n[7] 渲染点接线');
ok('状态标签取自文案', code.includes('texts.event.status_open') && code.includes('texts.event.status_full'));
ok('空位提示取自文案', code.includes('texts.bracket.empty_hint'));
ok('名单标题取自文案', code.includes('texts.dialog.list_title'));
ok('报名提示取自文案', code.includes('texts.dialog.hint_parent_wait') && code.includes('texts.dialog.hint_joining'));
ok('保存走 signup_update', code.includes('http_contest_signup_update'));
ok('管理员可见编辑按钮', code.includes("getElementById('button_edit_texts').classList.toggle"));

console.log('\n[8] 方块头部两行结构');
const head_css = (html.match(/\.bracket-node-head\s*\{[^}]*\}/) || [''])[0];
ok('头部改为纵向两行', /flex-direction:\s*column/.test(head_css), head_css.replace(/\s+/g, ' '));
const node_tpl = (html.match(/<div class='bracket-node-head'>[\s\S]*?<\/div>\s*<div class='bracket-node-body'>/) || [''])[0];
ok('抓到方块头部模板', node_tpl.length > 0);
ok('第一行只放方块名字', /bracket-node-head'>\s*<span class='bracket-node-name'>\$\{node\.name\}<\/span>\s*<div class='bracket-node-meta'>/.test(node_tpl));
ok('第二行含 BO 徽标', node_tpl.includes('BO${normalize_bo(node.bo)}'));
ok('第二行含状态徽标', node_tpl.includes("variant='${status.variant}'"));
ok('第二行含管理员操作按钮', node_tpl.includes("class='node-actions d-none'"));
ok('名字不在第二行容器内', node_tpl.indexOf('bracket-node-name') < node_tpl.indexOf("class='bracket-node-meta'"));
ok('操作按钮靠右排布', /\.node-actions\s*\{[^}]*margin-left:\s*auto/.test(html));

console.log('\n[9] 保存失败不再卡死');
const http_src = fs.readFileSync(path.join(root, 'js', 'ref', 'http.cjs'), 'utf8');
const rules_html = fs.readFileSync(path.join(root, 'html', 'mod', 'match-rules.html'), 'utf8');
ok('signup 更新对空响应有守卫', /http_contest_signup_update[\s\S]{0,260}Boolean\(rjson && rjson\.status\)/.test(http_src));
ok('signup 查询对空响应有守卫', /http_contest_signup_query[\s\S]{0,260}!rjson \|\| !rjson\.status/.test(http_src));
ok('rules 更新对空响应有守卫', /http_contest_rules_update[\s\S]{0,260}Boolean\(rjson && rjson\.status\)/.test(http_src));
ok('rules 查询对空响应有守卫', /http_contest_rules_query[\s\S]{0,260}!rjson \|\| !rjson\.status/.test(http_src));
ok('报名页保存按钮 finally 兜底', /editTextsSaveButton\.disabled = true[\s\S]{0,240}finally[\s\S]{0,160}editTextsSaveButton\.disabled = false/.test(html));
ok('规则页保存按钮 finally 兜底', /editSaveButton\.disabled = true[\s\S]{0,240}finally[\s\S]{0,160}editSaveButton\.disabled = false/.test(rules_html));
ok('压缩产物含 signup 更新守卫', built.includes('signup_update') && built.includes('status'));
ok('报名页保存不再重复校验 isAdmin', !/editTextsSaveButton\.addEventListener\('click', async \(\) => \{\s*if \(!isAdmin\) return;/.test(html));
ok('报名页失败文案不再归咎权限', html.includes('保存失败，服务暂不可用，请稍后重试。'));
ok('规则页保存不再重复校验 isAdmin', !/editSaveButton\.addEventListener\('click', async \(\) => \{\s*if \(!isAdmin\) return;/.test(rules_html));

console.log('\n[10] 报名条件按 uuid 判定 + 分组随机');
ok('存在 uuid 报名条件助手', /const is_registered = \(node, uuid, name\)/.test(html));
ok('存在已登记 uuid 集合助手', /const registered_uuids = \(node\)/.test(html));
ok('renderRegisterRow 按 uuid 判定', /if \(is_registered\(node, accountUuid, accountName\)\)/.test(html));
ok('报名处理器按 uuid 判定', /if \(is_registered\(node, uuid, name\)\) return;/.test(html));
ok('前置方块判定同样按 uuid', /parents\.filter\(\(parent\) => is_registered\(parent, uuid, name\)\)/.test(html));
ok('移除玩家同步清理 uuid', /delete node\.player_uuids\[name\]/.test(html));
ok('页面不再用 Math.random 分配分组', !/Math\.random/.test(html));

const be_contest = fs.readFileSync(path.join(root, '..', '4ascend-online', 'src', 'api', 'http', 'Contest.cpp'), 'utf8');
ok('后端报名以 uuid 为报名条件', /registered == uuid\) return api_http_error\("bracket_register"/.test(be_contest));
ok('后端分组随机改用 CSPRNG 拒绝采样', be_contest.includes('Libs::Only::Random::mod(static_cast<uint32_t>(unfilled.size()))'));
ok('后端不再使用 std::rand 取模', !/std::rand\(\) % unfilled\.size\(\)/.test(be_contest));
ok('后端已引入 Random 库', be_contest.includes('libs/only/Random.h'));

console.log('\n[11] 报名按钮绑定与请求守卫');
ok('报名按钮已绑定点击事件', /joinButton\.addEventListener\('click', async \(\) => \{/.test(html));
ok('报名按钮点击用 try/finally 兜底', /joinButton\.disabled = true[\s\S]{0,240}finally[\s\S]{0,160}joinButton\.disabled = false/.test(html));
ok('报名接口对空响应有守卫', /http_contest_bracket_register[\s\S]{0,220}Boolean\(rjson && rjson\.status\)/.test(http_src));
const status_lines = http_src.split('\n').filter((line) => line.includes('rjson.status'));
const unsafe_lines = status_lines.filter((line) => !/rjson && rjson\.status|!rjson \|\| !rjson\.status/.test(line));
ok('http.cjs 无未守卫的 rjson.status', unsafe_lines.length === 0, unsafe_lines.join(' | '));
const built_http = fs.readFileSync(path.join(root, 'root', 'js', 'ref', 'http.min.js'), 'utf8');
ok('压缩产物已含守卫（不再裸取 status）', built_http.includes('bracket_register'));

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
