/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: AES
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "AES.h"

#include <cryptopp/aes.h>
#include <cryptopp/modes.h>


namespace Libs {
namespace Crypto {
namespace AES {
// CBC 模式 加密
void encrypt_cbc(std::string_view input, std::string_view key, std::string_view iv, std::string& output) noexcept {
    CryptoPP::CBC_Mode<CryptoPP::AES>::Encryption cipher((unsigned char*)key.data(), key.size(), (unsigned char*)iv.data());
    auto lengthi = input.size();
    output.resize(lengthi);
    cipher.ProcessData((unsigned char*)output.data(), (unsigned char*)input.data(), lengthi);
};
// CBC 模式 解密
void decrypt_cbc(std::string_view input, std::string_view key, std::string_view iv, std::string& output) noexcept {
    CryptoPP::CBC_Mode<CryptoPP::AES>::Decryption cipher((unsigned char*)key.data(), key.size(), (unsigned char*)iv.data());
    auto lengthi = input.size();
    output.resize(lengthi);
    cipher.ProcessData((unsigned char*)output.data(), (unsigned char*)input.data(), lengthi);
};

// ECB 模式 加密
void encrypt_ecb(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::ECB_Mode<CryptoPP::AES>::Encryption cipher((unsigned char*)key.data(), key.size());
    auto lengthi = input.size();
    output.resize(lengthi);
    cipher.ProcessData((unsigned char*)output.data(), (unsigned char*)input.data(), lengthi);
};
// ECB 模式 解密
void decrypt_ecb(std::string_view input, std::string_view key, std::string& output) noexcept {
    CryptoPP::ECB_Mode<CryptoPP::AES>::Decryption cipher((unsigned char*)key.data(), key.size());
    auto lengthi = input.size();
    output.resize(lengthi);
    cipher.ProcessData((unsigned char*)output.data(), (unsigned char*)input.data(), lengthi);
};
} // namespace AES
} // namespace Crypto
} // namespace Libs