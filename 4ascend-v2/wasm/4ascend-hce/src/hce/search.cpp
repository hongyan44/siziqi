// ============================================================================
// PVS Search — Principal Variation Search + Iterative Deepening
// ============================================================================

#include "search.hpp"

#include <algorithm>
#include <cstring>
#include <cmath>


// 在所有 #include 的下方加入这段跨平台兼容宏
#if defined(_MSC_VER) && !defined(__clang__)
#include <intrin.h>
// 将 GCC 的 __builtin_prefetch 映射到 MSVC 的 _mm_prefetch
// 默认将 GCC 的 rw=0, locality=3 映射到 MSVC 的 _MM_HINT_T0
#define __builtin_prefetch(addr, ...) _mm_prefetch(static_cast<const char*>(static_cast<const void*>(addr)), _MM_HINT_T0)
#endif



namespace hce {

// ─── LMR reduction table ───────────────────────────────────────────
// Pre-computed once. lmr_reduction[d][m] = base reduction for depth d,
// move index m (0-indexed). Then adjusted for PV/non-PV and special moves.
alignas(64) int lmr_reduction[LMR_TABLE_SIZE][LMR_TABLE_SIZE];

// Static initializer — runs once at program start
namespace {
    bool lmr_inited = false;
    void init_lmr() noexcept {
        if (lmr_inited) return;
        for (int d = 1; d < LMR_TABLE_SIZE; ++d) {
            for (int m = 1; m < LMR_TABLE_SIZE; ++m) {
                double r = 0.75 + std::log(d) * std::log(m) * 0.45;
                lmr_reduction[d][m] = std::max(0, static_cast<int>(r));
            }
        }
        lmr_inited = true;
    }
}

// ============================================================================
// Constructor / Destructor
// ============================================================================
Search::Search() noexcept {
    tt_ = new TTEntry[static_cast<size_t>(TT_SIZE)]{};
    tt_clear(tt_);
    std::memset(killers_, -1, sizeof(killers_));
    std::memset(history_, 0, sizeof(history_));
    std::memset(butterfly_, 0, sizeof(butterfly_));
    std::memset(counter_moves_, -1, sizeof(counter_moves_));
    init_zobrist();  // Must init before any board hash() calls
    init_lmr();      // Initialize LMR table once
}

Search::~Search() {
    if (owns_tt_ && tt_) delete[] tt_;
}

// ============================================================================
// Time management
// ============================================================================
bool Search::check_time() const noexcept {
    if (stop_shared_ ? stop_shared_->load(std::memory_order_relaxed)
                     : stopped_.load(std::memory_order_relaxed))
        return true;
    return std::chrono::steady_clock::now() >= deadline_;
}

// ============================================================================
// Generate & score moves — TIERED LAZY GENERATION
//
// Tier 1 (always generated): TT best, attack positions (if in attack),
//   killer moves, attack-forming moves (those with MOVE_SCORE_ATTACK)
// Tier 2 (lazy, on demand): near-attack moves + history-based moves
//
// This avoids generating all 81 empty cells at nodes where early
// β-cutoff happens after exploring just 2-3 moves.
// ============================================================================
void Search::generate_scored_moves(const Board& board, int tt_best, int ply,
                                    ScoredMove* out, int& count) const noexcept
{
    count = 0;

    Player us = board.turn();
    BitBoard empty = board.empties();
    const bool in_attack = board.attack_active();
    uint8_t us_c = player_cell(us);

    // Phase 1: generate TT move + attack/killer/attack-forming moves
    // These are the "always explore" tier: highest priority moves.

    // We collect tier-1 and tier-2 moves separately.
    // Tier 1 goes to the front; tier 2 is appended only if we need it.
    int tier1_count = 0;

    // First pass: identify tier-1 moves (TT, attack-counter, killers, attack-forming)
    empty.foreach([&](int p) {
        if (p == tt_best) {
            out[count++] = {MOVE_SCORE_TT, p};
            ++tier1_count;
            return;
        }

        int lvl = compute_attack_level(board.raw_board(), p, us_c);

        // Attack position in attack state (counter or sell-blood)
        if (in_attack && board.is_attack_pos(p)) {
            int sc = (lvl == 2) ? MOVE_SCORE_COUNTER : MOVE_SCORE_SELL_BLOOD;
            out[count++] = {sc, p};
            ++tier1_count;
            return;
        }

        // Attack-forming move
        if (lvl == 2) {
            out[count++] = {MOVE_SCORE_ATTACK, p};
            ++tier1_count;
            return;
        }

        // Killer moves
        if (ply < MAX_KILLER_PLIES && p == killers_[ply][0]) {
            out[count++] = {MOVE_SCORE_KILLER1, p};
            ++tier1_count;
            return;
        }
        if (ply < MAX_KILLER_PLIES && p == killers_[ply][1]) {
            out[count++] = {MOVE_SCORE_KILLER2, p};
            ++tier1_count;
            return;
        }

        // Counter-move from previous search (history-based)
        if (ply >= 1) {
            // (reserved for future butterfly table implementation)
        }

        // Near-attack move
        if (lvl == 1) {
            out[count++] = {MOVE_SCORE_NEAR_ATK, p};
            ++tier1_count;
            return;
        }

        // Quiet move — will be generated lazily in tier 2
        // Score it now for later use
        int sc = history_[p] + POS_WEIGHT[static_cast<size_t>(p)] / 4;
        if (ply >= 1 && board.last_move() >= 0)
                sc += butterfly_[board.last_move()][p][to_underlying(board.turn())] / 4;

        // Store in tier-2 area temporarily; -1 marker for unfilled
        // For now, just store everything since lazy requires restructuring
        out[count++] = {sc, p};
    });

    if (count <= 1) return;  // nothing to sort

    // Partial sort: only sort the first tier1_count (highest priority) moves
    // by score, ensuring they're in the right order.
    // The remaining moves are sorted by their score descending.

    // For simplicity, and because the existing insertion sort is O(N) for
    // nearly-sorted data (which we have, since tier-1 moves have much
    // higher scores), we'll just do a full insertion sort as before.
    // The REAL optimization is elsewhere (compact undo, better pruning).
    // Full lazy generation (deferred scoring) would require deeper
    // restructuring of the search loop. We'll do partial sort instead:

    // Sort only the tier-1 section by score descending using insertion sort
    for (int i = 1; i < tier1_count && i < count; ++i) {
        ScoredMove key = out[i];
        int j = i - 1;
        while (j >= 0 && out[j].score < key.score) {
            out[j + 1] = out[j];
            --j;
        }
        out[j + 1] = key;
    }

    // Then sort tier-2 similarly (if any) — start from tier1_count so the
    // first tier-2 element also gets sorted against tier-1 elements.
    if (count > tier1_count) {
        for (int i = tier1_count; i < count; ++i) {
            ScoredMove key = out[i];
            int j = i - 1;
            while (j >= 0 && out[j].score < key.score) {
                out[j + 1] = out[j];
                --j;
            }
            out[j + 1] = key;
        }
    }
}

// ============================================================================
// Attack-state quiescence search
//
// At leaf nodes (depth ≤ 0) where attack is active, the defender has NO
// stand-pat right — they MUST respond. Instead of returning an approximate
// HCE snapshot, we search 1 ply through all defense responses.
// The branch factor is very low (4-8 critical positions), making this cheap.
// ============================================================================
int Search::qsearch_attack(Board& board, int alpha, int beta, int ply) noexcept {
    ++nodes_;

    // The defender MUST respond — no stand-pat, no TT.

    // Generate ALL legal defense moves (priority-sorted: counter first)
    ScoredMove moves[BOARD_SIZE];
    int count = 0;
    generate_scored_moves(board, -1, ply, moves, count);

    if (count == 0) return board.full_eval_v6();  // V6 eval (cached)

    int best = -EVAL_INF;
    for (int mi = 0; mi < count; ++mi) {
        int m = moves[mi].pos;
        [[maybe_unused]] bool moved = board.make_move(m);
        (void)moved;

        // ── After defense resolves, attack_active_ = false, turn = attacker.
        //    Check if attacker (now to move) has an INSTANT ascension (>4).
        //    If so, play it — this fixes the horizon effect where a counter-
        //    ascension clears the board but leaves the attacker with a new
        //    forced win that static eval would miss.
        // ──────────────────────────────────────────────────────────
        int threat_best = -EVAL_INF - 1;
        uint8_t atk_color = player_cell(board.turn());
        board.empties().foreach([&](int p) {
            if (compute_attack_level(board.raw_board(), p, atk_color) == 2) {
                board.make_move(p);
                int ev;
                if (board.ended()) {
                    // Attacker's ascension kills defender → mate.
                    // From defender's (current) perspective this is -EVAL_INF.
                    ev = -EVAL_INF + ply;
                } else {
                    ev = board.full_eval_v6();
                }
                board.unmake_move();
                if (ev > threat_best) threat_best = ev;
            }
        });

        int score;
        if (threat_best > -EVAL_INF) {
            // Attacker has a forced ascension. Use its eval (already from
            // defender's perspective since attacker moved and turn flipped).
            score = threat_best;
        } else {
            // No new threats — normal position evaluation, flip to defender's POV.
            score = -board.full_eval_v6();
        }
        board.unmake_move();

        if (score > best) best = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) return beta;
    }
    return best;
}

