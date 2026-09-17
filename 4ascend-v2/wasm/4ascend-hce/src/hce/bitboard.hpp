#pragma once

#include "types.hpp"

#include <cstdint>
#include <cassert>
#include <bit>
#include <concepts>

// PEXT intrinsic (BMI2) — include outside namespace
#if defined(__BMI2__) && defined(__x86_64__)
#include <x86intrin.h>
#endif

// ============================================================================
// BitBoard — 81-cell board packed into two uint64_t values
//
// b[0]: cells 0-63,  b[1]: cells 64-80 (bits 0-16 used)
// ============================================================================

namespace hce {

struct BitBoard {
    uint64_t b[2]{};

    constexpr BitBoard() noexcept : b{0, 0} {}
    constexpr BitBoard(uint64_t lo, uint64_t hi) noexcept : b{lo, hi & 0x1FFFFULL} {}

    [[nodiscard]] constexpr int get(int pos) const noexcept {
        assert(pos >= 0 && pos < BOARD_SIZE);
        if (pos < 64) return (b[0] >> pos) & 1ULL;
        return (b[1] >> (pos - 64)) & 1ULL;
    }

    constexpr void set(int pos) noexcept {
        assert(pos >= 0 && pos < BOARD_SIZE);
        if (pos < 64) b[0] |= (1ULL << pos);
        else          b[1] |= (1ULL << (pos - 64));
    }

    constexpr void clear(int pos) noexcept {
        assert(pos >= 0 && pos < BOARD_SIZE);
        if (pos < 64) b[0] &= ~(1ULL << pos);
        else          b[1] &= ~(1ULL << (pos - 64));
    }

    constexpr void clear_all() noexcept { b[0] = 0; b[1] = 0; }

    [[nodiscard]] constexpr bool empty() const noexcept {
        return (b[0] | b[1]) == 0;
    }

    [[nodiscard]] constexpr int popcount() const noexcept {
        return std::popcount(b[0]) + std::popcount(b[1]);
    }

    [[nodiscard]] constexpr int count() const noexcept { return popcount(); }

    template<typename F>
        requires std::invocable<F, int>
    constexpr void foreach(F&& f) const noexcept {
        uint64_t tmp = b[0];
        while (tmp) {
            int idx = std::countr_zero(tmp);
            f(idx);
            tmp &= tmp - 1;
        }
        tmp = b[1];
        while (tmp) {
            int idx = 64 + std::countr_zero(tmp);
            f(idx);
            tmp &= tmp - 1;
        }
    }

    [[nodiscard]] friend constexpr BitBoard operator|(BitBoard a, BitBoard o) noexcept {
        return { a.b[0] | o.b[0], a.b[1] | o.b[1] };
    }
    [[nodiscard]] friend constexpr BitBoard operator&(BitBoard a, BitBoard o) noexcept {
        return { a.b[0] & o.b[0], a.b[1] & o.b[1] };
    }
    [[nodiscard]] friend constexpr BitBoard operator~(BitBoard a) noexcept {
        return { ~a.b[0], ~a.b[1] & 0x1FFFFULL };
    }
    [[nodiscard]] friend constexpr BitBoard operator^(BitBoard a, BitBoard o) noexcept {
        return { a.b[0] ^ o.b[0], a.b[1] ^ o.b[1] };
    }
    constexpr BitBoard& operator|=(BitBoard o) noexcept {
        b[0] |= o.b[0]; b[1] |= o.b[1]; return *this;
    }
    constexpr BitBoard& operator&=(BitBoard o) noexcept {
        b[0] &= o.b[0]; b[1] &= o.b[1]; return *this;
    }
    [[nodiscard]] constexpr bool operator==(BitBoard o) const noexcept {
        return b[0] == o.b[0] && b[1] == o.b[1];
    }

