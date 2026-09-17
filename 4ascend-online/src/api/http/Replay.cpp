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

jsoncons::json record_json(const Manager::Replay::Record& record, std::string_view viewer) noexcept {
    jsoncons::json result = jsoncons::json::object();
    result["id"]          = record.id;
    result["time"]        = record.time;
    result["duration"]    = record.duration;
    result["mode"]        = record.mode;
    result["type"]        = record.category == "ranked" ? "排位战" : "房间号对战";
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

    uint64_t id = 0;
    const auto status = Manager::Replay::add_replay(
        uploader,
        opponent,
        black_uuid,
        white_uuid,
        black_name,
        white_name,
        static_cast<uint64_t>(client_time),
        static_cast<uint64_t>(std::max<int64_t>(0, json_i64(rjson, "duration"))),
        json_i64(rjson, "mode"),
        json_i64(rjson, "first"),
        json_i64(rjson, "black_hp"),
        json_i64(rjson, "white_hp"),
        json_string(rjson, "category").empty() ? "online" : json_string(rjson, "category"),
        json_string(rjson, "result").empty() ? "none" : json_string(rjson, "result"),
        hash,
        data,
        id
    );

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;
    std::string buffer;
    api_end("replay_update", status, result, buffer);
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
    server.set_http_handler<cinatra::POST>("/replay/get", replay_get);
    server.set_http_handler<cinatra::POST>("/replay/query", replay_query);
};
} // namespace Replay
} // namespace Http
} // namespace Api
