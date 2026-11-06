/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友系统改造回归测试
 *   1. 75% 宽弹窗 + 内嵌聊天/资料 + 好友申请页（圆形人像+号按钮）
 *   2. 近七天活跃玩家对所有登录玩家开放，取消管理员门槛
 *   3. 好友申请设置（不允许 / 需要同意 / 自动同意）前后端接线
 * 运行：node tmp/friend-requests.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server_root = path.join(root, '..', '4ascend-online');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

// ---------- 1. 页面结构 ----------
console.log('页面结构');

const html_src = read(path.join(root, 'html', 'index.html'));
ok('弹窗：占屏宽 75%', html_src.includes('width: 75vw'));
ok('弹窗：居中面板', html_src.includes('translate(-50%, -50%)'));
ok('弹窗：左右分栏', html_src.includes('.friend-drawer-body') && html_src.includes('grid-template-columns: 320px'));
ok('弹窗：右侧详情区', html_src.includes("id='friend_detail'"));
ok('弹窗：内嵌聊天视图', html_src.includes("id='friend_chat_view'") && html_src.includes("id='div_friend_chat_list'"));
ok('弹窗：内嵌资料视图', html_src.includes("id='friend_profile_view'"));
ok('申请页：圆形按钮（人像+号）', html_src.includes("id='button_friend_requests'") && html_src.includes("name='person-plus'"));
ok('申请页：独立覆盖层', html_src.includes("id='friend_requests_view'"));
ok('申请页：设置三档', html_src.includes("value='deny'") && html_src.includes("value='manual'") && html_src.includes("value='auto'"));
ok('申请页：收到与发出的申请容器', html_src.includes("id='div_friend_requests_page'") && html_src.includes("id='div_friend_outgoing_page'"));
ok('活跃玩家：近七天文案', html_src.includes('近七天活跃玩家'));
ok('活跃玩家：位于好友申请页左侧', html_src.indexOf("id='section_friend_online'") > html_src.indexOf("id='friend_requests_view'"));
ok('活跃玩家：已从好友栏侧栏移出', html_src.indexOf("id='section_friend_online'") > html_src.indexOf("class='friend-requests-side'"));
ok('申请页：左右分栏布局', html_src.includes('.friend-requests-body') && html_src.includes('grid-template-columns: 320px'));
ok('申请页：设置与申请列表在右栏', html_src.includes("class='friend-requests-main'"));
ok('活跃玩家：移除管理员专属文案', !html_src.includes('全部在线玩家（管理员）'));
ok('旧申请区块已移除', !html_src.includes("id='section_friend_requests'"));

// ---------- 2. 前端逻辑 ----------
console.log('前端逻辑');

const friends_src = read(path.join(root, 'js', 'ref', 'friends.cjs'));
ok('逻辑：申请页开关', /const open_requests\s*=/.test(friends_src) && /const close_requests\s*=/.test(friends_src));
ok('逻辑：申请设置保存', /const change_request_mode\s*=/.test(friends_src) && friends_src.includes('http_friend_settings'));
ok('逻辑：聊天内嵌（不再弹窗）', !friends_src.includes('friend-chat-dialog') && friends_src.includes('div_friend_chat_list'));
ok('逻辑：资料内嵌', /const open_profile\s*=/.test(friends_src) && friends_src.includes('div_friend_profile_body'));
ok('逻辑：无弹窗页面回退独立资料窗', /const open_profile_dialog\s*=/.test(friends_src));
ok('逻辑：申请红点独立展示', friends_src.includes('badge_friend_requests'));
ok('逻辑：活跃玩家始终展示', /section_friend_online/.test(friends_src) && friends_src.includes('近七天内没有活跃玩家'));
ok('逻辑：打开申请页即刷新活跃玩家', /const open_requests\s*=[\s\S]{0,800}?refresh_online\(\)/.test(friends_src));
ok('逻辑：好友栏打开不再拉取活跃玩家', !/const open_drawer\s*=[\s\S]{0,200}?refresh_online\(\)/.test(friends_src));
ok('逻辑：拒绝申请入口保留', /const reject_user\s*=/.test(friends_src));
ok('逻辑：通过申请入口保留', /const accept_user\s*=/.test(friends_src));

const http_src = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('接口：http_friend_settings', /window\.http_friend_settings\s*=/.test(http_src));
ok('接口：指向 /friend/settings', http_src.includes('/friend/settings'));

// ---------- 3. 后端 ----------
console.log('后端');

const api_src = read(path.join(server_root, 'src', 'api', 'http', 'Friend.cpp'));
ok('后端：七日活跃窗口常量', /ACTIVE_WINDOW_MS\s*=\s*7LL \* 24 \* 60 \* 60 \* 1000/.test(api_src));
ok('后端：活跃列表使用七日窗口', /ACTIVE_WINDOW_MS/.test(api_src));
ok('后端：取消管理员门槛', !/level < 4/.test(api_src));
ok('后端：在线状态按 60s 判定', /ONLINE_WINDOW_MS/.test(api_src));
ok('后端：申请设置处理器', /void friend_settings\s*\(/.test(api_src));
ok('后端：注册 /friend/settings', api_src.includes('"/friend/settings"'));
ok('后端：申请读取对方设置', /request_mode\(target, mode\)/.test(api_src));
ok('后端：deny 直接拒绝', api_src.includes('"denied"'));
ok('后端：auto 直接成为好友', /mode == "auto"/.test(api_src));
ok('后端：列表回传自身设置', /result\["request_mode"\]/.test(api_src));
ok('后端：活跃列表回传关系与设置', /item\["request_mode"\]/.test(api_src));

const manager_src = read(path.join(server_root, 'src', 'manager', 'Friend.cpp'));
const manager_h = read(path.join(server_root, 'src', 'manager', 'Friend.h'));
ok('存储：friend_settings 表', manager_src.includes('CREATE TABLE IF NOT EXISTS friend_settings'));
ok('存储：request_mode 读取', /void request_mode\(/.test(manager_src));
ok('存储：set_request_mode 写入', /bool set_request_mode\(/.test(manager_src));
ok('存储：三档校验', manager_src.includes('"deny"') && manager_src.includes('"manual"') && manager_src.includes('"auto"'));
ok('存储：头文件声明', /request_mode\(std::string_view/.test(manager_h) && /set_request_mode\(std::string_view/.test(manager_h));

const user_src = read(path.join(server_root, 'src', 'api', 'http', 'User.cpp'));
ok('资料：回传对方申请设置', /result\["request_mode"\]\s*=\s*request_mode/.test(user_src));

// ---------- 4. 构建产物 ----------
console.log('构建产物');

const built_http = read(path.join(root, 'root', 'js', 'ref', 'http.min.js'));
const built_friends = read(path.join(root, 'root', 'js', 'ref', 'friends.min.js'));
const built_index = read(path.join(root, 'root', 'index.html'));
ok('产物：http.min.js 含 /friend/settings', built_http.includes('/friend/settings'));
ok('产物：friends.min.js 含申请设置调用', built_friends.includes('http_friend_settings'));
ok('产物：index.html 弹窗 75vw', built_index.includes('width:75vw'));
ok('产物：index.html 含申请页', built_index.includes('friend_requests_view') && built_index.includes('person-plus'));
ok('产物：index.html 含近七天活跃玩家', built_index.includes('近七天活跃玩家'));

if (failed) {
    console.log(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');
