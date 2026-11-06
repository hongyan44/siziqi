/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 每日任务管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Task.h"

#include "../libs/db/Sqlite3.h"
#include "../libs/digest/Hash.h"
#include "../libs/only/Random.h"
#include "../libs/only/Time.h"

#include "User.h"

#include <sqlite/sqlite3.h>

#include <algorithm>
#include <array>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>


namespace Manager {
namespace Task {
namespace {
sqlite3* db = nullptr;
sqlite3_stmt* p_select_day    = nullptr;
sqlite3_stmt* p_insert        = nullptr;
sqlite3_stmt* p_select_one    = nullptr;
sqlite3_stmt* p_advance       = nullptr;
sqlite3_stmt* p_insert_draw   = nullptr;
sqlite3_stmt* p_select_draw   = nullptr;
sqlite3_stmt* p_delete_task   = nullptr;
sqlite3_stmt* p_get_refresh   = nullptr;
sqlite3_stmt* p_inc_refresh   = nullptr;
sqlite3_stmt* p_claim         = nullptr;
sqlite3_stmt* p_unclaim       = nullptr;

// 任务定义：多人 6 选 3，单人 4 选 2，投稿任务固定
struct Definition {
    const char* id;
    const char* kind;
    const char* title;
    int64_t target;
    int64_t reward_min;
    int64_t reward_max;
};

constexpr std::array<Definition, 6> MULTI_DEFS = {{
    {"m1", "multi", "进行 1 局排位匹配对战", 1, 50, 70},
    {"m2", "multi", "获得 1 局排位匹配对战的胜利", 1, 100, 150},
    {"m3", "multi", "进行 1 局房间号对战", 1, 50, 70},
    {"m4", "multi", "观战 1 局对战", 1, 50, 70},
    {"m5", "multi", "进行 3 局排位匹配对战", 3, 200, 250},
    {"m6", "multi", "获得 3 局排位匹配对战的胜利", 3, 500, 750},
}};

constexpr std::array<Definition, 4> SINGLE_DEFS = {{
    {"s1", "single", "进行 1 局人机对战", 1, 50, 70},
    {"s2", "single", "获得 1 局人机对战的胜利", 1, 100, 150},
    {"s3", "single", "获得 1 局简单及以上难度人机对战的胜利", 1, 200, 250},
    {"s4", "single", "进行 3 局人机对战", 3, 100, 150},
}};

// 每人每天固定的投稿任务：投稿 1 次（无论是否通过）即完成，奖励固定 300
constexpr Definition PUZZLE_DEF = {"p1", "puzzle", "投稿 1 次残局（无论是否通过）", 1, 300, 300};

// 等级 ≥ 2 才可见的剧情投稿任务：提交 1 次剧情编辑投稿即完成，奖励 700 棋币 + 700 经验
constexpr Definition STORY_DEF = {"t1", "story", "尝试投稿 1 次剧情（无论是否通过）", 1, 700, 700};

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

// 剧情投稿任务仅对权限等级 ≥ 2 的账号可见
bool story_accessible(std::string_view uuid) noexcept {
    int level = 0;
    return !uuid.empty() && Manager::User::get_level(uuid, level) && level >= 2;
}

// 登录账号等级降低后（例如从 2 降回 1），历史记录里可能残留剧情任务，读取时统一过滤
void filter_story(std::string_view uuid, std::vector<TaskRecord>& records) noexcept {
    if (story_accessible(uuid)) return;
    records.erase(
        std::remove_if(records.begin(), records.end(), [](const TaskRecord& record) { return record.kind == "story"; }),
        records.end()
    );
}

// 以 sha256(uuid|day) 为种子的确定性随机：同一账号同一天生成结果恒定，避免并发请求各自生成一套任务
class SeedRandom {
public:
    explicit SeedRandom(const std::string& digest) : bytes_(digest) {}