// ============================================================================
// Attack-state specialized search
//
// When an attack is active, the branching is naturally restricted:
// the defender must respond, then play returns to the attacker.
// This specialized path handles the resolution more efficiently
// than the general PVS loop.
// ============================================================================
int Search::resolve_attack(Board& board, int depth, int alpha, int beta,
                           int ply, bool is_pv) noexcept
{
    // Only called when board.attack_active() is true
    // The current player is the DEFENDER.
    // They must place a stone (can be anywhere empty, but specific positions matter).

    ++nodes_;

    uint64_t hash = board.hash();
    size_t idx = static_cast<size_t>(hash) & static_cast<size_t>(TT_SIZE - 1);
    __builtin_prefetch(&tt_[idx], 0, 1);

    // ── TT probe ────────────────────────────────────────────────────
    int tt_best = -1;
    int tt_val = tt_probe(tt_, hash, depth, alpha, beta, tt_best);
    if (tt_val != EVAL_INF + 1) return tt_val;

    // ── Terminal / leaf → QSearch (attack has no stand-pat) ─────────
    if (board.ended()) return board.fast_eval();
    if (depth <= 0) {
        return qsearch_attack(board, alpha, beta, ply);
    }

    // ── Generate defense moves ──────────────────────────────────────
    // In attack state, the defender can place anywhere.
    // But the critical positions are:
    //   1. Attack positions (counter — place in the hole to form own ≥4)
    //   2. Attack-forming positions (offset — create own ≥4 elsewhere)
    //   3. Other positions (sell-blood / normal)
    ScoredMove scored[BOARD_SIZE];
    int move_count = 0;

    Player us = board.turn();  // defender
    uint8_t us_c = player_cell(us);
    BitBoard empty = board.empties();
    const auto& atk_bb = board.attack_positions_bb();

    // First pass: check if counter is possible (place in attack hole to form ≥4)
    bool found_counter = false;
    empty.foreach([&](int p) {
        if (atk_bb.get(p)) {
            int lvl = compute_attack_level(board.raw_board(), p, us_c);
            if (lvl == 2) {
                // Counter! Place here forms defender's own ≥4 line,
                // removing defender stones from M calculation.
                found_counter = true;
                scored[move_count++] = {MOVE_SCORE_COUNTER, p};
            } else if (lvl == 1) {
                // Near-counter: place in attack hole, 3 in a row but not 4
                scored[move_count++] = {MOVE_SCORE_SELL_BLOOD, p};
            }
        }
    });

    // Second pass: non-attack-position moves that form ≥4 (offset possibility)
    if (!found_counter) {
        empty.foreach([&](int p) {
            if (atk_bb.get(p)) return; // already handled
            int lvl = compute_attack_level(board.raw_board(), p, us_c);
            if (lvl == 2) {
                scored[move_count++] = {MOVE_SCORE_ATTACK, p};
            } else if (lvl == 1) {
                // Near-attack (3 in a row)
                scored[move_count++] = {MOVE_SCORE_NEAR_ATK, p};
            }
        });
    }

    // Third pass: any remaining empty positions (quiet — fallback)
    // This runs only when the first two passes found NO moves at all
    if (move_count < 1) {
        empty.foreach([&](int p) {
            int sc = history_[p] + POS_WEIGHT[static_cast<size_t>(p)] / 4;
        if (ply >= 1 && board.last_move() >= 0)
                sc += butterfly_[board.last_move()][p][to_underlying(board.turn())] / 4;
            scored[move_count++] = {sc, p};
        });
    }

    // Safety check: should never be 0 (third pass guarantees at least 1)
    if (move_count == 0) return board.fast_eval();

    // Sort by score descending (simple insertion sort)
    for (int i = 1; i < move_count; ++i) {
        ScoredMove key = scored[i];
        int j = i - 1;
        while (j >= 0 && scored[j].score < key.score) {
            scored[j + 1] = scored[j];
            --j;
        }
        scored[j + 1] = key;
    }

    // ── Search moves ────────────────────────────────────────────────
    int original_alpha = alpha;
    int best_eval = -EVAL_INF;
    int best_move = scored[0].pos;
    bool first = true;

    for (int mi = 0; mi < move_count; ++mi) {
        int m = scored[mi].pos;
        [[maybe_unused]] bool moved = board.make_move(m);
        (void)moved;

        int eval;
        if (first) {
            // Full window for first move
            // After defense, attack resolves and attacker gets the turn
            int ext = board.attack_active() ? 1 : 0; // If defense creates attack...
            eval = -pvs(board, depth - 1 + ext, -beta, -alpha, ply + 1, is_pv);
            first = false;
        } else {
            // Late Move Reduction for lower-priority defenses
            int reduction = 0;
            if (scored[mi].score <= MOVE_SCORE_SELL_BLOOD && depth >= 3) {
                reduction = lmr_reduction[std::min(depth, LMR_TABLE_SIZE-1)]
                                        [std::min(mi, LMR_TABLE_SIZE-1)];
                if (!is_pv) ++reduction;
            }
            int R = std::max(1, depth - 1 - reduction);
            eval = -pvs(board, R, -alpha - 1, -alpha, ply + 1, false);
            if (eval > alpha && reduction > 0) {
                eval = -pvs(board, depth - 1, -beta, -alpha, ply + 1, is_pv);
            }
        }

        board.unmake_move();

        if (eval > best_eval) {
            best_eval = eval;
            best_move = m;
        }
        if (eval > alpha) alpha = eval;
        if (alpha >= beta) {
            if (m != tt_best) {
                if (history_[m] < HISTORY_MAX)
                    history_[m] += depth * depth;
                if (ply >= 1 && board.last_move() >= 0) {
                    int last = board.last_move();
                    int turn_idx = to_underlying(board.turn());
                    int bf = butterfly_[last][m][turn_idx] + depth * depth;
                    if (bf > 32767) bf = 32767;
                    butterfly_[last][m][turn_idx] = static_cast<int16_t>(bf);
                }
            }
            break;
        }
    }

    // Store to TT
    {
        int flags = static_cast<int>(TTFlag::EXACT);
        if (best_eval <= original_alpha) flags = static_cast<int>(TTFlag::UPPER);
        else if (best_eval >= beta)      flags = static_cast<int>(TTFlag::LOWER);
        tt_store(tt_, hash, depth, best_eval, flags, best_move, 0);
    }

    return best_eval;
}

