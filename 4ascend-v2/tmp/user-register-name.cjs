/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 注册选填昵称回归测试
 *   1. 后端 user_register 支持选填 name（空则默认“无名氏”，长度按 16 显示单位校验）
 *   2. 前端 http_user_register 透传 name
 *   3. 注册面板新增选填昵称输入框
 *   4. index.cjs 校验/传递/重置昵称
 *   5. 发布产物已同步
 * 运行：node tmp/user-register-name.cjs
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

// ---------- 1. 后端 ----------
const user_api_cpp = read(path.join(online, 'src', 'api', 'http', 'User.cpp'));
ok('后端定义 name_length（中文记2单位）', /size_t name_length\(std::string_view value\) noexcept[\s\S]*?length \+= 2;/.test(user_api_cpp));
ok('后端定义 is_name（非空且≤16单位）', /bool is_name\(std::string_view value\) noexcept[\s\S]*?!value\.empty\(\) && name_length\(value\) <= 16/.test(user_api_cpp));
ok('user_register 读取选填 name', /user_register[\s\S]*?rjson\.contains\("name"\)/.test(user_api_cpp));
ok('空昵称回退默认“无名氏”', /if \(name\.empty\(\)\) name = "无名氏";/.test(user_api_cpp));
ok('user_register 校验昵称长度', /user_register[\s\S]*?!is_name\(name\)/.test(user_api_cpp));
ok('create_user 使用传入昵称', /create_user\(mail, phone, account, pass, uuid, [^,]+?, name, ""\)/.test(user_api_cpp));
ok('create_user 不再硬编码“无名氏”', !/create_user\(mail, phone, account, pass, uuid, [^,]+?, "无名氏", ""\)/.test(user_api_cpp));

// ---------- 2. 前端接口 ----------
const http_source = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('http_user_register 增加 name 参数', /http_user_register = async \(ident, code, account, pass, name = ''\)/.test(http_source));
ok('注册请求透传 name', /\{ ident, code, account, pass, name \}/.test(http_source));

// ---------- 3. 前端 HTML ----------
const html_source = read(path.join(root, 'html', 'index.html'));
ok('注册面板含昵称输入框', html_source.includes("id='input_reg_name'"));
ok('昵称标注为选填', /id='input_reg_name'[^>]*label='昵称（选填）'/.test(html_source));

// ---------- 4. 前端逻辑 ----------
const index_source = read(path.join(root, 'js', 'main', 'index.cjs'));
ok('index.cjs 引用昵称输入框', index_source.includes("getElementById('input_reg_name')"));
ok('register_submit 接收并传递 name', /register_submit = async \(ident, code, account, pass, name\)[\s\S]*?http_user_register\(ident, code, account, pass, name\)/.test(index_source));
ok('提交时读取昵称', /const name = input_reg_name\.value\.trim\(\);/.test(index_source));
ok('昵称超长拦截', /if \(name && window\.name_length\(name\) > 16\) return toast\.error\('昵称最长16个字符！'\);/.test(index_source));
ok('提交调用传递 name', /register_submit\(ident, code, account, pass, name\)/.test(index_source));
ok('昵称纳入按钮禁用列表', /\[button_reg_sms, input_reg_ident, input_reg_code, input_reg_account, input_reg_name, input_reg_pass, input_reg_pass2\]/.test(index_source));
ok('关闭对话框清空昵称', /input_reg_account, input_reg_name, input_reg_pass, input_reg_pass2\]/.test(index_source));

// ---------- 5. 发布产物 ----------
if (exists(path.join(root, 'root', 'js', 'ref', 'http.min.js'))) {
    ok('发布 http.min.js 含注册接口', read(path.join(root, 'root', 'js', 'ref', 'http.min.js')).includes('/user/register'));
}
const built_index_min = path.join(root, 'root', 'js', 'main', 'index.min.js');
if (exists(built_index_min)) {
    ok('发布 index.min.js 含昵称逻辑', read(built_index_min).includes('input_reg_name'));
}
const built_index = path.join(root, 'root', 'index.html');
if (exists(built_index)) {
    ok('发布 index.html 含昵称输入框', read(built_index).includes('input_reg_name'));
}

console.log(failed ? `\nuser-register-name: ${failed} FAILED` : '\nuser-register-name: ALL PASS');
process.exit(failed ? 1 : 0);