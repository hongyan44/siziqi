/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 管理员移除报名后可再次报名 回归测试
 *   复现 bug：选手报名成功后，管理员用管理员权限移除报名，保存时 saveState 会先合并服务端
 *   数据（merge_remote_state），把服务端 player_uuids 里的旧 uuid 回灌到本地，导致该账号
 *   仍被判定为“已报名”，无法再次报名。
 *   修复：移除时记录 removed_uuids 标记，合并服务端报名标识码时跳过被移除的身份。
 *   1. 从 html/mod/match-registration.html 抽出内联逻辑脚本，在最小 DOM 桩上执行
 *   2. 校验 removePlayerFromNode 同步清理 players/groups/player_uuids 并记录移除标记
 *   3. 校验 merge_remote_state 不回灌被移除的 uuid，但仍补入本地缺失的正常 uuid
 *   4. 校验重新报名成功后 clear_removed_uuid 可撤销标记
 *   5. 校验发布产物已包含修复逻辑
 * 运行：node tmp/contest-signup-reremove.cjs
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
const code = inline_scripts[inline_scripts.length - 1];

const factory = new Function(
    'window', 'document', 'localStorage', 'setInterval', 'clearInterval',
    `${code}\nreturn { getState: () => state, removePlayerFromNode, merge_remote_state, clear_removed_uuid, is_registered, registered_uuids, purge_uuid_results, group_score_row };`
);
const api = factory(window_stub, document_stub, localStorage_stub, () => 0, () => 0);
const { getState, removePlayerFromNode, merge_remote_state, clear_removed_uuid, is_registered, registered_uuids, purge_uuid_results, group_score_row } = api;

const node = getState().nodes[0];
const reset = () => {
    node.players = ['甲'];
    node.groupCount = 2;
    node.groups = [['甲'], []];
    node.player_uuids = { '甲': 'uuid-a' };
    node.removed_uuids = [];
    node.bo = 3;
    node.results = {};
};

console.log('\n[1] 管理员移除：同步清理并记录移除标记');
reset();
removePlayerFromNode(node, '甲');
ok('players 已移除该玩家', !node.players.includes('甲'), JSON.stringify(node.players));
ok('groups 已移除该玩家', node.groups.every((g) => !g.includes('甲')), JSON.stringify(node.groups));
ok('player_uuids 已清理该账号', !('甲' in node.player_uuids), JSON.stringify(node.player_uuids));
ok('记录被移除的 uuid', node.removed_uuids.includes('uuid-a'), JSON.stringify(node.removed_uuids));
ok('移除后 is_registered 为 false', is_registered(node, 'uuid-a', '甲') === false);

console.log('\n[2] 合并服务端数据不得回灌被移除的 uuid（核心 bug）');
const remote_with_removed = { nodes: [{ id: node.id, player_uuids: { '甲': 'uuid-a' }, results: {} }] };
merge_remote_state(remote_with_removed);
ok('被移除的 uuid 未被回灌', !('甲' in node.player_uuids), JSON.stringify(node.player_uuids));
ok('合并后 is_registered 仍为 false', is_registered(node, 'uuid-a', '甲') === false);
ok('players 未被服务端数据污染', !node.players.includes('甲'), JSON.stringify(node.players));

console.log('\n[2b] 历史残留 uuid（昵称已不在名单）不再卡住报名');
const ghost_node = {
    id: 'g', players: ['乙'], groups: [['乙'], []],
    player_uuids: { '乙': 'uuid-b', '甲': 'uuid-a' }, removed_uuids: []
};
ok('残留账号不再判定为已报名', is_registered(ghost_node, 'uuid-a', '甲') === false);
ok('在册账号仍判定为已报名', is_registered(ghost_node, 'uuid-b', '乙') === true);
ok('registered_uuids 只统计在册账号', registered_uuids(ghost_node).length === 1 && registered_uuids(ghost_node)[0] === 'uuid-b', JSON.stringify(registered_uuids(ghost_node)));

