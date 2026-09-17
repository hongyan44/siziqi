#pragma once

#include "board.hpp"

// ============================================================================
// HCE (Hand-Crafted Evaluation) for 4ASCEND Famine
//
// Architecture (V6 Final):
//   Mixed forward pass — line table lookup (scalar) + global features (AVX2)
//
//   score = BIAS
//         + Σ over 20 full-length lines [ LINE_WEIGHT_SELF + LINE_WEIGHT_OPP ]
//         + Σ over 32 global features [ WEIGHT_GLOBAL[k] × feat_global[k] ]
//
//   Training: gen_selfplay_v2 outputs flat line indices (pattern*4+end_type)
//   + 32-dim global feature vector. Python trains Embedding + Linear layers.
// ============================================================================

namespace hce {

// ─── Fast static eval (O(1), ~0.02µs) ──────────────────────────────
// Uses only incremental accumulators + HP_DIFF. No threat scan.
// Suitable for non-leaf pruning (null-move, futility, razoring).
[[nodiscard]] inline int evaluate_fast(const Board& board) noexcept {
    if (board.ended()) {
        int w = board.winner();
        if (w == -2) return 0;
        Player us = board.turn();
        if ((us == Player::WHITE && w == 0) || (us == Player::BLACK && w == 1))
            return +EVAL_INF;
        return -EVAL_INF;
    }

    Player us   = board.turn();
    Player them = opponent(us);

    const auto& acc_us   = board.accum(us);
    const auto& acc_them = board.accum(them);

    int score = 0;
    // A. Base incremental (9 dims)
    score += acc_us.piece_count * EvalWeight::SELF_STONES
           + acc_them.piece_count * EvalWeight::OPP_STONES;
    score += (board.hp(us) - board.hp(them)) * EvalWeight::HP_DIFF;
    score += acc_us.pos_score * EvalWeight::POS_SELF
           + acc_them.pos_score * EvalWeight::POS_OPP;
    score += acc_us.edge_count * EvalWeight::EDGE_SELF
           + acc_them.edge_count * EvalWeight::EDGE_OPP;
    score += acc_us.conn_pairs * EvalWeight::CONN_SELF
           + acc_them.conn_pairs * EvalWeight::CONN_OPP;
    score += EvalWeight::BIAS;  // BIAS = 1 * weight

    return score;
}

// ─── V6 Final evaluation (mixed forward pass) ─────────────────────
// 1. LINE_WEIGHT contribution (scalar, no SIMD)
// 2. Global features (AVX2 dot product, 32-dim)
[[nodiscard]] int evaluate_v6(const Board& board) noexcept;

// ─── Legacy evaluations (keep for backward compat) ─────────────────
// These are still used by main.cpp eval/eval6 commands for comparison.
[[nodiscard]] int evaluate(const Board& board) noexcept;       // V5 36-dim hand-tuned
[[nodiscard]] int evaluate_v51(const Board& board) noexcept;   // V5.1 trained
void extract_features_v5(const Board& board, int16_t* feat) noexcept;

// ─── Global feature extraction for V6 Final ───────────────────────
// Fills feat[32] with:
//   [0-1]   SELF_STONES, OPP_STONES
//   [2]     HP_DIFF
//   [3-4]   ISOLATED_SELF, ISOLATED_OPP
//   [5-6]   POS_SELF, POS_OPP
//   [7-8]   EDGE_SELF, EDGE_OPP
//   [9-10]  CONN_SELF, CONN_OPP
//   [11-12] SELF_M2, OPP_M2 (filtered: end_type < 3 only)
//   [13-14] SELF_M3, OPP_M3 (filtered: end_type < 3 only)
//   [15]    EMPTINESS
//   [16-17] HP_DIFF_NL, TEMPO
//   [18-19] SELF_DEATH_LINE, OPP_DEATH_LINE
//   [20-21] SELF_FORCED_COUNTER, OPP_FORCED_COUNTER
//   [22-23] SELF_BLOODSELL_EV, OPP_BLOODSELL_EV
//   [24]    ATTACK_POS_FIELD
//   [25]    COUNTER_PER_STONE
//   [26]    OFFSET_BONUS
//   [27]    PENALTY_PER_STONE
//   [28]    URGENCY
//   [29-31] RESERVED (feat[31] = 1 for BIAS)
void extract_global_features(const Board& board, int16_t* feat) noexcept;

// ─── Line index computation (for gen_selfplay + C API) ────────────
// Computes flat index = pattern * 4 + end_type for a single line.
// Returns -1 if line length != 9 (not a full-length line).
[[nodiscard]] int compute_line_index(const BitBoard& stones,
                                      const BitBoard& opp_stones,
                                      int line_idx) noexcept;

} // namespace hce
