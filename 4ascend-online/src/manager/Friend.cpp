/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 好友关系管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Friend.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <algorithm>
#include <mutex>
#include <unordered_map>

#include <string>
#include <string_view>


namespace Manager {
namespace Friend {
namespace {
sqlite3* db = nullptr;

sqlite3_stmt* p_touch          = nullptr;
sqlite3_stmt* p_friend_add     = nullptr;
sqlite3_stmt* p_friend_remove  = nullptr;
sqlite3_stmt* p_friend_exists  = nullptr;
sqlite3_stmt* p_friend_list    = nullptr;
sqlite3_stmt* p_req_add        = nullptr;
sqlite3_stmt* p_req_remove     = nullptr;
sqlite3_stmt* p_req_exists     = nullptr;
sqlite3_stmt* p_req_incoming   = nullptr;
sqlite3_stmt* p_req_outgoing   = nullptr;
sqlite3_stmt* p_req_count      = nullptr;
sqlite3_stmt* p_invite_add     = nullptr;
sqlite3_stmt* p_invite_latest  = nullptr;
sqlite3_stmt* p_invite_clear   = nullptr;
sqlite3_stmt* p_msg_add        = nullptr;
sqlite3_stmt* p_msg_conv       = nullptr;
sqlite3_stmt* p_msg_unread     = nullptr;
sqlite3_stmt* p_msg_read       = nullptr;
sqlite3_stmt* p_msg_purge      = nullptr;

// 在线状态以内存为准（心跳高频），落库做节流以避免频繁磁盘写入。
std::unordered_map<std::string, int64_t> presence;
std::unordered_map<std::string, int64_t> presence_persisted;
constexpr int64_t PRESENCE_FLUSH_MS = 30 * 1000;

// 变更版本号：长轮询据此即时唤醒。内存态即可，重启后客户端会重新拉取一次。
std::mutex version_mutex;
std::unordered_map<std::string, uint64_t> versions;

void bind_text(sqlite3_stmt* statement, int index, std::string_view value) noexcept {
    sqlite3_bind_text(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void reset(sqlite3_stmt* statement) noexcept {
    sqlite3_reset(statement);
    sqlite3_clear_bindings(statement);
}

std::string column_text(sqlite3_stmt* statement, int index) noexcept {
    const auto* value = sqlite3_column_text(statement, index);
    return value ? reinterpret_cast<const char*>(value) : std::string();
}

// 好友关系无序：始终按字典序存放 (a < b)，保证 (x,y) 与 (y,x) 命中同一行。
void order_pair(std::string_view& a, std::string_view& b) noexcept {
    if (a > b) {
        auto tmp = a;
        a = b;
        b = tmp;
    }
}

void persist_presence(std::string_view uuid, int64_t now) noexcept {
    if (!p_touch) return;
    bind_text(p_touch, 1, uuid);
    sqlite3_bind_int64(p_touch, 2, static_cast<sqlite3_int64>(now));
    sqlite3_step(p_touch);
    reset(p_touch);
    presence_persisted[std::string(uuid)] = now;
}
} // namespace

void init() noexcept {
    Libs::DB::Sqlite3::open("db/friend.db", db);
    if (!db) return;

    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS friends ("
        "a TEXT NOT NULL, b TEXT NOT NULL, created_at INTEGER NOT NULL, "
        "PRIMARY KEY(a, b)) STRICT",
        nullptr, nullptr, nullptr
    );
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS requests ("
        "from_uuid TEXT NOT NULL, to_uuid TEXT NOT NULL, created_at INTEGER NOT NULL, "
        "PRIMARY KEY(from_uuid, to_uuid)) STRICT",
        nullptr, nullptr, nullptr
    );
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS presence (uuid TEXT PRIMARY KEY, last_seen INTEGER NOT NULL) STRICT",
        nullptr, nullptr, nullptr
    );
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS invites ("
        "from_uuid TEXT NOT NULL, to_uuid TEXT NOT NULL, room TEXT NOT NULL, created_at INTEGER NOT NULL, "
        "PRIMARY KEY(from_uuid, to_uuid)) STRICT",
        nullptr, nullptr, nullptr
    );
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS messages ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "from_uuid TEXT NOT NULL, to_uuid TEXT NOT NULL, content TEXT NOT NULL, "
        "created_at INTEGER NOT NULL, read_at INTEGER NOT NULL DEFAULT 0) STRICT",
        nullptr, nullptr, nullptr
    );
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_friends_a ON friends (a)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_friends_b ON friends (b)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_requests_to ON requests (to_uuid)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_invites_to ON invites (to_uuid)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (from_uuid, to_uuid, created_at)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_messages_to ON messages (to_uuid, read_at)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at)", nullptr, nullptr, nullptr);

