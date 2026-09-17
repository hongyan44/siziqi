#pragma once

#include <cstdint>
#include <cstddef>
#include <type_traits>
#include <utility>

// ============================================================================
// HCE Engine — Unified Fundamental Types
// ============================================================================
//
// Centralizes all type definitions, constants, and enums shared across
// the engine. C++23 features used:
//   - std::to_underlying  → enum→int conversion
//   - std::unreachable    → unreachable path annotation
//   - std::mdspan         → 2D board view (C++23)
//   - constexpr everything → compile-time table init
// ============================================================================

namespace hce {

// ─── Board geometry ────────────────────────────────────────────────
inline constexpr int BOARD_SIZE = 81;    // 9×9
inline constexpr int BOARD_DIM  = 9;     // rows & columns
inline constexpr int MAX_HP     = 6;     // starting HP per player
inline constexpr int MAX_PLY    = 256;   // must be > MAX_DEPTH (128) to absorb attack extensions

// ─── Threat tracking constants ─────────────────────────────────────
inline constexpr int MAX_REMOVED = 16;    // max ascension-removed stones per move
inline constexpr int AFFECTED_LINE_CELLS = 36; // max cells per line through a position
inline constexpr int LMR_TABLE_SIZE = 64; // LMR reduction table dimension

// ─── Cell / Player enums ───────────────────────────────────────────
enum class Cell : uint8_t { EMPTY = 0, WHITE = 1, BLACK = 2 };

enum class Player : uint8_t { WHITE = 0, BLACK = 1 };

// ─── Direction indices (0..3) ──────────────────────────────────────
// right, down, diag-down-right, diag-up-right
inline constexpr int NDIRS = 4;
inline constexpr int DIR_RIGHT = 0;
inline constexpr int DIR_DOWN  = 1;
inline constexpr int DIR_DDR   = 2;  // down-diagonal (row+1, col+1)
inline constexpr int DIR_DUR   = 3;  // up-diagonal   (row-1, col+1)

// Direction vectors (dr, dc) for each direction index
inline constexpr int DR[NDIRS] = { 0, 1, 1,  1 };
inline constexpr int DC[NDIRS] = { 1, 0, 1, -1 };

// ─── Color utilities ───────────────────────────────────────────────
constexpr uint8_t cell_to_uint(Cell c) noexcept {
    return static_cast<uint8_t>(c);
}

constexpr Player opponent(Player p) noexcept {
    return (p == Player::WHITE) ? Player::BLACK : Player::WHITE;
}

constexpr uint8_t player_cell(Player p) noexcept {
    return (p == Player::WHITE)
        ? static_cast<uint8_t>(Cell::WHITE)
        : static_cast<uint8_t>(Cell::BLACK);
}

// ─── Square geometry helpers ───────────────────────────────────────
constexpr int sq(int r, int c) noexcept { return r * BOARD_DIM + c; }
constexpr int row(int p)  noexcept { return p / BOARD_DIM; }
constexpr int col(int p)  noexcept { return p % BOARD_DIM; }

// ─── Eval infrastructure ──────────────────────────────────────────
inline constexpr int EVAL_INF = 100000;

// V5 clean features: 36 dims (removed EMPTIES, merged HP into HP_DIFF, added BIAS)
// Derived from V4 tuned weights (2026-05) with mathematical transformation:
//   SELF' = SELF - EMPTIES,  OPP' = OPP - EMPTIES
//   HP_DIFF = (HP_SELF - HP_DEFICIT + (-HP_OPP - HP_DEFICIT)) / 2
//   BIAS = 81 * EMPTIES → absorbs empty-board baseline
//   Empty board evaluates to 0 (all stone-related features = 0)
// V5 training constants
inline constexpr int CPP_SCALE = 2000;  // V5 weight scaling factor
inline constexpr int NF = 36;            // V5 feature count

namespace EvalWeight {
    // A. Base incremental (9 dims)
    inline constexpr int SELF_STONES        = -15;     // 31 - 46 (EMPTIES offset)
    inline constexpr int OPP_STONES         = -393;    // -347 - 46
    inline constexpr int HP_DIFF            = 419;     // (313 + 525)/2
    inline constexpr int POS_SELF           = 6;
    inline constexpr int POS_OPP            = 1;
    inline constexpr int EDGE_SELF          = -79;
    inline constexpr int EDGE_OPP           = 87;
    inline constexpr int CONN_SELF          = 102;
    inline constexpr int CONN_OPP           = -85;
    inline constexpr int BIAS               = 0;       // absorbs 81*46=3726 baseline

