/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局关卡 HTTP 接口
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Puzzle.h"

#include "../Utils.h"

#include "../../libs/only/Time.h"
#include "../../manager/Puzzle.h"
#include "../../manager/Task.h"
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

// 解析 token 得到用户标识与权限等级（等级校验 1..4 由 get_level 保证）。
bool token_level(const jsoncons::json& value, std::string& uuid, int& level) noexcept {
    level = 0;
    return token_uuid(value, uuid) && Manager::User::get_level(uuid, level);
}

jsoncons::json record_json(const Manager::Puzzle::Record& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"] = record.id;
    value["level"] = record.level;
    value["title"] = record.title;
    value["description"] = record.description;
    value["code"] = record.code;
    value["creator"] = record.creator;
    value["created_at"] = record.created_at;
    return value;
}

jsoncons::json daily_json(const Manager::Puzzle::DailyRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["title"] = record.title;
    value["description"] = record.description;
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
    // 描述可为空，最多 50 字。
    const auto description = json_string(value, "description");
    if (utf8_char_count(description) > 50) return api_http_error("puzzle_daily_update", response);
    const bool status = Manager::Puzzle::update_daily(title, description, code, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("puzzle_daily_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 查询残局 AI 战术矫正开关。公开接口，挑战页所有玩家都需要读取当前配置。
void puzzle_ai_tactics_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_ai_tactics_query", response);

    bool enabled = true;
    if (!Manager::Puzzle::query_ai_tactics(enabled)) return api_http_error("puzzle_ai_tactics_query", response);

    jsoncons::json result = jsoncons::json::object();
    result["enabled"] = enabled;
    std::string buffer;
    api_end("puzzle_ai_tactics_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 更新残局 AI 战术矫正开关。仅管理员（level = 4）可写，写入后全服生效。
void puzzle_ai_tactics_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_ai_tactics_update", response);
    auto value = body.value();
    std::string uuid;
    if (!is_admin(value, uuid)) return api_http_error("puzzle_ai_tactics_update", response);

    bool enabled = true;
    try { enabled = value.at("enabled").as<bool>(); } catch (...) { return api_http_error("puzzle_ai_tactics_update", response); }

    const bool status = Manager::Puzzle::update_ai_tactics(enabled, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("puzzle_ai_tactics_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void puzzle_add(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_add", response);
    auto value = body.value();
    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("puzzle_add", response);

    const auto title = json_string(value, "title");
    const auto description = json_string(value, "description");
    const auto code = json_string(value, "code");
    uint32_t level = 0;
    try { level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_add", response); }
    if (level < 1 || level > 100 || title.empty() || utf8_char_count(title) > 10 || utf8_char_count(description) > 50 || code.empty() || code.size() > 16000) return api_http_error("puzzle_add", response);

    uint64_t id = 0;
    if (!Manager::Puzzle::add_puzzle(level, title, description, code, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()), id))
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
    const auto description = json_string(value, "description");
    const auto code = json_string(value, "code");
    if (id == 0 || level < 1 || level > 100 || title.empty() || utf8_char_count(title) > 10 || utf8_char_count(description) > 50 || code.empty() || code.size() > 16000)
        return api_http_error("puzzle_update", response);

    const bool status = Manager::Puzzle::update_puzzle(id, level, title, description, code, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
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

// 投稿残局（2 级及以上）：提交后进入待审核队列，由 3/4 级用户审核。
// 等级不足 2 的账号可凭「单局投稿券」投稿一次，校验通过后立即消耗一张。
void puzzle_submit(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_submit", response);
    auto value = body.value();
    std::string creator;
    int level = 0;
    if (!token_level(value, creator, level)) return api_http_error("puzzle_submit", response);

    const auto target = json_string(value, "target");
    const auto title = json_string(value, "title");
    const auto description = json_string(value, "description");
    const auto code = json_string(value, "code");
    if ((target != "daily" && target != "level") || title.empty() || utf8_char_count(title) > 10 || utf8_char_count(description) > 50 || code.empty() || code.size() > 16000)
        return api_http_error("puzzle_submit", response);

    // daily 投稿忽略 level（存 0）；level 投稿必须落在 1..100 的关卡区间。
    uint32_t sub_level = 0;
    if (target == "level") {
        try { sub_level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_submit", response); }
        if (sub_level < 1 || sub_level > 100) return api_http_error("puzzle_submit", response);
    }

    // 等级不足时改为消耗一张单局投稿券：先确认持有，插入成功后再扣券，避免无效投稿浪费。
    const bool use_ticket = level < 2;
    if (use_ticket) {
        int64_t held = 0;
        if (!Manager::User::get_tickets(creator, held) || held < 1) return api_http_error("puzzle_submit", response);
    }

    uint64_t id = 0;
    if (!Manager::Puzzle::add_submission(target, sub_level, title, description, code, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()), id))
        return api_http_error("puzzle_submit", response);
    if (use_ticket) Manager::User::consume_ticket(creator);

    // 每日投稿任务：投稿成功即计一次（无论审核是否通过）
    const int64_t task_reward = Manager::Task::event(creator, "puzzle_submit", Manager::Task::today());

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;
    result["ticket_used"] = use_ticket;
    result["task_reward"] = task_reward;
    int64_t tickets = 0;
    if (Manager::User::get_tickets(creator, tickets)) result["tickets"] = tickets;
    std::string buffer;
    api_end("puzzle_submit", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 审核前修改投稿（3 级及以上）：管理员可纠正投稿位置、名称与残局码，仅待审核投稿可改。
void puzzle_submission_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_submission_update", response);
    auto value = body.value();
    std::string reviewer;
    int level = 0;
    if (!token_level(value, reviewer, level) || level < 3) return api_http_error("puzzle_submission_update", response);

    uint64_t id = 0;
    try { id = value.at("id").as<uint64_t>(); } catch (...) { return api_http_error("puzzle_submission_update", response); }
    const auto target = json_string(value, "target");
    const auto title = json_string(value, "title");
    const auto description = json_string(value, "description");
    const auto code = json_string(value, "code");
    if (id == 0 || (target != "daily" && target != "level") || title.empty() || utf8_char_count(title) > 10 || utf8_char_count(description) > 50 || code.empty() || code.size() > 16000)
        return api_http_error("puzzle_submission_update", response);

    uint32_t sub_level = 0;
    if (target == "level") {
        try { sub_level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_submission_update", response); }
        if (sub_level < 1 || sub_level > 100) return api_http_error("puzzle_submission_update", response);
    }

    const bool status = Manager::Puzzle::update_submission(id, target, sub_level, title, description, code);
    std::string buffer;
    api_end("puzzle_submission_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 查询投稿（2 级及以上）：3 级及以上可见全部待审核投稿，2 级仅见自己全部投稿。
void puzzle_submission_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_submission_query", response);
    auto value = body.value();
    std::string uuid;
    int level = 0;
    if (!token_level(value, uuid, level) || level < 2) return api_http_error("puzzle_submission_query", response);

    const bool can_review = level >= 3;
    std::vector<Manager::Puzzle::Submission> submissions;
    const bool ok = can_review
        ? Manager::Puzzle::list_submissions(std::string_view(), 0, submissions)
        : Manager::Puzzle::list_submissions(uuid, -1, submissions);
    if (!ok) return api_http_error("puzzle_submission_query", response);

    jsoncons::json arr = jsoncons::json::array();
    for (const auto& submission : submissions) {
        jsoncons::json item = jsoncons::json::object();
        item["id"] = submission.id;
        item["target"] = submission.target;
        item["level"] = submission.level;
        item["title"] = submission.title;
        item["description"] = submission.description;
        item["code"] = submission.code;
        item["creator"] = submission.creator;

        std::string creator_name = "无名氏";
        std::string name, avatar, mail;
        int64_t time = 0;
        if (Manager::User::info_user(submission.creator, name, avatar, mail, time) && !name.empty()) creator_name = name;
        item["creator_name"] = creator_name;

        item["status"] = submission.status;
        item["created_at"] = submission.created_at;
        arr.push_back(std::move(item));
    }

    jsoncons::json result = jsoncons::json::object();
    result["can_review"] = can_review;
    result["submissions"] = std::move(arr);
    std::string buffer;
    api_end("puzzle_submission_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 审核投稿（3 级及以上）：通过即发布；4 级可覆盖已占用的位置。
void puzzle_submission_review(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_submission_review", response);
    auto value = body.value();
    std::string reviewer;
    int level = 0;
    if (!token_level(value, reviewer, level) || level < 3) return api_http_error("puzzle_submission_review", response);

    uint64_t id = 0;
    try { id = value.at("id").as<uint64_t>(); } catch (...) { return api_http_error("puzzle_submission_review", response); }
    const auto action = json_string(value, "action");
    if (id == 0 || (action != "approve" && action != "reject")) return api_http_error("puzzle_submission_review", response);

    const bool approve = action == "approve";
    const bool allow_overwrite = level >= 4;
    bool slot_occupied = false;
    std::string creator;
    const bool status = Manager::Puzzle::review_submission(
        id, approve, reviewer, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()), allow_overwrite, slot_occupied, creator
    );
    // 位置已被占用且未获覆盖权限：前端据此提示“该位置已有残局，不能覆盖”。
    if (slot_occupied) return api_http_error("puzzle_submission_review", response);
    // 投稿审核通过后向投稿人发放一张 500 棋币兑换券；仅状态真正由待审改为通过时发放，避免重复审核重复发奖。
    if (status && approve && !creator.empty()) Manager::User::add_vouchers_puzzle(creator, 1);

    std::string buffer;
    api_end("puzzle_submission_review", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 首次通关领奖：同一账号在同一关卡/同一每日残局版本下只发一次 50 经验 + 50 棋币。
void puzzle_claim_clear(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("puzzle_claim_clear", response);
    auto value = body.value();
    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("puzzle_claim_clear", response);

    constexpr int64_t reward_coin = 50;
    constexpr int64_t reward_exp  = 50;
    const auto target = json_string(value, "target");
    int64_t ref = 0;

    if (target == "daily") {
        // 每日残局以当前发布版本（updated_at）作为去重键，换新题后可再次首通领奖。
        Manager::Puzzle::DailyRecord daily{};
        if (!Manager::Puzzle::query_daily(daily) || daily.code.empty()) return api_http_error("puzzle_claim_clear", response);
        ref = static_cast<int64_t>(daily.updated_at);
    } else if (target == "level") {
        uint32_t level = 0;
        try { level = value.at("level").as<uint32_t>(); } catch (...) { return api_http_error("puzzle_claim_clear", response); }
        if (level < 1 || level > 100) return api_http_error("puzzle_claim_clear", response);

        // 只允许对已发布的关卡领奖，避免伪造不存在关卡。
        std::vector<Manager::Puzzle::Record> records;
        if (!Manager::Puzzle::query_puzzles(records)) return api_http_error("puzzle_claim_clear", response);
        bool published = false;
        for (const auto& record : records) {
            if (record.level == level) {
                published = true;
                break;
            }
        }
        if (!published) return api_http_error("puzzle_claim_clear", response);
        ref = static_cast<int64_t>(level);
    } else {
        return api_http_error("puzzle_claim_clear", response);
    }

    const bool first = Manager::Puzzle::claim_clear(
        uuid, target, ref, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms())
    );
    int64_t coin = 0;
    int64_t exp  = 0;
    if (first) {
        if (Manager::User::add_coin(uuid, reward_coin)) coin = reward_coin;
        if (Manager::User::add_exp(uuid, reward_exp)) exp = reward_exp;
    }

    jsoncons::json result = jsoncons::json::object();
    result["first"] = first;
    result["coin"]  = coin;
    result["exp"]   = exp;
    std::string buffer;
    api_end("puzzle_claim_clear", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/puzzle/query", puzzle_query);
    server.set_http_handler<cinatra::POST>("/puzzle/daily_query", puzzle_daily_query);
    server.set_http_handler<cinatra::POST>("/puzzle/daily_update", puzzle_daily_update);
    server.set_http_handler<cinatra::POST>("/puzzle/ai_tactics_query", puzzle_ai_tactics_query);
    server.set_http_handler<cinatra::POST>("/puzzle/ai_tactics_update", puzzle_ai_tactics_update);
    server.set_http_handler<cinatra::POST>("/puzzle/add", puzzle_add);
    server.set_http_handler<cinatra::POST>("/puzzle/update", puzzle_update);
    server.set_http_handler<cinatra::POST>("/puzzle/delete", puzzle_delete);
    server.set_http_handler<cinatra::POST>("/puzzle/submit", puzzle_submit);
    server.set_http_handler<cinatra::POST>("/puzzle/submission_update", puzzle_submission_update);
    server.set_http_handler<cinatra::POST>("/puzzle/submission_query", puzzle_submission_query);
    server.set_http_handler<cinatra::POST>("/puzzle/submission_review", puzzle_submission_review);
    server.set_http_handler<cinatra::POST>("/puzzle/claim_clear", puzzle_claim_clear);
}
} // namespace Puzzle
} // namespace Http
} // namespace Api
