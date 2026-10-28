/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Friend.h"

#include "../Utils.h"

#include "../../manager/Friend.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include "../../libs/only/Time.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <async_simple/coro/Sleep.h>

#include <jsoncons_ext/msgpack/msgpack.hpp>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdlib>
#include <string>
#include <string_view>
#include <vector>


namespace Api {
namespace Http {
namespace Friend {
namespace {
// 在线判定窗口：客户端每 20s 心跳一次，窗口放宽到 60s 以容忍抖动与网络延迟。
constexpr int64_t ONLINE_WINDOW_MS = 60 * 1000;
// 活跃展示窗口：所有玩家都能查看近七天登录过的玩家（含资料与好友申请入口）。
constexpr int64_t ACTIVE_WINDOW_MS = 7LL * 24 * 60 * 60 * 1000;
// 对战邀请有效期：超时后不再提示，并顺手清理。
constexpr int64_t INVITE_TTL_MS = 2 * 60 * 1000;
// 私信有效期：30 天，过期即不可见并清理。
constexpr int64_t MESSAGE_TTL_MS = 30LL * 24 * 60 * 60 * 1000;
// 单条私信长度上限（字节），防止超长内容撑爆存储与响应。
constexpr size_t MESSAGE_MAX_BYTES = 4000;
// 单次会话返回的最近消息条数上限。
constexpr int64_t MESSAGE_PAGE_LIMIT = 200;

// 专属短 ID 统一大写比较，忽略用户输入的大小写差异。
std::string normalize_friend_id(std::string_view value) noexcept {
    std::string id(value);
    for (auto& c : id) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return id;
}

// 去除首尾空白，避免把纯空格当作有效消息。
std::string trim_message(std::string_view value) noexcept {
    size_t begin = 0;
    size_t end = value.size();
    while (begin < end && std::isspace(static_cast<unsigned char>(value[begin]))) begin += 1;
    while (end > begin && std::isspace(static_cast<unsigned char>(value[end - 1]))) end -= 1;
    return std::string(value.substr(begin, end - begin));
}

// 从请求中取出 token 对应的用户标识；失败时已写入错误响应。
bool resolve_token(jsoncons::json& rjson, cinatra::coro_http_response& response, std::string_view op, std::string& uuid) noexcept {
    if (!rjson.contains("token") || !rjson["token"].is_byte_string()) {
        api_http_error(op, response);
        return false;
    }
    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    if (!Manager::Token::token2uuid(token, uuid) || uuid.empty() || !Manager::User::exist_user(uuid)) {
        api_http_error(op, response);
        return false;
    }
    return true;
}

// 填写用户公开信息（昵称/头像）；用户缺失时回退占位昵称。
void fill_user(jsoncons::json& target, std::string_view uuid) noexcept {
    std::string name, avatar, mail;
    int64_t time = 0;
    if (Manager::User::info_user(uuid, name, avatar, mail, time)) {
        target["name"]   = name;
        target["avatar"] = avatar;
    } else {
        target["name"]   = "无名氏";
        target["avatar"] = "";
    }
    target["uuid"] = std::string(uuid);
    // 权限等级：供前端渲染管理员徽章（读取失败回退为普通用户 1 级）。
    int level = 1;
    Manager::User::get_level(uuid, level);
    target["level"] = level;
}

// 返回响应
void reply(std::string_view op, const jsoncons::json& result, cinatra::coro_http_response& response) noexcept {
    std::string buffer;
    api_end(op, true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 组装即时状态（待处理申请数 + 未读私信数 + 最新对战邀请），供心跳与长轮询共用。
void build_state(std::string_view uuid, int64_t now, jsoncons::json& result) noexcept {
    int64_t pending = 0;
    Manager::Friend::count_incoming(uuid, pending);
    result["requests"] = pending;

    int64_t unread = 0;
    Manager::Friend::count_unread(uuid, now - MESSAGE_TTL_MS, unread);
    result["messages"] = unread;

    Manager::Friend::InviteRecord invite;
    if (Manager::Friend::latest_invite(uuid, INVITE_TTL_MS, now, invite)) {
        jsoncons::json item = jsoncons::json::object();
        item["from"] = invite.from_uuid;
        fill_user(item, invite.from_uuid);
        item["room"]       = invite.room;
        item["created_at"] = invite.created_at;
        result["invite"]   = item;
    } else {
        result["invite"] = jsoncons::json::null();
    }
}

// 解析客户端上报的版本号（优先按字符串解析，兼容直接发送数字）。
uint64_t parse_version(const jsoncons::json& rjson) noexcept {
    if (!rjson.contains("version")) return 0;
    const auto& value = rjson["version"];
    if (value.is_string()) return std::strtoull(value.as<std::string>().c_str(), nullptr, 10);
    if (value.is_number()) return value.as<uint64_t>();
    return 0;
}
} // namespace

// 心跳：更新在线时间，并顺带返回待处理申请数与最新对战邀请（驱动全局红点与邀请弹窗）。
void friend_heartbeat(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_heartbeat", uuid)) return;

    const auto now = Libs::Only::Time::timestamp_ms();
    Manager::Friend::touch(uuid, now);

    jsoncons::json result = jsoncons::json::object();
    build_state(uuid, now, result);

    reply("friend_heartbeat", result, response);
}

// 长轮询：客户端带上已知版本号，服务端在版本变化或等待超时后返回最新状态。
// 挂起期间由协程让出线程，不阻塞 io_context；最长等待控制在 fetch 超时之内。
async_simple::coro::Lazy<void> friend_wait(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) co_return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_wait", uuid)) co_return;

    const auto now = Libs::Only::Time::timestamp_ms();
    Manager::Friend::touch(uuid, now);

    const uint64_t client_version = parse_version(rjson);

    // 每 250ms 检查一次版本号；单次最多挂起 3s（留出余量，避免触发前端 5s 请求超时）。
    constexpr int64_t POLL_INTERVAL_MS = 250;
    constexpr int64_t MAX_WAIT_MS = 3000;
    int64_t waited = 0;
    // 显式传入连接执行器，保证挂起期间让出线程而非阻塞 io_context。
    auto* executor = request.get_conn()->get_executor();
    while (Manager::Friend::version(uuid) == client_version && waited < MAX_WAIT_MS) {
        co_await async_simple::coro::sleep(executor, std::chrono::milliseconds(POLL_INTERVAL_MS));
        waited += POLL_INTERVAL_MS;
    }

    const auto fresh = Libs::Only::Time::timestamp_ms();
    Manager::Friend::touch(uuid, fresh);

    jsoncons::json result = jsoncons::json::object();
    result["version"] = Manager::Friend::version(uuid);
    build_state(uuid, fresh, result);

    reply("friend_wait", result, response);
}

// 好友列表：好友 + 收到的申请 + 发出的申请 + 自己的专属短 ID
void friend_list(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_list", uuid)) return;

    const auto now = Libs::Only::Time::timestamp_ms();

    jsoncons::json result = jsoncons::json::object();

    std::string friend_id;
    Manager::User::ensure_friend_id(uuid, friend_id);
    result["friend_id"] = friend_id;

    std::vector<std::string> friends;
    Manager::Friend::list_friends(uuid, friends);

    jsoncons::json arr = jsoncons::json::array();
    for (const auto& other : friends) {
        if (other.empty()) continue;
        jsoncons::json item = jsoncons::json::object();
        fill_user(item, other);
        int64_t seen = 0;
        const bool has_seen = Manager::Friend::last_seen(other, seen);
        item["last_seen"] = has_seen ? seen : 0;
        item["online"]    = has_seen && (now - seen) <= ONLINE_WINDOW_MS;
        arr.push_back(std::move(item));
    }
    result["friends"] = std::move(arr);

    std::vector<Manager::Friend::RequestRecord> incoming;
    Manager::Friend::list_incoming(uuid, incoming);
    jsoncons::json in_arr = jsoncons::json::array();
    for (const auto& record : incoming) {
        jsoncons::json item = jsoncons::json::object();
        fill_user(item, record.uuid);
        item["created_at"] = record.created_at;
        in_arr.push_back(std::move(item));
    }
    result["incoming"] = std::move(in_arr);

    std::vector<Manager::Friend::RequestRecord> outgoing;
    Manager::Friend::list_outgoing(uuid, outgoing);
    jsoncons::json out_arr = jsoncons::json::array();
    for (const auto& record : outgoing) {
        jsoncons::json item = jsoncons::json::object();
        fill_user(item, record.uuid);
        item["created_at"] = record.created_at;
        out_arr.push_back(std::move(item));
    }
    result["outgoing"] = std::move(out_arr);

    int64_t unread = 0;
    Manager::Friend::count_unread(uuid, now - MESSAGE_TTL_MS, unread);
    result["messages"] = unread;

    std::string request_mode;
    Manager::Friend::request_mode(uuid, request_mode);
    result["request_mode"] = request_mode;

    reply("friend_list", result, response);
}

// 搜索：按专属短 ID 查找用户，并返回与自己的关系
void friend_search(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_search", uuid)) return;

    const auto friend_id = normalize_friend_id(rjson.contains("friend_id") ? rjson["friend_id"].as<std::string>() : std::string());

    jsoncons::json result = jsoncons::json::object();
    result["friend_id"] = friend_id;

    std::string target;
    if (friend_id.empty() || !Manager::User::friend_id_uuid(friend_id, target) || target.empty()) {
        result["found"]    = false;
        result["relation"] = "none";
        reply("friend_search", result, response);
        return;
    }

    result["found"] = true;
    fill_user(result, target);

    std::string target_mode;
    Manager::Friend::request_mode(target, target_mode);
    result["request_mode"] = target_mode;

    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);

