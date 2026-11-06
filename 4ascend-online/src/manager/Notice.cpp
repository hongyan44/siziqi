/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 全服消息管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Notice.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <string>
#include <string_view>


namespace Manager {
namespace Notice {
namespace {
sqlite3* db = nullptr;
sqlite3_stmt* p_select_active = nullptr;
sqlite3_stmt* p_clear_active  = nullptr;
sqlite3_stmt* p_insert        = nullptr;

void bind_text(sqlite3_stmt* statement, int index, std::string_view value) noexcept {
    sqlite3_bind_text(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void reset(sqlite3_stmt* statement) noexcept {
    sqlite3_reset(statement);
    sqlite3_clear_bindings(statement);
}

std::string column_text(sqlite3_stmt* statement, int index) {
    const auto* value = sqlite3_column_text(statement, index);
    return value ? reinterpret_cast<const char*>(value) : std::string();
}
} // namespace

void init() noexcept {
    Libs::DB::Sqlite3::open("db/announcement.db", db);
    if (!db) return;

    if (sqlite3_exec(
            db,
            "CREATE TABLE IF NOT EXISTS notice ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "title TEXT NOT NULL, "
            "content TEXT NOT NULL, "
            "creator TEXT NOT NULL, "
            "created_at INTEGER NOT NULL, "
            "active INTEGER NOT NULL DEFAULT 1"
            ") STRICT",
            nullptr,
            nullptr,
            nullptr
        )
        != SQLITE_OK) {
        close();
        return;
    }

    sqlite3_prepare_v2(db, "SELECT id, title, content, creator, created_at FROM notice WHERE active = 1 ORDER BY id DESC LIMIT 1", -1, &p_select_active, nullptr);
    sqlite3_prepare_v2(db, "UPDATE notice SET active = 0 WHERE active = 1", -1, &p_clear_active, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO notice(title, content, creator, created_at, active) VALUES (?1, ?2, ?3, ?4, 1)", -1, &p_insert, nullptr);
}

void close() noexcept {
    sqlite3_finalize(p_select_active);
    sqlite3_finalize(p_clear_active);
    sqlite3_finalize(p_insert);
    p_select_active = nullptr;
    p_clear_active  = nullptr;
    p_insert        = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

bool query_active(NoticeRecord& result) noexcept {
    result = {};
    if (!db || !p_select_active) return false;

    const int rc = sqlite3_step(p_select_active);
    if (rc == SQLITE_ROW) {
        result.id         = sqlite3_column_int64(p_select_active, 0);
        result.title      = column_text(p_select_active, 1);
        result.content    = column_text(p_select_active, 2);
        result.creator    = column_text(p_select_active, 3);
        result.created_at = sqlite3_column_int64(p_select_active, 4);
    }
    reset(p_select_active);
    return rc == SQLITE_ROW;
}

bool publish(std::string_view title, std::string_view content, std::string_view creator, int64_t created_at) noexcept {
    if (!db || !p_clear_active || !p_insert || content.empty() || creator.empty()) return false;

    sqlite3_exec(db, "BEGIN IMMEDIATE", nullptr, nullptr, nullptr);

    int rc = sqlite3_step(p_clear_active);
    reset(p_clear_active);
    if (rc != SQLITE_DONE) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    bind_text(p_insert, 1, title);
    bind_text(p_insert, 2, content);
    bind_text(p_insert, 3, creator);
    sqlite3_bind_int64(p_insert, 4, static_cast<sqlite3_int64>(created_at));

    rc = sqlite3_step(p_insert);
    reset(p_insert);
    if (rc != SQLITE_DONE) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    sqlite3_exec(db, "COMMIT", nullptr, nullptr, nullptr);
    return true;
}

bool clear() noexcept {
    if (!db || !p_clear_active) return false;
    const int rc = sqlite3_step(p_clear_active);
    reset(p_clear_active);
    return rc == SQLITE_DONE;
}
} // namespace Notice
} // namespace Manager
