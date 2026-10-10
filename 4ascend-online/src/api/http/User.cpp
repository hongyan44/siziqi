/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "User.h"

#include "../Utils.h"

#include "../../manager/Ranked.h"
#include "../../manager/Sms.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include "../../libs/only/Random.h"
#include "../../libs/only/Time.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <jsoncons_ext/msgpack/msgpack.hpp>

#include <stdexcept>
#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace User {
namespace {
// 手机号：11 位、以 1 开头、第二位 3-9
bool is_phone(std::string_view value) noexcept {
    if (value.size() != 11 || value[0] != '1' || value[1] < '3' || value[1] > '9') return false;
    for (const char c : value) {
        if (c < '0' || c > '9') return false;
    }
    return true;
}

// 邮箱：本地部分与域名部分非空，域名含点且顶级域非空
bool is_mail(std::string_view value) noexcept {
    const auto at = value.find('@');
    if (at == std::string_view::npos || at == 0 || at + 1 >= value.size()) return false;
    const auto dot = value.rfind('.');
    if (dot == std::string_view::npos || dot <= at + 1 || dot + 1 >= value.size()) return false;
    return true;
}

// 账号：字母开头，4-16 位字母/数字/下划线
bool is_account(std::string_view value) noexcept {
    if (value.size() < 4 || value.size() > 16) return false;
    const char first = value[0];
    if (!((first >= 'A' && first <= 'Z') || (first >= 'a' && first <= 'z'))) return false;
    for (const char c : value) {
        const bool allowed = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_';
        if (!allowed) return false;
    }
    return true;
}

// 密码：6-64 位
bool is_pass(std::string_view value) noexcept {
    return value.size() >= 6 && value.size() <= 64;
}

// 昵称显示长度：非 ASCII（中文等）记 2 单位，ASCII 记 1 单位，与前端 name_length 保持一致
size_t name_length(std::string_view value) noexcept {
    size_t length = 0;
    for (size_t index = 0; index < value.size();) {
        const unsigned char c = static_cast<unsigned char>(value[index]);
        if (c < 0x80) {
            length += 1;
            index += 1;
            continue;
        }
        length += 2;
        if ((c & 0xE0) == 0xC0) index += 2;
        else if ((c & 0xF0) == 0xE0) index += 3;
        else if ((c & 0xF8) == 0xF0) index += 4;
        else index += 1;
    }
    return length;
}

// 昵称：非空且不超过 16 显示单位
bool is_name(std::string_view value) noexcept {
    return !value.empty() && name_length(value) <= 16;
}
} // namespace

