/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 账号信息「查看账号与密码状态」回归测试
 *   1. 后端 Manager::User 新增 has_pass 查询（User.h / User.cpp）
 *   2. 后端 user_info 接口返回 has_pass 字段（api/http/User.cpp）
 *   3. 前端 html 增加账号与密码状态展示区块
 *   4. 前端 index.cjs 渲染账号 / 密码状态并在设置成功后刷新
 *   5. 发布产物 root/index.html 与 root/js/main/index.min.js 已同步
 * 运行：node tmp/user-account-pass.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const online = path.join(root, '..', '4ascend-online');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);

// ---------- 1. 后端数据层 ----------
const user_h = read(path.join(online, 'src', 'manager', 'User.h'));
ok('User.h 声明 has_pass', /bool has_pass\(std::string_view uuid, bool& has\) noexcept;/.test(user_h));

const user_manager_cpp = read(path.join(online, 'src', 'manager', 'User.cpp'));
ok('User.cpp 实现 has_pass', /bool has_pass\(std::string_view uuid, bool& has\) noexcept[\s\S]*?p_pass_user[\s\S]*?sqlite3_column_text/.test(user_manager_cpp));
ok('has_pass 以空串判定未设置', /bool has_pass[\s\S]*?has = text && text\[0\] != '\\0';/.test(user_manager_cpp));
ok('has_pass 复用 pass 预编译语句', user_manager_cpp.includes('SELECT pass FROM users WHERE uuid = ?'));

// ---------- 2. 后端接口 ----------
const user_api_cpp = read(path.join(online, 'src', 'api', 'http', 'User.cpp'));
ok('user_info 调用 has_pass', /user_info[\s\S]*?Manager::User::has_pass\(uuid, has_pass\)/.test(user_api_cpp));
ok('user_info 返回 has_pass 字段', user_api_cpp.includes('info["has_pass"] = has_pass'));
ok('user_info 未返回密码明文', !/info\["pass"\]/.test(user_api_cpp));

// ---------- 3. 前端 HTML ----------
const html_source = read(path.join(root, 'html', 'index.html'));
ok('html 含账号展示元素', html_source.includes("id='span_user_account'"));
ok('html 含密码状态展示元素', html_source.includes("id='span_user_pass_status'"));
ok('html 含「账号与密码」区块标题', html_source.includes('账号与密码'));
ok('html 保留设置密码入口（始终可改）', html_source.includes("id='button_user_pass_submit'"));

// ---------- 4. 前端逻辑 ----------
const index_source = read(path.join(root, 'js', 'main', 'index.cjs'));
ok('index.cjs 引用账号与密码状态元素', index_source.includes('span_user_account') && index_source.includes('span_user_pass_status'));
ok('index.cjs 定义 render_user_pass_status', /const render_user_pass_status = \(has_pass\) =>/.test(index_source));
ok('密码状态：已设置文案', /set \? '已设置' : '未设置'/.test(index_source));
ok('user_info 解构 has_pass', /const \{ name, mail, phone, account, level, has_pass \} = info;/.test(index_source));
ok('user_info 渲染账号', index_source.includes("span_user_account.innerText = account || '未设置'"));
ok('user_info 渲染密码状态', index_source.includes('render_user_pass_status(has_pass)'));
ok('设置密码成功后刷新状态', /render_user_pass_status\(true\);/.test(index_source));
ok('关闭对话框复位账号与密码状态', /span_user_account\.innerText = '加载中\.\.\.';[\s\S]{0,120}?span_user_pass_status\.innerText = '加载中\.\.\.';/.test(index_source));

// ---------- 5. 发布产物 ----------
const built_index = path.join(root, 'root', 'index.html');
const built_index_min = path.join(root, 'root', 'js', 'main', 'index.min.js');
ok('发布 index.min.js 已生成', exists(built_index_min));
if (exists(built_index_min)) {
    const min = read(built_index_min);
    ok('发布 index.min.js 含密码状态逻辑', min.includes('span_user_pass_status') || min.includes('未设置'));
}
if (exists(built_index)) {
    const built = read(built_index);
    ok('发布 index.html 含账号与密码状态元素', built.includes('span_user_account') && built.includes('span_user_pass_status'));
    ok('发布 index.html 无 ?v=replace 残留', !built.includes('?v=replace'));
} else {
    ok('发布 index.html 已生成', false, 'root/index.html 不存在');
}

