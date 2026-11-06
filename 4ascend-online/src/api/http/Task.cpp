/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 每日任务 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Task.h"

#include "../Utils.h"

#include "../../manager/Task.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <algorithm>
#include <string>
#include <vector>


namespace Api {
namespace Http {
namespace Task {
namespace {
bool token_uuid(const jsoncons::json& value, std::string& uuid) noexcept {
    try {
        auto bin = value.at("token").as<jsoncons::byte_string_view>();
        std::string token(bin.begin(), bin.end());
        return Manager::Token::token2uuid(token, uuid) && Manager::User::exist_user(uuid);
    } catch (...) {
        return false;
    }
}

jsoncons::json task_json(const Manager::Task::TaskRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"]       = record.id;
    value["kind"]     = record.kind;
    value["title"]    = record.title;
    value["target"]   = record.target;
    value["progress"] = record.progress;
    value["reward"]   = record.reward;
    value["done"]     = record.done;
    value["claimed"]  = record.claimed;
    return value;
}

// 统计已完成数与「已完成但未领奖」数（后者用于右下角红点）
void count_records(const std::vector<Manager::Task::TaskRecord>& records, int64_t& done_count, int64_t& claimable_count) noexcept {
    done_count      = 0;
    claimable_count = 0;
    for (const auto& record : records) {
        if (!record.done) continue;
        ++done_count;
        if (!record.claimed) ++claimable_count;
    }
}
} // namespace

// 查询当天任务（首次访问自动生成 3 个多人 + 2 个单人 + 1 个投稿任务）
void task_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("task_query", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("task_query", response);

    const int64_t day = Manager::Task::today();
    std::vector<Manager::Task::TaskRecord> records;
    if (!Manager::Task::daily_tasks(uuid, day, records)) return api_http_error("task_query", response);

    jsoncons::json tasks = jsoncons::json::array();
    int64_t done_count   = 0;
    int64_t claimable    = 0;
    for (const auto& record : records) tasks.push_back(task_json(record));
    count_records(records, done_count, claimable);

    const int64_t refresh_count = Manager::Task::refresh_count(uuid, day);
    const int64_t free_refresh  = std::max<int64_t>(0, Manager::Task::FREE_REFRESH - refresh_count);

    jsoncons::json result = jsoncons::json::object();
    result["day"]             = day;
    result["tasks"]           = tasks;
    result["done_count"]      = done_count;
    result["claimable_count"] = claimable;
    result["refresh_count"]   = refresh_count;
    result["free_refresh"]  = free_refresh;
    result["refresh_cost"]  = free_refresh > 0 ? 0 : Manager::Task::PAID_REFRESH_COST;

    std::string buffer;
    api_end("task_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 刷新指定任务：前 2 次免费，之后每次 50 棋币；投稿任务与已完成任务不可刷新
void task_refresh(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("task_refresh", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("task_refresh", response);

    std::string task_id;
    try {
        task_id = value.at("id").as<std::string>();
    } catch (...) {
        return api_http_error("task_refresh", response);
    }

    const int64_t day = Manager::Task::today();
    int64_t cost      = 0;
    int64_t coin      = 0;
    std::vector<Manager::Task::TaskRecord> records;
    const auto refresh = Manager::Task::refresh(uuid, day, task_id, cost, coin, records);

    const bool ok        = refresh == Manager::Task::RefreshResult::ok;
    const char* reason   = refresh == Manager::Task::RefreshResult::invalid_task  ? "invalid"
                           : refresh == Manager::Task::RefreshResult::no_candidate ? "no_candidate"
                           : refresh == Manager::Task::RefreshResult::no_coin      ? "coin"
                                                                                  : ok ? "" : "error";

    jsoncons::json tasks = jsoncons::json::array();
    int64_t done_count   = 0;
    int64_t claimable    = 0;
    for (const auto& record : records) tasks.push_back(task_json(record));
    count_records(records, done_count, claimable);

    const int64_t refresh_count = Manager::Task::refresh_count(uuid, day);

    jsoncons::json result = jsoncons::json::object();
    result["ok"]              = ok;
    result["reason"]          = reason;
    result["cost"]            = cost;
    result["coin"]            = coin;
    result["tasks"]           = tasks;
    result["done_count"]      = done_count;
    result["claimable_count"] = claimable;
    result["refresh_count"]   = refresh_count;
    result["free_refresh"]  = std::max<int64_t>(0, Manager::Task::FREE_REFRESH - refresh_count);
    result["refresh_cost"]  = refresh_count >= Manager::Task::FREE_REFRESH ? Manager::Task::PAID_REFRESH_COST : 0;

    std::string buffer;
    api_end("task_refresh", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 领取指定已完成任务的奖励（棋币 + 等额经验），同一任务只能领取一次
void task_claim(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("task_claim", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("task_claim", response);

    std::string task_id;
    try {
        task_id = value.at("id").as<std::string>();
    } catch (...) {
        return api_http_error("task_claim", response);
    }

    const int64_t day = Manager::Task::today();
    int64_t reward    = 0;
    int64_t coin      = 0;
    std::vector<Manager::Task::TaskRecord> records;
    const auto result_claim = Manager::Task::claim(uuid, day, task_id, reward, coin, records);
    const bool ok           = result_claim == Manager::Task::ClaimResult::ok;
    const char* reason      = result_claim == Manager::Task::ClaimResult::invalid_task ? "invalid" : ok ? "" : "error";

    jsoncons::json tasks = jsoncons::json::array();
    int64_t done_count   = 0;
    int64_t claimable    = 0;
    for (const auto& record : records) tasks.push_back(task_json(record));
    count_records(records, done_count, claimable);

    jsoncons::json result = jsoncons::json::object();
    result["ok"]              = ok;
    result["reason"]          = reason;
    result["reward"]          = reward;
    result["coin"]            = coin;
    result["tasks"]           = tasks;
    result["done_count"]      = done_count;
    result["claimable_count"] = claimable;

    std::string buffer;
    api_end("task_claim", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 上报一次观战（进入观战房间且成功加入时调用）
void task_spectate(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("task_spectate", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("task_spectate", response);

    const int64_t reward = Manager::Task::event(uuid, "spectate", Manager::Task::today());

    jsoncons::json result = jsoncons::json::object();
    result["task_reward"] = reward;

    std::string buffer;
    api_end("task_spectate", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/task/query", task_query);
    server.set_http_handler<cinatra::POST>("/task/refresh", task_refresh);
    server.set_http_handler<cinatra::POST>("/task/claim", task_claim);
    server.set_http_handler<cinatra::POST>("/task/spectate", task_spectate);
}
} // namespace Task
} // namespace Http
} // namespace Api
