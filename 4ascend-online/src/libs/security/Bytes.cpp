/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Bytes.h"


namespace Libs {
namespace Security {
namespace Bytes {
bool safe_equal(std::string_view a, std::string_view b) noexcept {
    if (a.size() != b.size()) return false;

    volatile uint8_t result = 0;
    for (size_t i = 0; i < a.size(); ++i) result |= static_cast<uint8_t>(a[i]) ^ static_cast<uint8_t>(b[i]);
    return result == 0;
};
} // namespace Bytes
} // namespace Security
} // namespace Libs