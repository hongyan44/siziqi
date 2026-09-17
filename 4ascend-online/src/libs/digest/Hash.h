/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>


namespace Libs {
namespace Digest {
namespace Hash {
void md5(std::string_view input, std::string& output) noexcept;
void sha1(std::string_view input, std::string& output) noexcept;
void sha224(std::string_view input, std::string& output) noexcept;
void sha256(std::string_view input, std::string& output) noexcept;
void sha384(std::string_view input, std::string& output) noexcept;
void sha512(std::string_view input, std::string& output) noexcept;
} // namespace Hash
} // namespace Digest
} // namespace Libs