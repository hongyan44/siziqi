#pragma once

#include "bitboard.hpp"
#include "types.hpp"

#include <array>
#include <bit>
#include <cstdint>
#include <cstring>
#include <optional>
#include <span>
#include <string>

// ============================================================================
// Game Rules Engine — 4ASCEND Famine
//
// 9×9 board, stone placement, ascension (≥4 in a row), attack/HP mechanic.
// All methods noexcept. Fully constexpr-constructible.
// Uses incremental eval accumulators + incremental Zobrist hash.
// ============================================================================

namespace hce {

// ─── Incremental evaluation accumulator ────────────────────────────
// Cheap to maintain per make_move/unmake_move.
struct EvalAccum {
    int piece_count = 0; // number of stones for this side
    int pos_score   = 0; // sum of POS_WEIGHT[pos]
    int edge_count  = 0;
    int conn_pairs  = 0;
    int isolated    = 0; // isolated stone count

    constexpr void clear() noexcept {
        piece_count = 0;
        pos_score   = 0;
        edge_count  = 0;
        conn_pairs  = 0;
        isolated    = 0;
    }
    constexpr bool operator==(const EvalAccum&) const noexcept = default;
};

// ─── Board undo entry ─────────────────────────────────────────────
// Full state copy for correct unmake. ~168 bytes per entry.
// TODO: Compact to delta-based ~40B for +15-20% NPS (memory bandwidth win).
struct BoardUndo {
    uint8_t   board[BOARD_SIZE];
    BitBoard  white_bb;
    BitBoard  black_bb;
    uint8_t   turn;
    int8_t    hp[2];
    int16_t   move_cnt;
    uint8_t   attack_active;
    int16_t   attack_M;
    uint8_t   attacker;
    uint64_t  attack_bits[2];
    EvalAccum accum[2];
    int16_t   last_move = -1;
};
static_assert(sizeof(BoardUndo) <= 200, "BoardUndo reasonable size");

// ─── Ascension result ──────────────────────────────────────────────
// Fixed-size array avoids heap allocation from std::vector.
struct AscensionResult {
    std::array<int, BOARD_SIZE> cells{}; // cells to remove
    int                         count = 0;

    [[nodiscard]] constexpr bool                 empty() const noexcept { return count == 0; }
    [[nodiscard]] constexpr int                  size() const noexcept { return count; }
    [[nodiscard]] constexpr std::span<const int> span() const noexcept {
        return {cells.data(), static_cast<size_t>(count)};
    }
};

// ─── Board class ───────────────────────────────────────────────────
class Board {
public:
    Board() noexcept;

    // ─── Mutators ──────────────────────────────────────────────────
    [[nodiscard]] bool  step(int pos) noexcept;
    [[nodiscard]] bool  make_move(int pos) noexcept;
    void                unmake_move() noexcept;
    void                reset() noexcept;
    [[nodiscard]] Board clone() const noexcept;

    // ─── Tactical seeding (bypasses make_move, recomputes all state) ─
    // `cells` is array of (pos) with first n/2 as WHITE, rest as BLACK.
    // Fully recomputes hash, accumulators, bitboards from scratch.
    // No attack state, no undo history, cached evals invalidated.
    void load_seed(const int8_t* cells, int n) noexcept;
    void recompute_state() noexcept;

    // ─── Queries ───────────────────────────────────────────────────
    [[nodiscard]] Cell   cell(int pos) const noexcept;
    [[nodiscard]] Player turn() const noexcept { return turn_; }
    [[nodiscard]] int    hp(Player p) const noexcept { return hp_[to_underlying(p)]; }
    [[nodiscard]] int    move_count() const noexcept { return move_cnt_; }
    [[nodiscard]] int    last_move() const noexcept { return last_move_; }
    [[nodiscard]] bool   ended() const noexcept;
    [[nodiscard]] int    winner() const noexcept; // 0=white,1=black,-2=draw,-1=ongoing
    [[nodiscard]] bool   is_full() const noexcept;
    [[nodiscard]] bool   attack_active() const noexcept { return attack_active_; }
    [[nodiscard]] int    attack_M() const noexcept { return attack_M_; }
    [[nodiscard]] Player attacker() const noexcept { return attacker_; }
    [[nodiscard]] bool   is_attack_pos(int p) const noexcept { return atk_pos_bb_.get(p); }

    // ─── Incremental hash ──────────────────────────────────────────
    [[nodiscard]] uint64_t hash() const noexcept;
    void                   invalidate_hash() noexcept { hash_valid_ = false; }

    // ─── Cached fast eval (lazy: computed on demand, cached for reuse) ──
    [[nodiscard]] int  fast_eval() const noexcept;
    [[nodiscard]] bool fast_eval_valid() const noexcept { return cached_fast_valid_; }
    // ─── Cached V6 eval for search (invalidated on make_move) ──
    [[nodiscard]] int full_eval_v6() const noexcept;
    void              invalidate_full_eval() noexcept { cached_full_valid_ = false; }

    // ─── FEN serialization (for test suites) ───────────────────────
    [[nodiscard]] std::string to_fen() const noexcept;
    bool                      load_fen(const char* fen) noexcept;

