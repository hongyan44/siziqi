/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事规则页回归测试
 *   1. 从 html/mod/match-rules.html 抽出内联逻辑脚本，在最小 DOM 桩上执行
 *   2. 校验内联富文本渲染的 XSS 安全性（先转义再解析 **加粗** / [文字](链接)）
 *   3. 校验 sanitize / normalize 的数据规整与默认值回退
 *   4. 校验发布产物 root/pages/mod/match-rules.html 已包含新接口且无 ?v=replace 残留
 * 运行：node tmp/match-rules.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'html', 'mod', 'match-rules.html');
const built_path = path.join(root, 'root', 'pages', 'mod', 'match-rules.html');

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
        this.classes = new Set();
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.disabled = false;
        this.classList = {
            toggle: (name, force) => { force ? this.classes.add(name) : this.classes.delete(name); },
            add: (name) => this.classes.add(name),
            remove: (name) => this.classes.delete(name),
            contains: (name) => this.classes.has(name)
        };
    }
    addEventListener() {}
    appendChild(child) { this.children.push(child); return child; }
    append(...items) { this.children.push(...items); }
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
    querySelectorAll: () => [],
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
    http_contest_rules_query: async () => undefined,
    http_contest_rules_update: async () => false,
    http_user_info: async () => undefined
};

// ---------- 抽取内联逻辑脚本 ----------
const html = fs.readFileSync(source_path, 'utf8');
const inline_scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok('源页面存在内联逻辑脚本', inline_scripts.length >= 2, `找到 ${inline_scripts.length} 段`);
const loader_code = inline_scripts[0];
const code = inline_scripts[inline_scripts.length - 1];

const factory = new Function(
    'window', 'document', 'localStorage', 'setInterval',
    `${code}\nreturn { sanitize, normalize, renderInline, escapeHtml, default_rules };`
);
const api = factory(window_stub, document_stub, localStorage_stub, () => 0);

const { sanitize, normalize, renderInline, escapeHtml, default_rules } = api;

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n[1] 内联富文本渲染安全性');
ok('普通文本原样保留', renderInline('本次比赛是**三局两胜制**') === '本次比赛是<strong>三局两胜制</strong>');
ok('HTML 标签被转义', renderInline('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', renderInline('<img src=x onerror=alert(1)>'));
ok('script 标签不产生可执行标签', !renderInline('<script>alert(1)</script>').includes('<script'));
ok('危险链接协议不被识别为链接', !renderInline('[x](javascript:alert(1))').includes('<a '), renderInline('[x](javascript:alert(1))'));
ok('http 链接被正常渲染', renderInline('[直播间](http://live.bilibili.com/22743437)').includes("<a href='http://live.bilibili.com/22743437'"));
ok('链接文字仍被转义', renderInline('[<b>](http://a.com)').includes('&lt;b&gt;'));
ok('转义函数处理引号', escapeHtml(`"'`) === '&quot;&#39;');

console.log('\n[2] sanitize 数据规整');
const cleaned = sanitize({
    header: { title: '  规则  ', subtitle: '  ' },
    event: { section_title: '', title: ' 赛 ', time: ' 时间 ', status: ' 已发布 ' },
    sections: [
        { title: ' A ', items: [' x ', '', '   ', 'y'] },
        { title: '', items: [''] }
    ],
    prize: { title: '', rows: [{ label: '冠军', value: ' 80 元 ' }, { label: '', value: '' }] }
});
ok('标题裁剪空白', cleaned.header.title === '规则');
ok('副标题裁剪为空白', cleaned.header.subtitle === '');
ok('板块标题回退默认', cleaned.event.section_title === '赛事信息');
ok('条目裁剪并丢弃空项', equal(cleaned.sections[0].items, ['x', 'y']));
ok('空板块被丢弃', cleaned.sections.length === 1);
ok('奖项标题回退默认', cleaned.prize.title === '奖金分配');
ok('空奖项被丢弃且值裁剪', equal(cleaned.prize.rows, [{ label: '冠军', value: '80 元' }]));

console.log('\n[3] normalize 默认值回退');
ok('null 回退到默认结构', equal(normalize(null), default_rules()));
ok('默认结构幂等', equal(sanitize(default_rules()), default_rules()));
const partial = normalize({ header: { title: 'X' }, sections: [{ title: 'A', items: [' b ', ''] }] });
ok('部分字段回退且规整', partial.header.title === 'X' && equal(partial.sections, [{ title: 'A', items: ['b'] }]));
ok('缺失板块回退默认', equal(partial.prize, default_rules().prize));

console.log('\n[4] 发布产物完整性');
const built = fs.readFileSync(built_path, 'utf8');
ok('产物包含规则查询接口', built.includes('http_contest_rules_query'));
ok('产物包含规则更新接口', built.includes('http_contest_rules_update'));
ok('产物无 ?v=replace 残留', !built.includes('v=replace'));
ok('产物包含动态渲染容器', built.includes('rules_body'));

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
ok('压缩产物保留本地缓存键', built.includes('match_rules_state_v1'));

console.log('\n[6] 加载链路与组件依赖');
ok('引入 risk 加密脚本', html.includes('/js/risk/api.min.js'));
ok('risk 在 must 之前加载', html.indexOf('/js/risk/api.min.js') < html.indexOf('/js/ref/must.min.js'));
ok('产物引入 risk 脚本', built.includes('/js/risk/api.min.js'));
ok('遮罩存在兜底移除', html.includes('setTimeout(hide_loading, 5000)'));
ok('加载器不再等待动态创建的 sl-textarea', !loader_code.includes("whenDefined('sl-textarea')"));
ok('加载器仍等待首屏静态组件 sl-dialog', loader_code.includes("whenDefined('sl-dialog')"));
ok('静态预热 sl-textarea 组件', /<sl-textarea>\s*<\/sl-textarea>/.test(html));
ok('产物保留预热组件', built.includes('<sl-textarea></sl-textarea>'));

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
