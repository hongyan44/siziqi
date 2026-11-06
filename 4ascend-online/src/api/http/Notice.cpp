/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 全服消息 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Notice.h"

#include "../Utils.h"

#include "../../libs/only/Time.h"
#include "../../manager/Notice.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace Notice {
namespace {
std::string json_string(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return {};
    try { return value.at(key).as<std::string>(); } catch (...) { return {}; }
}

bool token_uuid(const jsoncons::json& value, std::string& uuid) noexcept {
    try {
        auto bin = value.at("token").as<jsoncons::byte_string_view>();
        std::string token(bin.begin(), bin.end());
        return Manager::Token::token2uuid(token, uuid) && Manager::User::exist_user(uuid);
    } catch (...) { return false; }
}

bool is_admin(const jsoncons::json& value, std::string& uuid) noexcept {
    int level = 0;
    return token_uuid(value, uuid) && Manager::User::get_level(uuid, level) && level == 4;
}

jsoncons::json notice_json(const Manager::Notice::NoticeRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"]         = record.id;
    value["title"]      = record.title;
    value["content"]    = record.content;
    value["created_at"] = record.created_at;
    return value;
}
} // namespace

// 查询当前生效的全服消息。公开接口，无消息时返回 null。
void notice_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("notice_query", response);

    Manager::Notice::NoticeRecord record{};
    jsoncons::json result = jsoncons::json::object();
    if (Manager::Notice::query_active(record)) result["notice"] = notice_json(record);
    else result["notice"] = jsoncons::json::null();

    std::string buffer;
    api_end("notice_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 发布全服消息。仅管理员（level = 4）可写，发布后旧消息自动失效。
void notice_publish(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("notice_publish", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("notice_publish", response);

    const auto title   = json_string(value, "title");
    const auto content = json_string(value, "content");
    if (content.empty() || content.size() > 65536) return api_http_error("notice_publish", response);
    if (title.size() > 256) return api_http_error("notice_publish", response);

    const bool status = Manager::Notice::publish(title, content, creator, static_cast<int64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("notice_publish", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 清除当前全服消息。仅管理员（level = 4）可写。
void notice_clear(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("notice_clear", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("notice_clear", response);

    const bool status = Manager::Notice::clear();
    std::string buffer;
    api_end("notice_clear", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/notice/query", notice_query);
    server.set_http_handler<cinatra::POST>("/notice/publish", notice_publish);
    server.set_http_handler<cinatra::POST>("/notice/clear", notice_clear);
}
} // namespace Notice
} // namespace Http
} // namespace Api
