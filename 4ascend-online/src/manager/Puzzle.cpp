/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局关卡管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Puzzle.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <string>
#include <string_view>
#include <utility>


namespace Manager {
namespace Puzzle {
namespace {
sqlite3* db = nullptr;
sqlite3_stmt* p_insert = nullptr;
sqlite3_stmt* p_update = nullptr;
sqlite3_stmt* p_delete = nullptr;
sqlite3_stmt* p_query = nullptr;
sqlite3_stmt* p_daily_query = nullptr;
sqlite3_stmt* p_daily_update = nullptr;

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
    Libs::DB::Sqlite3::open("db/puzzle.db", db);
    if (!db) return;

    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS puzzles ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "level INTEGER NOT NULL UNIQUE CHECK(level BETWEEN 1 AND 100), "
        "title TEXT NOT NULL, "
        "code TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "created_at INTEGER NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_puzzles_created_at ON puzzles(created_at DESC, id DESC)", nullptr, nullptr, nullptr);

    // 兼容旧版 puzzle.db：旧表没有 level / updated_at 时补列；重复列错误可安全忽略。
    sqlite3_exec(db, "ALTER TABLE puzzles ADD COLUMN level INTEGER", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE puzzles ADD COLUMN updated_at INTEGER", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "UPDATE puzzles SET level = id WHERE level IS NULL AND id BETWEEN 1 AND 100", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "UPDATE puzzles SET updated_at = created_at WHERE updated_at IS NULL", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzles_level ON puzzles(level)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "DELETE FROM puzzles WHERE level IS NULL OR level < 1 OR level > 100", nullptr, nullptr, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO puzzles(level, title, code, creator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", -1, &p_insert, nullptr);
    sqlite3_prepare_v2(db, "UPDATE puzzles SET level = ?, title = ?, code = ?, updated_at = ? WHERE id = ?", -1, &p_update, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM puzzles WHERE id = ?", -1, &p_delete, nullptr);
    sqlite3_prepare_v2(db, "SELECT id, level, title, code, creator, created_at, updated_at FROM puzzles ORDER BY level ASC, id ASC", -1, &p_query, nullptr);
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS daily_puzzle ("
        "id INTEGER PRIMARY KEY CHECK(id = 1), "
        "title TEXT NOT NULL, "
        "code TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT title, code, creator, updated_at FROM daily_puzzle WHERE id = 1", -1, &p_daily_query, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO daily_puzzle(id, title, code, creator, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, code = excluded.code, creator = excluded.creator, updated_at = excluded.updated_at", -1, &p_daily_update, nullptr);
}

void close() noexcept {
    sqlite3_finalize(p_insert);
    sqlite3_finalize(p_update);
    sqlite3_finalize(p_delete);
    sqlite3_finalize(p_query);
    sqlite3_finalize(p_daily_query);
    sqlite3_finalize(p_daily_update);
    p_insert = nullptr;
    p_update = nullptr;
    p_delete = nullptr;
    p_query = nullptr;
    p_daily_query = nullptr;
    p_daily_update = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

bool add_puzzle(uint32_t level, std::string_view title, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept {
    id = 0;
    if (!db || level < 1 || level > 100 || title.empty() || code.empty() || creator.empty() || !p_insert) return false;
    sqlite3_bind_int(p_insert, 1, static_cast<int>(level));
    bind_text(p_insert, 2, title);
    bind_text(p_insert, 3, code);
    bind_text(p_insert, 4, creator);
    sqlite3_bind_int64(p_insert, 5, static_cast<sqlite3_int64>(created_at));
    sqlite3_bind_int64(p_insert, 6, static_cast<sqlite3_int64>(created_at));
    const int rc = sqlite3_step(p_insert);
    if (rc == SQLITE_DONE) id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    reset(p_insert);
    return rc == SQLITE_DONE && id != 0;
}

bool update_puzzle(uint64_t id, uint32_t level, std::string_view title, std::string_view code, uint64_t updated_at) noexcept {
    if (!db || id == 0 || level < 1 || level > 100 || title.empty() || code.empty() || !p_update) return false;
    sqlite3_bind_int(p_update, 1, static_cast<int>(level));
    bind_text(p_update, 2, title);
    bind_text(p_update, 3, code);
    sqlite3_bind_int64(p_update, 4, static_cast<sqlite3_int64>(updated_at));
    sqlite3_bind_int64(p_update, 5, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_update);
    const int changed = sqlite3_changes(db);
    reset(p_update);
    return rc == SQLITE_DONE && changed > 0;
}

bool delete_puzzle(uint64_t id) noexcept {
    if (!db || !p_delete || id == 0) return false;
    sqlite3_bind_int64(p_delete, 1, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_delete);
    const int changed = sqlite3_changes(db);
    reset(p_delete);
    return rc == SQLITE_DONE && changed > 0;
}

bool query_puzzles(std::vector<Record>& result) noexcept {
    result.clear();
    if (!db || !p_query) return false;
    int rc = SQLITE_OK;
    while ((rc = sqlite3_step(p_query)) == SQLITE_ROW) {
        Record record{};
        record.id = static_cast<uint64_t>(sqlite3_column_int64(p_query, 0));
        record.level = static_cast<uint32_t>(sqlite3_column_int(p_query, 1));
        record.title = column_text(p_query, 2);
        record.code = column_text(p_query, 3);
        record.creator = column_text(p_query, 4);
        record.created_at = static_cast<uint64_t>(sqlite3_column_int64(p_query, 5));
        result.emplace_back(std::move(record));
    }
    reset(p_query);
    return rc == SQLITE_DONE;
}

bool query_daily(DailyRecord& result) noexcept {
    result = {};
    if (!db || !p_daily_query) return false;
    const int rc = sqlite3_step(p_daily_query);
    if (rc == SQLITE_ROW) {
        result.title = column_text(p_daily_query, 0);
        result.code = column_text(p_daily_query, 1);
        result.creator = column_text(p_daily_query, 2);
        result.updated_at = static_cast<uint64_t>(sqlite3_column_int64(p_daily_query, 3));
    }
    reset(p_daily_query);
    return rc == SQLITE_ROW || rc == SQLITE_DONE;
}

bool update_daily(std::string_view title, std::string_view code, std::string_view creator, uint64_t updated_at) noexcept {
    if (!db || !p_daily_update || title.empty() || code.empty() || creator.empty()) return false;
    bind_text(p_daily_update, 1, title);
    bind_text(p_daily_update, 2, code);
    bind_text(p_daily_update, 3, creator);
    sqlite3_bind_int64(p_daily_update, 4, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_daily_update);
    reset(p_daily_update);
    return rc == SQLITE_DONE;
}
} // namespace Puzzle
} // namespace Manager