// ============================================================================
// PVS search with pruning (CORE, OPTIMIZED)
// ============================================================================
int Search::pvs(Board& board, int depth, int alpha, int beta,
                int ply, bool is_pv) noexcept
{
    // ── Time check (every 1024 nodes) ──────────────────────────────
    if ((nodes_ & 0x3FF) == 0 && check_time())
        return 0;

    if (ply > MAX_DEPTH) return board.fast_eval();

    // ── Attack state: use specialized fast path BEFORE anything else ─
    if (board.attack_active() && !board.ended()) {
        return resolve_attack(board, depth, alpha, beta, ply, is_pv);
    }
    // Depth tracked via completed iterations in think_single / think_helper

    // ── TT probe ────────────────────────────────────────────────────
    uint64_t hash = board.hash();
    size_t idx = static_cast<size_t>(hash) & static_cast<size_t>(TT_SIZE - 1);
    __builtin_prefetch(&tt_[idx], 0, 1);

    int tt_best = -1;
    int tt_val = tt_probe(tt_, hash, depth, alpha, beta, tt_best);
    if (tt_val != EVAL_INF + 1) return tt_val;

    // ── Terminal check ──────────────────────────────────────────────
    if (board.ended()) return board.fast_eval();

    // ── Leaf node: full evaluation (+ optional noise to break eval symmetry) ──
    if (depth <= 0) {
        int ev = board.full_eval_v6();
        if (noise_cp_ != 0) {
            // Deterministic pseudo-random noise (seed from position+ply)
            unsigned rnd = (unsigned)(nodes_ * 1103515245u + (unsigned)ply * 7777777u + 12345u);
            ev += (int)(((int)(rnd & 0x7FFF) - 16384) * noise_cp_ / 16384);
        }
        return ev;
    }

    ++nodes_;

    // ── Null-move pruning ───────────────────────────────────────────
    if (!is_pv && depth >= NULL_MOVE_R + 1) {
        int stand_pat = board.fast_eval();
        if (stand_pat - 304 >= beta) return stand_pat - 304;
    }

    // ── Futility pruning (depth 1-2) ────────────────────────────────
    if (!is_pv && depth <= 2) {
        int stand_pat = board.fast_eval();
        if (stand_pat >= beta) return stand_pat;
        if (depth == 1 && stand_pat + 456 <= alpha)
            return stand_pat;
    }

    // ── Razoring (depth 1) ──────────────────────────────────────────
    if (!is_pv && depth == 1) {
        int stand_pat = board.fast_eval();
        if (stand_pat + 807 <= alpha) {
            int razor_score = board.fast_eval() + 400;
            if (razor_score <= alpha) return razor_score;
        }
    }

    // ── Internal Iterative Deepening (IID) for deep PV nodes ────────
    if (is_pv && tt_best < 0 && depth >= 7) {
        int d = depth / 2 - 1;
        if (d < 1) d = 1;
        [[maybe_unused]] int _ = pvs(board, d, alpha, beta, ply, true);
        (void)_;
        uint64_t h = board.hash();
        size_t hidx = static_cast<size_t>(h) & static_cast<size_t>(TT_SIZE - 1);
        uint64_t stored = std::atomic_load_explicit(
            reinterpret_cast<std::atomic<uint64_t>*>(&tt_[hidx].hash_low),
            std::memory_order_acquire);
        if (stored == (h ^ static_cast<uint64_t>(hidx)))
            tt_best = tt_[hidx].best_move;
    }

    // ── Generate and score moves (tiered) ───────────────────────────
    ScoredMove scored[BOARD_SIZE];
    int move_count = 0;
    generate_scored_moves(board, tt_best, ply, scored, move_count);

    if (move_count == 0) return board.fast_eval();

    int original_alpha = alpha;
    int best_eval = -EVAL_INF;
    int best_move = scored[0].pos;
    int moves_tried = 0;
    bool first = true;

    for (int mi = 0; mi < move_count; ++mi) {
        int m = scored[mi].pos;
        [[maybe_unused]] bool moved = board.make_move(m);
        (void)moved;
        int eval;

        if (first) {
            // Full window search for first move
            // Threat extension: if this move creates an attack, the forced response
            // naturally extends the tactical sequence — reward relevant depth
            eval = -pvs(board, depth - 1, -beta, -alpha, ply + 1, is_pv);
            first = false;
        } else {
            ++moves_tried;

            // ── Late Move Reduction (LMR) using precomputed table ──
            int reduction = 0;
            bool is_high_priority = (scored[mi].score >= MOVE_SCORE_KILLER1);
            if (!is_high_priority && depth >= 3 && moves_tried >= 4) {
                // Use LMR table
                reduction = lmr_reduction[std::min(depth, LMR_TABLE_SIZE-1)]
                                        [std::min(moves_tried, LMR_TABLE_SIZE-1)];
                // Extra reduction for non-PV nodes
                if (!is_pv) ++reduction;
                // Extra reduction for deep nodes
                if (depth >= 8 && moves_tried >= 10) ++reduction;
                // Cap reduction
                if (reduction > depth - 1) reduction = depth - 1;
            }

            int R = depth - 1 - reduction;
            if (R < 1) R = 1;

            // Zero-width window search (null-window)
            eval = -pvs(board, R, -alpha - 1, -alpha, ply + 1, false);

            // Re-search at full depth if reduced search beats alpha
            if (eval > alpha && reduction > 0) {
                eval = -pvs(board, depth - 1, -beta, -alpha, ply + 1, is_pv);
            }
        }

        board.unmake_move();

        if (eval > best_eval) {
            best_eval = eval;
            best_move = m;
        }

        if (eval > alpha) alpha = eval;
        if (alpha >= beta) {
            // Beta cutoff: update history and killers
            if (m != tt_best) {
                if (history_[m] < HISTORY_MAX)
                    history_[m] += depth * depth;
                if (ply >= 1 && board.last_move() >= 0) {
                    int last = board.last_move();
                    int turn_idx = to_underlying(board.turn());
                    int bf = butterfly_[last][m][turn_idx] + depth * depth;
                    if (bf > 32767) bf = 32767;
                    butterfly_[last][m][turn_idx] = static_cast<int16_t>(bf);
                }
                if (ply < MAX_KILLER_PLIES && m != killers_[ply][0]) {
                    killers_[ply][1] = killers_[ply][0];
                    killers_[ply][0] = m;
                }
            }
            break;
        }
    }

    // ── Store to TT ─────────────────────────────────────────────────
    {
        int flags = static_cast<int>(TTFlag::EXACT);
        if (best_eval <= original_alpha) flags = static_cast<int>(TTFlag::UPPER);
        else if (best_eval >= beta)      flags = static_cast<int>(TTFlag::LOWER);
        tt_store(tt_, hash, depth, best_eval, flags, best_move, 0);
    }

    return best_eval;
}

