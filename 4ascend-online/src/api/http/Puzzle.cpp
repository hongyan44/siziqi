/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局关卡 HTTP 接口
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Puzzle.h"

#include "../Utils.h"

#include "../../libs/only/Time.h"
#include "../../manager/Puzzle.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <string>
#include <string_view>
#include <vector>


namespace Api {
namespace Http {
namespace Puzzle {
namespace {
std::string json_string(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return {};
    try { return value.at(key).as<std::string>(); } catch (...) { return {}; }
}

size_t utf8_char_count(std::string_view value) noexcept {
    size_t count = 0;
    for (size_t index = 0; index < value.size(); ++index) {
        const auto byte = static_cast<unsigned char>(value[index]);
        if ((byte & 0xC0) != 0x80) ++count;
    }
    return count;
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

jsoncons::json record_json(const Manager::Puzzle::Record& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"] = record.id;
    value["level"] = record.level;
    value["title"] = record.title;
    value["code"] = record.code;
    value["creator"] = record.creator;
    value["created_at"] = record.created_at;
    return value;
}

jsoncons::json daily_json(const Manager::Puzzle::DailyRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["title"] = record.title;
    value["code"] = record.code;
    value["creator"] = record.creator;
    value["updated_at"] = record.updated_at;
    return value;
}
} // namespace

void puzzle_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_query", response);

    std::vector<Manager::Puzzle::Record> records;
    if (!Manager::Puzzle::query_puzzles(records)) return api_http_error("puzzle_query", response);
    jsoncons::json result = jsoncons::json::array();
    for (const auto& record : records) result.push_back(record_json(record));

    std::string buffer;
    api_end("puzzle_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_daily_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_daily_query", response);
    Manager::Puzzle::DailyRecord record{};
    if (!Manager::Puzzle::query_daily(record)) return api_http_error("puzzle_daily_query", response);
    std::string buffer;
    api_end("puzzle_daily_query", true, daily_json(record), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_daily_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_daily_update", response);
    auto value = body.value();
    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("puzzle_daily_update", response);
    const auto code = json_string(value, "code");
    if (code.empty() || code.size() > 16000) return api_http_error("puzzle_daily_update", response);
    const auto input_title = json_string(value, "title");
    const auto title = input_title.empty() ? std::string("每日挑战") : input_title;
    if (utf8_char_count(title) > 10) return api_http_error("puzzle_daily_update", response);
    const bool status = Manager::Puzzle::update_daily(title, code, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("puzzle_daily_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_add(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_add", response);
    auto value = body.value();
    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("puzzle_add", response);

    const auto title = json_string(value, "title");
    const auto code = json_string(value, "code");
    uint32_t level = 0;
    try { level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_add", response); }
    if (level < 1 || level > 100 || title.empty() || utf8_char_count(title) > 10 || code.empty() || code.size() > 16000) return api_http_error("puzzle_add", response);

    uint64_t id = 0;
    if (!Manager::Puzzle::add_puzzle(level, title, code, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()), id))
        return api_http_error("puzzle_add", response);

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;
    std::string buffer;
    api_end("puzzle_add", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_update", response);
    auto value = body.value();
    std::string uuid;
    if (!is_admin(value, uuid)) return api_http_error("puzzle_update", response);

    uint64_t id = 0;
    uint32_t level = 0;
    try { id = value.at("id").as<uint64_t>(); level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_update", response); }
    const auto title = json_string(value, "title");
    const auto code = json_string(value, "code");
    if (id == 0 || level < 1 || level > 100 || title.empty() || utf8_char_count(title) > 10 || code.empty() || code.size() > 16000)
        return api_http_error("puzzle_update", response);

    const bool status = Manager::Puzzle::update_puzzle(id, level, title, code, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("puzzle_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_delete(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_delete", response);
    auto value = body.value();
    std::string uuid;
    if (!is_admin(value, uuid)) return api_http_error("puzzle_delete", response);

    uint64_t id = 0;
    try { id = value.at("id").as<uint64_t>(); } catch (...) { return api_http_error("puzzle_delete", response); }
    const bool status = Manager::Puzzle::delete_puzzle(id);
    std::string buffer;
    api_end("puzzle_delete", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/puzzle/query", puzzle_query);
    server.set_http_handler<cinatra::POST>("/puzzle/daily_query", puzzle_daily_query);
    server.set_http_handler<cinatra::POST>("/puzzle/daily_update", puzzle_daily_update);
    server.set_http_handler<cinatra::POST>("/puzzle/add", puzzle_add);
    server.set_http_handler<cinatra::POST>("/puzzle/update", puzzle_update);
    server.set_http_handler<cinatra::POST>("/puzzle/delete", puzzle_delete);
}
} // namespace Puzzle
} // namespace Http
} // namespace Api
