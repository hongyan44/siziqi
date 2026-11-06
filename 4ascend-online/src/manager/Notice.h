/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 全服消息管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>


namespace Manager {
namespace Notice {
struct NoticeRecord {
    int64_t id;
    std::string title;
    std::string content;
    std::string creator;
    int64_t created_at;
};

void init() noexcept;
void close() noexcept;

// 读取当前生效的全服消息（无消息时返回 false）
bool query_active(NoticeRecord& result) noexcept;
// 发布全服消息：旧消息自动失效，仅保留最新一条
bool publish(std::string_view title, std::string_view content, std::string_view creator, int64_t created_at) noexcept;
// 清除当前生效的全服消息
bool clear() noexcept;
} // namespace Notice
} // namespace Manager
