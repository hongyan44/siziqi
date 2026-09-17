#pragma once

#include "tt.hpp"
#include "evaluate.hpp"

#include <atomic>
#include <thread>
#include <vector>
#include <chrono>

// ============================================================================
// PVS Search — Principal Variation Search with Iterative Deepening
//
// Features:
//   - PVS with zero-window successors
//   - Iterative deepening with aspiration windows
//   - Late Move Reduction (LMR) with precomputed table
//   - Attack-state specialized search (resolve_attack)
//   - Null-move / futility / razoring pruning
//   - Lazy SMP multi-threading
//   - Tiered move generation (TT → counter → killers → attack → quiet)
// ============================================================================

namespace hce {

// Search constants
inline constexpr int MAX_DEPTH         = 128;
inline constexpr int ASPIRATION_WINDOW = 114;
inline constexpr int NULL_MOVE_R       = 3;

// LMR table (global, shared across all Search instances)
extern int lmr_reduction[LMR_TABLE_SIZE][LMR_TABLE_SIZE];

// ─── Scored move (stack-allocated, no heap) ────────────────────────
struct ScoredMove {
    int score;
    int pos;
};

// ─── Search class ──────────────────────────────────────────────────
class Search {
public:
    Search() noexcept;
    ~Search();

    // Main entry: search for best move within max_time_ms
    [[nodiscard]] int think(const Board& board, int max_time_ms = 30000,
                            int num_threads = 1) noexcept;

    void set_noise(int cp) noexcept { noise_cp_ = cp; }
    void stop() noexcept { stopped_.store(true, std::memory_order_relaxed); }
    [[nodiscard]] bool stopped() const noexcept {
        return stopped_.load(std::memory_order_relaxed);
    }

    // Statistics
    [[nodiscard]] uint64_t nodes() const noexcept { return nodes_.load(std::memory_order_relaxed); }
    [[nodiscard]] int      depth_reached() const noexcept { return max_depth_reached_.load(std::memory_order_relaxed); }
    [[nodiscard]] int      last_score() const noexcept { return last_score_; }
    void reset_stats() noexcept {
        nodes_.store(0, std::memory_order_relaxed);
        max_depth_reached_.store(0, std::memory_order_relaxed);
        last_score_ = 0;
    }

    // PV extraction (public for CLI display)
    void extract_pv(Board& board, int* pv_line, int& pv_length) noexcept;

    // ─── Iteration history (for test suites & GUI) ────────────────
    struct IterationRecord {
        int depth;          // completed iteration depth
        int best_move;      // TT best move for root at this depth
        int eval;           // TT eval for root at this depth (centipawn)
        uint64_t nodes;     // node count at this point
        uint64_t elapsed_us; // microseconds since think() start
    };
    void clear_history() noexcept;
    [[nodiscard]] const IterationRecord* get_history(int& out_count) const noexcept;

    // Multi-PV: root move scores (sorted by score descending)
    struct RootMove {
        int pos;
        int score;
    };
    [[nodiscard]] int get_root_moves(RootMove* out, int max_n) const noexcept;

    // Lazy SMP sharing
    void share_tt(TTEntry* tt) noexcept { tt_ = tt; owns_tt_ = false; }
    void share_stopped(std::atomic<bool>* flag) noexcept { stop_shared_ = flag; }
    TTEntry* get_tt() noexcept { return tt_; }
    std::atomic<bool>* get_stopped() noexcept { return &stopped_; }

private:
    TTEntry* tt_ = nullptr;
    bool owns_tt_ = true;

    std::atomic<bool> stopped_{false};
    std::atomic<bool>* stop_shared_ = nullptr;

    // Search state
    alignas(64) int16_t butterfly_[81][81][2]{};  // from→to→color
    int   killers_[MAX_KILLER_PLIES][2]{};
    int   history_[BOARD_SIZE]{};
    int   counter_moves_[BOARD_SIZE]{};   // counter-move table: prev_move → best response
    std::atomic<uint64_t> nodes_{0};
    std::atomic<int>      max_depth_reached_{0};
    int                   last_score_ = 0;
    int   noise_cp_ = 0;
    RootMove root_moves_[BOARD_SIZE]{};
    int    root_move_count_ = 0;

    // Iteration history (fixed-size, no heap, -fno-exceptions safe)
    static constexpr int MAX_HISTORY = MAX_DEPTH;
    int history_count_ = 0;
    IterationRecord iter_history_[MAX_HISTORY]{};

    // Time management
    std::chrono::steady_clock::time_point deadline_;
    [[nodiscard]] bool check_time() const noexcept;

    // Internal search
    [[nodiscard]] int pvs(Board& board, int depth, int alpha, int beta,
                          int ply, bool is_pv) noexcept;
    [[nodiscard]] int resolve_attack(Board& board, int depth, int alpha, int beta,
                                      int ply, bool is_pv) noexcept;
    [[nodiscard]] int qsearch_attack(Board& board, int alpha, int beta,
                                      int ply) noexcept;
    [[nodiscard]] int think_single(const Board& board, int max_time_ms) noexcept;
    void think_helper(const Board& board, int max_time_ms) noexcept;

    // Move generation
    void generate_scored_moves(const Board& board, int tt_best, int ply,
                               ScoredMove* out, int& count) const noexcept;
};

} // namespace hce
