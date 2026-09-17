/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Ranked
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Ranked.h"

#include "User.h"

#include "../libs/db/Sqlite3.h"
#include "../libs/only/Random.h"

#include <sqlite/sqlite3.h>


namespace Manager {
namespace Ranked {
sqlite3* db = nullptr;

sqlite3_stmt* p_add_score    = nullptr;
sqlite3_stmt* p_sub_score    = nullptr;
sqlite3_stmt* p_get_score    = nullptr;
sqlite3_stmt* p_update_score = nullptr;
sqlite3_stmt* p_get_all      = nullptr;
sqlite3_stmt* p_insert       = nullptr;


// 初始化
void init() noexcept {
    // 打开数据库
    Libs::DB::Sqlite3::open("db/ranked.db", db);

    // 没有表则创建
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS ranked (uuid TEXT UNIQUE NOT NULL, score INTEGER NOT NULL) STRICT",
        nullptr,
        nullptr,
        nullptr
    );

    // 预编译：直接在原有分数上增加 (如果不存在，可以用 INSERT OR IGNORE 配合 UPDATE，这里假设用户已存在)
    sqlite3_prepare_v2(db, "UPDATE ranked SET score = score + ? WHERE uuid = ?", -1, &p_add_score, nullptr);

    // 预编译：直接在原有分数上减少
    sqlite3_prepare_v2(db, "UPDATE ranked SET score = score - ? WHERE uuid = ?", -1, &p_sub_score, nullptr);

    // 预编译：获取当前分数
    sqlite3_prepare_v2(db, "SELECT score FROM ranked WHERE uuid = ?", -1, &p_get_score, nullptr);

    // 预编译：直接覆盖修改分数
    sqlite3_prepare_v2(db, "UPDATE ranked SET score = ? WHERE uuid = ?", -1, &p_update_score, nullptr);

    // 查询所有
    sqlite3_prepare_v2(db, "SELECT uuid, score FROM ranked", -1, &p_get_all, nullptr);

    // 没有则插入
    sqlite3_prepare_v2(db, "INSERT OR IGNORE INTO ranked (uuid, score) VALUES (?, ?)", -1, &p_insert, nullptr);
};

// 关闭
void close() noexcept {
    sqlite3_finalize(p_add_score);
    sqlite3_finalize(p_sub_score);
    sqlite3_finalize(p_get_score);
    sqlite3_finalize(p_update_score);
    sqlite3_finalize(p_get_all);
    sqlite3_finalize(p_insert);

    sqlite3_close(db);
    db = nullptr;
};


// 增加分数
bool add_score(std::string_view uuid, int64_t score) noexcept {
    sqlite3_bind_int64(p_add_score, 1, score);
    sqlite3_bind_text(p_add_score, 2, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_add_score);
    sqlite3_reset(p_add_score);
    if (rc != SQLITE_DONE) return false;

    return true;
};

// 减少分数
bool sub_score(std::string_view uuid, int64_t score) noexcept {
    sqlite3_bind_int64(p_sub_score, 1, score);
    sqlite3_bind_text(p_sub_score, 2, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_sub_score);
    sqlite3_reset(p_sub_score);
    if (rc != SQLITE_DONE) return false;

    return true;
};

// 获取当前分数
bool get_score(std::string_view uuid, int64_t& score) noexcept {
    sqlite3_bind_text(p_get_score, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_get_score);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_get_score);
        return false;
    }

    score = sqlite3_column_int64(p_get_score, 0);

    sqlite3_reset(p_get_score);
    return true;
};

// 直接覆盖修改分数
bool update_score(std::string_view uuid, int64_t score) noexcept {
    sqlite3_bind_int64(p_update_score, 1, score);
    sqlite3_bind_text(p_update_score, 2, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_update_score);
    sqlite3_reset(p_update_score);
    if (rc != SQLITE_DONE) return false;

    return true;
};


// 插入新用户
bool insert_score(std::string_view uuid, int64_t score) noexcept {
    sqlite3_bind_text(p_insert, 1, uuid.data(), uuid.size(), nullptr);
    sqlite3_bind_int64(p_insert, 2, score);

    int rc = sqlite3_step(p_insert);
    sqlite3_reset(p_insert);

    if (rc != SQLITE_DONE) return false;
    return true;
};

