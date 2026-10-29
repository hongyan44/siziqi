/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友系统纯逻辑回归测试
 *   覆盖 js/ref/friend-list.cjs 的排序 / 状态文案 / ID 规范化 / 房间号 / 关系文案，
 *   并校验构建产物 root/js/ref/friends.min.js 与 root/js/ref/friend-list.min.js 已生成。
 * 运行：node tmp/friend-logic.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const FriendList = require(path.join(root, 'js', 'ref', 'friend-list.cjs'));

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

console.log('friend-list 纯逻辑');

// ---------- normalize_friend_id ----------
ok('规范化：去空白并转大写', FriendList.normalize_friend_id('  ab cd12 ') === 'ABCD12');
ok('规范化：剔除非法字符', FriendList.normalize_friend_id('A-B_C!D') === 'ABCD');
ok('规范化：截断到 8 位', FriendList.normalize_friend_id('ABCDEFGHJK') === 'ABCDEFGH');
ok('规范化：非字符串返回空串', FriendList.normalize_friend_id(12345) === '');
ok('规范化：空串返回空串', FriendList.normalize_friend_id('   ') === '');

// ---------- make_room_code ----------
(() => {
    const code = FriendList.make_room_code();
    ok('房间号：6 位', typeof code === 'string' && code.length === 6);
    ok('房间号：仅大写字母', /^[A-Z]{6}$/.test(code));
    const codes = new Set(Array.from({ length: 40 }, () => FriendList.make_room_code()));
    ok('房间号：具备随机性', codes.size > 1);
})();

// ---------- sort_friends ----------
(() => {
    const now = 1_700_000_000_000;
    const list = [
        { name: 'offline_new', online: false, last_seen: now - 1000 },
        { name: 'online_old', online: true, last_seen: now - 900000 },
        { name: 'offline_old', online: false, last_seen: now - 500000 },
        { name: 'online_new', online: true, last_seen: now - 200000 }
    ];
    const sorted = FriendList.sort_friends(list).map((item) => item.name);
    ok('排序：在线优先且在线内按时间新到旧',
        sorted[0] === 'online_new' && sorted[1] === 'online_old',
        JSON.stringify(sorted));
    ok('排序：离线按时间新到旧',
        sorted[2] === 'offline_new' && sorted[3] === 'offline_old',
        JSON.stringify(sorted));
    ok('排序：不修改原数组', list[0].name === 'offline_new');
    ok('排序：非数组返回空数组', FriendList.sort_friends(null).length === 0);
})();

// ---------- format_last_seen / format_presence ----------
(() => {
    const now = 1_700_000_000_000;
    ok('时间：从未上线', FriendList.format_last_seen(0, now) === '从未上线');
    ok('时间：刚刚在线', FriendList.format_last_seen(now - 30_000, now) === '刚刚在线');
    ok('时间：分钟前', FriendList.format_last_seen(now - 5 * 60_000, now) === '5 分钟前');
    ok('时间：小时前', FriendList.format_last_seen(now - 3 * 3600_000, now) === '3 小时前');
    ok('时间：天前', FriendList.format_last_seen(now - 2 * 86400_000, now) === '2 天前');
    ok('时间：超出 30 天回退日期', /^\d{4}-\d{2}-\d{2}$/.test(FriendList.format_last_seen(now - 40 * 86400_000, now)));
    ok('状态：在线优先于时间', FriendList.format_presence({ online: true, last_seen: 0 }, now) === '在线');
    ok('状态：离线回退时间文案', FriendList.format_presence({ online: false, last_seen: now - 60_000 }, now) === '1 分钟前');
})();

// ---------- relation_label ----------
(() => {
    ok('关系：好友禁用', FriendList.relation_label('friend').disabled === true);
    ok('关系：已申请禁用', FriendList.relation_label('outgoing').disabled === true);
    ok('关系：收到申请可接受', FriendList.relation_label('incoming').action === 'accept');
    ok('关系：自己禁用', FriendList.relation_label('self').disabled === true);
    ok('关系：陌生可添加', FriendList.relation_label('none').action === 'add');
    ok('关系：未知默认添加', FriendList.relation_label(undefined).action === 'add');
    ok('关系：对方不接受申请时禁用', FriendList.relation_label('denied').disabled === true);
    ok('设置：不允许申请文案', FriendList.request_mode_label('deny') === '不允许申请好友');
    ok('设置：需要同意文案', FriendList.request_mode_label('manual') === '好友申请需要同意');
    ok('设置：自动同意文案', FriendList.request_mode_label('auto') === '好友申请自动同意');
    ok('设置：未知回退需要同意', FriendList.request_mode_label(undefined) === '好友申请需要同意');
})();

// ---------- profile_action_label ----------
(() => {
    const friend = FriendList.profile_action_label('friend', 'manual');
    ok('资料卡：好友显示发送消息', friend.text === '发送消息' && friend.kind === 'chat' && friend.disabled === false);
    const incoming = FriendList.profile_action_label('incoming', 'manual');
    ok('资料卡：收到申请显示接受', incoming.text === '接受申请' && incoming.kind === 'accept');
    const outgoing = FriendList.profile_action_label('outgoing', 'manual');
    ok('资料卡：已发送禁用', outgoing.text === '已发送' && outgoing.disabled === true);
    const stranger = FriendList.profile_action_label('none', 'manual');
    ok('资料卡：陌生人添加好友', stranger.text === '添加好友' && stranger.kind === 'request' && stranger.disabled === false);
    const denied = FriendList.profile_action_label('none', 'deny');
    ok('资料卡：对方拒绝申请时禁用', denied.text === '对方不接受申请' && denied.disabled === true);
    ok('资料卡：自己无操作按钮', FriendList.profile_action_label('self', 'manual') === null);
    ok('资料卡：未知关系无操作按钮', FriendList.profile_action_label(undefined, undefined) === null);
})();

// ---------- battle_label ----------
(() => {
    const online = FriendList.battle_label(true);
    ok('对战：在线可发起', online.disabled === false && online.title === '邀请对方对战');
    const offline = FriendList.battle_label(false);
    ok('对战：离线灰置', offline.disabled === true && offline.title === '对方不在线，无法发起对战');
    ok('对战：缺省按离线处理', FriendList.battle_label(undefined).disabled === true);
})();

// ---------- display_name ----------
ok('昵称：空回退无名氏', FriendList.display_name('') === '无名氏');
ok('昵称：空白回退无名氏', FriendList.display_name('   ') === '无名氏');
ok('昵称：非字符串回退', FriendList.display_name(null) === '无名氏');
ok('昵称：正常返回', FriendList.display_name('阿飞') === '阿飞');

// ---------- 构建产物 ----------
console.log('构建产物');
const outputs = [
    path.join(root, 'root', 'js', 'ref', 'friend-list.min.js'),
    path.join(root, 'root', 'js', 'ref', 'friends.min.js'),
    path.join(root, 'root', 'pages', 'online', 'friend.html'),
    path.join(root, 'root', 'js', 'main', 'friend.min.js'),
    path.join(root, 'root', 'index.html')
];
outputs.forEach((file) => {
    const exists = fs.existsSync(file);
    ok(`产物存在：${path.relative(root, file)}`, exists);
});

if (failed) {
    console.log(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');