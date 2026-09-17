/**
 * @Author: CsVeryLoveXieWenLi
 * @Description: 随机数据
 * @Copyright (c) 2025 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Random.h"

#include <cryptopp/osrng.h>

#include <cstdint>
#include <random>
#include <string>


namespace Libs {
namespace Only {
namespace Random {
thread_local CryptoPP::AutoSeededX917RNG<CryptoPP::AES> rand;

std::string hexs = "0123456789abcdef";


// 数字
uint32_t uint32(uint32_t min, uint32_t max) noexcept {
    uint32_t r;
    rand.GenerateBlock(reinterpret_cast<CryptoPP::byte*>(&r), sizeof(r));
    return min + (r % (max - min + 1));
};

uint32_t uint32() noexcept {
    uint32_t r;
    rand.GenerateBlock(reinterpret_cast<CryptoPP::byte*>(&r), sizeof(r));
    return r;
};


// 拒绝采样
uint32_t mod(uint32_t n) noexcept {
    if (n == 0) return 0; // 防止除以 0 导致崩溃

    // uint32_t 的最大值是 4294967295 (即 0xFFFFFFFF)
    uint32_t max_uint32 = 0xFFFFFFFF;

    // 计算出 n 的最大完整倍数
    // 比如：如果 n = 5，零头是 4294967295 % 5 = 0
    // 如果 n = 7，零头是 4294967295 % 7 = 3，那么 limit = 4294967295 - 3 = 4294967292
    uint32_t limit = max_uint32 - (max_uint32 % n);

    uint32_t num;
    do {
        num = uint32(); // 产生一个完整的 32 位无符号整数
    } while (num > limit); // 拒绝掉那些落在“零头”区间（大于 limit）的数

    // 此时的 num 落在 [0, limit] 之间，这个区间长度刚好是 n 的整数倍
    return num % n;
};


// UUID V4
std::string uuid_v4() noexcept {
    // xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);

    std::string output;
    output.reserve(36);

    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];

    output += '-';

    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];

    output += '-';

    output += '4';
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];

    output += '-';

    // output += number(97, 98); // a b
    output += 97;
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];

    output += '-';

    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];
    output += hexs[dis(gen)];

    return output;
};

// UUID V7
std::string uuid_v7() noexcept {
    // 获取 48 位毫秒时间戳
    auto now    = std::chrono::system_clock::now();
    uint64_t ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

    // 随机字段
    uint64_t rand_a;
    rand.GenerateBlock(reinterpret_cast<CryptoPP::byte*>(&rand_a), sizeof(rand_a));
    uint64_t rand_b;
    rand.GenerateBlock(reinterpret_cast<CryptoPP::byte*>(&rand_b), sizeof(rand_b));

    // 构建 UUID 字段
    uint64_t high = (ms << 16) | (0x7000) | (rand_a & 0x0FFF);
    uint64_t low  = (0x8000000000000000ULL) | (rand_b & 0x3FFFFFFFFFFFFFFFULL);

    // 格式化
    char uuid[37];
    snprintf(
        uuid,
        sizeof(uuid),
        "%08llx-%04llx-%04llx-%04llx-%012llx",
        (high >> 32) & 0xFFFFFFFFULL,
        (high >> 16) & 0xFFFFULL,
        high & 0xFFFFULL,
        (low >> 48) & 0xFFFFULL,
        low & 0xFFFFFFFFFFFFULL
    );

    return std::string(uuid);
};
} // namespace Random
} // namespace Only
} // namespace Libs
