/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "String.h"

#include <string>
#include <vector>


namespace Libs {
namespace Only {
namespace String {
void split(std::string_view str, char delimiter, std::vector<std::string>& output) noexcept {
    size_t start = 0;
    size_t end = str.find(delimiter);

    output.reserve(20);

    while (end != std::string_view::npos) {
        output.emplace_back(str.substr(start, end - start));
        start = end + 1;
        end = str.find(delimiter, start);
    }

    output.emplace_back(str.substr(start));
}
} // namespace String
} // namespace Only
} // namespace Libs