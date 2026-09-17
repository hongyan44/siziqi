/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Flie.h"

#include <fstream>
#include <iostream>
#include <string>
#include <string_view>


namespace Libs {
namespace Only {
namespace Flie {
void read(std::string_view p, std::string& content) noexcept {
    std::ifstream file(p.data(), std::ios::in | std::ios::binary | std::ios::ate);
    if (!file.is_open()) return;

    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);

    content.resize(size);
    file.read(content.data(), size);
}
void write(std::string_view p, const std::string& content) noexcept {
    std::ofstream file(p.data(), std::ios::out | std::ios::binary | std::ios::trunc);
    if (!file.is_open()) return;

    file.write(content.data(), static_cast<std::streamsize>(content.size()));
}
} // namespace Flie
} // namespace Only
} // namespace Libs