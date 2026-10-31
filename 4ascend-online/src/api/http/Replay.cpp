/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 回放 HTTP 接口
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Replay.h"

#include "../Utils.h"

#include "../../libs/digest/Hash.h"
#include "../../libs/only/Time.h"

#include "../../manager/Replay.h"
#include "../../manager/Task.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <jsoncons_ext/msgpack/msgpack.hpp>

#include <algorithm>
#include <cstdint>
#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace Replay {
namespace {
int64_t json_i64(const jsoncons::json& value, std::string_view key, int64_t fallback = 0) noexcept {
    if (!value.contains(key)) return fallback;
    try {
        return value.at(key).as<int64_t>();
    } catch (...) {
        return fallback;
    }
}

std::string json_string(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return {};
    try {
        return value.at(key).as<std::string>();
    } catch (...) {
        return {};
    }
}

bool token_uuid(const jsoncons::json& rjson, std::string& token, std::string& uuid) noexcept {
    try {
        auto bin = rjson.at("token").as<jsoncons::byte_string_view>();
        token.assign(bin.begin(), bin.end());
    } catch (...) {
        return false;
    }
    return Manager::Token::token2uuid(token, uuid) && Manager::User::exist_user(uuid);
}

// 快棋奖励（对局不足 1 分钟）：胜方与和棋 20，败方 1
constexpr int64_t FAST_REWARD_WIN  = 20;
constexpr int64_t FAST_REWARD_LOSE = 1;

// 对局时长对应的棋币 / 经验基准奖励（败方 0-15，胜方翻倍）
// 1-5 分钟：1-7；5-10 分钟：8-10；10-15 分钟：11-14；15 分钟以上：15
int64_t reward_base(uint64_t seconds) noexcept {
    if (seconds < 60) return 0;
    if (seconds < 300) return 1 + static_cast<int64_t>((seconds - 60) * 6 / 239);
    if (seconds < 600) return 8 + static_cast<int64_t>((seconds - 300) * 2 / 299);
    if (seconds < 900) return 11 + static_cast<int64_t>((seconds - 600) * 3 / 299);
    return 15;
}

// 人机对战专用：档位与在线对局一致，区间内按标准值向上取整
int64_t reward_base_up(uint64_t seconds) noexcept {
    if (seconds < 60) return 0;
    if (seconds < 300) return 1 + static_cast<int64_t>(((seconds - 60) * 6 + 238) / 239);
    if (seconds < 600) return 8 + static_cast<int64_t>(((seconds - 300) * 2 + 298) / 299);
    if (seconds < 900) return 11 + static_cast<int64_t>(((seconds - 600) * 3 + 298) / 299);
    return 15;
}

// 在线对局单方奖励（未乘模式倍率）：不足 1 分钟走快棋档，其余按基准胜方双倍
int64_t online_reward(uint64_t seconds, bool winner, bool draw) noexcept {
    if (seconds < 60) return draw ? FAST_REWARD_WIN : (winner ? FAST_REWARD_WIN : FAST_REWARD_LOSE);
    const int64_t base = reward_base(seconds);
    return draw ? base : (winner ? base * 2 : base);
}

// 人机对战单方奖励：不足 1 分钟胜方 20、败方 1，其余按向上取整基准胜方双倍
int64_t ai_reward(uint64_t seconds, bool win) noexcept {
    if (seconds < 60) return win ? FAST_REWARD_WIN : FAST_REWARD_LOSE;
    const int64_t base = reward_base_up(seconds);
    return win ? base * 2 : base;
}

// 模式倍率：房间号对战 1 倍；排位棋币 ×3、经验 ×2；赛事棋币 ×5、经验 ×3
int64_t coin_rate(std::string_view category) noexcept {
    if (category == "ranked") return 3;
    if (category == "contest") return 5;
    return 1;
}

int64_t exp_rate(std::string_view category) noexcept {
    if (category == "ranked") return 2;
    if (category == "contest") return 3;
    return 1;
}

jsoncons::json record_json(const Manager::Replay::Record& record, std::string_view viewer) noexcept {
    jsoncons::json result = jsoncons::json::object();
    result["id"]          = record.id;
    result["time"]        = record.time;
    result["duration"]    = record.duration;
    result["mode"]        = record.mode;
    result["type"]        = record.category == "ranked" ? "排位战" : record.category == "contest" ? "赛事对战" : "房间号对战";
    result["mode_label"]  = record.mode == 2 ? "永夜模式" : record.mode == 1 ? "灾荒模式" : "普通模式";
    result["first"]       = record.first;
    result["first_label"]  = record.first == 0 ? "黑方" : "白方";
    result["black_uuid"]  = record.black_uuid;
    result["white_uuid"]  = record.white_uuid;
    result["black_name"]  = record.black_name;
    result["white_name"]  = record.white_name;
    result["player_a"]    = record.player_a;
    result["player_b"]    = record.player_b;
    result["result"]       = record.result;
    const auto winner_uuid  = record.result == "A" ? record.black_uuid : record.result == "B" ? record.white_uuid : std::string();
    result["result_label"]  = winner_uuid.empty() ? "和棋" : winner_uuid == viewer ? "胜利" : "失败";
    result["black_hp"]      = record.black_hp;
    result["white_hp"]      = record.white_hp;
    result["hp"]            = viewer == record.black_uuid ? record.black_hp : record.white_hp;
    result["viewer"]         = viewer;
    return result;
}
} // namespace

