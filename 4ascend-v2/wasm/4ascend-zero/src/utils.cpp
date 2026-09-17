/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "utils.h"

#include <algorithm>
#include <cmath>
#include <cstddef>


void ATK::parse(std::vector<uint8_t>& a, std::vector<uint8_t>& b, bool plant) noexcept {
    if (plant) {
        std::ranges::sort(a, std::greater<uint8_t>());
        std::ranges::sort(b, std::greater<uint8_t>());
    } else {
        for (size_t index = 0; index < a.size(); ++index) a[index] = 1;
        for (size_t index = 0; index < b.size(); ++index) b[index] = 1;
    }

    while (!a.empty() && !b.empty()) {
        uint8_t d = std::min(a[0], b[0]);

        a[0] -= d;
        b[0] -= d;

        if (a[0] <= 0) a.erase(a.begin());
        if (b[0] <= 0) b.erase(b.begin());
    }
};


float AIC::mmx(float minnum, float thenum, float maxnum) { return std::max(minnum, std::min(thenum, maxnum)); };

float AIC::zsin(float num, float _mx) {
    if (num <= 0.0f) return 0.0f;
    if (num < _mx) return AIC::sin(AIC::mmx(0.0f, num / _mx, 1.0f) * 0.5f * 3.1415927f);
    return 1.0f;
};

float AIC::sin(float x) {
    if (x != 0.0f) return AIC::cos(x - 1.5707964f);
    return 0.0f;
};

float AIC::cos(float x) {
    float num = 1.0f;

    if (x < 0.0f) x = -x;

    // 折叠到 [0, 2π) 区间
    // 精确复刻 JS 的 Math.fround 嵌套：拆分为单精度分步计算
    float const_factor = 0.31830987f * 0.5f;
    float prod1        = x * const_factor;
    float fl           = std::floor(prod1); // C++ 中 std::floor(float) 返回 float
    float prod2        = fl * 6.2831855f;
    x                  = x - prod2;

    if (x >= 3.1415927f) x = 6.2831855f - x;

    if (x >= 1.5707964f) {
        x   = 3.1415927f - x;
        num = -1.0f;
    }

    if (x > 0.7853982f) {
        x          = 1.5707964f - x;
        float num2 = x * x;

        // 泰勒展开计算并严格采用单精度
        float term1 = num2 * 0.16666667f;
        float sq2   = num2 * num2;
        float term2 = sq2 * 0.008333334f;
        float inner = 1.0f - term1 + term2;
        float res   = x * inner;
        return res * num;
    }

    float num3 = x * x;

    // 泰勒展开计算并严格采用单精度
    float part1 = 1.0f - (num3 * 0.5f);
    float sq3   = num3 * num3;
    float part2 = sq3 * 0.041666668f;
    float part3 = (sq3 * num3) * 0.0013888889f;
    float res   = part1 + part2 - part3;
    return res * num;
};