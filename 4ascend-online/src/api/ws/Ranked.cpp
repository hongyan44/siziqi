/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 排位赛
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Ranked.h"

#include "../Utils.h"

#include "../../manager/Ranked.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include "../../online/Ranked.h"

#include <string_view>


namespace Api {
namespace Ws {
namespace Ranked {
std::unordered_map<
    std::string,
    async_simple::coro::Lazy<void> (*)(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output)>
    dispatch;


// 加入匹配池
async_simple::coro::Lazy<void> ranked_join(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t time;
    std::string uuid, name, mail, avatar;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Online::Ranked::ranked_join(uuid, name, client))
        co_return api_ws_error("ranked_join", output);

    api_end("ranked_join", true, jsoncons::json::null(), output);
};

// 进行匹配
async_simple::coro::Lazy<void> ranked_match(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto seconds = rjson["seconds"].as<uint64_t>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid, room;
    std::vector<std::shared_ptr<Online::Player>> players;

    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)
        || !Online::Ranked::ranked_match(uuid, seconds, players, room))
        co_return api_ws_error("ranked_match", output);

    std::string buffer;
    api_end("ranked_match", true, jsoncons::json(room), buffer);
    for (auto player : players) {
        auto it = std::find(ws_clients.begin(), ws_clients.end(), player->client);
        if (it == ws_clients.end()) continue;
        co_await player->client->write_websocket(buffer, cinatra::opcode::binary);
    }
};

// 得到匹配的所有玩家信息
async_simple::coro::Lazy<void> ranked_all(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    std::vector<std::shared_ptr<Online::Player>> players;
    if (!Online::Ranked::ranked_all(players)) co_return api_ws_error("ranked_all", output);

    std::vector<std::string> names;
    for (auto player : players) names.emplace_back(player->name);

    api_end("ranked_all", true, jsoncons::json(names), output);
};


// 所有用户的分数
async_simple::coro::Lazy<void>
ranked_leaderboard(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)) co_return api_ws_error("ranked_leaderboard", output);

    std::vector<std::string> names;
    std::vector<std::string> uuids;
    std::vector<int64_t> scores;
    if (!Manager::Ranked::get_all(names, uuids, scores)) co_return api_ws_error("ranked_leaderboard", output); // cp

    auto length = names.size();
    int64_t my  = -1;

    jsoncons::json::array leaderboard = jsoncons::json::array();
    for (int index = 0; index < length; index++) {
        jsoncons::json value = jsoncons::json::object();

        if (uuids[index] == uuid) my = index;

        // 头像与玩家标识随昵称一起下发，供前端渲染头像并支持点击查看玩家资料。
        std::string name, avatar, mail;
        int64_t time = 0;
        if (!Manager::User::info_user(uuids[index], name, avatar, mail, time)) avatar.clear();

        value["id"]     = index;
        value["uuid"]   = uuids[index];
        value["name"]   = names[index];
        value["avatar"] = avatar;
        value["score"]  = scores[index];
        leaderboard.emplace_back(value);
    }

    jsoncons::json result = jsoncons::json::object();
    result["leaderboard"] = leaderboard;
    result["my"]          = my;

    api_end("ranked_leaderboard", true, result, output);
};

// 得到自己的分数
async_simple::coro::Lazy<void> ranked_getscore(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t score;
    std::string uuid;

    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Manager::Ranked::get_score(uuid, score))
        co_return api_ws_error("ranked_getscore", output);

    api_end("ranked_getscore", true, score, output);
};

// 验证对局并计分
async_simple::coro::Lazy<void> ranked_endgame(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    auto room      = rjson["room"].as<std::string>();
    auto win       = rjson["win"].as<std::string>();
    auto is_backbg = rjson["is_backbg"].as<bool>();
    auto archive   = rjson["archive"].as<std::string>();

    int64_t my_score;
    int64_t foe_score;
    std::string uuid, win_p;

    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)
        || !Online::Ranked::ranked_endgame(uuid, room, archive, win, my_score, foe_score, win_p, is_backbg))
        co_return api_ws_error("ranked_endgame", output);

    jsoncons::json value = jsoncons::json::object();
    value["my"]          = my_score;
    value["foe"]         = foe_score;
    value["win_p"]       = win_p;
    api_end("ranked_endgame", true, value, output);
};


// 装载所有路由
void load() noexcept {
    dispatch["ranked_join"]  = ranked_join;
    dispatch["ranked_match"] = ranked_match;
    dispatch["ranked_all"]   = ranked_all;

    dispatch["ranked_leaderboard"] = ranked_leaderboard;
    dispatch["ranked_getscore"]    = ranked_getscore;
    dispatch["ranked_endgame"]     = ranked_endgame;
};


// 运行
async_simple::coro::Lazy<bool> run(std::string_view body_, cinatra::coro_http_connection* client, std::string& output) noexcept {
    auto body = api_body(body_);
    if (!body) co_return false;
    auto rjson = body.value();

    auto op = rjson["op"].as<std::string>();
    // printf("%s\n", op.data());
    auto it = dispatch.find(op);
    if (it != dispatch.end()) {
        co_await it->second(rjson, client, output);
        co_return true;
    }
    co_return false;
};
} // namespace Ranked
} // namespace Ws
} // namespace Api