    // B. Non-incremental (2 dims)
    inline constexpr int ISOLATED_SELF      = -93;
    inline constexpr int ISOLATED_OPP       = 86;

    // C. M-buckets 2~10+ (16 dims)
    inline constexpr int SELF_M2            = -163;
    inline constexpr int SELF_M3            = 10;
    inline constexpr int SELF_M4            = 279;
    inline constexpr int SELF_M5            = 348;
    inline constexpr int SELF_M6            = 422;
    inline constexpr int SELF_M7            = 499;
    inline constexpr int SELF_M8_9          = 701;
    inline constexpr int SELF_M10PLUS       = 1000;
    inline constexpr int OPP_M2             = 126;
    inline constexpr int OPP_M3             = -54;
    inline constexpr int OPP_M4             = -289;
    inline constexpr int OPP_M5             = -390;
    inline constexpr int OPP_M6             = -522;
    inline constexpr int OPP_M7             = -599;
    inline constexpr int OPP_M8_9           = -801;
    inline constexpr int OPP_M10PLUS        = -1200;

    // D. Structure (3 dims)
    inline constexpr int FORK               = 563;
    inline constexpr int OPP_FORK           = -846;
    inline constexpr int BLOCK_ONE          = 112;

    // E. Attack state (5 dims)
    inline constexpr int ATTACK_POS_FIELD   = -360;
    inline constexpr int COUNTER_PER_STONE  = 1828;
    inline constexpr int OFFSET_BONUS       = 327;
    inline constexpr int PENALTY_PER_STONE  = 2444;
    inline constexpr int HP_URGENCY_FACTOR  = 280;

