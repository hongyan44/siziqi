/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 手机号/账号/密码/验证码 登录注册回归测试
 *   1. 加载 js/main/auth.cjs，校验各前端校验函数的判定
 *   2. 静态校验 js/ref/http.cjs 使用新的 ident/pass/code 协议
 *   3. 静态校验 js/main/index.cjs 已改造为登录/注册双面板且无旧邮箱逻辑残留
 *   4. 静态校验 html/index.html 新表单元素与 auth.min.js 引用
 *   5. 静态校验后端 User.cpp / Config.h / Sms.cpp 契约一致
 *   6. 校验发布产物 root/js/main/auth.min.js 与 root/index.html 已更新
 * 运行：node tmp/user-auth.cjs
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

// ---------- 1. 前端校验模块 ----------
const window_stub = {};
new Function('window', read(path.join(root, 'js', 'main', 'auth.cjs')))(window_stub);
const A = window_stub.AuthExports;

ok('auth 模块导出完整', A
    && typeof A.check_login_ident === 'function'
    && typeof A.check_mail_phone === 'function'
    && typeof A.check_account === 'function'
    && typeof A.check_password === 'function'
    && typeof A.check_password_repeat === 'function'
    && typeof A.check_code === 'function');

ok('手机号合法', A.is_phone('13800138000'));
ok('手机号非法（位数不足）', !A.is_phone('1380013800'));
ok('手机号非法（开头错误）', !A.is_phone('23800138000'));
ok('手机号非法（含字母）', !A.is_phone('1380013800a'));

ok('邮箱合法', A.is_mail('test@qq.com'));
ok('邮箱非法（无域名）', !A.is_mail('test@'));
ok('不支持的邮箱被拒绝', A.check_mail_phone('test@example.com') !== '');
ok('支持的邮箱通过', A.check_mail_phone('test@qq.com') === '');

ok('账号合法', A.is_account('abc_123'));
ok('账号非法（数字开头）', !A.is_account('1abc'));
ok('账号非法（过短）', !A.is_account('ab'));
ok('账号非法（超长）', !A.is_account('a' + 'b'.repeat(16)));

ok('密码长度不足被拒绝', A.check_password('12345') !== '');
ok('密码长度超限被拒绝', A.check_password('x'.repeat(65)) !== '');
ok('密码合法', A.check_password('123456') === '');
ok('两次密码不一致被拒绝', A.check_password_repeat('123456', '123457') !== '');
ok('两次密码一致通过', A.check_password_repeat('123456', '123456') === '');

ok('验证码 5 位通过', A.check_code('12345') === '');
ok('验证码位数不足被拒绝', A.check_code('1234') !== '');
ok('验证码含非数字被拒绝', A.check_code('1234a') !== '');

ok('登录标识：账号通过', A.check_login_ident('abc_123') === '');
ok('登录标识：手机号通过', A.check_login_ident('13800138000') === '');
ok('登录标识：邮箱通过', A.check_login_ident('test@qq.com') === '');
ok('登录标识：空被拒绝', A.check_login_ident('') !== '');
ok('登录标识：非法被拒绝', A.check_login_ident('!!!') !== '');

// 前端占位验证码需与后端保持一致
const config_source = read(path.join(online, 'src', 'Config.h'));
const dev_match = config_source.match(/PHONE_SMS_DEV_CODE\s*=\s*"(\d+)"/);
ok('前端占位验证码与后端一致', dev_match && dev_match[1] === A.PHONE_DEV_CODE, `front=${A.PHONE_DEV_CODE} back=${dev_match && dev_match[1]}`);

// ---------- 2. http.cjs 协议 ----------
const http_source = read(path.join(root, 'js', 'ref', 'http.cjs'));
ok('http_user_sms 传 ident', /http_user_sms[\s\S]{0,200}?\/user\/sms`,\s*\{\s*ident\s*\}/.test(http_source));
ok('http_user_exist 传 ident', /http_user_exist[\s\S]{0,200}?\/user\/exist`,\s*\{\s*ident\s*\}/.test(http_source));
ok('http_user_register 传 ident/code/account/pass/name', /http_user_register[\s\S]{0,260}?\/user\/register`,\s*\{\s*ident,\s*code,\s*account,\s*pass,\s*name\s*\}/.test(http_source));
ok('http_user_login 传 ident/pass/code', /http_user_login[\s\S]{0,260}?\/user\/login`,\s*\{\s*ident,\s*pass,\s*code\s*\}/.test(http_source));

// ---------- 3. index.cjs 交互 ----------
const index_source = read(path.join(root, 'js', 'main', 'index.cjs'));
ok('index.cjs 引用新表单元素', ['input_login_ident', 'button_login_sms', 'input_login_pass', 'input_login_code',
    'input_reg_ident', 'button_reg_sms', 'input_reg_code', 'input_reg_account', 'input_reg_pass', 'input_reg_pass2']
    .every((id) => index_source.includes(id)));
