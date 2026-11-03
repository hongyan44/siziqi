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

sqlite3_stmt* p_sub_insert         = nullptr;
sqlite3_stmt* p_sub_list_creator   = nullptr;
sqlite3_stmt* p_sub_list_all       = nullptr;
sqlite3_stmt* p_sub_load_pending   = nullptr;
sqlite3_stmt* p_sub_update         = nullptr;
sqlite3_stmt* p_sub_review         = nullptr;

sqlite3_stmt* p_claim_clear        = nullptr;
sqlite3_stmt* p_count_clears       = nullptr;

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
        "description TEXT NOT NULL DEFAULT '', "
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
    sqlite3_exec(db, "ALTER TABLE puzzles ADD COLUMN description TEXT NOT NULL DEFAULT ''", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "UPDATE puzzles SET level = id WHERE level IS NULL AND id BETWEEN 1 AND 100", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "UPDATE puzzles SET updated_at = created_at WHERE updated_at IS NULL", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzles_level ON puzzles(level)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "DELETE FROM puzzles WHERE level IS NULL OR level < 1 OR level > 100", nullptr, nullptr, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO puzzles(level, title, description, code, creator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", -1, &p_insert, nullptr);
    sqlite3_prepare_v2(db, "UPDATE puzzles SET level = ?, title = ?, description = ?, code = ?, updated_at = ? WHERE id = ?", -1, &p_update, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM puzzles WHERE id = ?", -1, &p_delete, nullptr);
    sqlite3_prepare_v2(db, "SELECT id, level, title, description, code, creator, created_at, updated_at FROM puzzles ORDER BY level ASC, id ASC", -1, &p_query, nullptr);
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS daily_puzzle ("
        "id INTEGER PRIMARY KEY CHECK(id = 1), "
        "title TEXT NOT NULL, "
        "description TEXT NOT NULL DEFAULT '', "
        "code TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_exec(db, "ALTER TABLE daily_puzzle ADD COLUMN description TEXT NOT NULL DEFAULT ''", nullptr, nullptr, nullptr);
    sqlite3_prepare_v2(db, "SELECT title, description, code, creator, updated_at FROM daily_puzzle WHERE id = 1", -1, &p_daily_query, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO daily_puzzle(id, title, description, code, creator, updated_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, code = excluded.code, creator = excluded.creator, updated_at = excluded.updated_at", -1, &p_daily_update, nullptr);

    // 残局投稿：普通/进阶用户提交，高级/管理员审核后发布到每日挑战或指定关卡。
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS puzzle_submissions ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "target TEXT NOT NULL, "
        "level INTEGER NOT NULL DEFAULT 0, "
        "title TEXT NOT NULL, "
        "description TEXT NOT NULL DEFAULT '', "
        "code TEXT NOT NULL, "
        "creator TEXT NOT NULL, "
        "created_at INTEGER NOT NULL, "
        "status INTEGER NOT NULL DEFAULT 0, "
        "reviewer TEXT NOT NULL DEFAULT '', "
        "reviewed_at INTEGER NOT NULL DEFAULT 0"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_exec(db, "ALTER TABLE puzzle_submissions ADD COLUMN description TEXT NOT NULL DEFAULT ''", nullptr, nullptr, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT INTO puzzle_submissions(target, level, title, description, code, creator, created_at, status, reviewer, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', 0)",
        -1,
        &p_sub_insert,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT id, target, level, title, description, code, creator, created_at, status, reviewer, reviewed_at FROM puzzle_submissions WHERE creator = ? AND (? < 0 OR status = ?) ORDER BY id DESC",
        -1,
        &p_sub_list_creator,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT id, target, level, title, description, code, creator, created_at, status, reviewer, reviewed_at FROM puzzle_submissions WHERE (? < 0 OR status = ?) ORDER BY id DESC",
        -1,
        &p_sub_list_all,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT target, level, title, description, code, creator, created_at FROM puzzle_submissions WHERE id = ? AND status = 0",
        -1,
        &p_sub_load_pending,
        nullptr
    );
    sqlite3_prepare_v2(db, "UPDATE puzzle_submissions SET target = ?, level = ?, title = ?, description = ?, code = ? WHERE id = ? AND status = 0", -1, &p_sub_update, nullptr);
    sqlite3_prepare_v2(db, "UPDATE puzzle_submissions SET status = ?, reviewer = ?, reviewed_at = ? WHERE id = ? AND status = 0", -1, &p_sub_review, nullptr);

    // 首次通关记录：同一账号在同一关卡/同一每日残局版本下只记一次。
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS puzzle_clears ("
        "uuid TEXT NOT NULL, "
        "target TEXT NOT NULL, "
        "ref INTEGER NOT NULL, "
        "cleared_at INTEGER NOT NULL, "
        "PRIMARY KEY(uuid, target, ref)"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "INSERT OR IGNORE INTO puzzle_clears(uuid, target, ref, cleared_at) VALUES (?, ?, ?, ?)",
        -1,
        &p_claim_clear,
        nullptr
    );
    // 玩家资料展示用：主键 (uuid, target, ref) 已保证同一残局只记一条，直接计数即为不同残局数。
    sqlite3_prepare_v2(
        db,
        "SELECT COUNT(*) FROM puzzle_clears WHERE uuid = ?",
        -1,
        &p_count_clears,
        nullptr
    );
}

void close() noexcept {
    sqlite3_finalize(p_insert);
    sqlite3_finalize(p_update);
    sqlite3_finalize(p_delete);
    sqlite3_finalize(p_query);
    sqlite3_finalize(p_daily_query);
    sqlite3_finalize(p_daily_update);
    sqlite3_finalize(p_sub_insert);
    sqlite3_finalize(p_sub_list_creator);
    sqlite3_finalize(p_sub_list_all);
    sqlite3_finalize(p_sub_load_pending);
    sqlite3_finalize(p_sub_update);
    sqlite3_finalize(p_sub_review);
    sqlite3_finalize(p_claim_clear);
    sqlite3_finalize(p_count_clears);
    p_insert = nullptr;
    p_update = nullptr;
    p_delete = nullptr;
    p_query = nullptr;
    p_daily_query = nullptr;
    p_daily_update = nullptr;
    p_sub_insert = nullptr;
    p_sub_list_creator = nullptr;
    p_sub_list_all = nullptr;
    p_sub_load_pending = nullptr;
    p_sub_review = nullptr;
    p_claim_clear = nullptr;
    p_count_clears = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

bool add_puzzle(uint32_t level, std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept {
    id = 0;
    if (!db || level < 1 || level > 100 || title.empty() || code.empty() || creator.empty() || !p_insert) return false;
    sqlite3_bind_int(p_insert, 1, static_cast<int>(level));
    bind_text(p_insert, 2, title);
    bind_text(p_insert, 3, description);
    bind_text(p_insert, 4, code);
    bind_text(p_insert, 5, creator);
    sqlite3_bind_int64(p_insert, 6, static_cast<sqlite3_int64>(created_at));
    sqlite3_bind_int64(p_insert, 7, static_cast<sqlite3_int64>(created_at));
    const int rc = sqlite3_step(p_insert);
    if (rc == SQLITE_DONE) id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    reset(p_insert);
    return rc == SQLITE_DONE && id != 0;
}

bool update_puzzle(uint64_t id, uint32_t level, std::string_view title, std::string_view description, std::string_view code, uint64_t updated_at) noexcept {
    if (!db || id == 0 || level < 1 || level > 100 || title.empty() || code.empty() || !p_update) return false;
    sqlite3_bind_int(p_update, 1, static_cast<int>(level));
    bind_text(p_update, 2, title);
    bind_text(p_update, 3, description);
    bind_text(p_update, 4, code);
    sqlite3_bind_int64(p_update, 5, static_cast<sqlite3_int64>(updated_at));
    sqlite3_bind_int64(p_update, 6, static_cast<sqlite3_int64>(id));
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
        record.description = column_text(p_query, 3);
        record.code = column_text(p_query, 4);
        record.creator = column_text(p_query, 5);
        record.created_at = static_cast<uint64_t>(sqlite3_column_int64(p_query, 6));
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
        result.description = column_text(p_daily_query, 1);
        result.code = column_text(p_daily_query, 2);
        result.creator = column_text(p_daily_query, 3);
        result.updated_at = static_cast<uint64_t>(sqlite3_column_int64(p_daily_query, 4));
    }
    reset(p_daily_query);
    return rc == SQLITE_ROW || rc == SQLITE_DONE;
}

bool update_daily(std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t updated_at) noexcept {
    if (!db || !p_daily_update || title.empty() || code.empty() || creator.empty()) return false;
    bind_text(p_daily_update, 1, title);
    bind_text(p_daily_update, 2, description);
    bind_text(p_daily_update, 3, code);
    bind_text(p_daily_update, 4, creator);
    sqlite3_bind_int64(p_daily_update, 5, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_daily_update);
    reset(p_daily_update);
    return rc == SQLITE_DONE;
}

bool add_submission(std::string_view target, uint32_t level, std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept {
    id = 0;
    if (!db || !p_sub_insert || (target != "daily" && target != "level") || title.empty() || code.empty() || creator.empty()) return false;
    if (target == "level" && (level < 1 || level > 100)) return false;

    bind_text(p_sub_insert, 1, target);
    sqlite3_bind_int(p_sub_insert, 2, static_cast<int>(level));
    bind_text(p_sub_insert, 3, title);
    bind_text(p_sub_insert, 4, description);
    bind_text(p_sub_insert, 5, code);
    bind_text(p_sub_insert, 6, creator);
    sqlite3_bind_int64(p_sub_insert, 7, static_cast<sqlite3_int64>(created_at));

    const int rc = sqlite3_step(p_sub_insert);
    if (rc == SQLITE_DONE) id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    reset(p_sub_insert);
    return rc == SQLITE_DONE && id != 0;
}

// 审核前修改投稿：只允许改动仍处于待审核（status=0）的记录。
bool update_submission(uint64_t id, std::string_view target, uint32_t level, std::string_view title, std::string_view description, std::string_view code) noexcept {
    if (!db || !p_sub_update || id == 0 || (target != "daily" && target != "level") || title.empty() || code.empty()) return false;
    if (target == "level" && (level < 1 || level > 100)) return false;
    const uint32_t sub_level = target == "level" ? level : 0;

    bind_text(p_sub_update, 1, target);
    sqlite3_bind_int(p_sub_update, 2, static_cast<int>(sub_level));
    bind_text(p_sub_update, 3, title);
    bind_text(p_sub_update, 4, description);
    bind_text(p_sub_update, 5, code);
    sqlite3_bind_int64(p_sub_update, 6, static_cast<sqlite3_int64>(id));

    const int rc = sqlite3_step(p_sub_update);
    const int changed = sqlite3_changes(db);
    reset(p_sub_update);
    return rc == SQLITE_DONE && changed == 1;
}

bool list_submissions(std::string_view creator, int status_filter, std::vector<Submission>& out) noexcept {
    out.clear();
    if (!db) return false;

    sqlite3_stmt* statement = creator.empty() ? p_sub_list_all : p_sub_list_creator;
    if (!statement) return false;

    if (creator.empty()) {
        sqlite3_bind_int(statement, 1, status_filter);
        sqlite3_bind_int(statement, 2, status_filter);
    } else {
        bind_text(statement, 1, creator);
        sqlite3_bind_int(statement, 2, status_filter);
        sqlite3_bind_int(statement, 3, status_filter);
    }

    int rc = SQLITE_OK;
    while ((rc = sqlite3_step(statement)) == SQLITE_ROW) {
        Submission record{};
        record.id = static_cast<uint64_t>(sqlite3_column_int64(statement, 0));
        record.target = column_text(statement, 1);
        record.level = static_cast<uint32_t>(sqlite3_column_int(statement, 2));
        record.title = column_text(statement, 3);
        record.description = column_text(statement, 4);
        record.code = column_text(statement, 5);
        record.creator = column_text(statement, 6);
        record.created_at = static_cast<uint64_t>(sqlite3_column_int64(statement, 7));
        record.status = sqlite3_column_int(statement, 8);
        record.reviewer = column_text(statement, 9);
        record.reviewed_at = static_cast<uint64_t>(sqlite3_column_int64(statement, 10));
        out.emplace_back(std::move(record));
    }
    reset(statement);
    return rc == SQLITE_DONE;
}

bool review_submission(uint64_t id, bool approve, std::string_view reviewer, uint64_t now, bool allow_overwrite, bool& slot_occupied, std::string& creator) noexcept {
    slot_occupied = false;
    creator.clear();
    if (!db || !p_sub_load_pending || !p_sub_review || id == 0 || reviewer.empty()) return false;

    // 只处理仍处于待审核状态的投稿。
    sqlite3_bind_int64(p_sub_load_pending, 1, static_cast<sqlite3_int64>(id));
    const int load_rc = sqlite3_step(p_sub_load_pending);
    if (load_rc != SQLITE_ROW) {
        reset(p_sub_load_pending);
        return false;
    }
    Submission record{};
    record.id = id;
    record.target = column_text(p_sub_load_pending, 0);
    record.level = static_cast<uint32_t>(sqlite3_column_int(p_sub_load_pending, 1));
    record.title = column_text(p_sub_load_pending, 2);
    record.description = column_text(p_sub_load_pending, 3);
    record.code = column_text(p_sub_load_pending, 4);
    record.creator = column_text(p_sub_load_pending, 5);
    record.created_at = static_cast<uint64_t>(sqlite3_column_int64(p_sub_load_pending, 6));
    reset(p_sub_load_pending);
    creator = record.creator;

    // 拒绝：直接标记状态，不做发布。
    if (!approve) {
        sqlite3_bind_int(p_sub_review, 1, 2);
        bind_text(p_sub_review, 2, reviewer);
        sqlite3_bind_int64(p_sub_review, 3, static_cast<sqlite3_int64>(now));
        sqlite3_bind_int64(p_sub_review, 4, static_cast<sqlite3_int64>(id));
        const int rc = sqlite3_step(p_sub_review);
        const int changed = sqlite3_changes(db);
        reset(p_sub_review);
        return rc == SQLITE_DONE && changed == 1;
    }

    // 通过：先发布到目标位置，成功后再标记为已通过。
    if (record.target == "daily") {
        DailyRecord daily{};
        query_daily(daily);
        if (!daily.code.empty() && !allow_overwrite) {
            slot_occupied = true;
            return false;
        }
        if (!update_daily(record.title, record.description, record.code, reviewer, now)) return false;
    } else if (record.target == "level") {
        std::vector<Record> records;
        query_puzzles(records);
        uint64_t existing_id = 0; // 该关卡已被占用时的残局主键
        for (const auto& existing : records) {
            if (existing.level != record.level) continue;
            existing_id = existing.id;
            break;
        }
        if (existing_id != 0) {
            // 关卡已有残局：等级 3 不允许覆盖，等级 4 走更新覆盖。
            if (!allow_overwrite) {
                slot_occupied = true;
                return false;
            }
            if (!update_puzzle(existing_id, record.level, record.title, record.description, record.code, now)) return false;
        } else {
            uint64_t new_id = 0;
            if (!add_puzzle(record.level, record.title, record.description, record.code, reviewer, now, new_id)) return false;
        }
    } else {
        return false;
    }

    sqlite3_bind_int(p_sub_review, 1, 1);
    bind_text(p_sub_review, 2, reviewer);
    sqlite3_bind_int64(p_sub_review, 3, static_cast<sqlite3_int64>(now));
    sqlite3_bind_int64(p_sub_review, 4, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_sub_review);
    const int changed = sqlite3_changes(db);
    reset(p_sub_review);
    return rc == SQLITE_DONE && changed == 1;
}

bool claim_clear(std::string_view uuid, std::string_view target, int64_t ref, uint64_t cleared_at) noexcept {
    if (!db || !p_claim_clear || uuid.empty() || (target != "daily" && target != "level") || ref <= 0) return false;

    bind_text(p_claim_clear, 1, uuid);
    bind_text(p_claim_clear, 2, target);
    sqlite3_bind_int64(p_claim_clear, 3, static_cast<sqlite3_int64>(ref));
    sqlite3_bind_int64(p_claim_clear, 4, static_cast<sqlite3_int64>(cleared_at));

    const int rc      = sqlite3_step(p_claim_clear);
    const int changed = sqlite3_changes(db);
    reset(p_claim_clear);
    // INSERT OR IGNORE 只有真正插入新记录时 changed 才为 1。
    return rc == SQLITE_DONE && changed == 1;
}

bool count_clears(std::string_view uuid, int64_t& count) noexcept {
    count = 0;
    if (!db || !p_count_clears || uuid.empty()) return false;

    bind_text(p_count_clears, 1, uuid);
    const int rc = sqlite3_step(p_count_clears);
    if (rc == SQLITE_ROW) count = sqlite3_column_int64(p_count_clears, 0);
    reset(p_count_clears);
    return rc == SQLITE_ROW;
}
} // namespace Puzzle
} // namespace Manager