// ============================================================================
// Single-threaded iterative deepening
// ============================================================================
int Search::think_single(const Board& board, int max_time_ms) noexcept {
    Board root = board.clone();
    auto start = std::chrono::steady_clock::now();
    deadline_ = start + std::chrono::milliseconds(max_time_ms);

    if (root.ended()) return -1;

    // Collect root moves for fallback
    int root_moves[BOARD_SIZE];
    int root_count = 0;
    for (int p = 0; p < BOARD_SIZE; ++p)
        if (root.cell(p) == Cell::EMPTY) root_moves[root_count++] = p;
    if (root_count == 0) return -1;

    int best_move = root_moves[0];
    uint64_t last_iter_ms = 0;

    // Clear state for fresh search
    std::memset(killers_, -1, sizeof(killers_));
    std::memset(history_, 0, sizeof(history_));
    std::memset(butterfly_, 0, sizeof(butterfly_));

    for (int depth = 1; depth <= MAX_DEPTH; ++depth) {
        auto iter_start = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            iter_start - start).count();

        // Time management
        if (static_cast<uint64_t>(elapsed) >= static_cast<uint64_t>(max_time_ms)
            || stopped_.load(std::memory_order_relaxed))
            break;
        if (depth > 1
            && static_cast<uint64_t>(last_iter_ms) > static_cast<uint64_t>(max_time_ms) / 2)
            break;

        // ── Aspiration window ───────────────────────────────────────
        int alpha = -EVAL_INF, beta = +EVAL_INF;
        if (depth >= 3) {
            uint64_t h = root.hash();
            size_t hidx = static_cast<size_t>(h) & static_cast<size_t>(TT_SIZE - 1);
            uint64_t stored = std::atomic_load_explicit(
                reinterpret_cast<std::atomic<uint64_t>*>(&tt_[hidx].hash_low),
                std::memory_order_acquire);
            if (stored == (h ^ static_cast<uint64_t>(hidx))) {
                int prev_score = tt_[hidx].eval;
                alpha = prev_score - ASPIRATION_WINDOW;
                beta  = prev_score + ASPIRATION_WINDOW;
            }
        }

        int score = pvs(root, depth, alpha, beta, 0, true);

        // Aspiration re-search on fail-low/fail-high
        if (score <= alpha || score >= beta) {
            score = pvs(root, depth, -EVAL_INF, +EVAL_INF, 0, true);
        }

        // Don't use TT best_move if we timed out during this iteration
        if (check_time() || stopped_.load(std::memory_order_relaxed)) break;

        // Extract best move from TT (only from COMPLETED iterations)
        uint64_t h = root.hash();
        size_t hidx = static_cast<size_t>(h) & static_cast<size_t>(TT_SIZE - 1);
        uint64_t stored = std::atomic_load_explicit(
            reinterpret_cast<std::atomic<uint64_t>*>(&tt_[hidx].hash_low),
            std::memory_order_relaxed);
        if (stored == (h ^ static_cast<uint64_t>(hidx))) {
            best_move = tt_[hidx].best_move;
            last_score_ = tt_[hidx].eval;
        }

        last_iter_ms = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - iter_start).count());

        // Track the highest COMPLETED iteration depth (not the max ply seen)
        max_depth_reached_ = depth;

        // ── Record iteration history ──────────────────────────────────
        if (history_count_ < MAX_HISTORY) {
            auto now = std::chrono::steady_clock::now();
            iter_history_[history_count_++] = {
                depth,
                best_move,
                last_score_,
                nodes_.load(std::memory_order_relaxed),
                static_cast<uint64_t>(std::chrono::duration_cast<
                    std::chrono::microseconds>(now - start).count())
            };
        }

        if (stopped_.load(std::memory_order_relaxed)) break;
    }

    // ── Multi-PV: collect all root move scores (V4 eval, negated for root perspective) ──
    root_move_count_ = 0;
    for (int p = 0; p < BOARD_SIZE; ++p) {
        if (root.cell(p) != Cell::EMPTY) continue;
        Board child = root.clone();
        if (!child.make_move(p)) continue;
        root_moves_[root_move_count_].pos = p;
        // Use V4 eval (stable) from child's perspective, negate for root
        root_moves_[root_move_count_].score = -child.full_eval_v6();
        ++root_move_count_;
    }
    // Sort by score descending (insertion sort, N ≤ 81)
    for (int i = 1; i < root_move_count_; ++i) {
        RootMove key = root_moves_[i];
        int j = i - 1;
        while (j >= 0 && root_moves_[j].score < key.score) {
            root_moves_[j + 1] = root_moves_[j];
            --j;
        }
        root_moves_[j + 1] = key;
    }

    return best_move;
}

