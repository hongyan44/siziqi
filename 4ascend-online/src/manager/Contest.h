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

void init() noexcept;
void close() noexcept;

bool query_bracket(BracketRecord& result) noexcept;
bool update_bracket(std::string_view data, std::string_view creator, uint64_t updated_at) noexcept;
} // namespace Contest
} // namespace Manager
