/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情角色管理（角色代表图与表情图；管理员可新增、删除角色并更换代表图）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Story.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>


namespace Manager {
namespace Story {
namespace {
sqlite3* db = nullptr;
sqlite3_stmt* p_chars = nullptr;
sqlite3_stmt* p_exprs = nullptr;
sqlite3_stmt* p_char_name = nullptr;
sqlite3_stmt* p_char_id = nullptr;
sqlite3_stmt* p_expr_name = nullptr;
sqlite3_stmt* p_add_char = nullptr;
sqlite3_stmt* p_add_expr = nullptr;
sqlite3_stmt* p_update_char_rep = nullptr;
sqlite3_stmt* p_update_expr_image = nullptr;
sqlite3_stmt* p_char_rep = nullptr;
sqlite3_stmt* p_expr_image = nullptr;
sqlite3_stmt* p_char_originals = nullptr;
sqlite3_stmt* p_expr_originals = nullptr;
sqlite3_stmt* p_delete_char = nullptr;
sqlite3_stmt* p_delete_char_exprs = nullptr;
sqlite3_stmt* p_delete_expr = nullptr;
sqlite3_stmt* p_add_submission = nullptr;
sqlite3_stmt* p_submissions_pending = nullptr;
sqlite3_stmt* p_submissions_creator = nullptr;
sqlite3_stmt* p_submissions_pending_creator = nullptr;
sqlite3_stmt* p_submission = nullptr;
sqlite3_stmt* p_submission_status = nullptr;

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

// 复用同一张语句查询「是否存在」：命中一行即存在
bool step_exist(sqlite3_stmt* statement) noexcept {
    if (!statement) return false;
    const int rc = sqlite3_step(statement);
    reset(statement);
    return rc == SQLITE_ROW;
}

SubmissionRecord submission_row(sqlite3_stmt* statement) {
    SubmissionRecord record{};
    record.id         = static_cast<uint64_t>(sqlite3_column_int64(statement, 0));
    record.kind       = column_text(statement, 1);
    record.level_from = static_cast<uint64_t>(sqlite3_column_int64(statement, 2));
    record.level_to   = static_cast<uint64_t>(sqlite3_column_int64(statement, 3));
    record.name       = column_text(statement, 4);
    record.payload    = column_text(statement, 5);
    record.creator    = column_text(statement, 6);
    record.created_at = static_cast<uint64_t>(sqlite3_column_int64(statement, 7));
    record.status     = static_cast<int>(sqlite3_column_int64(statement, 8));
    record.reviewer   = column_text(statement, 9);
    record.reviewed_at = static_cast<uint64_t>(sqlite3_column_int64(statement, 10));
    return record;
}

std::vector<SubmissionRecord> collect_submissions(sqlite3_stmt* statement) {
    std::vector<SubmissionRecord> records;
    int rc = SQLITE_DONE;
    while ((rc = sqlite3_step(statement)) == SQLITE_ROW) records.push_back(submission_row(statement));
    reset(statement);
    return records;
}
} // namespace

void init() noexcept {
    Libs::DB::Sqlite3::open("db/story.db", db);
    if (!db) return;

    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS story_character ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "name TEXT NOT NULL UNIQUE, "
        "rep TEXT NOT NULL, "
        "rep_original TEXT NOT NULL DEFAULT '', "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS story_expression ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "character_id INTEGER NOT NULL, "
        "name TEXT NOT NULL, "
        "image TEXT NOT NULL, "
        "image_original TEXT NOT NULL DEFAULT '', "
        "creator TEXT NOT NULL, "
        "updated_at INTEGER NOT NULL, "
        "UNIQUE(character_id, name)"
        ") STRICT",
        nullptr,
        nullptr,
        nullptr
    );

    // 剧情投稿：等级 2/3 的编辑先暂存，等级 4 审核通过后才写入正式数据
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS story_submission ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "kind TEXT NOT NULL, "
        "level_from INTEGER NOT NULL DEFAULT 0, "
        "level_to INTEGER NOT NULL DEFAULT 0, "
        "name TEXT NOT NULL DEFAULT '', "
        "payload TEXT NOT NULL, "
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
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS story_submission_status ON story_submission(status, id)", nullptr, nullptr, nullptr);