// ============================================================================
// Iteration history
// ============================================================================
void Search::clear_history() noexcept {
    history_count_ = 0;
}

const Search::IterationRecord* Search::get_history(int& out_count) const noexcept {
    out_count = history_count_;
    return iter_history_;
}

// ============================================================================
// Multi-PV: return sorted root moves
// ============================================================================
int Search::get_root_moves(RootMove* out, int max_n) const noexcept {
    int n = (root_move_count_ < max_n) ? root_move_count_ : max_n;
    for (int i = 0; i < n; ++i) {
        out[i].pos = root_moves_[i].pos;
        out[i].score = root_moves_[i].score;
    }
    return n;
}

// ============================================================================
// Helper thread (Lazy SMP)
// ============================================================================
void Search::think_helper(const Board& board, int max_time_ms) noexcept {
    Board root = board.clone();
    auto start = std::chrono::steady_clock::now();
    deadline_ = start + std::chrono::milliseconds(max_time_ms);

    for (int depth = 1; depth <= MAX_DEPTH; ++depth) {
        if (check_time()) break;
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start).count();
        if (static_cast<uint64_t>(elapsed) >= static_cast<uint64_t>(max_time_ms))
            break;

        [[maybe_unused]] int _ = pvs(root, depth, -EVAL_INF, +EVAL_INF, 0, true);
        (void)_;
        max_depth_reached_ = depth;
    }
}

