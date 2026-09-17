/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Token
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Token.h"

#include "../Config.h"

#include "../libs/crypto/AES.h"
#include "../libs/crypto/Pad.h"
#include "../libs/crypto/UnPad.h"

#include "../libs/digest/Hmac.h"

#include "../libs/only/Time.h"

#include <cryptopp/osrng.h>

#include <string>


namespace Manager {
namespace Token {
thread_local CryptoPP::AutoSeededX917RNG<CryptoPP::AES> rand;


// 加密
bool encrypt(std::string& inout) noexcept {
    std::string iv;
    iv.resize(16);
    rand.GenerateBlock(reinterpret_cast<unsigned char*>(iv.data()), 16);

    Libs::Crypto::Pad::pkcs7(inout, CryptoPP::AES::BLOCKSIZE);
    Libs::Crypto::AES::encrypt_cbc(inout, TOKEN_KEY, iv, inout);

    std::string hash;
    Libs::Digest::Hmac::md5(inout + iv, TOKEN_SALT, hash);

    inout += std::move(hash);
    inout += std::move(iv);

    return true;
};

// 解密
bool decrypt(std::string& input, std::string& output) noexcept {
    auto total = input.size();
    auto base  = input.data();

    std::string iv     = input.substr(total - 16, 16);
    std::string hmac   = input.substr(total - 32, 16);
    std::string cipher = input.substr(0, total - 32);

    std::string hash;
    Libs::Digest::Hmac::md5(cipher + iv, TOKEN_SALT, hash);
    if (hash != hmac) return false;

    output.resize(cipher.size());
    Libs::Crypto::AES::decrypt_cbc(cipher, TOKEN_KEY, iv, output);
    Libs::Crypto::UnPad::pkcs7(output);

    return true;
};


// 标识得到凭证
bool uuid2token(std::string& uuid, std::string& token) noexcept {
    token.resize(8);

    auto time = Libs::Only::Time::timestamp_ms();
    token[0]  = (char)((time >> 56) & 0xFF);
    token[1]  = (char)((time >> 48) & 0xFF);
    token[2]  = (char)((time >> 40) & 0xFF);
    token[3]  = (char)((time >> 32) & 0xFF);
    token[4]  = (char)((time >> 24) & 0xFF);
    token[5]  = (char)((time >> 16) & 0xFF);
    token[6]  = (char)((time >> 8) & 0xFF);
    token[7]  = (char)((time >> 0) & 0xFF);

    token += uuid.data(); // cp
    if (!encrypt(token)) return false;

    return true;
};

// 标识得到凭证
bool token2uuid(std::string& token, std::string& uuid) noexcept {
    std::string output;
    if (!decrypt(token, output)) return false;

    uint64_t time = ((uint64_t)(uint8_t)output[0] << 56) | ((uint64_t)(uint8_t)output[1] << 48) | ((uint64_t)(uint8_t)output[2] << 40)
                  | ((uint64_t)(uint8_t)output[3] << 32) | ((uint64_t)(uint8_t)output[4] << 24) | ((uint64_t)(uint8_t)output[5] << 16)
                  | ((uint64_t)(uint8_t)output[6] << 8) | ((uint64_t)(uint8_t)output[7] << 0);
    if (time < Libs::Only::Time::timestamp_ms() - TOKEN_EXP) return false;

    uuid = output.substr(8, 36);
    return true;
};

// 续期凭证
bool token2token(std::string& token, std::string& token_) noexcept {
    std::string uuid;
    if (!token2uuid(token, uuid)) return false;

    uuid2token(uuid, token_);
    return true;
};
} // namespace Token
} // namespace Manager