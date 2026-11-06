/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 权限系统回归测试（等级 1~4 递增继承：低级权限有的，更高级权限也有）
 *   覆盖：
 *     1) 好友管理员标识纯逻辑 FriendList.is_admin（等级 4 才为真）
 *     2) 后端权限门一律使用「>= N / < N」判定，禁止 == 2 / == 3 破坏继承
 *     3) 各新增接口的门限：投稿/纯色=2、审核/彩色渐变=3、覆盖/流动彩虹/在线玩家=4
 *     4) 前端源码与构建产物包含对应等级的能力开关
 * 运行：node tmp/permission-levels.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const backend = path.join(root, '..', '4ascend-online');

const FriendList = require(path.join(root, 'js', 'ref', 'friend-list.cjs'));

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (rel) => fs.readFileSync(path.join(backend, rel), 'utf8');
const read_front = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('管理员标识（好友系统）');
ok('等级 4 视为管理员', FriendList.is_admin({ level: 4 }) === true);
ok('等级 3 不是管理员', FriendList.is_admin({ level: 3 }) === false);
ok('等级 2 不是管理员', FriendList.is_admin({ level: 2 }) === false);
ok('等级 1 不是管理员', FriendList.is_admin({ level: 1 }) === false);
ok('字符串等级 4 视为管理员', FriendList.is_admin({ level: '4' }) === true);
ok('缺字段不视为管理员', FriendList.is_admin({}) === false);
ok('null 不视为管理员', FriendList.is_admin(null) === false);

console.log('后端权限门（递增继承）')
const puzzle = read('src/api/http/Puzzle.cpp');
const user = read('src/api/http/User.cpp');
const friend = read('src/api/http/Friend.cpp');

// 2 级：残局投稿
ok('投稿接口要求等级 ≥ 2', /level\s*<\s*2\)\s*return\s*api_http_error\("puzzle_submit"/.test(puzzle));
ok('投稿查询接口要求等级 ≥ 2', /level\s*<\s*2\)\s*return\s*api_http_error\("puzzle_submission_query"/.test(puzzle));
// 3 级：审核投稿（不能覆盖）
ok('审核接口要求等级 ≥ 3', /level\s*<\s*3\)\s*return\s*api_http_error\("puzzle_submission_review"/.test(puzzle));
ok('审核能力开关为等级 ≥ 3', /can_review\s*=\s*level\s*>=\s*3/.test(puzzle));
ok('覆盖能力仅等级 ≥ 4', /allow_overwrite\s*=\s*level\s*>=\s*4/.test(puzzle));
// 2 级：昵称单色；3 级：彩色渐变；4 级：流动彩虹
ok('昵称颜色接口要求等级 ≥ 2', /level\s*<\s*2\)\s*\n?\s*return\s*api_http_error\("user_set_color"/.test(user));
ok('彩色渐变仅等级 ≥ 3 允许', /level\s*>=\s*3\s*&&\s*is_gradient_color/.test(user));
ok('流动彩虹仅等级 ≥ 4 允许', /level\s*>=\s*4\s*&&\s*is_rainbow_color/.test(user));
ok('流动彩虹标记解析为固定 token rainbow', /is_rainbow_color[\s\S]{0,80}value\s*==\s*"rainbow"/.test(user));
ok('颜色查询仅对等级 ≥ 2 携带颜色', /if\s*\(level\s*>=\s*2\)\s*Manager::User::get_name_color/.test(user));
// 4 级：在线玩家列表
ok('在线玩家接口要求等级 ≥ 4', /level\s*<\s*4\)\s*return\s*api_http_error\("friend_online"/.test(friend));

console.log('禁止破坏继承的等值判定');
[['Puzzle.cpp', puzzle], ['User.cpp', user], ['Friend.cpp', friend]].forEach(([name, text]) => {
    ok(`${name} 不出现 level == 2`, !/level\s*==\s*2/.test(text));
    ok(`${name} 不出现 level == 3`, !/level\s*==\s*3/.test(text));
});
// 4 级唯一的“管理员专属”语义：残局的增删改仍只允许管理员
ok('残局管理接口仍限管理员（level == 4）',
    /token_uuid\(value,\s*uuid\)\s*&&\s*Manager::User::get_level\(uuid,\s*level\)\s*&&\s*level\s*==\s*4/.test(puzzle));

