/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: 摘要
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Hash.h"

#include <cryptopp/hmac.h>
#include <cryptopp/md5.h>
#include <cryptopp/sha.h>


namespace Libs {
namespace Digest {
namespace Hash {
void md5(std::string_view input, std::string& output) noexcept {
    CryptoPP::Weak1::MD5 hash;
    if (output.empty()) output.resize(16);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(16);
}
void sha1(std::string_view input, std::string& output) noexcept {
    CryptoPP::SHA1 hash;
    if (output.empty()) output.resize(20);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(20);
}
void sha224(std::string_view input, std::string& output) noexcept {
    CryptoPP::SHA224 hash;
    if (output.empty()) output.resize(28);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(28);
}
void sha256(std::string_view input, std::string& output) noexcept {
    CryptoPP::SHA256 hash;
    if (output.empty()) output.resize(32);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(32);
}

void sha384(std::string_view input, std::string& output) noexcept {
    CryptoPP::SHA384 hash;
    if (output.empty()) output.resize(48);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(48);
}
void sha512(std::string_view input, std::string& output) noexcept {
    CryptoPP::SHA512 hash;
    if (output.empty()) output.resize(64);
    hash.CalculateDigest((unsigned char*)output.data(), (unsigned char*)input.data(), input.size());
    output.resize(64);
}
} // namespace Hash
} // namespace Digest
} // namespace Libs