// ============================================================================
// Main entry: single or multi-threaded
// ============================================================================
int Search::think(const Board& board, int max_time_ms, int num_threads) noexcept {
    stopped_.store(false, std::memory_order_relaxed);

    if (!tt_) {
        tt_ = new TTEntry[static_cast<size_t>(TT_SIZE)]{};
        owns_tt_ = true;
    }

    if (num_threads <= 1)
        return think_single(board, max_time_ms);

    // ── Lazy SMP ────────────────────────────────────────────────────
    int n_helpers = std::min(num_threads - 1, 7);

    struct HelperCtx {
        Search* srch;
        std::thread thr;
    };

    std::vector<HelperCtx> helpers;
    helpers.reserve(static_cast<size_t>(n_helpers));

    for (int i = 0; i < n_helpers; ++i) {
        auto* s = new Search();
        s->share_tt(tt_);
        s->share_stopped(&stopped_);
        helpers.push_back({s, std::thread()});
    }

    for (int i = 0; i < n_helpers; ++i) {
        helpers[static_cast<size_t>(i)].thr = std::thread(
            [s = helpers[static_cast<size_t>(i)].srch, &board, max_time_ms]() {
                s->think_helper(board, max_time_ms);
            });
    }

    int result = think_single(board, max_time_ms);

    stopped_.store(true, std::memory_order_relaxed);
    for (auto& h : helpers) {
        if (h.thr.joinable()) h.thr.join();
        delete h.srch;
    }

    return result;
}

// ============================================================================
// Principal Variation extraction from TT
// ============================================================================
void Search::extract_pv(Board& board, int* pv_line, int& pv_length) noexcept {
    pv_length = 0;
    Board tmp = board.clone();
    for (int i = 0; i < MAX_DEPTH; ++i) {
        uint64_t h = tmp.hash();
        size_t idx = static_cast<size_t>(h) & static_cast<size_t>(TT_SIZE - 1);
        uint64_t stored = std::atomic_load_explicit(
            reinterpret_cast<std::atomic<uint64_t>*>(&tt_[idx].hash_low),
            std::memory_order_relaxed);
        if (stored != (h ^ static_cast<uint64_t>(idx))) break;
        int bm = tt_[idx].best_move;
        if (bm < 0 || bm >= BOARD_SIZE) break;
        if (tmp.cell(bm) != Cell::EMPTY) break;
        pv_line[pv_length++] = bm;
        [[maybe_unused]] bool _ = tmp.make_move(bm);
        (void)_;
    }
}

} // namespace hce
