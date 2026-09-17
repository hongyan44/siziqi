/**
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string>
#include <string_view>


namespace Libs {
namespace Crypto {
namespace DES {
// CBC 模式 加密
void encrypt_cbc(std::string_view input, std::string_view key, std::string_view iv, std::string& output) noexcept;
// CBC 模式 解密
void decrypt_cbc(std::string_view input, std::string_view key, std::string_view iv, std::string& output) noexcept;

// ECB 模式 加密
void encrypt_ecb(std::string_view input, std::string_view key, std::string& output) noexcept;
// ECB 模式 解密
void decrypt_ecb(std::string_view input, std::string_view key, std::string& output) noexcept;
} // namespace DES
} // namespace Crypto
} // namespace Libs