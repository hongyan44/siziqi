#pragma once

#include "board.hpp"

#include <atomic>
#include <cstring>
#include <random>

// ============================================================================
// Lock-Free Transposition Table + Zobrist Hashing
//
// Uses the XOR-lock pattern: store hash_low LAST (release),
// read hash_low FIRST (acquire).  256K entries (5MB, fits L3).
//
// Phase 3 will pack to 16 bytes and add multi-bucket age-based replacement.
// ============================================================================

namespace hce {

// ─── TT entry ──────────────────────────────────────────────────────
struct TTEntry {
    uint64_t hash_low;   // Zobrist hash XOR'd with index (acts as key)
    int16_t  eval;       // evaluation in centipawns
    int16_t  best_move;  // best move position (-1 = none)
    int8_t   depth;      // search depth
    uint8_t  flags;      // TTFlag: EXACT / LOWER / UPPER
    int8_t   age;        // for future age-based replacement
};
// TTEntry is 16 bytes on x86-64 GCC (8+2+2+1+1+1 padded to 16).
// Phase 3 will pack to 16 bytes with intentional layout.
static_assert(sizeof(TTEntry) <= 20, "TTEntry size sanity");

// ─── Zobrist hashing ──────────────────────────────────────────────
// 3 hash tables initialized once.
// Zobrist tables (extern linkage — used for incremental hash updates in board.cpp)
extern uint64_t zobrist_table[BOARD_SIZE][3];
extern uint64_t zobrist_turn;
extern uint64_t zobrist_hp[2][MAX_HP + 1];
extern uint64_t zobrist_attack_active;   // XOR'd when attack state is active
extern uint64_t zobrist_attack_M[10];    // one per attack size M (0-9)

void   init_zobrist() noexcept;
uint64_t compute_hash(const Board& board) noexcept;

// ─── TT operations ────────────────────────────────────────────────
void   tt_clear(TTEntry* tt) noexcept;
int    tt_probe(TTEntry* tt, uint64_t hash, int depth,
                int alpha, int beta, int& best_move) noexcept;
void   tt_store(TTEntry* tt, uint64_t hash, int depth, int eval,
                int flags, int best_move, int age) noexcept;

// ─── Move scoring ─────────────────────────────────────────────────
int score_move(const Board& board, int move, int tt_best, int ply,
               const int killers[MAX_KILLER_PLIES][2],
               const int history[BOARD_SIZE]) noexcept;

} // namespace hce
