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
// 用户注册
void user_register(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto mail = rjson["mail"].as<std::string>();
    auto code = rjson["code"].as<std::string>();

    if (Manager::User::exist_mail(mail) || !Manager::Sms::verify_sms(mail, code)) return api_http_error("user_register", response); // cp

    auto uuid = Libs::Only::Random::uuid_v7();

    std::string token;
    Manager::Token::uuid2token(uuid, token);
    Manager::User::create_user(mail, uuid, Libs::Only::Time::timestamp_ms(), "无名氏", "");
    Manager::Ranked::insert_score(uuid, 0);

    std::string buffer;
    api_end("user_register", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户登录
void user_login(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto mail = rjson["mail"].as<std::string>();
    auto code = rjson["code"].as<std::string>();

    if (!Manager::User::exist_mail(mail) || !Manager::Sms::verify_sms(mail, code)) return api_http_error("user_login", response); // cp

    std::string token, uuid;
    Manager::User::mail2uuid(mail, uuid);
    Manager::Token::uuid2token(uuid, token);

    std::string buffer;
    api_end("user_login", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);

    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 发送验证码
async_simple::coro::Lazy<void> user_sms(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) co_return;
    auto rjson = body.value();

    auto mail = rjson["mail"].as<std::string>();
    auto time = Libs::Only::Time::timestamp_ms();

    std::string code;
    if (!Manager::Sms::create_sms(mail, time, code) || !(co_await Manager::Sms::send_sms(mail, code, request.get_conn()->get_executor())))
        co_return api_http_error("user_sms", response); // cp

    std::string buffer;
    api_end("user_sms", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 邮箱是否注册
void user_exist(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto mail   = rjson["mail"].as<std::string>();
    auto status = Manager::User::exist_mail(mail);

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
    std::string uuid, name, avatar, mail;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Manager::Ranked::get_score(uuid, score))
        return api_http_error("user_info", response); // cp

    std::string buffer;
    jsoncons::json info = jsoncons::json::object();
    info["name"]        = name;
    info["avatar"]      = avatar;
    info["time"]        = time;
    info["mail"]        = mail;
    info["uuid"]        = uuid;
    int level = 1;
    if (!Manager::User::get_level(uuid, level)) return api_http_error("user_info", response);

    info["score"] = score;
    info["level"] = level;
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
    server.set_http_handler<cinatra::POST>("/user/unlock_level", user_unlock_level);
    server.set_http_handler<cinatra::GET>("/admin/generate_level_key", generate_level_key);
};
} // namespace User
} // namespace Http
} // namespace Api