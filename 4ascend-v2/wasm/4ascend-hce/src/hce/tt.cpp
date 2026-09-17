// ============================================================================
// Transposition Table — Zobrist hashing + probe/store + XOR-lock concurrency
// ============================================================================

#include "tt.hpp"
#include "evaluate.hpp"

#include <random>
#include <cstring>

namespace hce {

// ============================================================================
// Zobrist tables (module-internal)
// ============================================================================
// External linkage for incremental hash updates in board.cpp
uint64_t zobrist_table[BOARD_SIZE][3]{};
uint64_t zobrist_turn{};
uint64_t zobrist_hp[2][MAX_HP + 1]{};
uint64_t zobrist_attack_active{};
uint64_t zobrist_attack_M[10]{};

namespace {
    bool zobrist_inited = false;
} // anonymous namespace

void init_zobrist() noexcept {
    if (zobrist_inited) return;
    std::mt19937_64 rng(133742069);
    for (int p = 0; p < BOARD_SIZE; ++p)
        for (int c = 0; c < 3; ++c)
            zobrist_table[p][c] = rng();
    zobrist_turn = rng();
    for (int s = 0; s < 2; ++s)
        for (int h = 0; h <= MAX_HP; ++h)
            zobrist_hp[s][h] = rng();
    zobrist_attack_active = rng();
    for (int m = 0; m < 10; ++m)
        zobrist_attack_M[m] = rng();
    zobrist_inited = true;
}

uint64_t compute_hash(const Board& board) noexcept {
    uint64_t h = 0;
    for (int p = 0; p < BOARD_SIZE; ++p) {
        int c = static_cast<int>(board.cell(p));
        h ^= zobrist_table[p][c];
    }
    if (board.turn() == Player::BLACK)
        h ^= zobrist_turn;
    h ^= zobrist_hp[0][static_cast<size_t>(board.hp(Player::WHITE))];
    h ^= zobrist_hp[1][static_cast<size_t>(board.hp(Player::BLACK))];
    if (board.attack_active()) {
        h ^= zobrist_attack_active;
        int M = board.attack_M();
        if (M >= 0 && M < 10) h ^= zobrist_attack_M[static_cast<size_t>(M)];
    }
    return h;
}

// ============================================================================
// TT operations
// ============================================================================

void tt_clear(TTEntry* tt) noexcept {
    std::memset(tt, 0, static_cast<size_t>(TT_SIZE) * sizeof(TTEntry));
}

int tt_probe(TTEntry* tt, uint64_t hash, int depth,
             int alpha, int beta, int& best_move) noexcept
{
    size_t idx = static_cast<size_t>(hash) & static_cast<size_t>(TT_SIZE - 1);
    auto& e = tt[idx];

    uint64_t stored_hash = std::atomic_load_explicit(
        reinterpret_cast<std::atomic<uint64_t>*>(&e.hash_low),
        std::memory_order_acquire);

    if (stored_hash != (hash ^ static_cast<uint64_t>(idx)))
        return EVAL_INF + 1;

    best_move = e.best_move;
    if (e.depth < depth)
        return EVAL_INF + 1;

    if (e.flags == static_cast<uint8_t>(TTFlag::EXACT)) return e.eval;
    if (e.flags == static_cast<uint8_t>(TTFlag::LOWER) && e.eval >= beta)  return e.eval;
    if (e.flags == static_cast<uint8_t>(TTFlag::UPPER) && e.eval <= alpha) return e.eval;
    return EVAL_INF + 1;
}

void tt_store(TTEntry* tt, uint64_t hash, int depth, int eval,
              int flags, int best_move, int age) noexcept
{
    size_t idx = static_cast<size_t>(hash) & static_cast<size_t>(TT_SIZE - 1);
    auto& e = tt[idx];

    uint64_t old_hash = std::atomic_load_explicit(
        reinterpret_cast<std::atomic<uint64_t>*>(&e.hash_low),
        std::memory_order_relaxed);
    if (old_hash == (hash ^ static_cast<uint64_t>(idx)) && e.depth > depth)
        return;

    int clamped_eval = eval;
    if      (clamped_eval >  32700) clamped_eval =  32700;
    else if (clamped_eval < -32700) clamped_eval = -32700;
    int clamped_depth = depth;
    if      (clamped_depth >  127) clamped_depth =  127;
    else if (clamped_depth < -127) clamped_depth = -127;

    e.depth     = static_cast<int8_t>(clamped_depth);
    e.eval      = static_cast<int16_t>(clamped_eval);
    e.flags     = static_cast<uint8_t>(flags);
    e.best_move = static_cast<int16_t>(best_move);
    e.age       = static_cast<int8_t>(age);

    std::atomic_store_explicit(
        reinterpret_cast<std::atomic<uint64_t>*>(&e.hash_low),
        hash ^ static_cast<uint64_t>(idx),
        std::memory_order_release);
}

// ============================================================================
// Move scoring — uses branchless bitboard attack detection
// ============================================================================

int score_move(const Board& board, int move, int tt_best, int ply,
               const int killers[MAX_KILLER_PLIES][2],
               const int history[BOARD_SIZE]) noexcept
{
    if (move == tt_best) return MOVE_SCORE_TT;

    if (board.attack_active() && board.is_attack_pos(move))
        return MOVE_SCORE_COUNTER;

    // Board-array based consecutive attack detection
    int lvl = compute_attack_level(board.raw_board(), move, player_cell(board.turn()));
    if (lvl == 2) return MOVE_SCORE_ATTACK;
    if (lvl == 1) return MOVE_SCORE_NEAR_ATK;

    if (ply < MAX_KILLER_PLIES) {
        if (move == killers[ply][0]) return MOVE_SCORE_KILLER1;
        if (move == killers[ply][1]) return MOVE_SCORE_KILLER2;
    }

    return history[move] + POS_WEIGHT[static_cast<size_t>(move)] / 4;
}

} // namespace hce