    std::string relation = "none";
    if (target == uuid) {
        relation = "self";
    } else if (is_friend) {
        relation = "friend";
    } else {
        bool outgoing = false;
        bool incoming = false;
        Manager::Friend::request_exists(uuid, target, outgoing);
        Manager::Friend::request_exists(target, uuid, incoming);
        if (outgoing) relation = "outgoing";
        else if (incoming) relation = "incoming";
    }
    result["relation"] = relation;

    reply("friend_search", result, response);
}

// 发送好友申请：若对方已申请过我，则直接成为好友
void friend_request(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_request", uuid)) return;

    const auto friend_id = normalize_friend_id(rjson.contains("friend_id") ? rjson["friend_id"].as<std::string>() : std::string());

    std::string target;
    if (friend_id.empty() || !Manager::User::friend_id_uuid(friend_id, target) || target.empty() || target == uuid)
        return api_http_error("friend_request", response);

    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);
    if (is_friend) return api_http_error("friend_request", response);

    const auto now = Libs::Only::Time::timestamp_ms();

    // 对方的好友申请设置：deny 直接拒绝；auto 直接成为好友；manual 走申请流程。
    std::string mode;
    Manager::Friend::request_mode(target, mode);

    jsoncons::json result = jsoncons::json::object();
    if (mode == "deny") {
        Manager::Friend::remove_request(uuid, target);
        result["relation"] = "denied";
        reply("friend_request", result, response);
        return;
    }

