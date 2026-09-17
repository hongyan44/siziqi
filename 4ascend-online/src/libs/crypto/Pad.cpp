/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: 填充
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Pad.h"

#include <string>


namespace Libs {
namespace Crypto {
namespace Pad {
void pkcs7(std::string& message, size_t block_size) noexcept {
    auto p = block_size - (message.size() % block_size);
    // message += std::string(p, p);
    message.append(p, static_cast<char>(p));
}
void zero(std::string& message, size_t block_size) noexcept {
    auto p = block_size - (message.size() % block_size);
    if (p == 0) return;
    // message += std::string(p, 0x00);
    message.append(p, 0x00);
}
} // namespace Pad
} // namespace Crypto
} // namespace Libs