    sqlite3_prepare_v2(
        db,
        "INSERT INTO presence (uuid, last_seen) VALUES (?, ?) ON CONFLICT(uuid) DO UPDATE SET last_seen = excluded.last_seen",
        -1, &p_touch, nullptr
    );
    sqlite3_prepare_v2(
        db,
        "INSERT INTO friends (a, b, created_at) VALUES (?, ?, ?) ON CONFLICT(a, b) DO NOTHING",
        -1, &p_friend_add, nullptr
    );
    sqlite3_prepare_v2(db, "DELETE FROM friends WHERE a = ? AND b = ?", -1, &p_friend_remove, nullptr);
    sqlite3_prepare_v2(db, "SELECT 1 FROM friends WHERE a = ? AND b = ? LIMIT 1", -1, &p_friend_exists, nullptr);
    sqlite3_prepare_v2(db, "SELECT b FROM friends WHERE a = ? UNION ALL SELECT a FROM friends WHERE b = ?", -1, &p_friend_list, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT INTO requests (from_uuid, to_uuid, created_at) VALUES (?, ?, ?) ON CONFLICT(from_uuid, to_uuid) DO UPDATE SET created_at = excluded.created_at",
        -1, &p_req_add, nullptr
    );
    sqlite3_prepare_v2(db, "DELETE FROM requests WHERE from_uuid = ? AND to_uuid = ?", -1, &p_req_remove, nullptr);
    sqlite3_prepare_v2(db, "SELECT 1 FROM requests WHERE from_uuid = ? AND to_uuid = ? LIMIT 1", -1, &p_req_exists, nullptr);
    sqlite3_prepare_v2(db, "SELECT from_uuid, created_at FROM requests WHERE to_uuid = ? ORDER BY created_at DESC", -1, &p_req_incoming, nullptr);
    sqlite3_prepare_v2(db, "SELECT to_uuid, created_at FROM requests WHERE from_uuid = ? ORDER BY created_at DESC", -1, &p_req_outgoing, nullptr);
    sqlite3_prepare_v2(db, "SELECT COUNT(1) FROM requests WHERE to_uuid = ?", -1, &p_req_count, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT INTO invites (from_uuid, to_uuid, room, created_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(from_uuid, to_uuid) DO UPDATE SET room = excluded.room, created_at = excluded.created_at",
        -1, &p_invite_add, nullptr
    );
    sqlite3_prepare_v2(db, "SELECT from_uuid, room, created_at FROM invites WHERE to_uuid = ? ORDER BY created_at DESC LIMIT 1", -1, &p_invite_latest, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM invites WHERE from_uuid = ? AND to_uuid = ?", -1, &p_invite_clear, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT INTO messages (from_uuid, to_uuid, content, created_at, read_at) VALUES (?, ?, ?, ?, 0)",
        -1, &p_msg_add, nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT from_uuid, content, created_at FROM messages "
        "WHERE ((from_uuid = ? AND to_uuid = ?) OR (from_uuid = ? AND to_uuid = ?)) AND created_at >= ? "
        "ORDER BY created_at DESC, id DESC LIMIT ?",
        -1, &p_msg_conv, nullptr
    );
    sqlite3_prepare_v2(db, "SELECT COUNT(1) FROM messages WHERE to_uuid = ? AND read_at = 0 AND created_at >= ?", -1, &p_msg_unread, nullptr);
    sqlite3_prepare_v2(db, "UPDATE messages SET read_at = ? WHERE to_uuid = ? AND from_uuid = ? AND read_at = 0", -1, &p_msg_read, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM messages WHERE created_at < ?", -1, &p_msg_purge, nullptr);

    // 启动即清理一次过期私信，避免长期堆积。
    sqlite3_exec(db, "DELETE FROM messages WHERE created_at < (strftime('%s','now') * 1000 - 2592000000)", nullptr, nullptr, nullptr);

    // 载入已持久化的在线时间，保证服务重启后「最后上线时间」不丢失。
    sqlite3_stmt* load = nullptr;
    if (sqlite3_prepare_v2(db, "SELECT uuid, last_seen FROM presence", -1, &load, nullptr) == SQLITE_OK) {
        while (sqlite3_step(load) == SQLITE_ROW) {
            const auto uuid = column_text(load, 0);
            if (uuid.empty()) continue;
            presence[uuid] = sqlite3_column_int64(load, 1);
            presence_persisted[uuid] = presence[uuid];
        }
        sqlite3_finalize(load);
    }
}

void close() noexcept {
    // 退出前把内存中的在线时间落库，避免丢最后一次活跃。
    for (const auto& [uuid, seen] : presence) {
        auto it = presence_persisted.find(uuid);
        if (it != presence_persisted.end() && it->second >= seen) continue;
        persist_presence(uuid, seen);
    }
    presence.clear();
    presence_persisted.clear();

    sqlite3_finalize(p_touch);
    sqlite3_finalize(p_friend_add);
    sqlite3_finalize(p_friend_remove);
    sqlite3_finalize(p_friend_exists);
    sqlite3_finalize(p_friend_list);
    sqlite3_finalize(p_req_add);
    sqlite3_finalize(p_req_remove);
    sqlite3_finalize(p_req_exists);
    sqlite3_finalize(p_req_incoming);
    sqlite3_finalize(p_req_outgoing);
    sqlite3_finalize(p_req_count);
    sqlite3_finalize(p_invite_add);
    sqlite3_finalize(p_invite_latest);
    sqlite3_finalize(p_invite_clear);
    sqlite3_finalize(p_msg_add);
    sqlite3_finalize(p_msg_conv);
    sqlite3_finalize(p_msg_unread);
    sqlite3_finalize(p_msg_read);
    sqlite3_finalize(p_msg_purge);
    p_touch = nullptr;
    p_friend_add = nullptr;
    p_friend_remove = nullptr;
    p_friend_exists = nullptr;
    p_friend_list = nullptr;
    p_req_add = nullptr;
    p_req_remove = nullptr;
    p_req_exists = nullptr;
    p_req_incoming = nullptr;
    p_req_outgoing = nullptr;
    p_req_count = nullptr;
    p_invite_add = nullptr;
    p_invite_latest = nullptr;
    p_invite_clear = nullptr;
    p_msg_add = nullptr;
    p_msg_conv = nullptr;
    p_msg_unread = nullptr;
    p_msg_read = nullptr;
    p_msg_purge = nullptr;

    if (db) sqlite3_close(db);
    db = nullptr;
}


bool touch(std::string_view uuid, int64_t now) noexcept {
    if (uuid.empty()) return false;

    presence[std::string(uuid)] = now;

    auto it = presence_persisted.find(std::string(uuid));
    if (it == presence_persisted.end() || now - it->second >= PRESENCE_FLUSH_MS) persist_presence(uuid, now);
    return true;
}

bool last_seen(std::string_view uuid, int64_t& out) noexcept {
    auto it = presence.find(std::string(uuid));
    if (it == presence.end()) return false;
    out = it->second;
    return true;
}


void bump(std::string_view uuid) noexcept {
    if (uuid.empty()) return;
    std::lock_guard<std::mutex> lock(version_mutex);
    versions[std::string(uuid)] += 1;
}

uint64_t version(std::string_view uuid) noexcept {
    if (uuid.empty()) return 0;
    std::lock_guard<std::mutex> lock(version_mutex);
    auto it = versions.find(std::string(uuid));
    return it == versions.end() ? 0 : it->second;
}


bool are_friends(std::string_view a, std::string_view b, bool& out) noexcept {
    out = false;
    if (!db || !p_friend_exists || a.empty() || b.empty()) return false;
    order_pair(a, b);

    bind_text(p_friend_exists, 1, a);
    bind_text(p_friend_exists, 2, b);
    const int rc = sqlite3_step(p_friend_exists);
    reset(p_friend_exists);
    out = rc == SQLITE_ROW;
    return true;
}

bool add_friend(std::string_view a, std::string_view b, int64_t now) noexcept {
    if (!db || !p_friend_add || a.empty() || b.empty() || a == b) return false;
    order_pair(a, b);

    bind_text(p_friend_add, 1, a);
    bind_text(p_friend_add, 2, b);
    sqlite3_bind_int64(p_friend_add, 3, static_cast<sqlite3_int64>(now));
    const int rc = sqlite3_step(p_friend_add);
    reset(p_friend_add);
    if (rc == SQLITE_DONE) {
        bump(a);
        bump(b);
    }
    return rc == SQLITE_DONE;
}

bool remove_friend(std::string_view a, std::string_view b) noexcept {
    if (!db || !p_friend_remove || a.empty() || b.empty()) return false;
    order_pair(a, b);

    bind_text(p_friend_remove, 1, a);
    bind_text(p_friend_remove, 2, b);
    const int rc = sqlite3_step(p_friend_remove);
    reset(p_friend_remove);
    if (rc == SQLITE_DONE) {
        bump(a);
        bump(b);
    }
    return rc == SQLITE_DONE;
}

bool list_friends(std::string_view uuid, std::vector<std::string>& out) noexcept {
    out.clear();
    if (!db || !p_friend_list || uuid.empty()) return false;

    bind_text(p_friend_list, 1, uuid);
    bind_text(p_friend_list, 2, uuid);
    while (sqlite3_step(p_friend_list) == SQLITE_ROW) {
        const auto other = column_text(p_friend_list, 0);
        if (!other.empty()) out.emplace_back(other);
    }
    reset(p_friend_list);
    return true;
}


bool request_exists(std::string_view from, std::string_view to, bool& out) noexcept {
    out = false;
    if (!db || !p_req_exists || from.empty() || to.empty()) return false;

    bind_text(p_req_exists, 1, from);
    bind_text(p_req_exists, 2, to);
    const int rc = sqlite3_step(p_req_exists);
    reset(p_req_exists);
    out = rc == SQLITE_ROW;
    return true;
}

bool add_request(std::string_view from, std::string_view to, int64_t now) noexcept {
    if (!db || !p_req_add || from.empty() || to.empty() || from == to) return false;

    bind_text(p_req_add, 1, from);
    bind_text(p_req_add, 2, to);
    sqlite3_bind_int64(p_req_add, 3, static_cast<sqlite3_int64>(now));
    const int rc = sqlite3_step(p_req_add);
    reset(p_req_add);
    if (rc == SQLITE_DONE) bump(to);
    return rc == SQLITE_DONE;
}

bool remove_request(std::string_view from, std::string_view to) noexcept {
    if (!db || !p_req_remove || from.empty() || to.empty()) return false;

    bind_text(p_req_remove, 1, from);
    bind_text(p_req_remove, 2, to);
    const int rc = sqlite3_step(p_req_remove);
    reset(p_req_remove);
    if (rc == SQLITE_DONE) {
        bump(from);
        bump(to);
    }
    return rc == SQLITE_DONE;
}

bool list_incoming(std::string_view to, std::vector<RequestRecord>& out) noexcept {
    out.clear();
    if (!db || !p_req_incoming || to.empty()) return false;

    bind_text(p_req_incoming, 1, to);
    while (sqlite3_step(p_req_incoming) == SQLITE_ROW) {
        RequestRecord record;
        record.uuid = column_text(p_req_incoming, 0);
        record.created_at = sqlite3_column_int64(p_req_incoming, 1);
        if (!record.uuid.empty()) out.emplace_back(std::move(record));
    }
    reset(p_req_incoming);
    return true;
}

bool list_outgoing(std::string_view from, std::vector<RequestRecord>& out) noexcept {
    out.clear();
    if (!db || !p_req_outgoing || from.empty()) return false;

    bind_text(p_req_outgoing, 1, from);
    while (sqlite3_step(p_req_outgoing) == SQLITE_ROW) {
        RequestRecord record;
        record.uuid = column_text(p_req_outgoing, 0);
        record.created_at = sqlite3_column_int64(p_req_outgoing, 1);
        if (!record.uuid.empty()) out.emplace_back(std::move(record));
    }
    reset(p_req_outgoing);
    return true;
}

bool count_incoming(std::string_view to, int64_t& out) noexcept {
    out = 0;
    if (!db || !p_req_count || to.empty()) return false;

    bind_text(p_req_count, 1, to);
    const int rc = sqlite3_step(p_req_count);
    if (rc == SQLITE_ROW) out = sqlite3_column_int64(p_req_count, 0);
    reset(p_req_count);
    return rc == SQLITE_ROW;
}


bool add_invite(std::string_view from, std::string_view to, std::string_view room, int64_t now) noexcept {
    if (!db || !p_invite_add || from.empty() || to.empty() || room.empty()) return false;

    bind_text(p_invite_add, 1, from);
    bind_text(p_invite_add, 2, to);
    bind_text(p_invite_add, 3, room);
    sqlite3_bind_int64(p_invite_add, 4, static_cast<sqlite3_int64>(now));
    const int rc = sqlite3_step(p_invite_add);
    reset(p_invite_add);
    if (rc == SQLITE_DONE) bump(to);
    return rc == SQLITE_DONE;
}

bool latest_invite(std::string_view to, int64_t ttl_ms, int64_t now, InviteRecord& out) noexcept {
    out = {};
    if (!db || !p_invite_latest || to.empty()) return false;

    bind_text(p_invite_latest, 1, to);
    const int rc = sqlite3_step(p_invite_latest);
    if (rc == SQLITE_ROW) {
        out.from_uuid = column_text(p_invite_latest, 0);
        out.room = column_text(p_invite_latest, 1);
        out.created_at = sqlite3_column_int64(p_invite_latest, 2);
    }
    reset(p_invite_latest);

    if (rc != SQLITE_ROW || out.from_uuid.empty() || out.room.empty()) return false;
    // 过期邀请不返回（前端不再提示），并顺手清理，避免堆积。
    if (now - out.created_at > ttl_ms) {
        clear_invite(out.from_uuid, to);
        out = {};
        return false;
    }
    return true;
}

bool clear_invite(std::string_view from, std::string_view to) noexcept {
    if (!db || !p_invite_clear || from.empty() || to.empty()) return false;

    bind_text(p_invite_clear, 1, from);
    bind_text(p_invite_clear, 2, to);
    const int rc = sqlite3_step(p_invite_clear);
    reset(p_invite_clear);
    return rc == SQLITE_DONE;
}


bool send_message(std::string_view from, std::string_view to, std::string_view content, int64_t now) noexcept {
    if (!db || !p_msg_add || from.empty() || to.empty() || content.empty() || from == to) return false;

    bind_text(p_msg_add, 1, from);
    bind_text(p_msg_add, 2, to);
    bind_text(p_msg_add, 3, content);
    sqlite3_bind_int64(p_msg_add, 4, static_cast<sqlite3_int64>(now));
    const int rc = sqlite3_step(p_msg_add);
    reset(p_msg_add);
    if (rc == SQLITE_DONE) bump(to);
    return rc == SQLITE_DONE;
}

bool list_conversation(std::string_view a, std::string_view b, int64_t since, int64_t limit, std::vector<MessageRecord>& out) noexcept {
    out.clear();
    if (!db || !p_msg_conv || a.empty() || b.empty()) return false;

    bind_text(p_msg_conv, 1, a);
    bind_text(p_msg_conv, 2, b);
    bind_text(p_msg_conv, 3, b);
    bind_text(p_msg_conv, 4, a);
    sqlite3_bind_int64(p_msg_conv, 5, static_cast<sqlite3_int64>(since));
    sqlite3_bind_int64(p_msg_conv, 6, static_cast<sqlite3_int64>(limit > 0 ? limit : 1));

    // 查询按时间倒序取最近 limit 条，再翻转为升序供前端顺序渲染。
    while (sqlite3_step(p_msg_conv) == SQLITE_ROW) {
        MessageRecord record;
        record.from_uuid  = column_text(p_msg_conv, 0);
        record.content    = column_text(p_msg_conv, 1);
        record.created_at = sqlite3_column_int64(p_msg_conv, 2);
        out.emplace_back(std::move(record));
    }
    reset(p_msg_conv);
    std::reverse(out.begin(), out.end());
    return true;
}

bool count_unread(std::string_view to, int64_t since, int64_t& out) noexcept {
    out = 0;
    if (!db || !p_msg_unread || to.empty()) return false;

    bind_text(p_msg_unread, 1, to);
    sqlite3_bind_int64(p_msg_unread, 2, static_cast<sqlite3_int64>(since));
    const int rc = sqlite3_step(p_msg_unread);
    if (rc == SQLITE_ROW) out = sqlite3_column_int64(p_msg_unread, 0);
    reset(p_msg_unread);
    return rc == SQLITE_ROW;
}

bool mark_read(std::string_view to, std::string_view from, int64_t now) noexcept {
    if (!db || !p_msg_read || to.empty() || from.empty()) return false;

    sqlite3_bind_int64(p_msg_read, 1, static_cast<sqlite3_int64>(now));
    bind_text(p_msg_read, 2, to);
    bind_text(p_msg_read, 3, from);
    const int rc = sqlite3_step(p_msg_read);
    reset(p_msg_read);
    return rc == SQLITE_DONE;
}

void purge_expired(int64_t before) noexcept {
    if (!db || !p_msg_purge) return;
    sqlite3_bind_int64(p_msg_purge, 1, static_cast<sqlite3_int64>(before));
    sqlite3_step(p_msg_purge);
    reset(p_msg_purge);
}
} // namespace Friend
} // namespace Manager