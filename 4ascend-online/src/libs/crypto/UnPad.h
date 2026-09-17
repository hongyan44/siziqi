/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>


namespace Libs {
namespace Crypto {
namespace UnPad {
void pkcs7(std::string& message) noexcept;
void zero(std::string& message) noexcept;
} // namespace UnPad
} // namespace Crypto
} // namespace Libs