console.log('前端能力开关');
const index_js = read_front('js/main/index.cjs');
ok('账号页：等级 ≥ 2 显示昵称颜色设置', /block_user_color\.classList\.toggle\('d-none',\s*safe_level\s*<\s*2\)/.test(index_js));
ok('账号页：等级 ≥ 3 显示彩色渐变', /block_user_color_gradient\.classList\.toggle\('d-none',\s*safe_level\s*<\s*3\)/.test(index_js));
ok('账号页：仅等级 4 显示流动彩虹', /block_user_color_rainbow\.classList\.toggle\('d-none',\s*safe_level\s*!==\s*4\)/.test(index_js));
ok('账号页：昵称上色渲染委托通用模块', /typeof window\.name_color_apply === 'function'/.test(index_js));
ok('账号页：权限指南按钮已接入', /button_user_permission_guide/.test(index_js) && /dialog_permission_guide/.test(index_js));

const view_js = read_front('js/core/view.cjs');
ok('对战页：昵称上色渲染委托通用模块', /typeof window\.name_color_apply === 'function'/.test(view_js));

const must_js = read_front('js/ref/must.cjs');
ok('通用模块：流动彩虹 token 与关键帧集中在 must', /name_color_rainbow_token\s*=\s*'rainbow'/.test(must_js) && /name-color-rainbow-flow/.test(must_js));
ok('通用模块：跨页共享昵称上色 helper（self / pair）', /window\.name_color_apply_self\s*=/.test(must_js) && /window\.name_color_apply_pair\s*=/.test(must_js));

const index_src_html = read_front('html/index.html');
ok('页面：流动彩虹色块为 rainbow token', /data-color='rainbow'/.test(index_src_html));
ok('页面：单色标注等级 2、彩色渐变标注等级 3、流动彩虹标注等级 4',
    /单色（等级 2 及以上）/.test(index_src_html) && /彩色渐变（等级 3 及以上）/.test(index_src_html) && /流动彩虹（等级 4）/.test(index_src_html));

const index_html = read_front('html/index.html');
ok('页面：权限指南按钮位于权限秘钥下方', /button_user_permission_guide/.test(index_html));
ok('页面：权限指南弹窗存在', /dialog_permission_guide/.test(index_html));
ok('页面：在线玩家区块存在', /section_friend_online/.test(index_html));

const submit_html = read_front('html/endgame/submit.html');
ok('投稿编辑器：等级 ≥ 2 显示投稿卡', /submit_card'\)\.classList\.toggle\('d-none',\s*level\s*<\s*2\)/.test(submit_html));
ok('投稿编辑器：等级 ≥ 3 显示审核卡', /review_card'\)\.classList\.toggle\('d-none',\s*level\s*<\s*3\)/.test(submit_html));

const friends_js = read_front('js/ref/friends.cjs');
ok('好友系统：渲染管理员标识徽章', /admin_badge/.test(friends_js) && /FriendList\.is_admin/.test(friends_js));

console.log('构建产物')
const outputs = [
    ['root/js/ref/http.min.js', /http_puzzle_submit[\s\S]*http_user_set_color[\s\S]*http_friend_online/],
    ['root/index.html', /button_user_permission_guide/],
    ['root/index.html', /dialog_permission_guide/],
    ['root/index.html', /section_friend_online/],
    ['root/index.html', /data-color=["']rainbow["']/],
    ['root/js/ref/must.min.js', /name-color-rainbow-flow/],
    ['root/js/main/index.min.js', /name_color_apply/],
    ['root/js/core/view.min.js', /name_color_apply/],
    ['root/js/core/ai.min.js', /name_color_apply_self/],
    ['root/js/core/online.min.js', /name_color_apply_pair/],
    ['root/js/core/ranked.min.js', /name_color_apply_pair/],
    ['root/pages/docs/story-play.html', /name_color_apply_self/],
    ['root/pages/endgame/challenge.html', /name_color_apply_self/],
    ['root/pages/endgame/submit.html', /button_submit_puzzle/],
    ['root/pages/endgame/levels.html', /reviewer_notice/],
    ['root/pages/endgame/index.html', /SUBMIT_ROLES/]
];
outputs.forEach(([rel, pattern]) => {
    const file = path.join(root, rel);
    const exists = fs.existsSync(file);
    ok(`产物存在并含新代码：${rel}`, exists && pattern.test(fs.readFileSync(file, 'utf8')));
});

if (failed) {
    console.log(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');
