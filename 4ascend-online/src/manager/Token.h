/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Token
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "Token.h"

#include <string>


namespace Manager {
namespace Token {
// 标识得到凭证
bool uuid2token(std::string& uuid, std::string& token) noexcept;
// 标识得到凭证
bool token2uuid(std::string& token, std::string& uuid) noexcept;
// 续期凭证
bool token2token(std::string& token, std::string& token_) noexcept;
} // namespace Token
} // namespace Manager