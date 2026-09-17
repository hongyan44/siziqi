/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>


namespace Libs {
namespace Only {
namespace Flie {
void read(std::string_view p, std::string& content) noexcept;
void write(std::string_view p, const std::string& content) noexcept;
} // namespace Flie
} // namespace Only
} // namespace Libs