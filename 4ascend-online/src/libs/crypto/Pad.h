/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>


namespace Libs {
namespace Crypto {
namespace Pad {
void pkcs7(std::string& message, size_t block_size) noexcept;
void zero(std::string& message, size_t block_size) noexcept;
} // namespace Pad
} // namespace Crypto
} // namespace Libs