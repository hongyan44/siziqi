/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 文档管理（游戏规则 / 使用手册）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>


namespace Manager {
namespace Docs {
struct DocRecord {
    std::string data;
    std::string creator;
    uint64_t updated_at;
};

void init() noexcept;
void close() noexcept;

bool query_doc(std::string_view key, DocRecord& result) noexcept;
bool update_doc(std::string_view key, std::string_view data, std::string_view creator, uint64_t updated_at) noexcept;
} // namespace Docs
} // namespace Manager