// 上传回放。双方可以重复上传，同一对玩家与同一 hash 只保留一份数据。
void replay_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("replay_update", response);
    auto rjson = body.value();

    std::string token;
    std::string uploader;
    if (!token_uuid(rjson, token, uploader)) return api_http_error("replay_update", response);

    auto opponent = json_string(rjson, "opponent");
    if (opponent.empty()) opponent = json_string(rjson, "playerb");
    if (opponent.empty() || opponent == uploader || !Manager::User::exist_user(opponent)) return api_http_error("replay_update", response);

    const auto client_time = json_i64(rjson, "time", Libs::Only::Time::timestamp_s());
    if (client_time <= 0) return api_http_error("replay_update", response);

    std::string data;
    try {
        auto bin = rjson.at("data").as<jsoncons::byte_string_view>();
        data.assign(bin.begin(), bin.end());
    } catch (...) {
        return api_http_error("replay_update", response);
    }
    if (data.empty()) return api_http_error("replay_update", response);

    std::string black_uuid = json_string(rjson, "black_uuid");
    std::string white_uuid = json_string(rjson, "white_uuid");
    if (black_uuid.empty() || white_uuid.empty() || black_uuid == white_uuid) return api_http_error("replay_update", response);
    if ((black_uuid != uploader && black_uuid != opponent) || (white_uuid != uploader && white_uuid != opponent))
        return api_http_error("replay_update", response);

    std::string black_name;
    std::string white_name;
    std::string avatar;
    std::string mail;
    int64_t register_time = 0;
    if (!Manager::User::info_user(black_uuid, black_name, avatar, mail, register_time)
        || !Manager::User::info_user(white_uuid, white_name, avatar, mail, register_time))
        return api_http_error("replay_update", response);

    std::string hash;
    Libs::Digest::Hash::sha256(data, hash);

    const auto duration   = static_cast<uint64_t>(std::max<int64_t>(0, json_i64(rjson, "duration")));
    const auto category   = json_string(rjson, "category").empty() ? std::string("online") : json_string(rjson, "category");
    const auto result_code = json_string(rjson, "result").empty() ? std::string("none") : json_string(rjson, "result");

    uint64_t id = 0;
    bool created = false;
    const auto status = Manager::Replay::add_replay(
        uploader,
        opponent,
        black_uuid,
        white_uuid,
        black_name,
        white_name,
        static_cast<uint64_t>(client_time),
        duration,
        json_i64(rjson, "mode"),
        json_i64(rjson, "first"),
        json_i64(rjson, "black_hp"),
        json_i64(rjson, "white_hp"),
        category,
        result_code,
        hash,
        data,
        created,
        id
    );

    // 棋币 / 经验结算：房间号、排位、赛事均发奖；不足 1 分钟走快棋档（胜方 / 和棋 20，败方 1），
    // 其余按对局时长取基准（胜方双倍），再按模式倍率放大（排位棋币 ×3 / 经验 ×2，赛事棋币 ×5 / 经验 ×3）。
    // 双方都会上传回放，用「玩家对 + 开局秒」占位，确保同一场对局只结算一次；不做任何时间窗冷却。
    int64_t reward = 0;
    int64_t exp_reward = 0;
    int64_t task_reward = 0;
    if (status && (category == "online" || category == "ranked" || category == "contest")) {
        const bool draw        = result_code != "A" && result_code != "B";
        const std::string winner = result_code == "A" ? black_uuid : result_code == "B" ? white_uuid : std::string();
        const int64_t coin_mul = coin_rate(category);
        const int64_t exp_mul  = exp_rate(category);
        const int64_t black_coin = online_reward(duration, winner == black_uuid, draw) * coin_mul;
        const int64_t white_coin = online_reward(duration, winner == white_uuid, draw) * coin_mul;
        const int64_t black_exp  = online_reward(duration, winner == black_uuid, draw) * exp_mul;
        const int64_t white_exp  = online_reward(duration, winner == white_uuid, draw) * exp_mul;

        // 双方都会上传同一局：只有首次认领才真正入库（双方账户都由这次请求一并入账），
        // 但奖励数额始终按上传者应得份额返回，避免后上传的一方结算面板显示 0。
        reward     = uploader == black_uuid ? black_coin : white_coin;
        exp_reward = uploader == black_uuid ? black_exp : white_exp;

        // 同一对玩家、同一开局秒只结算一次；开局秒不同即为新对局，立即发奖，无冷却。
        const bool fresh = Manager::User::claim_coin_match(black_uuid, white_uuid, client_time);
        if (fresh) {
            if (black_coin > 0) Manager::User::add_coin(black_uuid, black_coin);
            if (white_coin > 0) Manager::User::add_coin(white_uuid, white_coin);
            if (black_exp > 0) Manager::User::add_exp(black_uuid, black_exp);
            if (white_exp > 0) Manager::User::add_exp(white_uuid, white_exp);

            // 每日任务：同一局只记一次，双方都记「进行」，胜者额外记「胜利」。
            const int64_t task_day    = Manager::Task::today();
            const bool uploader_black = uploader == black_uuid;
            if (category == "ranked") {
                const int64_t black_play = Manager::Task::event(black_uuid, "ranked_play", task_day);
                const int64_t white_play = Manager::Task::event(white_uuid, "ranked_play", task_day);
                task_reward += uploader_black ? black_play : white_play;

                if (winner == black_uuid) {
                    const int64_t black_win = Manager::Task::event(black_uuid, "ranked_win", task_day);
                    if (uploader_black) task_reward += black_win;
                } else if (winner == white_uuid) {
                    const int64_t white_win = Manager::Task::event(white_uuid, "ranked_win", task_day);
                    if (!uploader_black) task_reward += white_win;
                }
            } else if (category == "online") {
                const int64_t black_play = Manager::Task::event(black_uuid, "room_play", task_day);
                const int64_t white_play = Manager::Task::event(white_uuid, "room_play", task_day);
                task_reward += uploader_black ? black_play : white_play;
            }
        }
    }

    jsoncons::json result = jsoncons::json::object();
    result["id"]         = id;
    result["reward"]     = reward;
    result["exp_reward"] = exp_reward;
    result["task_reward"] = task_reward;
    std::string buffer;
    api_end("replay_update", status, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 人机对战结算：仅登录玩家有效，按对局时长对应的标准值发放棋币与经验（胜方双倍、向上取整）
// 同一局只结算一次：以客户端上报的开局时间（毫秒）作去重键，不做任何时间窗冷却。
void replay_ai_reward(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("replay_ai_reward", response);
    auto rjson = body.value();

    std::string token;
    std::string uuid;
    if (!token_uuid(rjson, token, uuid)) return api_http_error("replay_ai_reward", response);

    // AI 对局累计统计：每完成一局人机对战（无论奖励是否触发）都记一场。
    Manager::Replay::bump_ai_game(uuid);

    const int64_t seconds = std::max<int64_t>(0, json_i64(rjson, "duration"));
    const bool win        = json_i64(rjson, "win") != 0;
    const int64_t amount  = ai_reward(static_cast<uint64_t>(seconds), win);
    // 难度选项：'0' 入门，'1' 简单及以上（旧客户端不传时按入门处理）
    const int64_t difficulty = std::max<int64_t>(0, json_i64(rjson, "difficulty"));

    int64_t reward     = 0;
    int64_t exp_reward = 0;
    int64_t task_reward = 0;
    // 开局时间缺失时（旧客户端）不做去重，仍然正常发奖。
    const int64_t match_time = json_i64(rjson, "time");
    const bool fresh         = match_time > 0 ? Manager::User::claim_coin_match(uuid, "ai", match_time) : true;
    if (amount > 0 && fresh) {
        if (Manager::User::add_coin(uuid, amount)) reward = amount;
        if (Manager::User::add_exp(uuid, amount)) exp_reward = amount;
    }

    // 每日任务：每完成一局人机对战记一次「进行」，胜者再记「胜利」；简单及以上难度胜利额外记一次。
    if (fresh) {
        const int64_t task_day = Manager::Task::today();
        task_reward += Manager::Task::event(uuid, "ai_play", task_day);
        if (win) {
            task_reward += Manager::Task::event(uuid, "ai_win", task_day);
            if (difficulty >= 1) task_reward += Manager::Task::event(uuid, "ai_win_hard", task_day);
        }
    }

    int64_t coin = 0;
    int64_t exp  = 0;
    Manager::User::get_wallet(uuid, coin, exp);

    jsoncons::json result = jsoncons::json::object();
    result["reward"]     = reward;
    result["exp_reward"] = exp_reward;
    result["task_reward"] = task_reward;
    result["coin"]       = coin;
    result["exp"]        = exp;
    result["exp_level"]  = Manager::User::exp_level(exp);
    result["exp_cur"]    = Manager::User::exp_within(exp);
    result["exp_need"]   = Manager::User::exp_need(Manager::User::exp_level(exp));
    std::string buffer;
    api_end("replay_ai_reward", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 获取回放。必须是该回放关联的玩家。
void replay_get(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("replay_get", response);
    auto rjson = body.value();

    std::string token;
    std::string uuid;
    if (!token_uuid(rjson, token, uuid)) return api_http_error("replay_get", response);

    const auto id = static_cast<uint64_t>(json_i64(rjson, "id", 0));
    std::string data;
    if (id == 0 || !Manager::Replay::get_replay(id, uuid, data)) return api_http_error("replay_get", response);

    std::string buffer;
    api_end("replay_get", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(data.data()), data.size()), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 查询回放元数据。
void replay_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("replay_query", response);
    auto rjson = body.value();

    std::string token;
    std::string uuid;
    if (!token_uuid(rjson, token, uuid)) return api_http_error("replay_query", response);

    std::vector<Manager::Replay::Record> records;
    if (!Manager::Replay::query_replay(uuid, records)) return api_http_error("replay_query", response);

    jsoncons::json result = jsoncons::json::array();
    for (const auto& record : records) result.push_back(record_json(record, uuid));

    std::string buffer;
    api_end("replay_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/replay/update", replay_update);
    server.set_http_handler<cinatra::POST>("/replay/ai_reward", replay_ai_reward);
    server.set_http_handler<cinatra::POST>("/replay/get", replay_get);
    server.set_http_handler<cinatra::POST>("/replay/query", replay_query);
};
} // namespace Replay
} // namespace Http
} // namespace Api