    uint32_t next(uint32_t bound) noexcept {
        if (bound == 0) return 0;
        const uint32_t limit = 0xFFFFFFFFu - (0xFFFFFFFFu % bound);
        for (;;) {
            uint32_t value = 0;
            for (int index = 0; index < 4; ++index) value = (value << 8) | static_cast<uint8_t>(bytes_[cursor_++ % bytes_.size()]);
            if (value < limit) return value % bound;
        }
    }

private:
    std::string bytes_;
    size_t cursor_ = 0;
};

// 部分 Fisher-Yates 洗牌：取前 count 个即可
template <size_t N>
void shuffle_first(std::array<uint32_t, N>& list, size_t count, SeedRandom& random) noexcept {
    for (size_t index = 0; index < count && index < N; ++index) {
        const uint32_t pick = static_cast<uint32_t>(index + random.next(static_cast<uint32_t>(N - index)));
        std::swap(list[index], list[pick]);
    }
}

std::vector<std::string> event_ids(std::string_view name) noexcept {
    if (name == "ranked_play") return {"m1", "m5"};
    if (name == "ranked_win") return {"m2", "m6"};
    if (name == "room_play") return {"m3"};
    if (name == "spectate") return {"m4"};
    if (name == "ai_play") return {"s1", "s4"};
    if (name == "ai_win") return {"s2"};
    if (name == "ai_win_hard") return {"s3"};
    if (name == "puzzle_submit") return {"p1"};
    if (name == "story_submit") return {"t1"};
    return {};
}

bool select_one(std::string_view uuid, int64_t day, std::string_view id, int64_t& progress, int64_t& target, int64_t& reward, bool& done, bool& claimed) noexcept;

bool select_day(std::string_view uuid, int64_t day, std::vector<TaskRecord>& records) noexcept {
    records.clear();
    if (!db || !p_select_day || uuid.empty()) return false;

    bind_text(p_select_day, 1, uuid);
    sqlite3_bind_int64(p_select_day, 2, static_cast<sqlite3_int64>(day));

    int rc = SQLITE_DONE;
    while ((rc = sqlite3_step(p_select_day)) == SQLITE_ROW) {
        TaskRecord record{};
        record.id       = column_text(p_select_day, 0);
        record.kind     = column_text(p_select_day, 1);
        record.title    = column_text(p_select_day, 2);
        record.target   = sqlite3_column_int64(p_select_day, 3);
        record.progress = sqlite3_column_int64(p_select_day, 4);
        record.reward   = sqlite3_column_int64(p_select_day, 5);
        record.done     = sqlite3_column_int64(p_select_day, 6) != 0;
        record.claimed  = sqlite3_column_int64(p_select_day, 7) != 0;
        records.push_back(record);
    }
    reset(p_select_day);
    return rc == SQLITE_DONE;
}

bool insert_task(std::string_view uuid, int64_t day, const Definition& definition, int64_t reward) noexcept {
    bind_text(p_insert, 1, uuid);
    sqlite3_bind_int64(p_insert, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_insert, 3, definition.id);
    bind_text(p_insert, 4, definition.kind);
    bind_text(p_insert, 5, definition.title);
    sqlite3_bind_int64(p_insert, 6, definition.target);
    sqlite3_bind_int64(p_insert, 7, reward);
    const int rc = sqlite3_step(p_insert);
    reset(p_insert);
    return rc == SQLITE_DONE;
}

// 记录「当天抽到过」的任务，刷新时据此排除，避免把刚换掉的任务又抽回来
bool record_draw(std::string_view uuid, int64_t day, std::string_view id) noexcept {
    if (!db || !p_insert_draw) return false;
    bind_text(p_insert_draw, 1, uuid);
    sqlite3_bind_int64(p_insert_draw, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_insert_draw, 3, id);
    const int rc = sqlite3_step(p_insert_draw);
    reset(p_insert_draw);
    return rc == SQLITE_DONE;
}

std::vector<std::string> drawn_ids(std::string_view uuid, int64_t day) noexcept {
    std::vector<std::string> ids;
    if (!db || !p_select_draw) return ids;

    bind_text(p_select_draw, 1, uuid);
    sqlite3_bind_int64(p_select_draw, 2, static_cast<sqlite3_int64>(day));
    int rc = SQLITE_DONE;
    while ((rc = sqlite3_step(p_select_draw)) == SQLITE_ROW) ids.push_back(column_text(p_select_draw, 0));
    reset(p_select_draw);
    return ids;
}

bool delete_task(std::string_view uuid, int64_t day, std::string_view id) noexcept {
    if (!db || !p_delete_task) return false;
    bind_text(p_delete_task, 1, uuid);
    sqlite3_bind_int64(p_delete_task, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_delete_task, 3, id);
    const int rc      = sqlite3_step(p_delete_task);
    const int changed = sqlite3_changes(db);
    reset(p_delete_task);
    return rc == SQLITE_DONE && changed == 1;
}

int64_t read_refresh_count(std::string_view uuid, int64_t day) noexcept {
    if (!db || !p_get_refresh || uuid.empty()) return 0;

    bind_text(p_get_refresh, 1, uuid);
    sqlite3_bind_int64(p_get_refresh, 2, static_cast<sqlite3_int64>(day));
    int64_t count = 0;
    if (sqlite3_step(p_get_refresh) == SQLITE_ROW) count = sqlite3_column_int64(p_get_refresh, 0);
    reset(p_get_refresh);
    return count;
}

// 回滚领取标记（发奖失败时把任务恢复为待领取，避免奖励丢失）
bool unclaim(std::string_view uuid, int64_t day, std::string_view id) noexcept {
    if (!db || !p_unclaim || uuid.empty()) return false;
    bind_text(p_unclaim, 1, uuid);
    sqlite3_bind_int64(p_unclaim, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_unclaim, 3, id);
    const int rc = sqlite3_step(p_unclaim);
    reset(p_unclaim);
    return rc == SQLITE_DONE;
}

bool inc_refresh(std::string_view uuid, int64_t day) noexcept {
    if (!db || !p_inc_refresh || uuid.empty()) return false;
    bind_text(p_inc_refresh, 1, uuid);
    sqlite3_bind_int64(p_inc_refresh, 2, static_cast<sqlite3_int64>(day));
    const int rc = sqlite3_step(p_inc_refresh);
    reset(p_inc_refresh);
    return rc == SQLITE_DONE;
}

// 当天尚无任务时按规则生成；已有任务直接复用，并补齐投稿任务与抽取记录
bool ensure_day(std::string_view uuid, int64_t day) noexcept {
    if (!db || uuid.empty()) return false;

    std::vector<TaskRecord> existing;
    if (!select_day(uuid, day, existing)) return false;

    if (existing.empty()) {
        std::string seed;
        Libs::Digest::Hash::sha256(std::string(uuid) + "|" + std::to_string(day) + "|4ascend-daily-task", seed);
        SeedRandom random(seed);

        std::array<uint32_t, MULTI_DEFS.size()> multi_index{};
        for (size_t index = 0; index < multi_index.size(); ++index) multi_index[index] = static_cast<uint32_t>(index);
        shuffle_first(multi_index, 3, random);

        std::array<uint32_t, SINGLE_DEFS.size()> single_index{};
        for (size_t index = 0; index < single_index.size(); ++index) single_index[index] = static_cast<uint32_t>(index);
        shuffle_first(single_index, 2, random);

        for (size_t index = 0; index < 3; ++index) {
            const auto& definition = MULTI_DEFS[multi_index[index]];
            const int64_t reward   = definition.reward_min + static_cast<int64_t>(random.next(static_cast<uint32_t>(definition.reward_max - definition.reward_min + 1)));
            if (!insert_task(uuid, day, definition, reward)) return false;
            record_draw(uuid, day, definition.id);
        }
        for (size_t index = 0; index < 2; ++index) {
            const auto& definition = SINGLE_DEFS[single_index[index]];
            const int64_t reward   = definition.reward_min + static_cast<int64_t>(random.next(static_cast<uint32_t>(definition.reward_max - definition.reward_min + 1)));
            if (!insert_task(uuid, day, definition, reward)) return false;
            record_draw(uuid, day, definition.id);
        }
        if (!insert_task(uuid, day, PUZZLE_DEF, PUZZLE_DEF.reward_max)) return false;
        record_draw(uuid, day, PUZZLE_DEF.id);
        // 剧情投稿任务是条件任务：只有权限等级 ≥ 2 的账号才生成
        if (story_accessible(uuid)) {
            if (!insert_task(uuid, day, STORY_DEF, STORY_DEF.reward_max)) return false;
            record_draw(uuid, day, STORY_DEF.id);
        }
        return true;
    }

    // 老数据没有投稿任务：补一条固定投稿任务
    int64_t progress = 0, target = 0, reward = 0;
    bool done        = false;
    bool claimed     = false;
    if (!select_one(uuid, day, PUZZLE_DEF.id, progress, target, reward, done, claimed)) {
        if (!insert_task(uuid, day, PUZZLE_DEF, PUZZLE_DEF.reward_max)) return false;
    }
    // 老数据没有剧情投稿任务：等级 ≥ 2 时补一条
    if (story_accessible(uuid) && !select_one(uuid, day, STORY_DEF.id, progress, target, reward, done, claimed)) {
        if (!insert_task(uuid, day, STORY_DEF, STORY_DEF.reward_max)) return false;
    }
    // 当日任务同步到抽取记录（兼容升级前生成的旧数据）
    for (const auto& record : existing) record_draw(uuid, day, record.id);
    record_draw(uuid, day, PUZZLE_DEF.id);
    if (story_accessible(uuid)) record_draw(uuid, day, STORY_DEF.id);
    return true;
}

bool select_one(std::string_view uuid, int64_t day, std::string_view id, int64_t& progress, int64_t& target, int64_t& reward, bool& done, bool& claimed) noexcept {
    if (!db || !p_select_one || uuid.empty()) return false;

    bind_text(p_select_one, 1, uuid);
    sqlite3_bind_int64(p_select_one, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_select_one, 3, id);

    const int rc = sqlite3_step(p_select_one);
    if (rc == SQLITE_ROW) {
        progress = sqlite3_column_int64(p_select_one, 0);
        done     = sqlite3_column_int64(p_select_one, 1) != 0;
        target   = sqlite3_column_int64(p_select_one, 2);
        reward   = sqlite3_column_int64(p_select_one, 3);
        claimed  = sqlite3_column_int64(p_select_one, 4) != 0;
    }
    reset(p_select_one);
    return rc == SQLITE_ROW;
}

// 原子推进进度：仅对未完成任务 +1，完成时置 done；奖励改由玩家手动领取。
bool advance(std::string_view uuid, int64_t day, std::string_view id) noexcept {
    if (!db || !p_advance || uuid.empty()) return false;

    bind_text(p_advance, 1, uuid);
    sqlite3_bind_int64(p_advance, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_advance, 3, id);

    const int rc      = sqlite3_step(p_advance);
    const int changed = sqlite3_changes(db);
    reset(p_advance);
    return rc == SQLITE_DONE && changed == 1;
}
} // namespace

void init() noexcept {
    Libs::DB::Sqlite3::open("db/task.db", db);
    if (!db) return;

    if (sqlite3_exec(
            db,
            "CREATE TABLE IF NOT EXISTS daily_task ("
            "uuid TEXT NOT NULL, "
            "day INTEGER NOT NULL, "
            "id TEXT NOT NULL, "
            "kind TEXT NOT NULL, "
            "title TEXT NOT NULL, "
            "target INTEGER NOT NULL, "
            "progress INTEGER NOT NULL DEFAULT 0, "
            "reward INTEGER NOT NULL DEFAULT 0, "
            "done INTEGER NOT NULL DEFAULT 0, "
            "claimed INTEGER NOT NULL DEFAULT 0, "
            "PRIMARY KEY (uuid, day, id)"
            ") STRICT",
            nullptr,
            nullptr,
            nullptr
        )
        != SQLITE_OK) {
        close();
        return;
    }

    // 旧库升级：补 claimed 列；历史已完成任务在旧版本已自动发奖，直接标记为已领取，避免重复领取
    if (sqlite3_exec(db, "ALTER TABLE daily_task ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0", nullptr, nullptr, nullptr) == SQLITE_OK) {
        sqlite3_exec(db, "UPDATE daily_task SET claimed = done WHERE done = 1", nullptr, nullptr, nullptr);
    }

    if (sqlite3_exec(
            db,
            "CREATE TABLE IF NOT EXISTS daily_task_draw ("
            "uuid TEXT NOT NULL, "
            "day INTEGER NOT NULL, "
            "id TEXT NOT NULL, "
            "PRIMARY KEY (uuid, day, id)"
            ") STRICT",
            nullptr,
            nullptr,
            nullptr
        )
        != SQLITE_OK) {
        close();
        return;
    }

    if (sqlite3_exec(
            db,
            "CREATE TABLE IF NOT EXISTS daily_task_meta ("
            "uuid TEXT NOT NULL, "
            "day INTEGER NOT NULL, "
            "refresh_count INTEGER NOT NULL DEFAULT 0, "
            "PRIMARY KEY (uuid, day)"
            ") STRICT",
            nullptr,
            nullptr,
            nullptr
        )
        != SQLITE_OK) {
        close();
        return;
    }

    sqlite3_prepare_v2(db, "SELECT id, kind, title, target, progress, reward, done, claimed FROM daily_task WHERE uuid = ?1 AND day = ?2 ORDER BY kind ASC, target ASC, id ASC", -1, &p_select_day, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT OR IGNORE INTO daily_task (uuid, day, id, kind, title, target, progress, reward, done) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, 0)",
        -1,
        &p_insert,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT progress, done, target, reward, claimed FROM daily_task WHERE uuid = ?1 AND day = ?2 AND id = ?3", -1, &p_select_one, nullptr);
    sqlite3_prepare_v2(
        db,
        "UPDATE daily_task SET progress = MIN(target, progress + 1), done = (MIN(target, progress + 1) >= target) "
        "WHERE uuid = ?1 AND day = ?2 AND id = ?3 AND done = 0",
        -1,
        &p_advance,
        nullptr
    );
    sqlite3_prepare_v2(db, "INSERT OR IGNORE INTO daily_task_draw (uuid, day, id) VALUES (?1, ?2, ?3)", -1, &p_insert_draw, nullptr);
    sqlite3_prepare_v2(db, "SELECT id FROM daily_task_draw WHERE uuid = ?1 AND day = ?2", -1, &p_select_draw, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM daily_task WHERE uuid = ?1 AND day = ?2 AND id = ?3 AND done = 0", -1, &p_delete_task, nullptr);
    sqlite3_prepare_v2(db, "SELECT refresh_count FROM daily_task_meta WHERE uuid = ?1 AND day = ?2", -1, &p_get_refresh, nullptr);
    sqlite3_prepare_v2(
        db,
        "INSERT INTO daily_task_meta (uuid, day, refresh_count) VALUES (?1, ?2, 1) "
        "ON CONFLICT (uuid, day) DO UPDATE SET refresh_count = refresh_count + 1",
        -1,
        &p_inc_refresh,
        nullptr
    );
    sqlite3_prepare_v2(
        db,
        "UPDATE daily_task SET claimed = 1 WHERE uuid = ?1 AND day = ?2 AND id = ?3 AND done = 1 AND claimed = 0",
        -1,
        &p_claim,
        nullptr
    );
    sqlite3_prepare_v2(db, "UPDATE daily_task SET claimed = 0 WHERE uuid = ?1 AND day = ?2 AND id = ?3", -1, &p_unclaim, nullptr);
}

void close() noexcept {
    sqlite3_finalize(p_select_day);
    sqlite3_finalize(p_insert);
    sqlite3_finalize(p_select_one);
    sqlite3_finalize(p_advance);
    sqlite3_finalize(p_insert_draw);
    sqlite3_finalize(p_select_draw);
    sqlite3_finalize(p_delete_task);
    sqlite3_finalize(p_get_refresh);
    sqlite3_finalize(p_inc_refresh);
    sqlite3_finalize(p_claim);
    sqlite3_finalize(p_unclaim);
    p_select_day  = nullptr;
    p_insert      = nullptr;
    p_select_one  = nullptr;
    p_advance     = nullptr;
    p_insert_draw = nullptr;
    p_select_draw = nullptr;
    p_delete_task = nullptr;
    p_get_refresh = nullptr;
    p_inc_refresh = nullptr;
    p_claim       = nullptr;
    p_unclaim     = nullptr;
    if (db) sqlite3_close(db);
    db = nullptr;
}

int64_t today() noexcept {
    return (Libs::Only::Time::timestamp_s() + 8 * 3600) / 86400;
}

bool daily_tasks(std::string_view uuid, int64_t day, std::vector<TaskRecord>& records) noexcept {
    if (!ensure_day(uuid, day)) return false;
    if (!select_day(uuid, day, records)) return false;
    filter_story(uuid, records);
    return true;
}

int64_t refresh_count(std::string_view uuid, int64_t day) noexcept {
    return read_refresh_count(uuid, day);
}

RefreshResult refresh(std::string_view uuid, int64_t day, std::string_view task_id, int64_t& cost, int64_t& coin, std::vector<TaskRecord>& records) noexcept {
    cost  = 0;
    coin  = 0;
    records.clear();
    if (!ensure_day(uuid, day)) return RefreshResult::error;

    std::vector<TaskRecord> current;
    if (!select_day(uuid, day, current)) return RefreshResult::error;
    filter_story(uuid, current);

    const int64_t count = read_refresh_count(uuid, day);
    cost                = count >= FREE_REFRESH ? PAID_REFRESH_COST : 0;

    // 只刷新调用方指定的任务：必须是当天存在、未完成且非投稿任务
    const TaskRecord* matched = nullptr;
    for (const auto& record : current) {
        if (record.id == task_id) {
            matched = &record;
            break;
        }
    }
    if (!matched || matched->kind == "puzzle" || matched->kind == "story" || matched->done) return RefreshResult::invalid_task;

    const TaskRecord original = *matched;
    const std::string& kind   = original.kind;

    // 同组「从未抽到过」的候选
    const Definition* defs = kind == "multi" ? MULTI_DEFS.data() : SINGLE_DEFS.data();
    const size_t def_count = kind == "multi" ? MULTI_DEFS.size() : SINGLE_DEFS.size();
    const auto drawn       = drawn_ids(uuid, day);

    std::vector<uint32_t> candidates;
    for (size_t index = 0; index < def_count; ++index) {
        if (std::find(drawn.begin(), drawn.end(), std::string(defs[index].id)) == drawn.end()) candidates.push_back(static_cast<uint32_t>(index));
    }
    if (candidates.empty()) return RefreshResult::no_candidate;

    // 先校验余额再扣费，避免余额不足时白扣（add_coin 会把负数压到 0）
    if (cost > 0) {
        int64_t wallet_coin = 0, wallet_exp = 0;
        if (!Manager::User::get_wallet(uuid, wallet_coin, wallet_exp)) return RefreshResult::error;
        if (wallet_coin < cost) {
            coin = wallet_coin;
            return RefreshResult::no_coin;
        }
    }

    if (!delete_task(uuid, day, original.id)) return RefreshResult::error;

    if (cost > 0 && !Manager::User::add_coin(uuid, -cost)) {
        // 扣费失败时把原任务恢复（进度归零），避免任务凭空消失
        Definition restore{original.id.c_str(), original.kind.c_str(), original.title.c_str(), original.target, original.reward, original.reward};
        insert_task(uuid, day, restore, original.reward);
        return RefreshResult::error;
    }

    const auto& definition = defs[candidates[Libs::Only::Random::mod(static_cast<uint32_t>(candidates.size()))]];
    const int64_t reward   = definition.reward_min + static_cast<int64_t>(Libs::Only::Random::mod(static_cast<uint32_t>(definition.reward_max - definition.reward_min + 1)));
    if (!insert_task(uuid, day, definition, reward)) {
        if (cost > 0) Manager::User::add_coin(uuid, cost);
        return RefreshResult::error;
    }

    record_draw(uuid, day, definition.id);
    if (!inc_refresh(uuid, day)) {
        delete_task(uuid, day, definition.id);
        if (cost > 0) Manager::User::add_coin(uuid, cost);
        return RefreshResult::error;
    }

    int64_t wallet_coin = 0, wallet_exp = 0;
    if (Manager::User::get_wallet(uuid, wallet_coin, wallet_exp)) coin = wallet_coin;
    select_day(uuid, day, records);
    filter_story(uuid, records);
    return RefreshResult::ok;
}

ClaimResult claim(std::string_view uuid, int64_t day, std::string_view task_id, int64_t& reward, int64_t& coin, std::vector<TaskRecord>& records) noexcept {
    reward = 0;
    coin   = 0;
    records.clear();
    if (!ensure_day(uuid, day)) return ClaimResult::error;

    std::vector<TaskRecord> current;
    if (!select_day(uuid, day, current)) return ClaimResult::error;
    filter_story(uuid, current);

    // 只有已完成且未领取的任务可以领奖
    const TaskRecord* matched = nullptr;
    for (const auto& record : current) {
        if (record.id == task_id) {
            matched = &record;
            break;
        }
    }
    if (!matched || !matched->done || matched->claimed) return ClaimResult::invalid_task;

    reward = matched->reward;

    // 原子置位：并发重复领取时只有第一个请求能改动成功
    bind_text(p_claim, 1, uuid);
    sqlite3_bind_int64(p_claim, 2, static_cast<sqlite3_int64>(day));
    bind_text(p_claim, 3, task_id);
    const int rc      = sqlite3_step(p_claim);
    const int changed = sqlite3_changes(db);
    reset(p_claim);
    if (rc != SQLITE_DONE) return ClaimResult::error;
    if (changed != 1) return ClaimResult::invalid_task;

    // 奖励：棋币与等额经验；发币失败则回滚领取标记
    if (!Manager::User::add_coin(uuid, reward)) {
        unclaim(uuid, day, task_id);
        return ClaimResult::error;
    }
    Manager::User::add_exp(uuid, reward);

    int64_t wallet_coin = 0, wallet_exp = 0;
    if (Manager::User::get_wallet(uuid, wallet_coin, wallet_exp)) coin = wallet_coin;
    select_day(uuid, day, records);
    filter_story(uuid, records);
    return ClaimResult::ok;
}

int64_t event(std::string_view uuid, std::string_view name, int64_t day) noexcept {
    // 剧情投稿任务只对等级 ≥ 2 的账号生效
    if (name == "story_submit" && !story_accessible(uuid)) return 0;
    const auto ids = event_ids(name);
    if (uuid.empty() || ids.empty()) return 0;
    if (!ensure_day(uuid, day)) return 0;

    // 只推进进度，奖励不自动发放，需玩家在每日任务面板手动领取
    for (const auto& id : ids) advance(uuid, day, id);
    return 0;
}
} // namespace Task
} // namespace Manager
