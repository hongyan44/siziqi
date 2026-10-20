/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事签表 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Contest.h"

#include "../Utils.h"

#include "../../libs/only/Random.h"
#include "../../libs/only/Time.h"
#include "../../manager/Contest.h"
#include "../../manager/Replay.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace Contest {
namespace {
std::string json_string(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return {};
    try { return value.at(key).as<std::string>(); } catch (...) { return {}; }
}

int64_t json_i64(const jsoncons::json& value, std::string_view key, int64_t fallback = 0) noexcept {
    if (!value.contains(key)) return fallback;
    try { return value.at(key).as<int64_t>(); } catch (...) { return fallback; }
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

jsoncons::json bracket_json(const Manager::Contest::BracketRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["data"] = record.data;
    value["creator"] = record.creator;
    value["updated_at"] = record.updated_at;
    return value;
}

jsoncons::json rules_json(const Manager::Contest::RulesRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["data"] = record.data;
    value["creator"] = record.creator;
    value["updated_at"] = record.updated_at;
    return value;
}

jsoncons::json signup_json(const Manager::Contest::SignupRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["data"] = record.data;
    value["creator"] = record.creator;
    value["updated_at"] = record.updated_at;
    return value;
}
} // namespace

// 查询签表。公开接口，任何人可读。
void bracket_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("bracket_query", response);

    Manager::Contest::BracketRecord record{};
    if (!Manager::Contest::query_bracket(record)) return api_http_error("bracket_query", response);