ok('index.cjs 无旧邮箱逻辑残留', !/mail_verify|mail_sms|mail_login|input_init_mail|input_init_code|button_init_sms/.test(index_source));
ok('index.cjs 使用 AuthExports 校验', index_source.includes('window.AuthExports'));
ok('index.cjs 注册成功提示语正确', index_source.includes('注册成功，可以使用注册的手机号/邮箱或账号进行账密登录，也可以验证码登录。'));
ok('index.cjs 登录密码/验证码二选一', index_source.includes('请输入密码或验证码！'));
ok('index.cjs 注册后切回登录面板', index_source.includes('switch_init_tab(\'login\')'));

// ---------- 4. html 表单 ----------
const html_source = read(path.join(root, 'html', 'index.html'));
ok('html 含登录面板元素', ['panel_init_login', 'input_login_ident', 'button_login_sms', 'input_login_pass', 'input_login_code']
    .every((id) => html_source.includes(`id='${id}'`)));
ok('html 含注册面板元素', ['panel_init_register', 'input_reg_ident', 'button_reg_sms', 'input_reg_code', 'input_reg_account', 'input_reg_pass', 'input_reg_pass2']
    .every((id) => html_source.includes(`id='${id}'`)));
ok('html 引入 auth.min.js', html_source.includes('/js/main/auth.min.js'));
ok('html 注册页标签文案', html_source.includes('邮箱或手机号') && html_source.includes('注册账号') && html_source.includes('重复密码'));

// ---------- 5. 后端契约 ----------
const user_cpp = read(path.join(online, 'src', 'api', 'http', 'User.cpp'));
ok('后端注册读取 ident/code/account/pass', /user_register[\s\S]*?"ident"[\s\S]*?"code"[\s\S]*?"account"[\s\S]*?"pass"/.test(user_cpp));
ok('后端注册校验邮箱/手机号', user_cpp.includes('is_mail(ident)') && user_cpp.includes('is_phone(ident)'));
ok('后端注册校验账号唯一', user_cpp.includes('exist_account(account)'));
ok('后端注册校验标识唯一', user_cpp.includes('exist_ident(ident)'));
ok('后端登录支持账密', user_cpp.includes('check_pass(uuid, pass)'));
ok('后端登录支持验证码', user_cpp.includes('verify_sms(ident, code)'));
ok('后端手机号使用占位验证码', user_cpp.includes('PHONE_SMS_DEV_CODE'));

const user_h = read(path.join(online, 'src', 'manager', 'User.h'));
ok('User.h 声明新接口', ['exist_ident', 'exist_account', 'ident2uuid', 'check_pass', 'account_user']
    .every((name) => user_h.includes(name)));

const sms_cpp = read(path.join(online, 'src', 'manager', 'Sms.cpp'));
ok('Sms.create_sms 支持固定验证码', sms_cpp.includes('fixed_code'));

// ---------- 6. 发布产物 ----------
ok('root/js/main/auth.min.js 已生成', exists(path.join(root, 'root', 'js', 'main', 'auth.min.js')));
const built_index = path.join(root, 'root', 'index.html');
if (exists(built_index)) {
    const built = read(built_index);
    ok('发布 index.html 含新元素', built.includes('input_login_ident') && built.includes('input_reg_account'));
    ok('发布 index.html 无 ?v=replace 残留', !built.includes('?v=replace'));
} else {
    ok('发布 index.html 已生成', false, 'root/index.html 不存在');
}

