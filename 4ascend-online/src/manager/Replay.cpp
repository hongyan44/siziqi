/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Replay 回放管理
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Replay.h"

#include "../libs/db/Sqlite3.h"

#include <sqlite/sqlite3.h>

#include <algorithm>
#include <string>
#include <string_view>


namespace Manager {
namespace Replay {
sqlite3* db = nullptr;

sqlite3_stmt* p_select_existing = nullptr;
sqlite3_stmt* p_insert          = nullptr;
sqlite3_stmt* p_insert_player   = nullptr;
sqlite3_stmt* p_trim_player     = nullptr;
sqlite3_stmt* p_delete_orphan   = nullptr;
sqlite3_stmt* p_delete          = nullptr;
sqlite3_stmt* p_delete_record   = nullptr;
sqlite3_stmt* p_query_player    = nullptr;
sqlite3_stmt* p_select_data     = nullptr;
sqlite3_stmt* p_stats_player    = nullptr;
sqlite3_stmt* p_bump_player     = nullptr;
sqlite3_stmt* p_total_player    = nullptr;
sqlite3_stmt* p_bump_ai_player  = nullptr;

namespace {
void bind_text(sqlite3_stmt* statement, int index, std::string_view value) noexcept {
    sqlite3_bind_text(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void bind_blob(sqlite3_stmt* statement, int index, std::string_view value) noexcept {
    sqlite3_bind_blob(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void reset(sqlite3_stmt* statement) noexcept {
    sqlite3_reset(statement);
    sqlite3_clear_bindings(statement);
}

std::string column_text(sqlite3_stmt* statement, int index) {
    const auto* text = sqlite3_column_text(statement, index);
    return text ? reinterpret_cast<const char*>(text) : std::string();
}

bool exec(const char* sql) noexcept {
    return sqlite3_exec(db, sql, nullptr, nullptr, nullptr) == SQLITE_OK;
}
} // namespace

// 初始化
void init() noexcept {
    Libs::DB::Sqlite3::open("db/replay.db", db);
    if (!db) return;

    if (!exec(
            "CREATE TABLE IF NOT EXISTS replay ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "a TEXT NOT NULL, "
            "b TEXT NOT NULL, "
            "time INTEGER NOT NULL, "
            "hash BLOB UNIQUE NOT NULL, "
            "data BLOB NOT NULL, "
            "player_a_uuid TEXT NOT NULL, "
            "player_b_uuid TEXT NOT NULL, "
            "black_uuid TEXT, "
            "white_uuid TEXT, "
            "black_name TEXT, "
            "white_name TEXT, "
            "duration INTEGER NOT NULL DEFAULT 0, "
            "mode INTEGER NOT NULL DEFAULT 0, "
            "first INTEGER NOT NULL DEFAULT 0, "
            "black_hp INTEGER NOT NULL DEFAULT 0, "
            "white_hp INTEGER NOT NULL DEFAULT 0, "
            "category TEXT NOT NULL DEFAULT 'online', "
            "result TEXT NOT NULL DEFAULT 'none'"
            ") STRICT"
        )) {
        std::cerr << "回放数据库表初始化失败" << std::endl;
        close();
        return;
    }

    // 兼容旧版 replay 表：新增列失败时直接忽略，已有列保持不变。
    exec("ALTER TABLE replay ADD COLUMN player_a_uuid TEXT NOT NULL DEFAULT ''");
    exec("ALTER TABLE replay ADD COLUMN player_b_uuid TEXT NOT NULL DEFAULT ''");
    exec("ALTER TABLE replay ADD COLUMN black_uuid TEXT NOT NULL DEFAULT ''");
    exec("ALTER TABLE replay ADD COLUMN white_uuid TEXT NOT NULL DEFAULT ''");
    exec("ALTER TABLE replay ADD COLUMN black_name TEXT");
    exec("ALTER TABLE replay ADD COLUMN white_name TEXT");
    exec("ALTER TABLE replay ADD COLUMN duration INTEGER NOT NULL DEFAULT 0");
    exec("ALTER TABLE replay ADD COLUMN mode INTEGER NOT NULL DEFAULT 0");
    exec("ALTER TABLE replay ADD COLUMN first INTEGER NOT NULL DEFAULT 0");
    exec("ALTER TABLE replay ADD COLUMN black_hp INTEGER NOT NULL DEFAULT 0");
    exec("ALTER TABLE replay ADD COLUMN white_hp INTEGER NOT NULL DEFAULT 0");
    exec("ALTER TABLE replay ADD COLUMN category TEXT NOT NULL DEFAULT 'online'");
    exec("ALTER TABLE replay ADD COLUMN result TEXT NOT NULL DEFAULT 'none'");

    exec("UPDATE replay SET player_a_uuid = a WHERE player_a_uuid IS NULL OR player_a_uuid = ''");
    exec("UPDATE replay SET player_b_uuid = b WHERE player_b_uuid IS NULL OR player_b_uuid = ''");
    exec("UPDATE replay SET black_uuid = a WHERE black_uuid IS NULL OR black_uuid = ''");
    exec("UPDATE replay SET white_uuid = b WHERE white_uuid IS NULL OR white_uuid = ''");

    if (!exec(
            "CREATE TABLE IF NOT EXISTS replay_players ("
            "player_uuid TEXT NOT NULL, "
            "replay_id INTEGER NOT NULL, "
            "time INTEGER NOT NULL, "
            "PRIMARY KEY (player_uuid, replay_id), "
            "FOREIGN KEY (replay_id) REFERENCES replay(id) ON DELETE CASCADE"
            ") STRICT"
        )
        || !exec("CREATE INDEX IF NOT EXISTS idx_replay_players_player ON replay_players(player_uuid, time DESC, replay_id DESC)")
        || !exec("CREATE INDEX IF NOT EXISTS idx_replay_players_replay ON replay_players(replay_id)")
        || !exec("CREATE INDEX IF NOT EXISTS idx_replay_pair ON replay(player_a_uuid, player_b_uuid)")) {
        std::cerr << "回放数据库表或索引初始化失败" << std::endl;
        close();
        return;
    }

    // 累计对局统计：回放本体只保留最近 100 局，但总场次 / 总胜场 / AI 场次在这里持续累加。
    if (!exec(
            "CREATE TABLE IF NOT EXISTS player_stats ("
            "player_uuid TEXT PRIMARY KEY, "
            "online_games INTEGER NOT NULL DEFAULT 0, "
            "online_wins INTEGER NOT NULL DEFAULT 0, "
            "ai_games INTEGER NOT NULL DEFAULT 0"
            ") STRICT"
        )) {
        std::cerr << "对局统计表初始化失败" << std::endl;
        close();
        return;
    }

    // 旧数据基线：只给尚无统计行的玩家按当前保留的回放补一次，已有累计值不会被覆盖。
    const auto seed_stats = [&]() {
        exec(
            "INSERT OR IGNORE INTO player_stats (player_uuid, online_games, online_wins) "
            "SELECT p.player_uuid, COUNT(*), "
            "COALESCE(SUM(CASE WHEN (r.result = 'A' AND r.black_uuid = p.player_uuid) "
            "OR (r.result = 'B' AND r.white_uuid = p.player_uuid) THEN 1 ELSE 0 END), 0) "
            "FROM replay_players p INNER JOIN replay r ON r.id = p.replay_id "
            "GROUP BY p.player_uuid"
        );
    };

    // 把旧版 replay.a/replay.b 转成玩家关联，避免升级后历史记录消失。
    exec(
        "INSERT OR IGNORE INTO replay_players (player_uuid, replay_id, time) "
        "SELECT a, id, time FROM replay WHERE a <> ''"
    );
    exec(
        "INSERT OR IGNORE INTO replay_players (player_uuid, replay_id, time) "
        "SELECT b, id, time FROM replay WHERE b <> ''"
    );

    seed_stats();

    const auto prepare = [](const char* sql, sqlite3_stmt** statement) {
        return sqlite3_prepare_v2(db, sql, -1, statement, nullptr) == SQLITE_OK;
    };

    if (!prepare(
            "SELECT id FROM replay WHERE hash = ? AND ((player_a_uuid = ? AND player_b_uuid = ?) OR (player_a_uuid = ? AND player_b_uuid = ?)) LIMIT 1",
            &p_select_existing)) {
        std::cerr << "回放查询语句初始化失败" << std::endl;
        close();
        return;
    }
    sqlite3_prepare_v2(
        db,
        "INSERT INTO replay (a, b, time, hash, data, player_a_uuid, player_b_uuid, black_uuid, white_uuid, black_name, white_name, duration, mode, first, black_hp, white_hp, category, result) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        -1,
        &p_insert,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "INSERT OR IGNORE INTO replay_players (player_uuid, replay_id, time) VALUES (?, ?, ?)",
        -1,
        &p_insert_player,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "DELETE FROM replay_players WHERE player_uuid = ? AND replay_id IN ("
        "SELECT replay_id FROM replay_players WHERE player_uuid = ? ORDER BY time DESC, replay_id DESC LIMIT -1 OFFSET 100"
        ")",
        -1,
        &p_trim_player,
        nullptr
    );
    sqlite3_prepare_v2(db, "DELETE FROM replay WHERE id NOT IN (SELECT replay_id FROM replay_players)", -1, &p_delete_orphan, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM replay_players WHERE replay_id = ?", -1, &p_delete, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM replay WHERE id = ?", -1, &p_delete_record, nullptr);
    sqlite3_prepare_v2(
        db,
        "SELECT r.id, r.time, r.duration, r.mode, r.first, r.black_hp, r.white_hp, r.category, "
        "r.player_a_uuid, r.player_b_uuid, r.black_uuid, r.white_uuid, r.black_name, r.white_name, r.result "
        "FROM replay r INNER JOIN replay_players p ON p.replay_id = r.id "
        "WHERE p.player_uuid = ? ORDER BY r.time DESC, r.id DESC",
        -1,
        &p_query_player,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT r.data FROM replay r INNER JOIN replay_players p ON p.replay_id = r.id WHERE r.id = ? AND p.player_uuid = ? LIMIT 1",
        -1,
        &p_select_data,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN (r.result = 'A' AND r.black_uuid = ?) OR (r.result = 'B' AND r.white_uuid = ?) THEN 1 ELSE 0 END), 0) "
        "FROM (SELECT r.result, r.black_uuid, r.white_uuid FROM replay r INNER JOIN replay_players p ON p.replay_id = r.id "
        "WHERE p.player_uuid = ? ORDER BY r.time DESC, r.id DESC LIMIT ?) AS r",
        -1,
        &p_stats_player,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "INSERT INTO player_stats (player_uuid, online_games, online_wins, ai_games) VALUES (?, 1, ?, 0) "
        "ON CONFLICT(player_uuid) DO UPDATE SET "
        "online_games = MIN(online_games + 1, 1000000000), "
        "online_wins = MIN(online_wins + excluded.online_wins, 1000000000)",
        -1,
        &p_bump_player,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "SELECT online_games, online_wins, ai_games FROM player_stats WHERE player_uuid = ?",
        -1,
        &p_total_player,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "INSERT INTO player_stats (player_uuid, online_games, online_wins, ai_games) VALUES (?, 0, 0, 1) "
        "ON CONFLICT(player_uuid) DO UPDATE SET ai_games = MIN(ai_games + 1, 1000000000)",
        -1,
        &p_bump_ai_player,
        nullptr
    );
};

// 关闭
void close() noexcept {
    sqlite3_finalize(p_select_existing);
    sqlite3_finalize(p_insert);
    sqlite3_finalize(p_insert_player);
    sqlite3_finalize(p_trim_player);
    sqlite3_finalize(p_delete_orphan);
    sqlite3_finalize(p_delete);
    sqlite3_finalize(p_delete_record);
    sqlite3_finalize(p_query_player);
    sqlite3_finalize(p_select_data);
    sqlite3_finalize(p_stats_player);
    sqlite3_finalize(p_bump_player);
    sqlite3_finalize(p_total_player);
    sqlite3_finalize(p_bump_ai_player);

    p_select_existing = nullptr;
    p_insert          = nullptr;
    p_insert_player   = nullptr;
    p_trim_player     = nullptr;
    p_delete_orphan   = nullptr;
    p_delete          = nullptr;
    p_delete_record   = nullptr;
    p_query_player    = nullptr;
    p_select_data     = nullptr;
    p_stats_player    = nullptr;
    p_bump_player     = nullptr;
    p_total_player    = nullptr;
    p_bump_ai_player  = nullptr;

    if (db) sqlite3_close(db);
    db = nullptr;
};

// 新增回放；同一 hash 与同一组玩家只保留一条总回放记录。
bool add_replay(
    std::string_view player_a,
    std::string_view player_b,
    std::string_view black_uuid,
    std::string_view white_uuid,
    std::string_view black_name,
    std::string_view white_name,
    uint64_t time,
    uint64_t duration,
    int64_t mode,
    int64_t first,
    int64_t black_hp,
    int64_t white_hp,
    std::string_view category,
    std::string_view result,
    std::string_view hash,
    std::string_view data,
    bool& created,
    uint64_t& id
) noexcept {
    id = 0;
    created = false;
    if (!db || player_a.empty() || player_b.empty() || player_a == player_b || hash.empty() || data.empty()) return false;
    if (black_uuid.empty() || white_uuid.empty() || black_uuid == white_uuid) return false;
    if ((black_uuid != player_a && black_uuid != player_b) || (white_uuid != player_a && white_uuid != player_b)) return false;

    std::string pair_a(player_a);
    std::string pair_b(player_b);
    if (pair_b < pair_a) std::swap(pair_a, pair_b);

    if (!exec("BEGIN IMMEDIATE TRANSACTION")) return false;

    bind_blob(p_select_existing, 1, hash);
    bind_text(p_select_existing, 2, pair_a);
    bind_text(p_select_existing, 3, pair_b);
    bind_text(p_select_existing, 4, pair_b);
    bind_text(p_select_existing, 5, pair_a);
    int rc = sqlite3_step(p_select_existing);
    if (rc == SQLITE_ROW) {
        id = static_cast<uint64_t>(sqlite3_column_int64(p_select_existing, 0));
        reset(p_select_existing);
    } else if (rc != SQLITE_DONE) {
        reset(p_select_existing);
        exec("ROLLBACK");
        return false;
    } else {
        reset(p_select_existing);

        bind_text(p_insert, 1, pair_a);
        bind_text(p_insert, 2, pair_b);
        sqlite3_bind_int64(p_insert, 3, static_cast<sqlite3_int64>(time));
        bind_blob(p_insert, 4, hash);
        bind_blob(p_insert, 5, data);
        bind_text(p_insert, 6, pair_a);
        bind_text(p_insert, 7, pair_b);
        bind_text(p_insert, 8, black_uuid);
        bind_text(p_insert, 9, white_uuid);
        bind_text(p_insert, 10, black_name);
        bind_text(p_insert, 11, white_name);
        sqlite3_bind_int64(p_insert, 12, static_cast<sqlite3_int64>(duration));
        sqlite3_bind_int64(p_insert, 13, mode);
        sqlite3_bind_int64(p_insert, 14, first);
        sqlite3_bind_int64(p_insert, 15, black_hp);
        sqlite3_bind_int64(p_insert, 16, white_hp);
        bind_text(p_insert, 17, category);
        bind_text(p_insert, 18, result);

        rc = sqlite3_step(p_insert);
        reset(p_insert);
        if (rc != SQLITE_DONE) {
            exec("ROLLBACK");
            return false;
        }
        id = static_cast<uint64_t>(sqlite3_last_insert_rowid(db));
        created = true;
    }

    for (const auto& uuid : {std::string_view(pair_a), std::string_view(pair_b)}) {
        bind_text(p_insert_player, 1, uuid);
        sqlite3_bind_int64(p_insert_player, 2, static_cast<sqlite3_int64>(id));
        sqlite3_bind_int64(p_insert_player, 3, static_cast<sqlite3_int64>(time));
        rc = sqlite3_step(p_insert_player);
        reset(p_insert_player);
        if (rc != SQLITE_DONE) {
            exec("ROLLBACK");
            return false;
        }

        bind_text(p_trim_player, 1, uuid);
        bind_text(p_trim_player, 2, uuid);
        rc = sqlite3_step(p_trim_player);
        reset(p_trim_player);
        if (rc != SQLITE_DONE) {
            exec("ROLLBACK");
            return false;
        }

        // 累计统计只在新回放入库时增加一次，双方重复上传同一局不会重复计数。
        if (created) {
            const bool win = (result == "A" && black_uuid == uuid) || (result == "B" && white_uuid == uuid);
            bind_text(p_bump_player, 1, uuid);
            sqlite3_bind_int64(p_bump_player, 2, win ? 1 : 0);
            rc = sqlite3_step(p_bump_player);
            reset(p_bump_player);
            if (rc != SQLITE_DONE) {
                exec("ROLLBACK");
                return false;
            }
        }
    }

    rc = sqlite3_step(p_delete_orphan);
    reset(p_delete_orphan);
    if (rc != SQLITE_DONE) {
        exec("ROLLBACK");
        return false;
    }

    if (!exec("COMMIT")) {
        exec("ROLLBACK");
        return false;
    }
    return true;
};

// 删除回放及其全部玩家关联。
bool delete_replay(uint64_t id) noexcept {
    if (!db) return false;
    if (!exec("BEGIN IMMEDIATE TRANSACTION")) return false;

    sqlite3_bind_int64(p_delete, 1, static_cast<sqlite3_int64>(id));
    int rc = sqlite3_step(p_delete);
    reset(p_delete);
    if (rc != SQLITE_DONE) {
        exec("ROLLBACK");
        return false;
    }

    sqlite3_bind_int64(p_delete_record, 1, static_cast<sqlite3_int64>(id));
    rc = sqlite3_step(p_delete_record);
    const int changed = sqlite3_changes(db);
    reset(p_delete_record);
    if (rc != SQLITE_DONE) {
        exec("ROLLBACK");
        return false;
    }

    if (!exec("COMMIT")) {
        exec("ROLLBACK");
        return false;
    }
    return changed > 0;
};

// 查询玩家的回放元数据。
bool query_replay(std::string_view player, std::vector<Record>& result) noexcept {
    result.clear();
    if (!db) return false;

    bind_text(p_query_player, 1, player);
    int rc;
    while ((rc = sqlite3_step(p_query_player)) == SQLITE_ROW) {
        Record record;
        record.id        = static_cast<uint64_t>(sqlite3_column_int64(p_query_player, 0));
        record.time      = static_cast<uint64_t>(sqlite3_column_int64(p_query_player, 1));
        record.duration  = static_cast<uint64_t>(sqlite3_column_int64(p_query_player, 2));
        record.mode      = sqlite3_column_int64(p_query_player, 3);
        record.first     = sqlite3_column_int64(p_query_player, 4);
        record.black_hp  = sqlite3_column_int64(p_query_player, 5);
        record.white_hp  = sqlite3_column_int64(p_query_player, 6);
        record.category  = column_text(p_query_player, 7);
        record.player_a   = column_text(p_query_player, 8);
        record.player_b   = column_text(p_query_player, 9);
        record.black_uuid = column_text(p_query_player, 10);
        record.white_uuid = column_text(p_query_player, 11);
        record.black_name = column_text(p_query_player, 12);
        record.white_name = column_text(p_query_player, 13);
        record.result     = column_text(p_query_player, 14);
        result.emplace_back(std::move(record));
    }
    reset(p_query_player);
    return rc == SQLITE_DONE;
};

// 获取玩家有权访问的真实回放字节流。
bool get_replay(uint64_t id, std::string_view player, std::string& result) noexcept {
    result.clear();
    if (!db) return false;

    sqlite3_bind_int64(p_select_data, 1, static_cast<sqlite3_int64>(id));
    bind_text(p_select_data, 2, player);
    int rc = sqlite3_step(p_select_data);
    if (rc != SQLITE_ROW) {
        reset(p_select_data);
        return false;
    }

    const auto* data = sqlite3_column_blob(p_select_data, 0);
    const int size   = sqlite3_column_bytes(p_select_data, 0);
    if (!data || size <= 0) {
        reset(p_select_data);
        return false;
    }
    result.assign(reinterpret_cast<const char*>(data), static_cast<size_t>(size));
    reset(p_select_data);
    return true;
};
// 统计玩家最近 limit 场真实对局的场次与胜利数
bool stats_player(std::string_view player, int64_t limit, int64_t& games, int64_t& wins) noexcept {
    games = 0;
    wins  = 0;
    if (!db || !p_stats_player || player.empty() || limit <= 0) return false;

    bind_text(p_stats_player, 1, player);
    bind_text(p_stats_player, 2, player);
    bind_text(p_stats_player, 3, player);
    sqlite3_bind_int64(p_stats_player, 4, limit);

    const int rc = sqlite3_step(p_stats_player);
    if (rc == SQLITE_ROW) {
        games = sqlite3_column_int64(p_stats_player, 0);
        wins  = sqlite3_column_int64(p_stats_player, 1);
    }
    reset(p_stats_player);
    return rc == SQLITE_ROW;
};

// 读取累计统计：在线总场次 / 总胜场 / AI 总场次
bool stats_total(std::string_view player, int64_t& games, int64_t& wins, int64_t& ai_games) noexcept {
    games    = 0;
    wins     = 0;
    ai_games = 0;
    if (!db || !p_total_player || player.empty()) return false;

    bind_text(p_total_player, 1, player);
    const int rc = sqlite3_step(p_total_player);
    if (rc == SQLITE_ROW) {
        games    = sqlite3_column_int64(p_total_player, 0);
        wins     = sqlite3_column_int64(p_total_player, 1);
        ai_games = sqlite3_column_int64(p_total_player, 2);
    }
    reset(p_total_player);
    return rc == SQLITE_ROW;
};

// AI 对局计数：人机对战结算时调用，累计场次只增不减
bool bump_ai_game(std::string_view player) noexcept {
    if (!db || !p_bump_ai_player || player.empty()) return false;

    bind_text(p_bump_ai_player, 1, player);
    const int rc = sqlite3_step(p_bump_ai_player);
    reset(p_bump_ai_player);
    return rc == SQLITE_DONE;
};
} // namespace Replay
} // namespace Manager
