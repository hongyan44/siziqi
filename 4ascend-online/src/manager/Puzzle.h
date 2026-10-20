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
    std::string code;
    std::string creator;
    uint64_t created_at;
};

struct DailyRecord {
    std::string title;
    std::string code;
    std::string creator;
    uint64_t updated_at;
};

struct Submission {
    uint64_t id;
    std::string target;   // "daily" or "level"
    uint32_t level;       // 0 for daily, 1..100 for level
    std::string title;
    std::string code;
    std::string creator;  // uuid
    uint64_t created_at;
    int status;           // 0 pending, 1 approved, 2 rejected
    std::string reviewer;
    uint64_t reviewed_at;
};

void init() noexcept;
void close() noexcept;

bool add_puzzle(uint32_t level, std::string_view title, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept;
bool update_puzzle(uint64_t id, uint32_t level, std::string_view title, std::string_view code, uint64_t updated_at) noexcept;
bool delete_puzzle(uint64_t id) noexcept;
bool query_puzzles(std::vector<Record>& result) noexcept;
bool query_daily(DailyRecord& result) noexcept;
bool update_daily(std::string_view title, std::string_view code, std::string_view creator, uint64_t updated_at) noexcept;

bool add_submission(std::string_view target, uint32_t level, std::string_view title, std::string_view code, std::string_view creator, uint64_t created_at, uint64_t& id) noexcept;
bool list_submissions(std::string_view creator, int status_filter, std::vector<Submission>& out) noexcept;
bool review_submission(uint64_t id, bool approve, std::string_view reviewer, uint64_t now, bool allow_overwrite, bool& slot_occupied) noexcept;
} // namespace Puzzle
} // namespace Manager