// ---------- 7. 账号信息设置密码 ----------
ok('http_user_set_pass 传 token/code/pass', /http_user_set_pass[\s\S]{0,260}?\/user\/set_pass`,\s*\{\s*token,\s*code,\s*pass\s*\}/.test(http_source));

ok('index.cjs 引用设置密码表单元素', ['input_user_pass_code', 'button_user_pass_sms', 'input_user_pass',
    'input_user_pass2', 'button_user_pass_submit']
    .every((id) => index_source.includes(id)));
ok('index.cjs 调用 http_user_set_pass', index_source.includes('window.http_user_set_pass'));
ok('index.cjs 设置密码校验验证码与新密码', /check_code\(code\)[\s\S]{0,120}?check_password\(pass\)[\s\S]{0,120}?check_password_repeat\(pass, pass2\)/.test(index_source));
ok('index.cjs 未绑定标识时拒绝发送验证码', index_source.includes('未绑定邮箱或手机号'));

ok('html 含设置密码元素', ['input_user_pass_code', 'button_user_pass_sms', 'input_user_pass', 'input_user_pass2', 'button_user_pass_submit']
    .every((id) => html_source.includes(`id='${id}'`)));

ok('后端注册 set_pass 路由', user_cpp.includes('"/user/set_pass"') && user_cpp.includes('user_set_pass'));
ok('后端 set_pass 读取 token/code/pass', /user_set_pass[\s\S]*?"token"[\s\S]*?"code"[\s\S]*?"pass"/.test(user_cpp));
ok('后端 set_pass 校验验证码后更新密码', user_cpp.includes('verify_sms(ident, code)') && user_cpp.includes('update_pass(uuid, pass)'));

const user_manager_cpp = read(path.join(online, 'src', 'manager', 'User.cpp'));
ok('User.h 声明 update_pass', user_h.includes('update_pass'));
ok('User.cpp 预编译更新密码语句', user_manager_cpp.includes('UPDATE users SET pass = ? WHERE uuid = ?'));
ok('User.cpp 实现 update_pass', /bool update_pass\(std::string_view uuid, std::string_view pass\)[\s\S]*?password_digest\(pass\)[\s\S]*?p_update_pass/.test(user_manager_cpp));

// 发布产物需包含设置密码功能
const built_index_min = path.join(root, 'root', 'js', 'main', 'index.min.js');
const built_http_min = path.join(root, 'root', 'js', 'ref', 'http.min.js');
ok('发布 index.min.js 含设置密码逻辑', exists(built_index_min) && read(built_index_min).includes('http_user_set_pass'));
ok('发布 http.min.js 含 set_pass 接口', exists(built_http_min) && read(built_http_min).includes('user/set_pass'));
if (exists(built_index)) {
    const built = read(built_index);
    ok('发布 index.html 含设置密码元素', built.includes('input_user_pass_code') && built.includes('button_user_pass_submit'));
}

// ---------- 8. 手机短信通道（云片，仅 11 位手机号） ----------
ok('Config.h 含云片配置', config_source.includes('SMS_YUNPIAN_APIKEY') && config_source.includes('SMS_YUNPIAN_TPL_ID')
    && config_source.includes('tpl_single_send'));
ok('Config.h 云片走 https 域名', config_source.includes('sms.yunpian.com'));

const init_source = read(path.join(online, 'src', 'Init.h'));
ok('Init.h 读取云片配置', init_source.includes('bin/sms_yunpian_apikey.bin') && init_source.includes('bin/sms_yunpian_tpl_id.bin'));

const sms_h = read(path.join(online, 'src', 'manager', 'Sms.h'));
ok('Sms.h 声明手机短信接口', ['send_phone_sms', 'phone_sms_ready', 'delete_sms'].every((name) => sms_h.includes(name)));

ok('Sms.cpp 仅 11 位手机号可发短信', /send_phone_sms[\s\S]*?phone\.size\(\)\s*!=\s*11[\s\S]*?co_return false/.test(sms_cpp));
ok('Sms.cpp 使用 HTTPS 客户端', sms_cpp.includes('coro_http_client') && sms_cpp.includes('use_ssl'));
ok('Sms.cpp 调用云片模板单发', sms_cpp.includes('SMS_YUNPIAN_HOST') && sms_cpp.includes('form_url_encode'));
ok('Sms.cpp 校验云片返回 code==0', /rjson\["code"\]\.as<int>\(\)\s*==\s*0/.test(sms_cpp));
ok('Sms.cpp 实现 delete_sms', /bool delete_sms\(std::string_view mail\)[\s\S]*?p_delete_sms/.test(sms_cpp));

ok('user_sms 手机号分支走真实发送', /is_phone\(ident\)[\s\S]{0,200}?phone_sms_ready\(\)/.test(user_cpp));
ok('user_sms 未配置回退占位并置 dev', /phone_sms_ready\(\)[\s\S]*?dev = true[\s\S]*?PHONE_SMS_DEV_CODE/.test(user_cpp));
ok('user_sms 返回 dev 标记', user_cpp.includes('result["dev"] = dev'));
ok('user_sms 发送失败回滚验证码', user_cpp.includes('delete_sms(ident)'));

ok('xmake 开启 CINATRA_ENABLE_SSL', read(path.join(online, 'xmake.lua')).includes('CINATRA_ENABLE_SSL'));

ok('http_user_sms 返回后端结果', /http_user_sms[\s\S]{0,260}?return rjson\.result/.test(http_source));
ok('index.cjs 依据 dev 提示占位码', /result\.dev[\s\S]{0,160}?PHONE_DEV_CODE/.test(index_source));
ok('发布 index.min.js 依据 dev 提示', exists(built_index_min) && read(built_index_min).includes('.dev'));

console.log(failed ? `\nuser-auth: ${failed} FAILED` : '\nuser-auth: ALL PASS');
process.exit(failed ? 1 : 0);