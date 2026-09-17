/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "rand.h"

#include <random>


RandAIC::RandAIC(uint32_t seed) {
    states[0] = seed;
    states[1] = seed + 123456789U;
    states[2] = seed + 362436069U;
    states[3] = seed + 521288629U;

    // 分布预热
    for (int i = 0; i < 132; ++i) (void)next();
};
RandAIC::~RandAIC() = default;

uint32_t RandAIC::next() noexcept {
    const uint32_t num = states[0] ^ (states[0] << 11U);

    states[0] = states[1];
    states[1] = states[2];
    states[2] = states[3];
    states[3] = states[3] ^ (states[3] >> 19U) ^ num ^ (num >> 8U);

    // printf("seed: %u\n", states[3]);
    return states[3];
};

uint32_t RandAIC::xorr(uint32_t n) noexcept {
    if (n == 0) return 0;
    return next() % n;
};


RandUinty::RandUinty(uint32_t seed) {
    states[0] = seed;
    states[1] = states[0] * 1812433253U + 1U;
    states[2] = states[1] * 1812433253U + 1U;
    states[3] = states[2] * 1812433253U + 1U;
};
RandUinty::~RandUinty() = default;

uint32_t RandUinty::next() noexcept {
    const uint32_t num = states[0] ^ (states[0] << 11U);

    states[0] = states[1];
    states[1] = states[2];
    states[2] = states[3];

    states[3] = states[3] ^ (states[3] >> 19U) ^ num ^ (num >> 8U);

    // printf("seed: %u\n", states[3]);
    return states[3];
};

uint32_t RandUinty::ins(uint32_t min, uint32_t max) noexcept {
    uint32_t dif;

    if (min < max) {
        dif         = max - min;
        uint32_t t  = this->next() % dif;
        t          += min;
        return t;

    } else if (min > max) {
        dif        = min - max;
        uint32_t t = this->next() % dif;
        t          = min - t;
        return t;

    } else {
        return min;
    }
};


RandMcts::RandMcts(uint64_t seed) {
    state_ = seed + increment_;
    // *this();  // 注意：这里调用了operator()，但构造函数中调用成员函数是安全的
};

RandMcts::result_type RandMcts::operator()() {
    uint64_t oldstate   = state_;
    state_              = oldstate * 6364136223846793005ULL + increment_;
    uint32_t xorshifted = static_cast<uint32_t>(((oldstate >> 18u) ^ oldstate) >> 27u);
    uint32_t rot        = static_cast<uint32_t>(oldstate >> 59u);
    return (xorshifted >> rot) | (xorshifted << ((-rot) & 31));
};

std::vector<float> RandMcts::dirichlet(float alpha, int n) {
    std::gamma_distribution<float> gamma(alpha, 1.0f);
    std::vector<float>             samples(n);
    float                          sum = 0.0f;
    for (int i = 0; i < n; ++i) {
        samples[i]  = gamma(*this); // 使用 PCG 引擎
        sum        += samples[i];
    }
    float inv = 1.0f / sum;
    for (float& v : samples) v *= inv;
    return samples;
};