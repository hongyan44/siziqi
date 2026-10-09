/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Sms
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>


namespace Manager {
namespace Sms {
// 初始化数据库与表结构
void init() noexcept;
// 关闭数据库连接并释放预编译语句
void close() noexcept;

// 创建验证码（fixed_code 非空时使用固定验证码，用于手机号占位）
bool create_sms(std::string_view mail, int64_t time, std::string& code, std::string_view fixed_code = {}) noexcept;
// 验证验证码
bool verify_sms(std::string_view mail, std::string_view code) noexcept;
// 发送验证码
async_simple::coro::Lazy<bool> send_sms(std::string_view mail, std::string_view code, coro_io::ExecutorWrapper<>* executor) noexcept;
} // namespace Sms
} // namespace Manager