// 查询所有
bool get_all(std::vector<std::string>& names, std::vector<std::string>& uuids, std::vector<int64_t>& scores) noexcept {
    // 清空传入的容器（可选，根据你的业务逻辑决定是否保留旧数据）
    names.clear();
    scores.clear();
    uuids.clear();

    while (sqlite3_step(p_get_all) == SQLITE_ROW) {
        std::string uuid = reinterpret_cast<const char*>(sqlite3_column_text(p_get_all, 0));
        int64_t score    = sqlite3_column_int64(p_get_all, 1);

        std::string name;
        User::name_user(uuid, name);

        names.emplace_back(std::move(name));
        scores.emplace_back(score);
        uuids.emplace_back(std::move(uuid));
    }

    // 重置状态
    sqlite3_reset(p_get_all);
    return true;
};


void endgame(int64_t& score_a, int64_t& score_b, const std::string& result_status, std::string winner) noexcept {
    // 基础配置
    const int K_FACTOR     = 32;                             // Elo 权重系数
    const int FLEE_PENALTY = 2 + Libs::Only::Random::mod(3); // 逃跑的额外惩罚分数 || 拒绝采样以公平随机 0-10

    double actual_score_a = 0.0;
    double actual_score_b = 0.0;
    int penalty_a         = 0;
    int penalty_b         = 0;

    // ==========================================
    // 1. 逃跑仲裁逻辑（当没有明确胜者时，非逃跑方躺赢）
    // ==========================================
    if (winner == "none" || winner.empty()) {
        if (result_status == "A") winner = "B";      // A 逃跑，B 自动判定为赢家
        else if (result_status == "B") winner = "A"; // B 逃跑，A 自动判定为赢家
    }

    // ==========================================
    // 2. 纯粹的胜负结果赋值
    // ==========================================
    if (winner == "A") {
        actual_score_a = 1.0;
        actual_score_b = 0.0;
    } else if (winner == "B") {
        actual_score_a = 0.0;
        actual_score_b = 1.0;
    } else {
        // 依然没有人胜利（比如正常打平 "Draw"，或者既没胜者也没人逃跑）
        actual_score_a = 0.5;
        actual_score_b = 0.5;
    }

    // ==========================================
    // 3. 独立计算逃跑惩罚（赢的一方逃跑不做处理，输家/平局逃跑扣分）
    // ==========================================
    if (actual_score_a < 1.0 && result_status == "A") penalty_a = FLEE_PENALTY;
    if (actual_score_b < 1.0 && result_status == "B") penalty_b = FLEE_PENALTY;

    // 4. 数学公式：计算 A 和 B 的胜率期望值
    double expected_score_a = 1.0 / (1.0 + std::pow(10.0, (score_b - score_a) / 400.0));
    double expected_score_b = 1.0 / (1.0 + std::pow(10.0, (score_a - score_b) / 400.0));

    // 5. 计算常规积分变动
    int delta_a = static_cast<int>(std::round(K_FACTOR * (actual_score_a - expected_score_a)));
    int delta_b = static_cast<int>(std::round(K_FACTOR * (actual_score_b - expected_score_b)));

    // 6. 应用积分变动与逃跑惩罚
    // score_a = score_a + delta_a - penalty_a;
    // score_b = score_b + delta_b - penalty_b;

    // 6. 应用积分变动与逃跑惩罚（减少扣分，加分不动）
    const double LOSE_PROTECTION_FACTOR = 0.77 + (Libs::Only::Random::mod(24) / 100.0); // 1.0 ~ 0.77

    // 处理 A 的积分变动
    if (delta_a > 0) {
        // 正常加分，不作任何缩减
        score_a = score_a + delta_a - penalty_a;
    } else if (delta_a < 0) {
        // 扣分阶段：乘以缓冲系数，减少扣分量
        int reduced_loss_a = static_cast<int>(std::round(delta_a * LOSE_PROTECTION_FACTOR));
        score_a            = score_a + reduced_loss_a - penalty_a;
    } else {
        score_a = score_a - penalty_a;
    }

    // 处理 B 的积分变动
    if (delta_b > 0) {
        // 正常加分，不作任何缩减
        score_b = score_b + delta_b - penalty_b;
    } else if (delta_b < 0) {
        // 扣分阶段：乘以缓冲系数，减少扣分量
        int reduced_loss_b = static_cast<int>(std::round(delta_b * LOSE_PROTECTION_FACTOR));
        score_b            = score_b + reduced_loss_b - penalty_b;
    } else {
        score_b = score_b - penalty_b;
    }

    // 7. 兜底条款：积分最低不得低于 0
    if (score_a < 0) score_a = 0;
    if (score_b < 0) score_b = 0;
};
} // namespace Ranked
} // namespace Manager