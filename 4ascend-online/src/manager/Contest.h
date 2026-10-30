/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事签表管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>


namespace Manager {
namespace Contest {
struct BracketRecord {
    std::string data;
    std::string creator;
    uint64_t updated_at;
};

struct RulesRecord {
    std::string data;
    std::string creator;
    uint64_t updated_at;
};

struct SignupRecord {
    std::string data;
    std::string creator;
    uint64_t updated_at;
};

void init() noexcept;
void close() noexcept;

bool query_bracket(BracketRecord& result) noexcept;
bool update_bracket(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept;

bool query_rules(RulesRecord& result) noexcept;
bool update_rules(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept;

bool query_signup(SignupRecord& result) noexcept;
bool update_signup(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept;

// 冠军奖励领取标记：同一决赛方块只允许领取一次（首次插入返回 true，重复返回 false）
bool claim_champion_voucher(std::string_view node_id) noexcept;
} // namespace Contest
} // namespace Manager