    if (mode == "auto") {
        Manager::Friend::add_friend(uuid, target, now);
        Manager::Friend::remove_request(target, uuid);
        Manager::Friend::remove_request(uuid, target);
        result["relation"] = "friend";
        reply("friend_request", result, response);
        return;
    }

    bool incoming = false;
    Manager::Friend::request_exists(target, uuid, incoming);

    if (incoming) {
        // 对方已申请：直接互加好友并清理双方申请。
        Manager::Friend::add_friend(uuid, target, now);
        Manager::Friend::remove_request(target, uuid);
        Manager::Friend::remove_request(uuid, target);
        result["relation"] = "friend";
    } else {
        Manager::Friend::add_request(uuid, target, now);
        result["relation"] = "outgoing";
    }

    reply("friend_request", result, response);
}

// 接受好友申请：建立双向好友并清理双方申请记录
void friend_accept(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_accept", uuid)) return;

    const auto from = rjson.contains("from") ? rjson["from"].as<std::string>() : std::string();
    if (from.empty() || from == uuid) return api_http_error("friend_accept", response);

    bool incoming = false;
    Manager::Friend::request_exists(from, uuid, incoming);
    if (!incoming) return api_http_error("friend_accept", response);

    const auto now = Libs::Only::Time::timestamp_ms();
    Manager::Friend::add_friend(uuid, from, now);
    Manager::Friend::remove_request(from, uuid);
    Manager::Friend::remove_request(uuid, from);

    reply("friend_accept", jsoncons::json::null(), response);
}

// 拒绝好友申请
void friend_reject(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_reject", uuid)) return;

    const auto from = rjson.contains("from") ? rjson["from"].as<std::string>() : std::string();
    if (from.empty() || from == uuid) return api_http_error("friend_reject", response);

    Manager::Friend::remove_request(from, uuid);
    reply("friend_reject", jsoncons::json::null(), response);
}

// 好友申请设置：deny（不允许申请）/ manual（需要同意）/ auto（自动同意）
void friend_settings(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_settings", uuid)) return;

    const auto mode = rjson.contains("mode") ? rjson["mode"].as<std::string>() : std::string();
    if (!Manager::Friend::set_request_mode(uuid, mode)) return api_http_error("friend_settings", response);

    reply("friend_settings", jsoncons::json::null(), response);
}

// 删除好友：同时清理双方申请与邀请，避免残留触发误提示
void friend_remove(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_remove", uuid)) return;

    const auto other = rjson.contains("uuid") ? rjson["uuid"].as<std::string>() : std::string();
    if (other.empty() || other == uuid) return api_http_error("friend_remove", response);

    Manager::Friend::remove_friend(uuid, other);
    Manager::Friend::remove_request(uuid, other);
    Manager::Friend::remove_request(other, uuid);
    Manager::Friend::clear_invite(uuid, other);
    Manager::Friend::clear_invite(other, uuid);

    reply("friend_remove", jsoncons::json::null(), response);
}

// 发起对战邀请：仅好友之间可邀请，房间号由邀请方生成
void friend_challenge(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_challenge", uuid)) return;

    const auto target = rjson.contains("uuid") ? rjson["uuid"].as<std::string>() : std::string();
    const auto room   = rjson.contains("room") ? rjson["room"].as<std::string>() : std::string();
    if (target.empty() || target == uuid || room.empty()) return api_http_error("friend_challenge", response);

    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);
    if (!is_friend) return api_http_error("friend_challenge", response);

