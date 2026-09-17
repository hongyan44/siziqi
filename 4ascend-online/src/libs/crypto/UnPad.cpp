/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: 逆填充
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "UnPad.h"

#include <string>


namespace Libs {
namespace Crypto {
namespace UnPad {
void pkcs7(std::string& message) noexcept {
    auto lengthm = message.size();
    auto p = message[lengthm - 1];
    message.resize(lengthm - p);
}
void zero(std::string& message) noexcept {
    while (message.back() == 0x00) message.pop_back();
}
} // namespace UnPad
} // namespace Crypto
} // namespace Libs