    [[nodiscard]] constexpr bool intersects(BitBoard o) const noexcept {
        return (b[0] & o.b[0]) | (b[1] & o.b[1]);
    }
    [[nodiscard]] constexpr bool contains(BitBoard o) const noexcept {
        return ((b[0] & o.b[0]) == o.b[0]) && ((b[1] & o.b[1]) == o.b[1]);
    }
};

// ============================================================================
// Pre-computed tables (defined in tables.cpp)
// ============================================================================

struct AttackTables {
    BitBoard line_mask[BOARD_SIZE][NDIRS];
    int      dir_len[BOARD_SIZE][NDIRS][2];
    BitBoard stretch[BOARD_SIZE][NDIRS][5];
};

struct NeighborTables {
    int16_t fwd[BOARD_SIZE][NDIRS][8];
    int16_t bwd[BOARD_SIZE][NDIRS][8];
};

extern NeighborTables G_NB;
extern AttackTables G_AT;
extern int16_t POS_WEIGHT[BOARD_SIZE];

void init_tables() noexcept;

// ============================================================================
// Board-array based consecutive-stone counting (correct for attack detection)
// ============================================================================

[[nodiscard]] inline int count_consecutive(const uint8_t* board, int pos, int dir, uint8_t color) noexcept {
    int cnt = 0;
    int n = G_AT.dir_len[pos][dir][0];
    for (int i = 0; i < n; ++i) {
        int idx = G_NB.fwd[pos][dir][i];
        if (board[static_cast<size_t>(idx)] != color) break;
        ++cnt;
    }
    n = G_AT.dir_len[pos][dir][1];
    for (int i = 0; i < n; ++i) {
        int idx = G_NB.bwd[pos][dir][i];
        if (board[static_cast<size_t>(idx)] != color) break;
        ++cnt;
    }
    return cnt;
}

[[nodiscard]] inline int compute_attack_level(const uint8_t* board, int pos, uint8_t color) noexcept {
    int best = 0;
    for (int d = 0; d < NDIRS; ++d) {
        int cnt = count_consecutive(board, pos, d, color);
        if (cnt >= 3) return 2;
        if (cnt == 2) best = 1;
    }
    return best;
}

[[nodiscard]] inline int attack_dirs_count(const uint8_t* board, int pos, uint8_t color) noexcept {
    int atk = 0;
    for (int d = 0; d < NDIRS; ++d) {
        if (count_consecutive(board, pos, d, color) >= 3) ++atk;
    }
    return atk;
}

[[nodiscard]] inline std::pair<int, int> attack_dirs_both(const uint8_t* board, int pos, uint8_t us_c, uint8_t them_c) noexcept {
    int self_atk = 0, opp_atk = 0;
    for (int d = 0; d < NDIRS; ++d) {
        if (count_consecutive(board, pos, d, us_c) >= 3)   ++self_atk;
        if (count_consecutive(board, pos, d, them_c) >= 3) ++opp_atk;
    }
    return {self_atk, opp_atk};
}

// BitBoard-based attack directions count (pre-filter only — counts ALL stones on line)
[[nodiscard]] inline int attack_dirs_bitboard(const BitBoard& pieces, int pos) noexcept {
    int atk = 0;
    for (int d = 0; d < NDIRS; ++d) {
        if ((G_AT.line_mask[pos][d] & pieces).popcount() >= 3) ++atk;
    }
    return atk;
}

[[nodiscard]] inline bool threat_possible(const BitBoard& pieces, int pos, int dir) noexcept {
    return (G_AT.line_mask[pos][dir] & pieces).popcount() >= 1;
}

// ============================================================================
// V6 PEXT-based line scanning infrastructure
// ============================================================================

// Precomputed line masks and metadata (defined in tables.cpp)
extern uint64_t LINE_MASK_LO[NUM_LINES];  // lo 64 bits of line mask
extern uint64_t LINE_MASK_HI[NUM_LINES];  // hi bits (cells 64-80) of line mask
extern int      LINE_POP_LO[NUM_LINES];   // popcount of lo mask
extern int      LINE_LENGTH[NUM_LINES];   // cells on this line (≤9)
extern int16_t  LINE_ENDPOINTS[NUM_LINES][2]; // first & last cell position (-1=none)
extern bool     LINE_IS_DIAG[NUM_LINES];
extern uint64_t LINE_PAD[NUM_LINES];     // 1s for virtual cells (lines shorter than 9)

// PEXT bit extraction — fallback to scalar if BMI2 unavailable
[[nodiscard]] inline uint64_t pext_bits(uint64_t val, uint64_t mask) noexcept {
#if defined(__BMI2__) && defined(__x86_64__)
    return _pext_u64(val, mask);
#else
    // Fallback: extract bits manually (slow but correct)
    uint64_t res = 0;
    int bit = 0;
    while (mask) {
        int lsb = std::countr_zero(mask);
        mask &= mask - 1;
        res |= ((val >> lsb) & 1ULL) << bit;
        ++bit;
    }
    return res;
#endif
}

// Extract a ≤9-bit pattern for a line from a 2-word bitboard
[[nodiscard]] inline uint64_t pext_line(const uint64_t bb_lo, const uint64_t bb_hi,
                                        int line_idx) noexcept {
    uint64_t lo = pext_bits(bb_lo, LINE_MASK_LO[line_idx]);
    uint64_t hi = pext_bits(bb_hi, LINE_MASK_HI[line_idx]);
    return lo | (hi << LINE_POP_LO[line_idx]);
}

} // namespace hce