    Manager::Friend::add_invite(uuid, target, room, Libs::Only::Time::timestamp_ms());

    reply("friend_challenge", jsoncons::json::null(), response);
}

// 清除对战邀请（接受/忽略后调用，避免重复弹窗）
void friend_invite_clear(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_invite_clear", uuid)) return;

    const auto from = rjson.contains("from") ? rjson["from"].as<std::string>() : std::string();
    if (from.empty()) return api_http_error("friend_invite_clear", response);

    Manager::Friend::clear_invite(from, uuid);
    reply("friend_invite_clear", jsoncons::json::null(), response);
}

// 发送私信：仅好友之间可发，内容去空白并限制长度，成功后通知接收方
void friend_message_send(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_message_send", uuid)) return;

    const auto target  = rjson.contains("uuid") ? rjson["uuid"].as<std::string>() : std::string();
    const auto content = trim_message(rjson.contains("content") ? rjson["content"].as<std::string>() : std::string());
    if (target.empty() || target == uuid || content.empty() || content.size() > MESSAGE_MAX_BYTES)
        return api_http_error("friend_message_send", response);

    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);
    if (!is_friend) return api_http_error("friend_message_send", response);

    const auto now = Libs::Only::Time::timestamp_ms();
    Manager::Friend::purge_expired(now - MESSAGE_TTL_MS);
    if (!Manager::Friend::send_message(uuid, target, content, now))
        return api_http_error("friend_message_send", response);

    reply("friend_message_send", jsoncons::json::null(), response);
}