    std::string buffer;
    api_end("bracket_query", true, bracket_json(record), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 更新签表。仅管理员（level = 4）可写。
void bracket_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("bracket_update", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("bracket_update", response);

    const auto data = json_string(value, "data");
    if (data.empty() || data.size() > 65536) return api_http_error("bracket_update", response);

    const bool status = Manager::Contest::update_bracket(data, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("bracket_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 查询赛事规则。公开接口，任何人可读。
void rules_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("rules_query", response);

    Manager::Contest::RulesRecord record{};
    if (!Manager::Contest::query_rules(record)) return api_http_error("rules_query", response);

    std::string buffer;
    api_end("rules_query", true, rules_json(record), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 更新赛事规则。仅管理员（level = 4）可写，写入后全服可见。
void rules_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("rules_update", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("rules_update", response);

    const auto data = json_string(value, "data");
    if (data.empty() || data.size() > 65536) return api_http_error("rules_update", response);

    const bool status = Manager::Contest::update_rules(data, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("rules_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 查询报名页文案。公开接口，任何人可读。
void signup_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("signup_query", response);

    Manager::Contest::SignupRecord record{};
    if (!Manager::Contest::query_signup(record)) return api_http_error("signup_query", response);

    std::string buffer;
    api_end("signup_query", true, signup_json(record), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 更新报名页文案。仅管理员（level = 4）可写，写入后全服可见。
void signup_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("signup_update", response);
    auto value = body.value();

    std::string creator;
    if (!is_admin(value, creator)) return api_http_error("signup_update", response);

    const auto data = json_string(value, "data");
    if (data.empty() || data.size() > 65536) return api_http_error("signup_update", response);

    const bool status = Manager::Contest::update_signup(data, creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("signup_update", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 报名。任何登录用户可写，但只能把名字加入未满组，不能改结构。
void bracket_register(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("bracket_register", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("bracket_register", response);

    const auto node_id = json_string(value, "node_id");
    const auto name = json_string(value, "name");
    if (node_id.empty() || name.empty() || name.size() > 64) return api_http_error("bracket_register", response);

    // 读取当前签表
    Manager::Contest::BracketRecord record{};
    if (!Manager::Contest::query_bracket(record) || record.data.empty()) return api_http_error("bracket_register", response);

    // 解析签表 JSON
    jsoncons::json bracket;
    try {
        bracket = jsoncons::json::parse(record.data);
    } catch (...) { return api_http_error("bracket_register", response); }

    if (!bracket.contains("nodes") || !bracket.at("nodes").is_array()) return api_http_error("bracket_register", response);
    auto nodes = bracket.at("nodes");

    // 查找目标节点
    bool found = false;
    for (auto& node : nodes.array_range()) {
        if (!node.is_object()) continue;
        const auto id = json_string(node, "id");
        if (id != node_id) continue;
        found = true;

        if (!node.contains("players") || !node.contains("maxPlayers")) return api_http_error("bracket_register", response);
        auto players = node.at("players");
        const auto maxPlayers = json_i64(node, "maxPlayers", 0);
        if (maxPlayers <= 0) return api_http_error("bracket_register", response);

        // 报名条件：当前账号 uuid 是否仍在方块在册名单内。
        // 以 players 名单为准，只认仍被登记的昵称对应的 uuid；历史脏数据可能残留已移除账号的 uuid
        // （昵称已不在 players），若据此拒绝，被管理员移除的选手将永远无法再次报名。
        jsoncons::json player_uuids = jsoncons::json::object();
        if (node.contains("player_uuids") && node.at("player_uuids").is_object()) player_uuids = node.at("player_uuids");
        for (const auto& pname : players.array_range()) {
            std::string member;
            try { member = pname.as<std::string>(); } catch (...) { continue; }
            if (member.empty() || !player_uuids.contains(member)) continue;
            std::string registered;
            try { registered = player_uuids.at(member).as<std::string>(); } catch (...) { continue; }
            if (!registered.empty() && registered == uuid) return api_http_error("bracket_register", response);
        }

        // 昵称唯一性守卫：player_uuids 以昵称为键，同名会互相覆盖导致身份错乱，故同名也拒绝。
        if (players.contains(name)) return api_http_error("bracket_register", response);
        // 满员
        if (static_cast<int64_t>(players.size()) >= maxPlayers) return api_http_error("bracket_register", response);

        // 随机找未满组。使用密码学安全随机 + 拒绝采样，避免 std::rand() 低位规律与取模偏差。
        if (!node.contains("groups") || !node.at("groups").is_array()) return api_http_error("bracket_register", response);
        auto groups = node.at("groups");
        std::vector<size_t> unfilled;
        for (size_t i = 0; i < groups.size(); ++i) {
            if (groups[i].is_array() && groups[i].size() < 2) unfilled.push_back(i);
        }
        if (unfilled.empty()) return api_http_error("bracket_register", response);
        const size_t pick = unfilled[Libs::Only::Random::mod(static_cast<uint32_t>(unfilled.size()))];

        // 清理该身份在历史小分中的残留，并重置本次加入组的旧战绩：
        // 被移除后重新报名必须走全新抽签，不得继承任何历史赛事记录。
        int64_t bo = json_i64(node, "bo", 3);
        if (bo < 1) bo = 3;
        if (bo % 2 == 0) bo += 1;
        const int64_t target = bo / 2 + 1;
        const auto now = static_cast<int64_t>(Libs::Only::Time::timestamp_ms());
        jsoncons::json results = (node.contains("results") && node.at("results").is_object())
            ? node.at("results") : jsoncons::json::object();
        for (auto& item : results.object_range()) {
            if (!item.value().is_object()) continue;
            auto& entry = item.value();
            if (!entry.contains("wins") || !entry.at("wins").is_object()) continue;
            jsoncons::json wins = entry.at("wins");
            if (!wins.contains(uuid)) continue;
            jsoncons::json filtered = jsoncons::json::object();
            int64_t max_wins = 0;
            std::string best_uuid;
            for (auto& w : wins.object_range()) {
                const std::string& wu = w.key();
                if (wu == uuid) continue;
                int64_t v = 0;
                try { v = w.value().as<int64_t>(); } catch (...) { v = 0; }
                filtered[wu] = v;
                if (v > max_wins) { max_wins = v; best_uuid = wu; }
            }
            entry["wins"] = filtered;
            entry["bo"] = bo;
            entry["completed"] = max_wins >= target;
            entry["winner_uuid"] = max_wins >= target ? best_uuid : std::string();
            entry["updated_at"] = now;
        }
        // 本次加入的组此前未满员，任何历史战绩都属被移除选手遗留，整体清空
        jsoncons::json cleared = jsoncons::json::object();
        cleared["bo"] = bo;
        cleared["wins"] = jsoncons::json::object();
        cleared["games"] = jsoncons::json::array();
        cleared["completed"] = false;
        cleared["winner_uuid"] = std::string();
        cleared["updated_at"] = now;
        results[std::to_string(pick)] = cleared;
        node["results"] = results;

        // 全部校验通过后再写入，避免半途失败留下脏数据
        players.push_back(name);
        node["players"] = players;
        groups[pick].push_back(name);
        node["groups"] = groups;
        player_uuids[name] = uuid;
        node["player_uuids"] = player_uuids;
        break;
    }
    if (!found) return api_http_error("bracket_register", response);

    bracket["nodes"] = nodes;
    std::string newData;
    bracket.dump(newData);

    // 保留原 creator，仅更新数据和时间戳
    const bool status = Manager::Contest::update_bracket(newData, record.creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    std::string buffer;
    api_end("bracket_register", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 上报一局比赛结果（赛事 BO 小分）。任何本组参赛选手可写。
// 服务端用自身回放记录交叉校验该局真实存在且分出胜负，再增量写回签表；未完成不写。
void match_report(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("match_report", response);
    auto value = body.value();

    std::string uuid;
    if (!token_uuid(value, uuid)) return api_http_error("match_report", response);

    const auto node_id = json_string(value, "node_id");
    const int64_t group_index = json_i64(value, "group_index", -1);
    const int64_t replay_id = json_i64(value, "replay_id", 0);
    if (node_id.empty() || group_index < 0 || replay_id <= 0) return api_http_error("match_report", response);

    Manager::Contest::BracketRecord record{};
    if (!Manager::Contest::query_bracket(record) || record.data.empty()) return api_http_error("match_report", response);

    jsoncons::json bracket;
    try {
        bracket = jsoncons::json::parse(record.data);
    } catch (...) { return api_http_error("match_report", response); }

    if (!bracket.contains("nodes") || !bracket.at("nodes").is_array()) return api_http_error("match_report", response);
    auto nodes = bracket.at("nodes");

    bool found = false;
    bool ok = false;
    jsoncons::json report = jsoncons::json::object();

    for (auto& node : nodes.array_range()) {
        if (!node.is_object()) continue;
        if (json_string(node, "id") != node_id) continue;
        found = true;

        // 该方块 BO 局数（默认 3，偶数向上取奇）
        int64_t bo = json_i64(node, "bo", 3);
        if (bo < 1) bo = 3;
        if (bo % 2 == 0) bo += 1;
        const int64_t target = bo / 2 + 1;

        if (!node.contains("groups") || !node.at("groups").is_array()) break;
        auto groups = node.at("groups");
        if (group_index >= static_cast<int64_t>(groups.size())) break;
        auto group = groups[static_cast<size_t>(group_index)];
        if (!group.is_array() || group.size() != 2) break;

        if (!node.contains("player_uuids") || !node.at("player_uuids").is_object()) break;
        auto player_uuids = node.at("player_uuids");

        // 解析本组双方标识码，并确认上报者是本组选手
        std::string my_name, a_uuid, b_uuid;
        for (auto& member : group.array_range()) {
            std::string mname;
            try { mname = member.as<std::string>(); } catch (...) { continue; }
            std::string mu;
            if (player_uuids.contains(mname)) {
                try { mu = player_uuids.at(mname).as<std::string>(); } catch (...) { mu.clear(); }
            }
            if (mu == uuid) my_name = mname;
            if (a_uuid.empty()) a_uuid = mu; else b_uuid = mu;
        }
        if (my_name.empty() || a_uuid.empty() || b_uuid.empty() || a_uuid == b_uuid) break;

        // 回放交叉校验：该局必须真实存在、双方匹配且分出胜负
        std::vector<Manager::Replay::Record> replays;
        if (!Manager::Replay::query_replay(uuid, replays)) break;
        std::string winner_uuid;
        // 本局先手方标识码：取自回放记录（first 为 0 表示黑方先手，1 表示白方先手）。
        // 用于系列赛先手轮换——第 1 局随机，之后每局按上一局实际先手交换，双方据此推导一致结果。
        std::string first_uuid;
        bool replay_ok = false;
        for (const auto& r : replays) {
            if (static_cast<int64_t>(r.id) != replay_id) continue;
            if (r.result != "A" && r.result != "B") break;
            const bool pair_ok = (r.black_uuid == a_uuid && r.white_uuid == b_uuid)
                || (r.black_uuid == b_uuid && r.white_uuid == a_uuid);
            if (!pair_ok) break;
            winner_uuid = r.result == "A" ? r.black_uuid : r.white_uuid;
            if (r.first == 0) first_uuid = r.black_uuid;
            else if (r.first == 1) first_uuid = r.white_uuid;
            replay_ok = true;
            break;
        }
        if (!replay_ok) break;

        // 增量写入 results[group_index]
        jsoncons::json results = (node.contains("results") && node.at("results").is_object())
            ? node.at("results") : jsoncons::json::object();
        const std::string key = std::to_string(group_index);
        jsoncons::json group_result = (results.contains(key) && results.at(key).is_object())
            ? results.at(key) : jsoncons::json::object();
        jsoncons::json games = (group_result.contains("games") && group_result.at("games").is_array())
            ? group_result.at("games") : jsoncons::json::array();

        // 幂等：同一回放只计一次（双方都会上报）
        bool dup = false;
        for (const auto& g : games.array_range()) {
            if (json_i64(g, "replay_id", -1) == replay_id) { dup = true; break; }
        }
        if (!dup) {
            jsoncons::json game = jsoncons::json::object();
            game["replay_id"] = replay_id;
            game["winner_uuid"] = winner_uuid;
            game["first_uuid"] = first_uuid;
            game["at"] = static_cast<int64_t>(Libs::Only::Time::timestamp_ms());
            games.push_back(game);
        }

        // 小分按标识码累计：wins 为权威分数，games 仅作审计日志与幂等去重
        jsoncons::json wins = (group_result.contains("wins") && group_result.at("wins").is_object())
            ? group_result.at("wins") : jsoncons::json::object();

        if (!dup) wins[winner_uuid] = json_i64(wins, winner_uuid, 0) + 1;

        const int64_t wins_a = json_i64(wins, a_uuid, 0);
        const int64_t wins_b = json_i64(wins, b_uuid, 0);
        const bool completed = wins_a >= target || wins_b >= target;

        const auto now = static_cast<int64_t>(Libs::Only::Time::timestamp_ms());
        group_result["games"] = games;
        group_result["bo"] = bo;
        group_result["wins"] = wins;
        group_result["completed"] = completed;
        group_result["winner_uuid"] = completed ? (wins_a > wins_b ? a_uuid : b_uuid) : std::string();
        group_result["updated_at"] = now;
        results[key] = group_result;
        node["results"] = results;

        report["games"] = games;
        report["wins"] = wins;
        report["completed"] = completed;
        report["winner_uuid"] = group_result["winner_uuid"];
        ok = true;
        break;
    }
    if (!found) return api_http_error("match_report", response);

    if (ok) {
        bracket["nodes"] = nodes;
        std::string newData;
        bracket.dump(newData);
        if (newData.size() > 65536) return api_http_error("match_report", response);
        Manager::Contest::update_bracket(newData, record.creator, static_cast<uint64_t>(Libs::Only::Time::timestamp_ms()));
    }

    std::string buffer;
    api_end("match_report", ok, ok ? report : jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/contest/bracket_query", bracket_query);
    server.set_http_handler<cinatra::POST>("/contest/bracket_update", bracket_update);
    server.set_http_handler<cinatra::POST>("/contest/bracket_register", bracket_register);
    server.set_http_handler<cinatra::POST>("/contest/match_report", match_report);
    server.set_http_handler<cinatra::POST>("/contest/rules_query", rules_query);
    server.set_http_handler<cinatra::POST>("/contest/rules_update", rules_update);
    server.set_http_handler<cinatra::POST>("/contest/signup_query", signup_query);
    server.set_http_handler<cinatra::POST>("/contest/signup_update", signup_update);
}
} // namespace Contest
} // namespace Http
} // namespace Api
