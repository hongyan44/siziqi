/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友关系管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>
#include <vector>


namespace Manager {
namespace Friend {
struct RequestRecord {
    std::string uuid;
    int64_t created_at;
};

struct InviteRecord {
    std::string from_uuid;
    std::string room;
    int64_t created_at;
};

struct MessageRecord {
    std::string from_uuid;
    std::string content;
    int64_t created_at;
};

void init() noexcept;
void close() noexcept;

// 在线心跳：更新用户最后活跃时间（内存权威 + 落库节流）
bool touch(std::string_view uuid, int64_t now) noexcept;
// 查询最后活跃时间；从未活跃返回 false
bool last_seen(std::string_view uuid, int64_t& out) noexcept;
// 按活跃时间倒序取出 since 之后活跃的至多 limit 位玩家（uuid + last_seen，内存查询，不落库）
bool list_active(int64_t since, size_t limit, std::vector<std::pair<int64_t, std::string>>& out) noexcept;

// 变更版本号：好友系统任一影响该用户的变更都会自增，供长轮询即时唤醒
void bump(std::string_view uuid) noexcept;
uint64_t version(std::string_view uuid) noexcept;

// 好友关系
bool are_friends(std::string_view a, std::string_view b, bool& out) noexcept;
bool add_friend(std::string_view a, std::string_view b, int64_t now) noexcept;
bool remove_friend(std::string_view a, std::string_view b) noexcept;
bool list_friends(std::string_view uuid, std::vector<std::string>& out) noexcept;

// 好友申请
bool request_exists(std::string_view from, std::string_view to, bool& out) noexcept;
bool add_request(std::string_view from, std::string_view to, int64_t now) noexcept;
bool remove_request(std::string_view from, std::string_view to) noexcept;
bool list_incoming(std::string_view to, std::vector<RequestRecord>& out) noexcept;
bool list_outgoing(std::string_view from, std::vector<RequestRecord>& out) noexcept;
bool count_incoming(std::string_view to, int64_t& out) noexcept;

// 好友申请设置：deny（不允许申请）/ manual（需要同意，默认）/ auto（自动同意）
void request_mode(std::string_view uuid, std::string& out) noexcept;
bool set_request_mode(std::string_view uuid, std::string_view mode) noexcept;

// 对战邀请
bool add_invite(std::string_view from, std::string_view to, std::string_view room, int64_t now) noexcept;
bool latest_invite(std::string_view to, int64_t ttl_ms, int64_t now, InviteRecord& out) noexcept;
bool clear_invite(std::string_view from, std::string_view to) noexcept;

// 好友私信
// 发送一条私信；成功时通知接收方（bump）
bool send_message(std::string_view from, std::string_view to, std::string_view content, int64_t now) noexcept;
// 会话记录（双方往来），仅返回 created_at >= since 的消息，按时间升序最多 limit 条
bool list_conversation(std::string_view a, std::string_view b, int64_t since, int64_t limit, std::vector<MessageRecord>& out) noexcept;
// 未读私信数（仅统计 created_at >= since 的来信）
bool count_unread(std::string_view to, int64_t since, int64_t& out) noexcept;
// 按发送方统计未读私信数（仅统计 created_at >= since 且 read_at = 0 的来信）
bool count_unread_by_sender(std::string_view to, int64_t since, std::vector<std::pair<std::string, int64_t>>& out) noexcept;
// 将 from 发给 to 的消息全部标记为已读
bool mark_read(std::string_view to, std::string_view from, int64_t now) noexcept;
// 清理早于 before 的过期消息
void purge_expired(int64_t before) noexcept;
} // namespace Friend
} // namespace Manager