    // Used by evaluate_fast for attack-state evaluation
    inline constexpr int ATTACK_READY       = 200;
}

// Feature index enum (36 dims, V5 format)
enum class Feature : int {
    SELF_STONES = 0, OPP_STONES, HP_DIFF,
    POS_SELF, POS_OPP, EDGE_SELF, EDGE_OPP, CONN_SELF, CONN_OPP, BIAS,
    ISOLATED_SELF, ISOLATED_OPP,
    SELF_M2, SELF_M3, SELF_M4, SELF_M5, SELF_M6, SELF_M7, SELF_M8_9, SELF_M10PLUS,
    OPP_M2, OPP_M3, OPP_M4, OPP_M5, OPP_M6, OPP_M7, OPP_M8_9, OPP_M10PLUS,
    SELF_FORK, OPP_FORK, BLOCK_ONE,
    ATTACK_POS_FIELD, COUNTER_PER_STONE, OFFSET_BONUS, PENALTY_PER_STONE,
    HP_URGENCY_FACTOR,
    TOTAL_COUNT
};
inline constexpr int NUM_FEATURES = static_cast<int>(Feature::TOTAL_COUNT);
static_assert(NUM_FEATURES == 36, "V5 must have exactly 36 features");

// V5 data record: (NF-1)=35 int32 + 2 float = 148 bytes
// Features[0..34]=int32, Features[35]=urgency(float), result(float)
inline constexpr uint32_t HCE_MAGIC   = 0x48434554;  // "HCET"
inline constexpr uint32_t HCE_VERSION = 6;            // V5 data format
inline constexpr uint32_t HCE_RSIZE   = (NUM_FEATURES - 1) * 4 + 8;  // 148

// ─── TT constants ─────────────────────────────────────────────────
inline constexpr int TT_SIZE_BITS = 19;  // 2^19 = 524,288 entries (~8MB, fits L3)
inline constexpr int TT_SIZE = 1 << TT_SIZE_BITS;  // 262,144 entries

enum class TTFlag : uint8_t { EXACT = 0, LOWER = 1, UPPER = 2 };

// Move ordering scores
inline constexpr int MOVE_SCORE_TT         = 1000000;
inline constexpr int MOVE_SCORE_COUNTER    = 900000;
inline constexpr int MOVE_SCORE_ATTACK     = 800000;
inline constexpr int MOVE_SCORE_SELL_BLOOD = 750000;
inline constexpr int MOVE_SCORE_KILLER1    = 700000;
inline constexpr int MOVE_SCORE_KILLER2    = 600000;
inline constexpr int MOVE_SCORE_NEAR_ATK   = 500000;

inline constexpr int MAX_KILLER_PLIES = 64;
inline constexpr int HISTORY_MAX      = 1000000;

// ─── V6 constants (legacy 64-dim, to be deprecated) ──────────────
inline constexpr int V6_NF = 64;             // V6 feature count
inline constexpr int V6_CPP_SCALE = 2000;     // weight scaling factor
inline constexpr uint32_t V6_MAGIC   = 0x48434556;  // "HCEV"
inline constexpr uint32_t V6_VERSION = 7;            // V6 data format
inline constexpr uint32_t V6_RSIZE   = V6_NF * 2 + 4; // 64×int16 + float result = 132

// ─── V6 Final constants (mixed architecture: line table + global features) ─
inline constexpr int V6F_LINE_COUNT = 20;             // full-length lines (9 rows + 9 cols + 2 main diags)
inline constexpr int V6F_SELF_OFF = 0;                // self line_idx[20] in training record
inline constexpr int V6F_OPP_OFF = V6F_LINE_COUNT;    // opp line_idx[20] in training record
inline constexpr int V6F_GLOBAL_NF = 32;              // global feature dimension
inline constexpr int V6F_TOTAL_FEAT = V6F_LINE_COUNT * 2 + V6F_GLOBAL_NF;
inline constexpr int V6F_RSIZE = V6F_LINE_COUNT * 2 * 2 + V6F_GLOBAL_NF * 2 + 4; // 148 bytes
inline constexpr uint32_t V6F_MAGIC = 0x4A5C6F7E;
inline constexpr uint32_t V6F_VERSION = 8;

// Line scan constants (for PEXT-based evaluation)
inline constexpr int NUM_ROWS = 9;
inline constexpr int NUM_COLS = 9;
inline constexpr int NUM_DIAGS = 17;           // each ↘ and ↙ direction
inline constexpr int NUM_LINES = NUM_ROWS + NUM_COLS + NUM_DIAGS * 2;  // 52

// ─── C++23 forward compatibility ──────────────────────────────────
// std::to_underlying (C++23) or polyfill
#if defined(__cpp_lib_to_underlying) && __cpp_lib_to_underlying >= 202102L
using std::to_underlying;
#else
template<typename E>
constexpr auto to_underlying(E e) noexcept {
    return static_cast<std::underlying_type_t<E>>(e);
}
#endif

// ─── V5 trained evaluation weights ──────────────────────────────
// Used by evaluate_v5(). Computed as W_cpp[i] = round(w[i] * CPP_SCALE / std[i])
// where w[i] is the float weight learned on normalized features.
// V5_BIAS absorbs the Z-Score normalization constant internally:
//   score = V5_BIAS + sum(feat[i] * V5_WEIGHTS[i])
//         = CPP_SCALE * sum((feat[i] - mean[i]) / std[i] * w[i])
} // namespace hce
