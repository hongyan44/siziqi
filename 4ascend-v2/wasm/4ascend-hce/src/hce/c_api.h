#pragma once
// ============================================================================
// HCE Engine — C API for embedding in GUI / other languages
//
// All functions are thread-safe as long as each BoardHandle/SearchHandle
// is only used from one thread at a time.
// ============================================================================

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// ─── Opaque handles ────────────────────────────────────────────────
typedef struct hce_board_handle  hce_board_t;
typedef struct hce_search_handle hce_search_t;

// ─── Initialization (call once at startup) ─────────────────────────
void hce_init(void);

// ─── Board lifecycle ──────────────────────────────────────────────
hce_board_t* hce_board_new(void);
hce_board_t* hce_board_clone(const hce_board_t* b);
void         hce_board_reset(hce_board_t* b);
void         hce_board_free(hce_board_t* b);

// ─── Board queries ─────────────────────────────────────────────────
int          hce_board_cell(const hce_board_t* b, int pos);     // 0=EMPTY, 1=WHITE, 2=BLACK
int          hce_board_turn(const hce_board_t* b);              // 0=WHITE, 1=BLACK
int          hce_board_hp(const hce_board_t* b, int player);    // 0..6
int          hce_board_move_count(const hce_board_t* b);
int          hce_board_ended(const hce_board_t* b);             // 0=ongoing, 1=ended
int          hce_board_winner(const hce_board_t* b);            // 0=WHITE, 1=BLACK, -1=ongoing, -2=draw
int          hce_board_attack_active(const hce_board_t* b);
int          hce_board_attack_M(const hce_board_t* b);          // number of stones in ascension
int          hce_board_attack_positions(const hce_board_t* b, int* out, int max_out);  // fills positions, returns count
int          hce_board_is_attack_pos(const hce_board_t* b, int pos);

// ─── Board actions ─────────────────────────────────────────────────
// Returns 0 on failure, 1 on success.
int hce_board_step(hce_board_t* b, int pos);
int hce_board_make_move(hce_board_t* b, int pos);
int hce_board_undo_move(hce_board_t* b);

// ─── Evaluation ────────────────────────────────────────────────────
// Static evaluation from the perspective of the current player.
// Positive = current player is winning.
int hce_evaluate_v51(const hce_board_t* b);
int hce_evaluate_v6(const hce_board_t* b);
int hce_evaluate(const hce_board_t* b);
int hce_evaluate_fast(const hce_board_t* b);  // O(1) incremental (no threat scan)
// Extract V5.1 36-dim feature vector for training. Returns feat[36].
void hce_extract_v5_features(const hce_board_t* b, int16_t* out_feat);
void hce_extract_v6_features(const hce_board_t* b, int16_t* out_feat);

// ─── Search ────────────────────────────────────────────────────────
hce_search_t* hce_search_new(void);
void          hce_search_free(hce_search_t* s);
void          hce_search_share_tt(hce_search_t* s, hce_search_t* master);

// Search for best move. Returns the position (0..80) or -1 on failure.
int  hce_search_think(hce_search_t* s, const hce_board_t* b,
                       int max_time_ms, int num_threads);

// Statistics from last search
uint64_t hce_search_nodes(const hce_search_t* s);
int      hce_search_depth(const hce_search_t* s);

// Reset search statistics (node counter, depth)
void hce_search_reset_stats(hce_search_t* s);

// Stop a running search (from another thread)
void hce_search_stop(hce_search_t* s);

// Extract principal variation (clones board internally)
int  hce_search_pv(hce_search_t* s, const hce_board_t* board,
                    int* out_moves, int max_len);

// Multi-PV: get top N root moves with scores (N ≤ 81)
// Returns the number of moves written. Moves sorted by score descending.
int  hce_search_best_moves(hce_search_t* s, int* out_moves, int* out_scores, int max_n);

// ─── Iteration history (for test_suite.py + web_gui) ─────────────────
typedef struct {
    int depth;
    int best_move;
    int eval;
    uint64_t nodes;
    uint64_t elapsed_us;
} hce_iteration_t;

void hce_search_clear_history(hce_search_t* s);
const hce_iteration_t* hce_search_get_history(hce_search_t* s, int* out_count);

// ─── FEN serialization (for test suites) ──────────────────────────
// to_fen: writes FEN into buffer, returns written length (excl. null).
//         buffer must be at least 256 bytes.
int  hce_board_to_fen(const hce_board_t* b, char* out_buf, int max_len);
// load_fen: returns 1 on success, 0 on parse error.
int  hce_board_load_fen(hce_board_t* b, const char* fen);

#ifdef __cplusplus
}
#endif