console.log('\n[3] 合并仍补入本地缺失且未被移除的 uuid');
reset();
node.players = [];
node.player_uuids = {};
const remote_new = { nodes: [{ id: node.id, player_uuids: { '乙': 'uuid-b' }, results: {} }] };
merge_remote_state(remote_new);
ok('缺失的正常 uuid 被补入', node.player_uuids['乙'] === 'uuid-b', JSON.stringify(node.player_uuids));

console.log('\n[4] 重复移除同一人只记一条标记');
reset();
removePlayerFromNode(node, '甲');
node.players = ['甲'];
node.player_uuids = { '甲': 'uuid-a' };
removePlayerFromNode(node, '甲');
ok('移除标记不重复', node.removed_uuids.filter((u) => u === 'uuid-a').length === 1, JSON.stringify(node.removed_uuids));

console.log('\n[5] 重新报名成功后撤销标记');
reset();
removePlayerFromNode(node, '甲');
clear_removed_uuid(node, 'uuid-a');
ok('标记已撤销', !node.removed_uuids.includes('uuid-a'), JSON.stringify(node.removed_uuids));
merge_remote_state(remote_with_removed);
ok('撤销后可再次补入该账号', node.player_uuids['甲'] === 'uuid-a', JSON.stringify(node.player_uuids));

console.log('\n[6] 源码接线断言');
ok('移除记录 removed_uuids', /node\.removed_uuids\.push\(uuid\)/.test(html));
ok('合并跳过被移除的 uuid', /if \(!value \|\| removed\.includes\(value\)\) return;/.test(html));
ok('存在撤销标记助手', /const clear_removed_uuid = \(node, uuid\)/.test(html));
ok('migrateState 归一化 removed_uuids', /node\.removed_uuids = Array\.isArray\(node\.removed_uuids\) \? node\.removed_uuids : \[\]/.test(html));
ok('容量缩减走 removePlayerFromNode', /toRemove\.forEach\(\(p\) => removePlayerFromNode\(node, p\)\)/.test(html));
ok('新方块模板含 removed_uuids', /player_uuids: \{\},\s*removed_uuids: \[\]/.test(html));
ok('重报名成功后撤销标记', /clear_removed_uuid\(joined, uuid\)/.test(html));
ok('重报名成功后清理残留小分', /purge_uuid_results\(joined, uuid\)/.test(html));
ok('移除时清理历史小分', /purge_uuid_results\(node, uuid\)/.test(html));
ok('存在清理小分助手', /const purge_uuid_results = \(node, uuid\)/.test(html));
ok('渲染仅采信与当前组匹配的小分', /const pair_matched = win_keys\.every/.test(html));
ok('报名判定以在册名单为准', /return players\.map\(\(name\) => map\[name\]\)\.filter\(Boolean\)/.test(html));

console.log('\n[6b] 后端报名判定同样以名单为准');
const be_contest = fs.readFileSync(path.join(root, '..', '4ascend-online', 'src', 'api', 'http', 'Contest.cpp'), 'utf8');
ok('后端遍历 players 名单', /for \(const auto& pname : players\.array_range\(\)\)/.test(be_contest));
ok('后端只认在册昵称的 uuid', /if \(member\.empty\(\) \|\| !player_uuids\.contains\(member\)\) continue;/.test(be_contest));
ok('后端不再遍历全部 player_uuids 判重', !/for \(const auto& entry : player_uuids\.object_range\(\)\)/.test(be_contest));
ok('后端报名清理该身份历史小分', /entry\["wins"\] = filtered;/.test(be_contest));
ok('后端重置目标组旧战绩', /results\[std::to_string\(pick\)\] = cleared;/.test(be_contest));

console.log('\n[8] 移除已完赛选手：清除其历史小分并重算完成态');
reset();
node.players = ['甲', '乙'];
node.groups = [['甲', '乙']];
node.player_uuids = { '甲': 'uuid-a', '乙': 'uuid-b' };
node.results = { '0': { bo: 3, wins: { 'uuid-a': 2, 'uuid-b': 1 }, completed: true, winner_uuid: 'uuid-a', updated_at: 1 } };
removePlayerFromNode(node, '甲');
ok('甲的旧小分已清除', !('uuid-a' in node.results['0'].wins), JSON.stringify(node.results));
ok('移除后该组不再判定完赛', node.results['0'].completed === false, JSON.stringify(node.results['0']));
ok('胜者标识已清空', node.results['0'].winner_uuid === '', JSON.stringify(node.results['0']));