    // ─── Edge + connectivity helpers ───────────────────────────────
    static constexpr bool is_edge(int pos) noexcept {
        int r = pos / BOARD_DIM, c = pos % BOARD_DIM;
        return r == 0 || r == BOARD_DIM - 1 || c == 0 || c == BOARD_DIM - 1;
    }
    static constexpr int count_adjacent_same(const uint8_t* board, int pos, uint8_t color) noexcept {
        int r = pos / BOARD_DIM, c = pos % BOARD_DIM;
        int count = 0;
        if (r > 0 && board[(r - 1) * BOARD_DIM + c] == color) ++count;
        if (r < BOARD_DIM - 1 && board[(r + 1) * BOARD_DIM + c] == color) ++count;
        if (c > 0 && board[r * BOARD_DIM + (c - 1)] == color) ++count;
        if (c < BOARD_DIM - 1 && board[r * BOARD_DIM + (c + 1)] == color) ++count;
        return count;
    }

    // ─── Incremental eval access ───────────────────────────────────
    [[nodiscard]] const EvalAccum& accum(Player p) const noexcept { return accum_[to_underlying(p)]; }
    [[nodiscard]] const BitBoard&  white_bb() const noexcept { return white_; }
    [[nodiscard]] const BitBoard&  black_bb() const noexcept { return black_; }
    [[nodiscard]] const uint8_t*   raw_board() const noexcept { return board_.data(); }
    [[nodiscard]] const BitBoard&  attack_positions_bb() const noexcept { return atk_pos_bb_; }
    [[nodiscard]] BitBoard         occupancy() const noexcept { return white_ | black_; }
    [[nodiscard]] BitBoard         empties() const noexcept { return ~occupancy(); }

    // ─── Legal move list (stack-filled) ────────────────────────────
    // Returns number of legal moves, filling the output span.
    [[nodiscard]] int legal_moves(std::span<int> out) const noexcept;

    // ─── Ascension detection ───────────────────────────────────────
    [[nodiscard]] AscensionResult detect_ascension(int pos) const noexcept;

    // ─── Quick threat pre-check (board-array based, all 4 directions) ──
    // Returns: 0 = no threat, 1 = near-attack (forms 3), 2 = attack-ready (forms ≥4)
    [[nodiscard]] int threat_level_quick(int pos, uint8_t us_c) const noexcept {
        int near = 0;
        for (int d = 0; d < NDIRS; ++d) {
            int cnt = count_consecutive(board_.data(), pos, d, us_c);
            if (cnt >= 3) return 2; // attack-ready
            if (cnt == 2) near = 1; // near-attack
        }
        return near;
    }


    void set_first(uint8_t first) { turn_ = first == 9 ? Player::BLACK : Player::WHITE; };

private:
    std::array<uint8_t, BOARD_SIZE> board_{}; // 0=EMPTY, 1=WHITE, 2=BLACK
    BitBoard                        white_;
    BitBoard                        black_;
    Player                          turn_          = Player::WHITE;
    int                             hp_[2]         = {MAX_HP, MAX_HP};
    int                             move_cnt_      = 0;
    int                             last_move_     = -1; // most recent move position, -1 = none
    bool                            attack_active_ = false;
    int                             attack_M_      = 0;
    Player                          attacker_      = Player::WHITE;

    // Incremental eval accumulators
    EvalAccum accum_[2];

    // Attack position bitboard
    BitBoard atk_pos_bb_;

    // Cached Zobrist hash
    mutable uint64_t hash_       = 0;
    mutable bool     hash_valid_ = false;

    // Cached fast evaluation (lazy: recomputed on demand)
    mutable int  cached_fast_eval_  = 0;
    mutable bool cached_fast_valid_ = false;
    mutable int  cached_full_eval_  = 0;
    mutable bool cached_full_valid_ = false;

    // Undo stack
    struct UndoEntry {
        BoardUndo state;
        uint64_t  hash;
        int       fast_eval;
        bool      fast_valid;
        int       full_eval;
        bool      full_valid;
    };
    std::array<UndoEntry, MAX_PLY> history_;
    int                            history_top_ = -1;

    // ─── helper: compute threat level for one cell for both sides ────────
    // Returns (self_dirs, opp_dirs) where each is number of ≥4-forming directions
    static std::pair<int, int>
    cell_threat_profile(const uint8_t* board, int pos, uint8_t us_c, uint8_t them_c) noexcept;
};

// ─── Inline implementations ────────────────────────────────────────

inline Cell Board::cell(int pos) const noexcept { return static_cast<Cell>(board_[static_cast<size_t>(pos)]); }

inline bool Board::ended() const noexcept { return hp_[0] <= 0 || hp_[1] <= 0 || is_full(); }

inline bool Board::is_full() const noexcept {
    uint64_t low  = white_.b[0] | black_.b[0];
    uint64_t high = (white_.b[1] | black_.b[1]) & 0x1FFFFULL;
    return (low == ~0ULL) && (high == 0x1FFFFULL);
}

// hash() defined in board.cpp

} // namespace hce
