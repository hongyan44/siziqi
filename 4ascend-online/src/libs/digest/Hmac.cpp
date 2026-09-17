/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: 加密摘要
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Hmac.h"

#include <cryptopp/hmac.h>
#include <cryptopp/md5.h>
#include <cryptopp/sha.h>


namespace Libs {
namespace Digest {
namespace Hmac {
void md5(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::Weak1::MD5> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(16);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(16);
}
void sha1(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::SHA1> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(20);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(20);
}
void sha224(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::SHA224> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(28);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(28);
}
void sha256(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::SHA256> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(32);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(32);
}
void sha384(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::SHA384> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(48);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(48);
}
void sha512(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::HMAC<CryptoPP::SHA512> hmac((unsigned char*)key.data(), key.size());
    if (output.empty()) output.resize(64);
    hmac.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(64);
}
} // namespace Hmac
} // namespace Digest
} // namespace Libs