console.log('\n[9] 同组两人均被移除后无任何历史战绩残留');
reset();
node.players = ['甲', '乙'];
node.groups = [['甲', '乙']];
node.player_uuids = { '甲': 'uuid-a', '乙': 'uuid-b' };
node.results = { '0': { bo: 3, wins: { 'uuid-a': 2, 'uuid-b': 1 }, completed: true, winner_uuid: 'uuid-a', updated_at: 1 } };
removePlayerFromNode(node, '甲');
removePlayerFromNode(node, '乙');
ok('组内小分已清空', Object.keys(node.results['0'].wins).length === 0, JSON.stringify(node.results));
ok('保留空壳记录防止合并回灌', '0' in node.results, JSON.stringify(node.results));

console.log('\n[10] 重新报名不继承旧战绩（模拟移除→重抽签）');
reset();
node.players = ['甲', '乙'];
node.groups = [['甲', '乙']];
node.player_uuids = { '甲': 'uuid-a', '乙': 'uuid-b' };
node.results = { '0': { bo: 3, wins: { 'uuid-a': 2, 'uuid-b': 1 }, completed: true, winner_uuid: 'uuid-a', updated_at: 1 } };
removePlayerFromNode(node, '甲');
removePlayerFromNode(node, '乙');
// 两人重新随机进入同一空组
node.players = ['甲', '乙'];
node.groups = [['甲', '乙']];
node.player_uuids = { '甲': 'uuid-a', '乙': 'uuid-b' };
purge_uuid_results(node, 'uuid-a');
purge_uuid_results(node, 'uuid-b');
ok('重报名后无残留小分', Object.keys(node.results['0'].wins).length === 0, JSON.stringify(node.results));
const row = group_score_row(node, ['甲', '乙'], 0);
ok('渲染的小分行无胜者高亮', Boolean(row) && !/group-score-win/.test(row.innerHTML), row ? row.innerHTML : 'null');

console.log('\n[11] group_score_row 仅采信与当前组双方匹配的历史小分');
reset();
node.players = ['甲', '乙'];
node.groups = [['甲', '乙']];
node.player_uuids = { '甲': 'uuid-a', '乙': 'uuid-b' };
node.results = { '0': { bo: 3, wins: { 'uuid-x': 2 }, completed: true, winner_uuid: 'uuid-x', updated_at: 1 } };
const stale_row = group_score_row(node, ['甲', '乙'], 0);
ok('含无关 uuid 的旧战绩被忽略为 0:0', Boolean(stale_row) && /group-score-value'>0<\/span>/.test(stale_row.innerHTML), stale_row ? stale_row.innerHTML : 'null');

console.log('\n[12] 合并服务端数据不得回灌被清除的小分');
reset();
node.players = ['甲'];
node.groups = [['甲'], []];
node.player_uuids = { '甲': 'uuid-a' };
node.results = { '0': { bo: 3, wins: {}, completed: false, winner_uuid: '', updated_at: Date.now() } };
const remote_stale = { nodes: [{ id: node.id, player_uuids: {}, results: { '0': { bo: 3, wins: { 'uuid-a': 2 }, completed: true, winner_uuid: 'uuid-a', updated_at: 1 } } }] };
merge_remote_state(remote_stale);
ok('较旧的旧战绩未覆盖本地空壳', Object.keys(node.results['0'].wins).length === 0 && node.results['0'].completed === false, JSON.stringify(node.results));

console.log('\n[7] 发布产物已包含修复');
const built = fs.readFileSync(built_path, 'utf8');
ok('产物含 removed_uuids 逻辑', built.includes('removed_uuids'));
ok('产物无 ?v=replace 残留', !built.includes('v=replace'));
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

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);