// ---------- 6. 设置账号（仅未设置时可设置，需验证码） ----------
const http_source = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('http_user_set_account 传 token/code/account', /http_user_set_account[\s\S]{0,260}?\/user\/set_account`,\s*\{\s*token,\s*code,\s*account\s*\}/.test(http_source));

ok('User.h 声明 update_account', /bool update_account\(std::string_view uuid, std::string_view account\) noexcept;/.test(user_h));
ok('User.cpp 预编译 update_account 语句（仅空账号可写）', user_manager_cpp.includes("UPDATE users SET account = ? WHERE uuid = ? AND account = ''"));
ok('User.cpp 实现 update_account', /bool update_account\(std::string_view uuid, std::string_view account\) noexcept[\s\S]*?p_update_account[\s\S]*?changed == 1/.test(user_manager_cpp));
ok('User.cpp finalize p_update_account', /sqlite3_finalize\(p_update_account\)/.test(user_manager_cpp));

ok('后端注册 set_account 路由', user_api_cpp.includes('"/user/set_account"') && user_api_cpp.includes('user_set_account'));
ok('set_account 读取 token/code/account', /user_set_account[\s\S]*?"token"[\s\S]*?"code"[\s\S]*?"account"/.test(user_api_cpp));
ok('set_account 校验账号格式', /user_set_account[\s\S]*?!is_account\(account\)/.test(user_api_cpp));
ok('set_account 拒绝已设置账号', /user_set_account[\s\S]*?!current\.empty\(\)/.test(user_api_cpp));
ok('set_account 校验账号唯一', /user_set_account[\s\S]*?exist_account\(account\)/.test(user_api_cpp));
ok('set_account 校验验证码', /user_set_account[\s\S]*?verify_sms\(ident, code\)/.test(user_api_cpp));
ok('set_account 写入账号', /user_set_account[\s\S]*?update_account\(uuid, account\)/.test(user_api_cpp));

ok('html 含设置账号区块', html_source.includes("id='block_user_account_set'"));
ok('html 含设置账号元素', ['input_user_account_code', 'button_user_account_sms', 'input_user_account', 'button_user_account_submit']
    .every((id) => html_source.includes(`id='${id}'`)));
ok('html 设置账号区块默认隐藏', /id='block_user_account_set'[^>]*style='display: none;'/.test(html_source));
ok('html 含「设置登录账号」说明', html_source.includes('设置登录账号'));

ok('index.cjs 引用设置账号元素', ['block_user_account_set', 'input_user_account_code', 'button_user_account_sms', 'input_user_account', 'button_user_account_submit']
    .every((id) => index_source.includes(id)));
ok('index.cjs 定义 user_set_account', /const user_set_account = async \(token, code, account\) =>/.test(index_source));
ok('index.cjs 调用 http_user_set_account', index_source.includes('window.http_user_set_account'));
ok('index.cjs 校验验证码与账号格式', /check_code\(code\) \|\| check_account\(account\)/.test(index_source));
ok('index.cjs 仅未设置时显示设置入口', /block_user_account_set\.style\.display = account \? 'none' : 'flex';/.test(index_source));
ok('index.cjs 设置成功后隐藏并回填账号', /span_user_account\.innerText = account;[\s\S]{0,80}?block_user_account_set\.style\.display = 'none';/.test(index_source));
ok('index.cjs 关闭对话框复位账号输入', /\[input_user_account_code, input_user_account\]\.forEach/.test(index_source));

ok('发布 http.min.js 含 set_account 接口', exists(path.join(root, 'root', 'js', 'ref', 'http.min.js'))
    && read(path.join(root, 'root', 'js', 'ref', 'http.min.js')).includes('user/set_account'));
if (exists(built_index_min)) {
    ok('发布 index.min.js 含设置账号逻辑', read(built_index_min).includes('http_user_set_account'));
}
if (exists(built_index)) {
    ok('发布 index.html 含设置账号元素', read(built_index).includes('block_user_account_set'));
}

console.log(failed ? `\nuser-account-pass: ${failed} FAILED` : '\nuser-account-pass: ALL PASS');
process.exit(failed ? 1 : 0);