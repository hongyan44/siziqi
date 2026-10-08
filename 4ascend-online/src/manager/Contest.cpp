/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事签表管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Contest.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <string>
#include <string_view>


namespace Manager {
namespace Contest {
namespace {
sqlite3* db = nullptr;
sqlite3_stmt* p_query = nullptr;
sqlite3_stmt* p_update = nullptr;
sqlite3_stmt* p_rules_query = nullptr;
sqlite3_stmt* p_rules_update = nullptr;

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
    Libs::DB::Sqlite3::open("db/contest.db", db);
    if (!db) return;

    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS bracket ("
        "id INTEGER PRIMARY KEY CHECK(id = 1), "
        "data TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT data, creator, updated_at FROM bracket WHERE id = 1", -1, &p_query, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO bracket(id, data, creator, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, creator = excluded.creator, updated_at = excluded.updated_at", -1, &p_update, nullptr);

    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS rules ("
        "id INTEGER PRIMARY KEY CHECK(id = 1), "
        "data TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT data, creator, updated_at FROM rules WHERE id = 1", -1, &p_rules_query, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO rules(id, data, creator, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, creator = excluded.creator, updated_at = excluded.updated_at", -1, &p_rules_update, nullptr);
}

void close() noexcept {
    sqlite3_finalize(p_query);
    sqlite3_finalize(p_update);
    sqlite3_finalize(p_rules_query);
    sqlite3_finalize(p_rules_update);
    p_query = nullptr;
    p_update = nullptr;
    p_rules_query = nullptr;
    p_rules_update = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

bool query_bracket(BracketRecord& result) noexcept {
    result = {};
    if (!db || !p_query) return false;
    const int rc = sqlite3_step(p_query);
    if (rc == SQLITE_ROW) {
        result.data = column_text(p_query, 0);
        result.creator = column_text(p_query, 1);
        result.updated_at = static_cast<uint64_t>(sqlite3_column_int64(p_query, 2));
    }
    reset(p_query);
    return rc == SQLITE_ROW || rc == SQLITE_DONE;
}

bool update_bracket(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept {
    if (!db || !p_update || data.empty() || creator.empty()) return false;
    bind_text(p_update, 1, data);
    bind_text(p_update, 2, creator);
    sqlite3_bind_int64(p_update, 3, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_update);
    reset(p_update);
    return rc == SQLITE_DONE;
}

bool query_rules(RulesRecord& result) noexcept {
    result = {};
    if (!db || !p_rules_query) return false;
    const int rc = sqlite3_step(p_rules_query);
    if (rc == SQLITE_ROW) {
        result.data = column_text(p_rules_query, 0);
        result.creator = column_text(p_rules_query, 1);
        result.updated_at = static_cast<uint64_t>(sqlite3_column_int64(p_rules_query, 2));
    }
    reset(p_rules_query);
    return rc == SQLITE_ROW || rc == SQLITE_DONE;
}

bool update_rules(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept {
    if (!db || !p_rules_update || data.empty() || creator.empty()) return false;
    bind_text(p_rules_update, 1, data);
    bind_text(p_rules_update, 2, creator);
    sqlite3_bind_int64(p_rules_update, 3, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_rules_update);
    reset(p_rules_update);
    return rc == SQLITE_DONE;
}
} // namespace Contest
} // namespace Manager
