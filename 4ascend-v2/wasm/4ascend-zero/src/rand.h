/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <vector>


class RandAIC {
public:
    explicit RandAIC(uint32_t seed);
    ~RandAIC();

    // RandAIC(const RandAIC&)            = delete;
    // RandAIC& operator=(const RandAIC&) = delete;
    // RandAIC(RandAIC&&)                 = delete;
    // RandAIC& operator=(RandAIC&&)      = delete;

    [[nodiscard]] uint32_t next() noexcept;
    [[nodiscard]] uint32_t xorr(uint32_t n) noexcept;

private:
    uint32_t states[4];
};


class RandUinty {
public:
    explicit RandUinty(uint32_t seed);
    ~RandUinty();

    // RandUinty(const RandUinty&)            = delete;
    // RandUinty& operator=(const RandUinty&) = delete;
    // RandUinty(RandUinty&&)                 = delete;
    // RandUinty& operator=(RandUinty&&)      = delete;

    [[nodiscard]] uint32_t next() noexcept;
    [[nodiscard]] uint32_t ins(uint32_t min, uint32_t max) noexcept;

    template <typename T>
    void shuffle(std::vector<T>& array) noexcept {
        const size_t length = array.size();
        if (length <= 1) return;

        const size_t num = (length - 1) * 23;

        for (size_t ptr = 0; ptr < num; ptr++) {
            const size_t num2 = this->ins(0, static_cast<uint32_t>(length));
            const size_t num3 = this->ins(0, static_cast<uint32_t>(length));
            const size_t num4 = num2;
            const size_t num5 = num3;

            const T a1 = array[num3];
            const T a2 = array[num2];

            array[num4] = a1;
            array[num5] = a2;
        }
    };

private:
    uint32_t states[4];
};


class RandMcts {
public:
    using result_type = uint32_t;
    static constexpr result_type min() { return 0; };
    static constexpr result_type max() { return UINT32_MAX; };

    explicit RandMcts(uint64_t seed = 0x853c49e6748fea9bULL);

    result_type operator()();

    std::vector<float> dirichlet(float alpha, int n);

private:
    uint64_t state_;

    static constexpr uint64_t increment_ = 1442695040888963407ULL;
};