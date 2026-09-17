/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>
#include <vector>


namespace Libs {
namespace Only {
namespace String {
void split(std::string_view str, char delimiter, std::vector<std::string>& output) noexcept;
} // namespace String
} // namespace Only
} // namespace Libs