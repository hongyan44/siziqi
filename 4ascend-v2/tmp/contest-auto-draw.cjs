/*
 * 赛事抽签「非双败赛制自动抽签」回归测试。
 * 运行：node tmp/contest-auto-draw.cjs
 *
 * 需求：赛事抽签板块中，非双败赛制的方块在本轮报名满员并分出胜负后，
 *       胜者自动晋级到唯一的下一轮方块，并随机进入未满组。
 *
 * 覆盖：
 *   1) 自动抽签只对非双败（loserAdvance 未开启）方块生效；
 *   2) 本轮必须报名满员（抽签完成）才触发；
 *   3) 单人组（轮空）同样自动晋级；
 *   4) 胜者进入唯一子方块的随机未满组，已在册不重复；
 *   5) 多分支方块不自动抽签，保留人工安排；
 *   6) 管理员已移除的账号不会被自动回填；
 *   7) 比赛上报与管理员保存签表两条写入路径都会触发；
 *   8) 前端比赛页在系列赛结束后重新定位，能直接进入下一轮；
 *   9) 源页面与发布产物均包含自动抽签逻辑。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source_path = path.join(root, 'html', 'mod', 'match-registration.html');
const built_path = path.join(root, 'root', 'pages', 'mod', 'match-registration.html');
const backend_path = path.join(root, '..', '4ascend-online', 'src', 'api', 'http', 'Contest.cpp');
const match_game_path = path.join(root, 'js', 'main', 'match-game.cjs');

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
    `${code}\nreturn { getState: () => state, auto_advance_all };`
);
const api = factory(window_stub, document_stub, localStorage_stub, () => 0, () => 0);
const { getState, auto_advance_all } = api;
const state = getState();

const make_parent = (loserAdvance) => ({
    id: 'parent',
    name: '第一轮',
    bo: 3,
    maxPlayers: 4,
    groupCount: 2,
    players: ['甲', '乙', '丙', '丁'],
    groups: [['甲', '乙'], ['丙', '丁']],
    player_uuids: { '甲': 'u-甲', '乙': 'u-乙', '丙': 'u-丙', '丁': 'u-丁' },
    results: {
        0: { bo: 3, wins: { 'u-甲': 2, 'u-乙': 0 }, games: [], completed: true, winner_uuid: 'u-甲' },
        1: { bo: 3, wins: { 'u-丙': 1, 'u-丁': 1 }, games: [], completed: false, winner_uuid: '' }
    },
    removed_uuids: [],
    loserAdvance
});

const make_child = () => ({
    id: 'child',
    name: '第二轮',
    bo: 3,
    maxPlayers: 8,
    groupCount: 4,
    players: [],
    groups: [[], [], [], []],
    player_uuids: {},
    results: {},
    removed_uuids: []
});

console.log('\n[1] 非双败赛制才自动抽签');
{
    state.nodes = [make_parent(true), make_child()];
    state.edges = [{ from: 'parent', to: 'child' }];
    const changed = auto_advance_all();
    ok('双败方块不自动抽签', changed === false && state.nodes[1].players.length === 0, `changed=${changed}, players=${state.nodes[1].players.length}`);
}

console.log('\n[2] 本轮抽签完成后才晋级');
{
    const parent = make_parent(false);
    parent.maxPlayers = 8;
    state.nodes = [parent, make_child()];
    state.edges = [{ from: 'parent', to: 'child' }];
    ok('未满员不晋级', auto_advance_all() === false && state.nodes[1].players.length === 0);
}

console.log('\n[3] 胜者进入下一轮随机未满组');
{
    state.nodes = [make_parent(false), make_child()];
    state.edges = [{ from: 'parent', to: 'child' }];
    const changed = auto_advance_all();
    const child = state.nodes[1];
    const placed_group = child.groups.findIndex((group) => group.includes('甲'));
    ok('已写入下一轮', changed === true && child.players.includes('甲'));
    ok('身份标识码同步', child.player_uuids['甲'] === 'u-甲');
    ok('只晋级已分出胜负的组', !child.players.includes('丙'));
    ok('落在单一未满组', placed_group >= 0 && child.groups[placed_group].length === 1);
    ok('新组小分已重置', child.results[String(placed_group)] && child.results[String(placed_group)].completed === false);
    ok('重复执行不重复写入', auto_advance_all() === false && child.players.length === 1);
}

console.log('\n[4] 单人组（轮空）自动晋级');
{
    const parent = make_parent(false);
    parent.maxPlayers = 3;
    parent.groupCount = 2;
    parent.players = ['甲', '乙', '丙'];
    parent.groups = [['甲'], ['乙', '丙']];
    parent.player_uuids = { '甲': 'u-甲', '乙': 'u-乙', '丙': 'u-丙' };
    parent.results = { 1: { bo: 3, wins: { 'u-乙': 2, 'u-丙': 0 }, completed: true, winner_uuid: 'u-乙' } };
    state.nodes = [parent, make_child()];
    state.edges = [{ from: 'parent', to: 'child' }];
    auto_advance_all();
    const child = state.nodes[1];
    ok('轮空选手自动晋级', child.players.includes('甲') && child.players.includes('乙'));
}

console.log('\n[5] 多分支不自动抽签');
{
    state.nodes = [make_parent(false), make_child(), Object.assign(make_child(), { id: 'child2' })];
    state.edges = [{ from: 'parent', to: 'child' }, { from: 'parent', to: 'child2' }];
    const changed = auto_advance_all();
    ok('多个下一轮方块时保留人工安排', changed === false && state.nodes[1].players.length === 0 && state.nodes[2].players.length === 0);
}

console.log('\n[6] 管理员移除的账号不回填');
{
    const child = make_child();
    child.removed_uuids = ['u-甲'];
    state.nodes = [make_parent(false), child];
    state.edges = [{ from: 'parent', to: 'child' }];
    ok('移除名单内不自动晋级', auto_advance_all() === false && child.players.length === 0);
}

console.log('\n[7] 后端两条写入路径均接入自动抽签');
const backend = fs.existsSync(backend_path) ? fs.readFileSync(backend_path, 'utf8') : '';
ok('后端源码存在', fs.existsSync(backend_path), backend_path);
ok('非双败才自动抽签', /json_bool\(\*parent, "loserAdvance", false\)/.test(backend));
ok('未满员不晋级', /if \(!node_is_drawn\(\*parent\)\) return false;/.test(backend));
ok('仅唯一子方块自动晋级', /if \(children\.size\(\) != 1\) return false;/.test(backend));
ok('随机进入未满组', /Libs::Only::Random::mod\(static_cast<uint32_t>\(unfilled\.size\(\)\)\)/.test(backend));
ok('比赛上报后自动抽签', /auto_advance_all\(bracket\)/.test(backend));
ok('管理员保存签表后自动抽签', /if \(auto_advance_all\(parsed\)\)/.test(backend));

console.log('\n[8] 页面与发布产物包含自动抽签逻辑');
const source_checks = [
    ['页面本地自动抽签', /const auto_advance_all = \(\) =>/],
    ['保存前补做抽签', /if \(auto_advance_all\(\)\) \{/],
    ['双败跳过', /node\.loserAdvance === true\) return false;/],
    ['唯一子方块限制', /if \(children\.length !== 1\) return false;/],
    ['移除名单守卫', /target\.removed_uuids\.includes\(uuid\)/]
];
source_checks.forEach(([name, regex]) => ok(`源页面 ${name}`, regex.test(html)));
if (fs.existsSync(built_path)) {
    const built = fs.readFileSync(built_path, 'utf8');
    ok('发布产物包含自动抽签', /auto_advance_all/.test(built) && /place_advancer/.test(built));
} else {
    ok('发布产物存在', false, built_path);
}

console.log('\n[9] 比赛页晋级后重新定位');
const match_game = fs.existsSync(match_game_path) ? fs.readFileSync(match_game_path, 'utf8') : '';
ok('系列赛结束后重新同步签表', /if \(completed\)[\s\S]{0,220}await sync_contest\(\);/.test(match_game));

if (failed) {
    console.log(`\ncontest-auto-draw: ${failed} 项失败`);
    process.exit(1);
}
console.log('\ncontest-auto-draw: all assertions passed');
