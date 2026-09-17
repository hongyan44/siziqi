/*** 
 * @Author: CsVeryLoveXieWenLi
 * @Description: 
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>


namespace Libs {
namespace Coder {
namespace Base64 {
// Base64 编码
void encode(std::string_view input, std::string& output) noexcept;
[[nodiscard]] std::string encode(std::string_view input) noexcept;
// Base64 解码
void decode(std::string_view input, std::string& output) noexcept;
[[nodiscard]] std::string decode(std::string_view input) noexcept;
} // namespace Base64
} // namespace Coder
} // namespace Libs