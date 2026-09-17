/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>


namespace Libs {
namespace Only {
namespace Random {
// UUID
std::string uuid_v4() noexcept;
// UUID
std::string uuid_v7() noexcept;

// 数字
uint32_t uint32(uint32_t min, uint32_t max) noexcept;
// 数字
uint32_t uint32() noexcept;
// 拒绝采样
uint32_t mod(uint32_t n) noexcept;
} // namespace Random
} // namespace Only
} // namespace Libs