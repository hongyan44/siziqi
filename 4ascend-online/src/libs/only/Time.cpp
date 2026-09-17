/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Time.h"

#include <chrono>


namespace Libs {
namespace Only {
namespace Time {
// 毫秒级时间戳
int64_t timestamp_ms() noexcept {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
}
// 秒级时间戳
int64_t timestamp_s() noexcept {
    return std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count();
}
} // namespace Time
} // namespace Only
} // namespace Libs