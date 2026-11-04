/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局关卡管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>


namespace Manager {
namespace Puzzle {
struct Record {
    uint64_t id;
    uint32_t level;
    std::string title;
    std::string description; // 残局描述，可为空，最多 50 字
    std::string code;
    std::string creator;
    uint64_t created_at;
};

struct DailyRecord {
    std::string title;
    std::string description;
    std::string code;
    std::string creator;
    uint64_t updated_at;
};

struct Submission {
    uint64_t id;
    std::string target;   // "daily" or "level"
    uint32_t level;       // 0 for daily, 1..100 for level
    std::string title;
    std::string description;
    std::string code;
    std::string creator;  // uuid
    uint64_t created_at;
    int status;           // 0 pending, 1 approved, 2 rejected
    std::string reviewer;
    uint64_t reviewed_at;
};

void init() noexcept;
void close() noexcept;

bool add_puzzle(uint32_t level, std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept;
bool update_puzzle(uint64_t id, uint32_t level, std::string_view title, std::string_view description, std::string_view code, uint64_t updated_at) noexcept;
bool delete_puzzle(uint64_t id) noexcept;
bool query_puzzles(std::vector<Record>& result) noexcept;
bool query_daily(DailyRecord& result) noexcept;
bool update_daily(std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t updated_at) noexcept;

bool add_submission(std::string_view target, uint32_t level, std::string_view title, std::string_view description, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept;
// 审核前修改待审核投稿（仅 status=0 可改），用于管理员纠正投稿位置/名称/描述/残局码
bool update_submission(uint64_t id, std::string_view target, uint32_t level, std::string_view title, std::string_view description, std::string_view code) noexcept;
bool list_submissions(std::string_view creator, int status_filter, std::vector<Submission>& out) noexcept;
// 审核投稿：通过时发布到目标位置并返回投稿人 uuid，供上层发放投稿奖励
bool review_submission(uint64_t id, bool approve, std::string_view reviewer, uint64_t now, bool allow_overwrite, bool& slot_occupied, std::string& creator) noexcept;

// 残局 AI 战术矫正开关（全局单行设置）：true 表示启用斩杀 / 防自杀矫正
bool query_ai_tactics(bool& enabled) noexcept;
bool update_ai_tactics(bool enabled, uint64_t updated_at) noexcept;

// 记录首次通关：ref 为关卡号或每日残局版本，首次写入返回 true，重复通关返回 false
bool claim_clear(std::string_view uuid, std::string_view target, int64_t ref, uint64_t cleared_at) noexcept;

// 统计玩家已破解的不同残局数量：按 (target, ref) 去重后的首通记录数
bool count_clears(std::string_view uuid, int64_t& count) noexcept;
} // namespace Puzzle
} // namespace Manager
