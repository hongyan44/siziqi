/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 文档 HTTP 接口（游戏规则 / 使用手册）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Docs.h"

#include "../Utils.h"

#include "../../libs/only/Time.h"
#include "../../manager/Docs.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace Docs {
namespace {
// 文档大小上限：rule / tip 保持 64KB；story 包含全部关卡剧本，放宽到 1MB
constexpr std::size_t DOC_LIMIT = 65536;
constexpr std::size_t STORY_LIMIT = 1024 * 1024;

// 只允许固定几篇文档，避免写入任意键值污染数据库
bool valid_key(std::string_view key) noexcept {
    return key == "rule" || key == "tip" || key == "story";
}

// 按文档类型返回字节上限（服务端按 UTF-8 字节数校验）
std::size_t doc_limit(std::string_view key) noexcept {
    return key == "story" ? STORY_LIMIT : DOC_LIMIT;
}

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

jsoncons::json doc_json(const Manager::Docs::DocRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["data"] = record.data;
    value["creator"] = record.creator;
    value["updated_at"] = record.updated_at;
    return value;
}
} // namespace

// 查询文档。公开接口，任何人可读；无记录时返回空 data，前端回退到静态文件。
void docs_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("docs_query", response);
    auto value = body.value();

    const auto key = json_string(value, "key");
    if (!valid_key(key)) return api_http_error("docs_query", response);

    Manager::Docs::DocRecord record{};
    if (!Manager::Docs::query_doc(key, record)) return api_http_error("docs_query", response);

    std::string buffer;
    api_end("docs_query", true, doc_json(record), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 更新文档。仅管理员（level = 4）可写，写入后全服可见。
void docs_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("docs_update", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("docs_update", response);

    const auto key = json_string(value, "key");
    if (!valid_key(key)) return api_http_error("docs_update", response);

    const auto data = json_string(value, "data");
    if (data.empty() || data.size() > doc_limit(key)) return api_http_error("docs_update", response);

    const bool status = Manager::Docs::update_doc(key, data, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("docs_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/docs/query", docs_query);
    server.set_http_handler<cinatra::POST>("/docs/update", docs_update);
}
} // namespace Docs
} // namespace Http
} // namespace Api