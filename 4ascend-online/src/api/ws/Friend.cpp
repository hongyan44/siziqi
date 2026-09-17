/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Friend.h"

#include "../Utils.h"

#include "../../manager/Token.h"
#include "../../manager/User.h"

#include "../../online/Friend.h"

#include <algorithm>
#include <memory>
#include <string_view>


namespace Api {
namespace Ws {
namespace Friend {
std::unordered_map<
    std::string,
    async_simple::coro::Lazy<void> (*)(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output)>
    dispatch;


// 房间创建
async_simple::coro::Lazy<void> room_create(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id     = rjson["id"].as<std::string>();
    auto status = Online::Friend::room_create(id);

    api_end("room_create", status, jsoncons::json::null(), output);
    co_return;
};

// 房间是否存在
async_simple::coro::Lazy<void> room_exist(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id     = rjson["id"].as<std::string>();
    auto status = Online::Friend::room_exist(id);

    api_end("room_exist", status, jsoncons::json::null(), output);
    co_return;
};


// 房间上次心跳
async_simple::coro::Lazy<void> room_exp(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    int64_t exp;
    if (!Online::Friend::room_exp(id, exp)) co_return api_ws_error("room_exp", output);

    api_end("room_exp", true, jsoncons::json(exp), output);
};

// 房间，得到另外一位玩家的心跳
async_simple::coro::Lazy<void> room_foeex(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::shared_ptr<Online::Player> player;

    if (!Manager::Token::token2uuid(token, uuid) || !Online::Friend::player2player(id, uuid, player))
        co_return api_ws_error("room_foeex", output);

    api_end("room_foeex", true, jsoncons::json(player->exp), output);
};

// 房间，得到另外一位玩家的是否离开
async_simple::coro::Lazy<void> room_foele(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::shared_ptr<Online::Player> player;

    if (!Manager::Token::token2uuid(token, uuid) || !Online::Friend::player2player(id, uuid, player))
        co_return api_ws_error("room_foele", output);

    api_end("room_foele", true, jsoncons::json(player->leave), output);
};

// 房间，标记自己已离开
async_simple::coro::Lazy<void> room_setle(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::shared_ptr<Online::Player> player;

    if (!Manager::Token::token2uuid(token, uuid) || !Online::Friend::player2player_rers(id, uuid, player))
        co_return api_ws_error("room_setle", output);

    player->leave = true;
    api_end("room_setle", true, jsoncons::json::null(), output);
};

// 房间，所有房间信息
async_simple::coro::Lazy<void> room_all(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    std::vector<std::shared_ptr<Online::Room>> rooms;
    auto status = Online::Friend::room_all(rooms);

    jsoncons::json infos = jsoncons::json::array();
    for (auto room : rooms) {
        jsoncons::json info   = jsoncons::json::object();
        info["exp"]           = room->exp;
        info["id"]            = room->id;
        info["name1"]         = room->player1->name;
        info["name2"]         = room->player2->name;
        info["observer_size"] = room->observers.size();
        infos.push_back(info);
    }

    api_end("room_all", status, infos, output);
    co_return;
};

// 房间，所有观众昵称
async_simple::coro::Lazy<void> room_observers(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    std::vector<std::string> names;
    if (!Online::Friend::room_observers(id, names)) co_return api_ws_error("room_observers", output);

    api_end("room_observers", true, jsoncons::json(names), output);
};


// 房间，玩家加入
async_simple::coro::Lazy<void> player_join(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();
    // auto name = rjson["name"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t time;
    std::string uuid, name, mail, avatar;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Online::Friend::player_join(id, uuid, name, client))
        co_return api_ws_error("player_join", output);

    api_end("player_join", true, jsoncons::json::null(), output);
};

// 房间，观战者加入
async_simple::coro::Lazy<void> observer_join(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();
    // auto name = rjson["name"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t time;
    std::string uuid, name, avatar, mail;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Online::Friend::observer_join(id, uuid, name, client))
        co_return api_ws_error("observer_join", output);

    api_end("observer_join", true, jsoncons::json::null(), output);
};


// 房间，玩家心跳
async_simple::coro::Lazy<void>
player_heartbeat(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Online::Friend::player_heartbeat(id, uuid))
        co_return api_ws_error("player_heartbeat", output);

    Online::Friend::room_heartbeat(id);
    api_end("player_heartbeat", true, jsoncons::json::null(), output);
};

// 房间，观众心跳
async_simple::coro::Lazy<void>
observer_heartbeat(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id = rjson["id"].as<std::string>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Online::Friend::observer_heartbeat(id, uuid))
        co_return api_ws_error("observer_heartbeat", output);

    api_end("observer_heartbeat", true, jsoncons::json::null(), output);
};


// 房间，同步，玩家到玩家
async_simple::coro::Lazy<void>
sync_player2player(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id   = rjson["id"].as<std::string>();
    auto data = rjson["data"].as<jsoncons::json>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::shared_ptr<Online::Player> player;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Online::Friend::player2player(id, uuid, player))
        co_return;

    std::string buffer;
    api_end("sync_player2player", true, data, buffer);

    auto it = std::find(ws_clients.begin(), ws_clients.end(), player->client);
    if (it == ws_clients.end()) co_return;
    co_await player->client->write_websocket(buffer, cinatra::opcode::binary);
};

// 房间，同步，玩家到所有观众
async_simple::coro::Lazy<void>
sync_player2observers(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id   = rjson["id"].as<std::string>();
    auto data = rjson["data"].as<jsoncons::json>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::vector<std::shared_ptr<Online::Player>> players;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Online::Friend::player2observers(id, uuid, players))
        co_return;

    std::string buffer;
    api_end("sync_player2observers", true, data, buffer);

    for (auto player : players) {
        auto it = std::find(ws_clients.begin(), ws_clients.end(), player->client);
        if (it == ws_clients.end()) continue;
        co_await player->client->write_websocket(buffer, cinatra::opcode::binary);
    }
};

// 房间，同步，观众到所有观众
async_simple::coro::Lazy<void>
sync_observer2observers(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    auto id   = rjson["id"].as<std::string>();
    auto data = rjson["data"].as<jsoncons::json>();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    std::vector<std::shared_ptr<Online::Player>> players;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Online::Friend::observer2observers(id, uuid, players))
        co_return;

    std::string buffer;
    api_end("sync_observer2observers", true, data, buffer);

    for (auto player : players) {
        auto it = std::find(ws_clients.begin(), ws_clients.end(), player->client);
        if (player->client == client || it == ws_clients.end()) continue;
        co_await player->client->write_websocket(buffer, cinatra::opcode::binary);
    }
};


// 装载所有路由
void load() noexcept {
    dispatch["room_create"] = room_create;
    dispatch["room_exist"]  = room_exist;

    dispatch["room_exp"]   = room_exp;
    dispatch["room_foeex"] = room_foeex;

    dispatch["room_foele"] = room_foele;
    dispatch["room_setle"] = room_setle;

    dispatch["room_all"]       = room_all;
    dispatch["room_observers"] = room_observers;

    dispatch["player_join"]   = player_join;
    dispatch["observer_join"] = observer_join;

    dispatch["player_heartbeat"]   = player_heartbeat;
    dispatch["observer_heartbeat"] = observer_heartbeat;

    dispatch["sync_player2player"]      = sync_player2player;
    dispatch["sync_player2observers"]   = sync_player2observers;
    dispatch["sync_observer2observers"] = sync_observer2observers;
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
} // namespace Friend
} // namespace Ws
} // namespace Api