// 会话记录：返回与指定好友的最近私信，并把对方来信标记为已读
void friend_message_list(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_message_list", uuid)) return;

    const auto target = rjson.contains("uuid") ? rjson["uuid"].as<std::string>() : std::string();
    if (target.empty() || target == uuid) return api_http_error("friend_message_list", response);

    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);
    if (!is_friend) return api_http_error("friend_message_list", response);

    const auto now = Libs::Only::Time::timestamp_ms();

    std::vector<Manager::Friend::MessageRecord> records;
    Manager::Friend::list_conversation(uuid, target, now - MESSAGE_TTL_MS, MESSAGE_PAGE_LIMIT, records);

    jsoncons::json arr = jsoncons::json::array();
    for (const auto& record : records) {
        jsoncons::json item = jsoncons::json::object();
        item["mine"]       = record.from_uuid == uuid;
        item["content"]    = record.content;
        item["created_at"] = record.created_at;
        arr.push_back(std::move(item));
    }

    // 打开会话即视为已读，随后返回剩余未读总数供红点刷新。
    Manager::Friend::mark_read(uuid, target, now);

    jsoncons::json result = jsoncons::json::object();
    result["messages"] = std::move(arr);

    int64_t unread = 0;
    Manager::Friend::count_unread(uuid, now - MESSAGE_TTL_MS, unread);
    result["unread"] = unread;

    reply("friend_message_list", result, response);
}

// 近七天活跃玩家列表（所有登录用户可见）：枚举最近 7 天内登录过的玩家及其与自己的关系
void friend_online(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    std::string uuid;
    if (!resolve_token(rjson, response, "friend_online", uuid)) return;

    const auto now = Libs::Only::Time::timestamp_ms();

    std::vector<std::string> uuids;
    Manager::User::all_user(uuids);

    jsoncons::json players = jsoncons::json::array();
    for (const auto& other : uuids) {
        if (other.empty()) continue;

        int64_t seen = 0;
        if (!Manager::Friend::last_seen(other, seen) || seen <= 0) continue;
        if ((now - seen) > ACTIVE_WINDOW_MS) continue;

        jsoncons::json item = jsoncons::json::object();
        fill_user(item, other);

        std::string friend_id;
        Manager::User::friend_id_user(other, friend_id);
        item["friend_id"] = friend_id;

        std::string relation = "none";
        if (other == uuid) {
            relation = "self";
        } else {
            bool is_friend = false;
            Manager::Friend::are_friends(uuid, other, is_friend);
            if (is_friend) {
                relation = "friend";
            } else {
                bool outgoing = false;
                bool incoming = false;
                Manager::Friend::request_exists(uuid, other, outgoing);
                Manager::Friend::request_exists(other, uuid, incoming);
                if (outgoing) relation = "outgoing";
                else if (incoming) relation = "incoming";
            }
        }

        std::string mode;
        Manager::Friend::request_mode(other, mode);

        item["relation"]     = relation;
        item["request_mode"] = mode;
        item["online"]       = (now - seen) <= ONLINE_WINDOW_MS;
        item["last_seen"]    = seen;

        players.push_back(std::move(item));
    }

    jsoncons::json result = jsoncons::json::object();
    result["uuid"]    = uuid;
    result["players"] = std::move(players);

    reply("friend_online", result, response);
}

// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/friend/heartbeat", friend_heartbeat);
    server.set_http_handler<cinatra::POST>("/friend/wait", friend_wait);
    server.set_http_handler<cinatra::POST>("/friend/list", friend_list);
    server.set_http_handler<cinatra::POST>("/friend/search", friend_search);
    server.set_http_handler<cinatra::POST>("/friend/request", friend_request);
    server.set_http_handler<cinatra::POST>("/friend/accept", friend_accept);
    server.set_http_handler<cinatra::POST>("/friend/reject", friend_reject);
    server.set_http_handler<cinatra::POST>("/friend/settings", friend_settings);
    server.set_http_handler<cinatra::POST>("/friend/remove", friend_remove);
    server.set_http_handler<cinatra::POST>("/friend/challenge", friend_challenge);
    server.set_http_handler<cinatra::POST>("/friend/invite_clear", friend_invite_clear);
    server.set_http_handler<cinatra::POST>("/friend/message_send", friend_message_send);
    server.set_http_handler<cinatra::POST>("/friend/message_list", friend_message_list);
    server.set_http_handler<cinatra::POST>("/friend/online", friend_online);
};
} // namespace Friend
} // namespace Http
} // namespace Api