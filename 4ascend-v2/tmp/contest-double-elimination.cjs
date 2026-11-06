/*
 * 赛事抽签「双败赛制」回归测试。
 * 运行：node tmp/contest-double-elimination.cjs
 *
 * 背景：签表方块新增 loserAdvance 开关，管理员可设置某方块是否允许败方进入下一组抽签。
 * 覆盖：
 *   1. 旧签表缺失该字段时默认关闭；
 *   2. 开关关闭时仅胜方晋级，败方为 lose；
 *   3. 开关开启时败方同样晋级（ok）；
 *   4. 未分出胜负时一律 wait，不受开关影响；
 *   5. 单人组轮空直接晋级；
 *   6. parent_gate 在多前置路径下按开关放行；
 *   7. 源页面与发布产物均包含开关、判定逻辑；
 *   8. 后端 Contest.cpp 含双败放行分支。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'html', 'mod', 'match-registration.html');
const built_path = path.join(root, 'root', 'pages', 'mod', 'match-registration.html');
const backend_path = path.join(root, '..', '4ascend-online', 'src', 'api', 'http', 'Contest.cpp');

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
        this.checked = false;
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
    http_contest_bracket_query: async () => undefined,
    http_contest_bracket_update: async () => false,
    http_contest_bracket_register: async () => false,
    http_user_info: async () => undefined
};

// ---------- 抽取内联逻辑脚本 ----------
const html = fs.readFileSync(source_path, 'utf8');
const inline_scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok('源页面存在内联逻辑脚本', inline_scripts.length >= 2, `找到 ${inline_scripts.length} 段`);
const code = inline_scripts[inline_scripts.length - 1];

const factory = new Function(
    'window', 'document', 'localStorage', 'setInterval', 'clearInterval',
    `${code}\nreturn { getState: () => state, migrateState, parent_advance_state, parent_gate, group_winner_uuid };`
);
const api = factory(window_stub, document_stub, localStorage_stub, () => 0, () => 0);
const { getState, migrateState, parent_advance_state, parent_gate, group_winner_uuid } = api;

const state = getState();
const parent = state.nodes[0];

const reset = (loserAdvance) => {
    parent.id = 'parent';
    parent.bo = 3;
    parent.maxPlayers = 2;
    parent.groupCount = 1;
    parent.players = ['甲', '乙'];
    parent.groups = [['甲', '乙']];
    parent.player_uuids = { '甲': 'uuid-甲', '乙': 'uuid-乙' };
    parent.results = { 0: { bo: 3, wins: { 'uuid-甲': 2, 'uuid-乙': 0 }, completed: true, winner_uuid: 'uuid-甲' } };
    parent.loserAdvance = loserAdvance;
    state.nodes = [parent];
    state.edges = [];
};

console.log('\n[1] 旧签表缺失开关时默认关闭');
reset(undefined);
migrateState();
ok('migrateState 将缺失值归一为 false', parent.loserAdvance === false, String(parent.loserAdvance));

console.log('\n[2] 开关关闭：仅胜方晋级');
reset(false);
const winner_state = parent_advance_state(parent, 'uuid-甲', '甲');
const loser_state = parent_advance_state(parent, 'uuid-乙', '乙');
ok('胜方判为 ok', winner_state === 'ok', winner_state);
ok('败方判为 lose', loser_state === 'lose', loser_state);

console.log('\n[3] 开关开启：败方同样晋级');
reset(true);
const loser_state_on = parent_advance_state(parent, 'uuid-乙', '乙');
const winner_state_on = parent_advance_state(parent, 'uuid-甲', '甲');
ok('败方判为 ok', loser_state_on === 'ok', loser_state_on);
ok('胜方仍判为 ok', winner_state_on === 'ok', winner_state_on);

console.log('\n[4] 未分出胜负：一律 wait');
reset(true);
parent.results = { 0: { bo: 3, wins: { 'uuid-甲': 1, 'uuid-乙': 1 }, completed: false, winner_uuid: '' } };
ok('开关开启时未分胜负仍 wait', parent_advance_state(parent, 'uuid-乙', '乙') === 'wait');
reset(false);
parent.results = { 0: { bo: 3, wins: { 'uuid-甲': 1, 'uuid-乙': 1 }, completed: false, winner_uuid: '' } };
ok('开关关闭时未分胜负仍 wait', parent_advance_state(parent, 'uuid-乙', '乙') === 'wait');

console.log('\n[5] 单人组轮空直接晋级');
reset(false);
parent.maxPlayers = 1;
parent.players = ['甲'];
parent.groups = [['甲']];
parent.player_uuids = { '甲': 'uuid-甲' };
parent.results = {};
ok('单人组 judge ok', parent_advance_state(parent, 'uuid-甲', '甲') === 'ok');

console.log('\n[6] parent_gate 按开关放行');
const child = { id: 'child', name: '败者组', maxPlayers: 2, groupCount: 1, players: [], groups: [[]], player_uuids: {} };
reset(true);
state.nodes = [parent, child];
state.edges = [{ from: 'parent', to: 'child' }];
ok('开关开启：败方可报名下一方块', parent_gate(child, 'uuid-乙', '乙').state === 'ok', parent_gate(child, 'uuid-乙', '乙').state);
reset(false);
state.nodes = [parent, child];
state.edges = [{ from: 'parent', to: 'child' }];
ok('开关关闭：败方不可报名下一方块', parent_gate(child, 'uuid-乙', '乙').state === 'lose', parent_gate(child, 'uuid-乙', '乙').state);

console.log('\n[7] 源页面与发布产物包含开关与判定逻辑');
const source_checks = [
    ['管理端开关', /id='switch_node_loser_advance'/],
    ['节点字段归一', /node\.loserAdvance = node\.loserAdvance === true/],
    ['报名判定放行', /if \(parent\.loserAdvance === true\) return 'ok';/],
    ['方块徽标', /variant='primary' pill>双败/]
];
source_checks.forEach(([name, regex]) => ok(`源页面 ${name}`, regex.test(html)));

if (fs.existsSync(built_path)) {
    const built = fs.readFileSync(built_path, 'utf8');
    const built_checks = [
        ['管理端开关', /switch_node_loser_advance/],
        ['败方判定字段', /loserAdvance/],
        ['方块徽标', /双败/]
    ];
    built_checks.forEach(([name, regex]) => ok(`发布产物 ${name}`, regex.test(built)));
} else {
    ok('发布产物存在', false, built_path);
}

console.log('\n[8] 后端 Contest.cpp 含双败放行分支');
if (fs.existsSync(backend_path)) {
    const backend = fs.readFileSync(backend_path, 'utf8');
    ok('后端读取 loserAdvance', /json_bool\(parent, "loserAdvance", false\)/.test(backend));
    ok('后端放行败方', /advanced = true/ .test(backend));
} else {
    ok('后端源码存在', false, backend_path);
}

if (failed) {
    console.log(`\ncontest-double-elimination: ${failed} 项失败`);
    process.exit(1);
}
console.log('\ncontest-double-elimination: all assertions passed');