// 用户注册（邮箱或手机号 + 验证码 + 账号 + 密码，注册后不自动登录）
void user_register(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident   = rjson["ident"].as<std::string>();
    auto code    = rjson["code"].as<std::string>();
    auto account = rjson["account"].as<std::string>();
    auto pass    = rjson["pass"].as<std::string>();
    // 昵称选填，未填写时使用默认昵称
    std::string name = rjson.contains("name") && rjson["name"].is_string() ? rjson["name"].as<std::string>() : std::string();
    if (name.empty()) name = "无名氏";

    // 标识必须是邮箱或手机号，账号与密码需符合规则，昵称长度需合法，且验证码有效（验证码校验放最后，避免无谓消耗）
    if ((!is_mail(ident) && !is_phone(ident)) || !is_account(account) || !is_pass(pass) || !is_name(name)
        || Manager::User::exist_ident(ident) || Manager::User::exist_account(account) || !Manager::Sms::verify_sms(ident, code))
        return api_http_error("user_register", response); // cp

    auto uuid = Libs::Only::Random::uuid_v7();

    std::string mail  = is_mail(ident) ? ident : std::string();
    std::string phone = is_phone(ident) ? ident : std::string();
    if (!Manager::User::create_user(mail, phone, account, pass, uuid, Libs::Only::Time::timestamp_ms(), name, ""))
        return api_http_error("user_register", response); // cp
    Manager::Ranked::insert_score(uuid, 0);

    std::string buffer;
    api_end("user_register", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户登录（标识为 账号/手机号/邮箱；密码与验证码二选一）
void user_login(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident = rjson["ident"].as<std::string>();
    auto pass  = rjson["pass"].as<std::string>();
    auto code  = rjson["code"].as<std::string>();

    std::string uuid;
    if (!Manager::User::ident2uuid(ident, uuid)) return api_http_error("user_login", response); // cp

    bool passed = false;
    if (!pass.empty()) {
        passed = Manager::User::check_pass(uuid, pass);
    } else if (!code.empty() && (is_mail(ident) || is_phone(ident))) {
        // 验证码只能发往邮箱或手机号，账号名不支持验证码登录
        passed = Manager::Sms::verify_sms(ident, code);
    }
    if (!passed) return api_http_error("user_login", response); // cp

    std::string token;
    Manager::Token::uuid2token(uuid, token);

    std::string buffer;
    api_end("user_login", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);

    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 发送验证码（邮箱真实发送；手机号在配置云片后真实下发，未配置时回退占位固定码）
async_simple::coro::Lazy<void> user_sms(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) co_return;
    auto rjson = body.value();

    auto ident = rjson["ident"].as<std::string>();
    auto time  = Libs::Only::Time::timestamp_ms();

    std::string code;
    bool dev = false;

    if (is_phone(ident)) {
        if (!Manager::Sms::phone_sms_ready()) {
            // 未接入短信服务商：回退占位，使用固定验证码且不实际下发
            dev = true;
            if (!Manager::Sms::create_sms(ident, time, code, PHONE_SMS_DEV_CODE)) co_return api_http_error("user_sms", response); // cp
        } else {
            if (!Manager::Sms::create_sms(ident, time, code)) co_return api_http_error("user_sms", response); // cp
            if (!(co_await Manager::Sms::send_phone_sms(ident, code, request.get_conn()->get_executor()))) {
                Manager::Sms::delete_sms(ident);
                co_return api_http_error("user_sms", response); // cp
            }
        }
    } else if (is_mail(ident)) {
        if (!Manager::Sms::create_sms(ident, time, code)) co_return api_http_error("user_sms", response); // cp
        if (!(co_await Manager::Sms::send_sms(ident, code, request.get_conn()->get_executor()))) {
            Manager::Sms::delete_sms(ident);
            co_return api_http_error("user_sms", response); // cp
        }
    } else {
        co_return api_http_error("user_sms", response); // cp
    }

    // dev 为 true 表示手机号走占位固定码（前端据此提示固定验证码）
    jsoncons::json result = jsoncons::json::object();
    result["dev"] = dev;

    std::string buffer;
    api_end("user_sms", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 标识（邮箱或手机号）是否已注册
void user_exist(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident  = rjson["ident"].as<std::string>();
    auto status = Manager::User::exist_ident(ident);

    std::string buffer;
    api_end("user_exist", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户删除
void user_delete(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    Manager::Token::token2uuid(token, uuid);
    auto status = Manager::User::delete_user(uuid);

    std::string buffer;
    api_end("user_delete", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


// 用户信息
void user_info(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t time;
    int64_t score;
    std::string uuid, name, avatar, mail, account, phone;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Manager::User::account_user(uuid, account, phone) || !Manager::Ranked::get_score(uuid, score))
        return api_http_error("user_info", response); // cp

    std::string buffer;
    jsoncons::json info = jsoncons::json::object();
    info["name"]        = name;
    info["avatar"]      = avatar;
    info["time"]        = time;
    info["mail"]        = mail;
    info["account"]     = account;
    info["phone"]       = phone;
    info["uuid"]        = uuid;
    int level = 1;
    if (!Manager::User::get_level(uuid, level)) return api_http_error("user_info", response);
    bool has_pass = false;
    if (!Manager::User::has_pass(uuid, has_pass)) return api_http_error("user_info", response);

    info["score"] = score;
    info["level"] = level;
    // 密码以 HMAC 摘要存储，无法还原明文，这里只暴露“是否已设置”，供前端展示密码状态。
    info["has_pass"] = has_pass;
    api_end("user_info", true, info, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户刷新凭证
void user_rtoken(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string token_;
    if (!Manager::Token::token2token(token, token_)) return api_http_error("user_rtoken", response); // cp

    std::string buffer;
    api_end("user_rtoken", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 解锁用户权限
void user_unlock_level(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto secret = rjson["secret"].as<std::string>();

    std::string uuid;
    int level = 1;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)
        || !Manager::User::unlock_level(uuid, secret, level))
        return api_http_error("user_unlock_level", response);

    std::string buffer;
    jsoncons::json result = jsoncons::json::object();
    result["level"] = level;
    api_end("user_unlock_level", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户更新信息
void user_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto name   = rjson["name"].as<std::string>();
    auto avatar = rjson["avatar"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)) return api_http_error("user_update", response); // cp

    Manager::User::update_user(uuid, name, avatar);

    std::string buffer;
    api_end("user_update", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 设置/修改登录密码（需验证码校验，验证码发往已绑定的邮箱或手机号；设置后即可账密登录）
void user_set_pass(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto code = rjson["code"].as<std::string>();
    auto pass = rjson["pass"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !is_pass(pass))
        return api_http_error("user_set_pass", response); // cp

    std::string name, avatar, mail, account, phone;
    int64_t time = 0;
    if (!Manager::User::info_user(uuid, name, avatar, mail, time) || !Manager::User::account_user(uuid, account, phone))
        return api_http_error("user_set_pass", response); // cp

    // 验证码只能发往已绑定的邮箱或手机号，优先使用邮箱；账号名不支持接收验证码
    const std::string ident = !mail.empty() ? mail : phone;
    if (ident.empty() || !Manager::Sms::verify_sms(ident, code)) return api_http_error("user_set_pass", response); // cp

    if (!Manager::User::update_pass(uuid, pass)) return api_http_error("user_set_pass", response); // cp

    std::string buffer;
    api_end("user_set_pass", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 设置登录账号（仅当前账号为空时可设置，设置后固定；需验证码校验，验证码发往已绑定的邮箱或手机号）
void user_set_account(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto code    = rjson["code"].as<std::string>();
    auto account = rjson["account"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !is_account(account))
        return api_http_error("user_set_account", response); // cp

    // 账号一旦设置便不可再改；账号需全局唯一
    std::string current, phone;
    if (!Manager::User::account_user(uuid, current, phone) || !current.empty() || Manager::User::exist_account(account))
        return api_http_error("user_set_account", response); // cp

    std::string name, avatar, mail;
    int64_t time = 0;
    if (!Manager::User::info_user(uuid, name, avatar, mail, time)) return api_http_error("user_set_account", response); // cp

    // 验证码只能发往已绑定的邮箱或手机号，优先使用邮箱
    const std::string ident = !mail.empty() ? mail : phone;
    if (ident.empty() || !Manager::Sms::verify_sms(ident, code)) return api_http_error("user_set_account", response); // cp

    // 依赖 SQL 的 account = '' 条件原子兜底，避免并发下重复设置
    if (!Manager::User::update_account(uuid, account)) return api_http_error("user_set_account", response); // cp

    std::string buffer;
    api_end("user_set_account", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


// 生成一次性权限秘钥
void generate_level_key(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    // URL 参数鉴权：password 不应通过公共代理或第三方链接传递，否则可能进入访问日志。
    static constexpr std::string_view ADMIN_PASSWORD = "REMOVED";
    if (request.get_query_value("password") != ADMIN_PASSWORD) {
        response.set_status_and_content(cinatra::status_type::unauthorized, "unauthorized");
        return;
    }

    int level = 0;
    try {
        const auto level_value = request.get_query_value("level");
        if (level_value.empty()) throw std::invalid_argument("missing level");
        size_t parsed = 0;
        level = std::stoi(std::string(level_value), &parsed);
        if (parsed != level_value.size()) throw std::invalid_argument("invalid level");
    } catch (...) {
        response.set_status_and_content(cinatra::status_type::bad_request, "level must be 2, 3 or 4");
        return;
    }
    if (level < 2 || level > 4) {
        response.set_status_and_content(cinatra::status_type::bad_request, "level must be 2, 3 or 4");
        return;
    }

    std::string secret;
    if (!Manager::User::generate_level_key(level, secret)) {
        response.set_status_and_content(cinatra::status_type::internal_server_error, "failed to generate level key");
        return;
    }

    // 管理接口返回明文 JSON，不走 MsgPack + DES 业务协议。
    jsoncons::json result = jsoncons::json::object();
    result["level"] = level;
    result["key"] = secret;
    result["used"] = false;
    std::string buffer;
    result.dump(buffer);
    response.add_header("Content-Type", "application/json; charset=utf-8");
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/user/register", user_register);
    server.set_http_handler<cinatra::POST>("/user/login", user_login);

    server.set_http_handler<cinatra::POST>("/user/sms", user_sms);
    server.set_http_handler<cinatra::POST>("/user/exist", user_exist);

    server.set_http_handler<cinatra::POST>("/user/delete", user_delete);
    server.set_http_handler<cinatra::POST>("/user/rtoken", user_rtoken);
    server.set_http_handler<cinatra::POST>("/user/info", user_info);
    server.set_http_handler<cinatra::POST>("/user/update", user_update);
    server.set_http_handler<cinatra::POST>("/user/set_pass", user_set_pass);
    server.set_http_handler<cinatra::POST>("/user/set_account", user_set_account);
    server.set_http_handler<cinatra::POST>("/user/unlock_level", user_unlock_level);
    server.set_http_handler<cinatra::GET>("/admin/generate_level_key", generate_level_key);
};
} // namespace User
} // namespace Http
} // namespace Api