    // 旧库迁移：为已存在的表补上原图路径列（重复执行会报 duplicate column，忽略即可）。
    sqlite3_exec(db, "ALTER TABLE story_character ADD COLUMN rep_original TEXT NOT NULL DEFAULT ''", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE story_expression ADD COLUMN image_original TEXT NOT NULL DEFAULT ''", nullptr, nullptr, nullptr);

    sqlite3_prepare_v2(db, "SELECT id, name, rep, rep_original, updated_at FROM story_character ORDER BY id", -1, &p_chars, nullptr);
    sqlite3_prepare_v2(db, "SELECT id, character_id, name, image, image_original FROM story_expression ORDER BY character_id, id", -1, &p_exprs, nullptr);
    sqlite3_prepare_v2(db, "SELECT 1 FROM story_character WHERE name = ?1", -1, &p_char_name, nullptr);
    sqlite3_prepare_v2(db, "SELECT 1 FROM story_character WHERE id = ?1", -1, &p_char_id, nullptr);
    sqlite3_prepare_v2(db, "SELECT 1 FROM story_expression WHERE character_id = ?1 AND name = ?2", -1, &p_expr_name, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO story_character(name, rep, rep_original, creator, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)", -1, &p_add_char, nullptr);
    sqlite3_prepare_v2(db, "INSERT INTO story_expression(character_id, name, image, image_original, creator, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", -1, &p_add_expr, nullptr);
    sqlite3_prepare_v2(db, "UPDATE story_character SET rep = ?1, rep_original = ?2, updated_at = ?3 WHERE id = ?4", -1, &p_update_char_rep, nullptr);
    sqlite3_prepare_v2(db, "UPDATE story_expression SET image = ?1, image_original = ?2, updated_at = ?3 WHERE id = ?4 AND character_id = ?5", -1, &p_update_expr_image, nullptr);
    sqlite3_prepare_v2(db, "SELECT name, rep, rep_original FROM story_character WHERE id = ?1", -1, &p_char_rep, nullptr);
    sqlite3_prepare_v2(db, "SELECT name, image, image_original FROM story_expression WHERE id = ?1 AND character_id = ?2", -1, &p_expr_image, nullptr);
    sqlite3_prepare_v2(db, "SELECT rep_original FROM story_character WHERE id = ?1", -1, &p_char_originals, nullptr);
    sqlite3_prepare_v2(db, "SELECT image_original FROM story_expression WHERE character_id = ?1", -1, &p_expr_originals, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM story_expression WHERE character_id = ?1", -1, &p_delete_char_exprs, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM story_expression WHERE id = ?1 AND character_id = ?2", -1, &p_delete_expr, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM story_character WHERE id = ?1", -1, &p_delete_char, nullptr);

    const std::string submission_columns = "id, kind, level_from, level_to, name, payload, creator, created_at, status, reviewer, reviewed_at";
    sqlite3_prepare_v2(db, "INSERT INTO story_submission(kind, level_from, level_to, name, payload, creator, created_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)", -1, &p_add_submission, nullptr);
    sqlite3_prepare_v2(db, ("SELECT " + submission_columns + " FROM story_submission WHERE status = 0 ORDER BY id ASC LIMIT 100").c_str(), -1, &p_submissions_pending, nullptr);
    sqlite3_prepare_v2(db, ("SELECT " + submission_columns + " FROM story_submission WHERE creator = ?1 ORDER BY id DESC LIMIT 50").c_str(), -1, &p_submissions_creator, nullptr);
    sqlite3_prepare_v2(db, ("SELECT " + submission_columns + " FROM story_submission WHERE creator = ?1 AND status = 0 ORDER BY id DESC LIMIT 50").c_str(), -1, &p_submissions_pending_creator, nullptr);
    sqlite3_prepare_v2(db, ("SELECT " + submission_columns + " FROM story_submission WHERE id = ?1").c_str(), -1, &p_submission, nullptr);
    sqlite3_prepare_v2(db, "UPDATE story_submission SET status = ?2, reviewer = ?3, reviewed_at = ?4 WHERE id = ?1 AND status = ?5", -1, &p_submission_status, nullptr);
}

void close() noexcept {
    sqlite3_finalize(p_chars);
    sqlite3_finalize(p_exprs);
    sqlite3_finalize(p_char_name);
    sqlite3_finalize(p_char_id);
    sqlite3_finalize(p_expr_name);
    sqlite3_finalize(p_add_char);
    sqlite3_finalize(p_add_expr);
    sqlite3_finalize(p_update_char_rep);
    sqlite3_finalize(p_update_expr_image);
    sqlite3_finalize(p_char_rep);
    sqlite3_finalize(p_expr_image);
    sqlite3_finalize(p_char_originals);
    sqlite3_finalize(p_expr_originals);
    sqlite3_finalize(p_delete_char);
    sqlite3_finalize(p_delete_char_exprs);
    sqlite3_finalize(p_delete_expr);
    sqlite3_finalize(p_add_submission);
    sqlite3_finalize(p_submissions_pending);
    sqlite3_finalize(p_submissions_creator);
    sqlite3_finalize(p_submissions_pending_creator);
    sqlite3_finalize(p_submission);
    sqlite3_finalize(p_submission_status);
    p_chars = nullptr;
    p_exprs = nullptr;
    p_char_name = nullptr;
    p_char_id = nullptr;
    p_expr_name = nullptr;
    p_add_char = nullptr;
    p_add_expr = nullptr;
    p_update_char_rep = nullptr;
    p_update_expr_image = nullptr;
    p_char_rep = nullptr;
    p_expr_image = nullptr;
    p_char_originals = nullptr;
    p_expr_originals = nullptr;
    p_delete_char = nullptr;
    p_delete_char_exprs = nullptr;
    p_delete_expr = nullptr;
    p_add_submission = nullptr;
    p_submissions_pending = nullptr;
    p_submissions_creator = nullptr;
    p_submissions_pending_creator = nullptr;
    p_submission = nullptr;
    p_submission_status = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

bool query_characters(std::vector<CharacterRecord>& result) noexcept {
    result.clear();
    if (!db || !p_chars || !p_exprs) return false;

    std::unordered_map<uint64_t, std::size_t> index;

    while (sqlite3_step(p_chars) == SQLITE_ROW) {
        CharacterRecord record{};
        record.id = static_cast<uint64_t>(sqlite3_column_int64(p_chars, 0));
        record.name = column_text(p_chars, 1);
        record.rep = column_text(p_chars, 2);
        record.rep_original = column_text(p_chars, 3);
        record.updated_at = static_cast<uint64_t>(sqlite3_column_int64(p_chars, 4));
        index.emplace(record.id, result.size());
        result.push_back(std::move(record));
    }
    reset(p_chars);

    while (sqlite3_step(p_exprs) == SQLITE_ROW) {
        const auto character_id = static_cast<uint64_t>(sqlite3_column_int64(p_exprs, 1));
        const auto found = index.find(character_id);
        if (found == index.end()) continue;
        ExpressionRecord expression{};
        expression.id = static_cast<uint64_t>(sqlite3_column_int64(p_exprs, 0));
        expression.name = column_text(p_exprs, 2);
        expression.image = column_text(p_exprs, 3);
        expression.image_original = column_text(p_exprs, 4);
        result[found->second].expressions.push_back(std::move(expression));
    }
    reset(p_exprs);

    return true;
}

bool exist_character_name(std::string_view name) noexcept {
    if (!db || !p_char_name || name.empty()) return false;
    bind_text(p_char_name, 1, name);
    return step_exist(p_char_name);
}

bool exist_character_id(uint64_t id) noexcept {
    if (!db || !p_char_id || id == 0) return false;
    sqlite3_bind_int64(p_char_id, 1, static_cast<sqlite3_int64>(id));
    return step_exist(p_char_id);
}

bool exist_expression_name(uint64_t character_id, std::string_view name) noexcept {
    if (!db || !p_expr_name || character_id == 0 || name.empty()) return false;
    sqlite3_bind_int64(p_expr_name, 1, static_cast<sqlite3_int64>(character_id));
    bind_text(p_expr_name, 2, name);
    return step_exist(p_expr_name);
}

bool add_character(std::string_view name, std::string_view rep, std::string_view rep_original, std::string_view creator, uint64_t updated_at, uint64_t& id) noexcept {
    id = 0;
    if (!db || !p_add_char || name.empty() || rep.empty() || creator.empty()) return false;
    bind_text(p_add_char, 1, name);
    bind_text(p_add_char, 2, rep);
    bind_text(p_add_char, 3, rep_original);
    bind_text(p_add_char, 4, creator);
    sqlite3_bind_int64(p_add_char, 5, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_add_char);
    reset(p_add_char);
    if (rc != SQLITE_DONE) return false;
    id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    return true;
}

bool add_expression(uint64_t character_id, std::string_view name, std::string_view image, std::string_view image_original, std::string_view creator, uint64_t updated_at, uint64_t& id) noexcept {
    id = 0;
    if (!db || !p_add_expr || character_id == 0 || name.empty() || image.empty() || creator.empty()) return false;
    sqlite3_bind_int64(p_add_expr, 1, static_cast<sqlite3_int64>(character_id));
    bind_text(p_add_expr, 2, name);
    bind_text(p_add_expr, 3, image);
    bind_text(p_add_expr, 4, image_original);
    bind_text(p_add_expr, 5, creator);
    sqlite3_bind_int64(p_add_expr, 6, static_cast<sqlite3_int64>(updated_at));
    const int rc = sqlite3_step(p_add_expr);
    reset(p_add_expr);
    if (rc != SQLITE_DONE) return false;
    id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    return true;
}

bool update_character_rep(uint64_t id, std::string_view rep, std::string_view rep_original, uint64_t updated_at) noexcept {
    if (!db || !p_update_char_rep || id == 0 || rep.empty()) return false;
    bind_text(p_update_char_rep, 1, rep);
    bind_text(p_update_char_rep, 2, rep_original);
    sqlite3_bind_int64(p_update_char_rep, 3, static_cast<sqlite3_int64>(updated_at));
    sqlite3_bind_int64(p_update_char_rep, 4, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_update_char_rep);
    reset(p_update_char_rep);
    return rc == SQLITE_DONE;
}

bool update_expression_image(uint64_t character_id, uint64_t expression_id, std::string_view image, std::string_view image_original, uint64_t updated_at) noexcept {
    if (!db || !p_update_expr_image || character_id == 0 || expression_id == 0 || image.empty()) return false;
    bind_text(p_update_expr_image, 1, image);
    bind_text(p_update_expr_image, 2, image_original);
    sqlite3_bind_int64(p_update_expr_image, 3, static_cast<sqlite3_int64>(updated_at));
    sqlite3_bind_int64(p_update_expr_image, 4, static_cast<sqlite3_int64>(expression_id));
    sqlite3_bind_int64(p_update_expr_image, 5, static_cast<sqlite3_int64>(character_id));
    const int rc = sqlite3_step(p_update_expr_image);
    const int changes = sqlite3_changes(db);
    reset(p_update_expr_image);
    return rc == SQLITE_DONE && changes > 0;
}

bool query_character_rep(uint64_t id, std::string& name, std::string& image, std::string& original) noexcept {
    name.clear(); image.clear(); original.clear();
    if (!db || !p_char_rep || id == 0) return false;
    sqlite3_bind_int64(p_char_rep, 1, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_char_rep);
    if (rc == SQLITE_ROW) {
        name = column_text(p_char_rep, 0);
        image = column_text(p_char_rep, 1);
        original = column_text(p_char_rep, 2);
    }
    reset(p_char_rep);
    return rc == SQLITE_ROW;
}

bool query_expression_image(uint64_t character_id, uint64_t expression_id, std::string& name, std::string& image, std::string& original) noexcept {
    name.clear(); image.clear(); original.clear();
    if (!db || !p_expr_image || character_id == 0 || expression_id == 0) return false;
    sqlite3_bind_int64(p_expr_image, 1, static_cast<sqlite3_int64>(expression_id));
    sqlite3_bind_int64(p_expr_image, 2, static_cast<sqlite3_int64>(character_id));
    const int rc = sqlite3_step(p_expr_image);
    if (rc == SQLITE_ROW) {
        name = column_text(p_expr_image, 0);
        image = column_text(p_expr_image, 1);
        original = column_text(p_expr_image, 2);
    }
    reset(p_expr_image);
    return rc == SQLITE_ROW;
}

bool query_character_originals(uint64_t id, std::vector<std::string>& originals) noexcept {
    originals.clear();
    if (!db || !p_char_originals || !p_expr_originals || id == 0) return false;
    sqlite3_bind_int64(p_char_originals, 1, static_cast<sqlite3_int64>(id));
    if (sqlite3_step(p_char_originals) == SQLITE_ROW) {
        auto value = column_text(p_char_originals, 0);
        if (!value.empty()) originals.push_back(std::move(value));
    }
    reset(p_char_originals);
    sqlite3_bind_int64(p_expr_originals, 1, static_cast<sqlite3_int64>(id));
    while (sqlite3_step(p_expr_originals) == SQLITE_ROW) {
        auto value = column_text(p_expr_originals, 0);
        if (!value.empty()) originals.push_back(std::move(value));
    }
    reset(p_expr_originals);
    return true;
}

bool delete_character(uint64_t id) noexcept {
    if (!db || !p_delete_char || !p_delete_char_exprs || id == 0) return false;

    sqlite3_exec(db, "BEGIN", nullptr, nullptr, nullptr);

    sqlite3_bind_int64(p_delete_char_exprs, 1, static_cast<sqlite3_int64>(id));
    const int expr_rc = sqlite3_step(p_delete_char_exprs);
    reset(p_delete_char_exprs);
    if (expr_rc != SQLITE_DONE) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    sqlite3_bind_int64(p_delete_char, 1, static_cast<sqlite3_int64>(id));
    const int char_rc = sqlite3_step(p_delete_char);
    reset(p_delete_char);
    if (char_rc != SQLITE_DONE) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    sqlite3_exec(db, "COMMIT", nullptr, nullptr, nullptr);
    return true;
}

bool delete_expression(uint64_t character_id, uint64_t expression_id) noexcept {
    if (!db || !p_delete_expr || character_id == 0 || expression_id == 0) return false;

    sqlite3_bind_int64(p_delete_expr, 1, static_cast<sqlite3_int64>(expression_id));
    sqlite3_bind_int64(p_delete_expr, 2, static_cast<sqlite3_int64>(character_id));
    const int rc = sqlite3_step(p_delete_expr);
    const int changes = sqlite3_changes(db);
    reset(p_delete_expr);
    return rc == SQLITE_DONE && changes > 0;
}

bool add_submission(
    std::string_view kind,
    uint64_t level_from,
    uint64_t level_to,
    std::string_view name,
    std::string_view payload,
    std::string_view creator,
    uint64_t created_at,
    uint64_t& id
) noexcept {
    id = 0;
    if (!db || !p_add_submission || kind.empty() || payload.empty() || creator.empty()) return false;
    bind_text(p_add_submission, 1, kind);
    sqlite3_bind_int64(p_add_submission, 2, static_cast<sqlite3_int64>(level_from));
    sqlite3_bind_int64(p_add_submission, 3, static_cast<sqlite3_int64>(level_to));
    bind_text(p_add_submission, 4, name);
    bind_text(p_add_submission, 5, payload);
    bind_text(p_add_submission, 6, creator);
    sqlite3_bind_int64(p_add_submission, 7, static_cast<sqlite3_int64>(created_at));
    const int rc = sqlite3_step(p_add_submission);
    reset(p_add_submission);
    if (rc != SQLITE_DONE) return false;
    id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
    return true;
}

bool query_submissions(bool pending_only, std::string_view creator, std::vector<SubmissionRecord>& result) noexcept {
    result.clear();
    if (!db) return false;

    sqlite3_stmt* statement = nullptr;
    if (creator.empty()) {
        statement = p_submissions_pending;
    } else if (pending_only) {
        statement = p_submissions_pending_creator;
    } else {
        statement = p_submissions_creator;
    }
    if (!statement) return false;

    if (!creator.empty()) bind_text(statement, 1, creator);
    result = collect_submissions(statement);
    return true;
}

bool query_submission(uint64_t id, SubmissionRecord& result) noexcept {
    result = {};
    if (!db || !p_submission || id == 0) return false;
    sqlite3_bind_int64(p_submission, 1, static_cast<sqlite3_int64>(id));
    const int rc = sqlite3_step(p_submission);
    if (rc == SQLITE_ROW) result = submission_row(p_submission);
    reset(p_submission);
    return rc == SQLITE_ROW;
}

bool set_submission_status(uint64_t id, int from_status, int to_status, std::string_view reviewer, uint64_t reviewed_at) noexcept {
    if (!db || !p_submission_status || id == 0) return false;
    sqlite3_bind_int64(p_submission_status, 1, static_cast<sqlite3_int64>(id));
    sqlite3_bind_int(p_submission_status, 2, to_status);
    bind_text(p_submission_status, 3, reviewer);
    sqlite3_bind_int64(p_submission_status, 4, static_cast<sqlite3_int64>(reviewed_at));
    sqlite3_bind_int(p_submission_status, 5, from_status);
    const int rc = sqlite3_step(p_submission_status);
    const int changes = sqlite3_changes(db);
    reset(p_submission_status);
    return rc == SQLITE_DONE && changes == 1;
}
} // namespace Story
} // namespace Manager
