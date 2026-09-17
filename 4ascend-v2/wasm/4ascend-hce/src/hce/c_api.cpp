// ============================================================================
// C API — ctypes bridge for Python bindings
// ============================================================================

#include "c_api.h"
#include "board.hpp"
#include "evaluate.hpp"
#include "search.hpp"
#include "tables.hpp"
#include "tt.hpp"

#include <algorithm>

#include <cstring>
#include <new>

// ============================================================================
// Initialization
// ============================================================================
void hce_init(void) {
    static bool inited = false;
    if (!inited) {
        hce::init_tables();
        hce::init_zobrist();
        inited = true;
    }
}

// ============================================================================
// Board
// ============================================================================
hce_board_t* hce_board_new(void) {
    auto* b = new hce::Board();
    return reinterpret_cast<hce_board_t*>(b);
}

hce_board_t* hce_board_clone(const hce_board_t* b) {
    const auto* src = reinterpret_cast<const hce::Board*>(b);
    auto* dst = new hce::Board(src->clone());
    return reinterpret_cast<hce_board_t*>(dst);
}

void hce_board_reset(hce_board_t* b) {
    reinterpret_cast<hce::Board*>(b)->reset();
}

void hce_board_free(hce_board_t* b) {
    if (b) {
        auto* board = reinterpret_cast<hce::Board*>(b);
        delete board;
    }
}

int hce_board_cell(const hce_board_t* b, int pos) {
    return static_cast<int>(reinterpret_cast<const hce::Board*>(b)->cell(pos));
}

int hce_board_turn(const hce_board_t* b) {
    auto p = reinterpret_cast<const hce::Board*>(b)->turn();
    return (p == hce::Player::WHITE) ? 0 : 1;
}

int hce_board_hp(const hce_board_t* b, int player) {
    auto p = (player == 0) ? hce::Player::WHITE : hce::Player::BLACK;
    return reinterpret_cast<const hce::Board*>(b)->hp(p);
}

int hce_board_move_count(const hce_board_t* b) {
    return reinterpret_cast<const hce::Board*>(b)->move_count();
}

int hce_board_ended(const hce_board_t* b) {
    return reinterpret_cast<const hce::Board*>(b)->ended() ? 1 : 0;
}

int hce_board_winner(const hce_board_t* b) {
    return reinterpret_cast<const hce::Board*>(b)->winner();
}

int hce_board_attack_active(const hce_board_t* b) {
    return reinterpret_cast<const hce::Board*>(b)->attack_active() ? 1 : 0;
}

int hce_board_attack_M(const hce_board_t* b) {
    return reinterpret_cast<const hce::Board*>(b)->attack_M();
}

int hce_board_attack_positions(const hce_board_t* b, int* out, int max_out) {
    const auto& board = *reinterpret_cast<const hce::Board*>(b);
    const auto& bb = board.attack_positions_bb();
    int count = 0;
    bb.foreach([&](int p) {
        if (count < max_out) out[count] = p;
        ++count;
    });
    return count;
}

int hce_board_is_attack_pos(const hce_board_t* b, int pos) {
    return reinterpret_cast<const hce::Board*>(b)->is_attack_pos(pos) ? 1 : 0;
}

int hce_board_step(hce_board_t* b, int pos) {
    return reinterpret_cast<hce::Board*>(b)->step(pos) ? 1 : 0;
}

int hce_board_make_move(hce_board_t* b, int pos) {
    return reinterpret_cast<hce::Board*>(b)->make_move(pos) ? 1 : 0;
}

int hce_board_undo_move(hce_board_t* b) {
    reinterpret_cast<hce::Board*>(b)->unmake_move();
    return 1;
}

// ============================================================================
// Evaluation
// ============================================================================
int hce_evaluate_v51(const hce_board_t* b) {
    return hce::evaluate_v51(*reinterpret_cast<const hce::Board*>(b));
}

int hce_evaluate_v6(const hce_board_t* b) {
    return hce::evaluate_v6(*reinterpret_cast<const hce::Board*>(b));
}

void hce_extract_v5_features(const hce_board_t* b, int16_t* out_feat) {
    hce::extract_features_v5(*reinterpret_cast<const hce::Board*>(b), out_feat);
}

void hce_extract_v6_features(const hce_board_t* b, int16_t* out_feat) {
    // V6 Final: extract global features (32-dim) into the first 32 slots,
    // leave remaining 32 slots as 0 for backward compat.
    hce::extract_global_features(*reinterpret_cast<const hce::Board*>(b), out_feat);
    for (int i = 32; i < 64; ++i) out_feat[i] = 0;
}

int hce_evaluate(const hce_board_t* b) {
    return hce::evaluate(*reinterpret_cast<const hce::Board*>(b));
}

int hce_evaluate_fast(const hce_board_t* b) {
    return hce::evaluate_fast(*reinterpret_cast<const hce::Board*>(b));
}

// ============================================================================
// Search
// ============================================================================
hce_search_t* hce_search_new(void) {
    auto* s = new hce::Search();
    return reinterpret_cast<hce_search_t*>(s);
}

void hce_search_free(hce_search_t* s) {
    if (s) {
        auto* search = reinterpret_cast<hce::Search*>(s);
        delete search;
    }
}

void hce_search_share_tt(hce_search_t* s, hce_search_t* master) {
    auto* child  = reinterpret_cast<hce::Search*>(s);
    auto* parent = reinterpret_cast<hce::Search*>(master);
    child->share_tt(parent->get_tt());
    child->share_stopped(parent->get_stopped());
}

int hce_search_think(hce_search_t* s, const hce_board_t* b,
                      int max_time_ms, int num_threads)
{
    auto* search = reinterpret_cast<hce::Search*>(s);
    const auto& board = *reinterpret_cast<const hce::Board*>(b);
    return search->think(board, max_time_ms, num_threads);
}

uint64_t hce_search_nodes(const hce_search_t* s) {
    return reinterpret_cast<const hce::Search*>(s)->nodes();
}

int hce_search_depth(const hce_search_t* s) {
    return reinterpret_cast<const hce::Search*>(s)->depth_reached();
}

void hce_search_reset_stats(hce_search_t* s) {
    reinterpret_cast<hce::Search*>(s)->reset_stats();
}

void hce_search_stop(hce_search_t* s) {
    reinterpret_cast<hce::Search*>(s)->stop();
}

int hce_search_pv(hce_search_t* s, const hce_board_t* board,
                   int* out_moves, int max_len)
{
    auto* search = reinterpret_cast<hce::Search*>(s);
    const auto* src = reinterpret_cast<const hce::Board*>(board);
    hce::Board tmp = src->clone();
    int pv_length = 0;
    search->extract_pv(tmp, out_moves, pv_length);
    return pv_length;
}

int hce_search_best_moves(hce_search_t* s, int* out_moves, int* out_scores, int max_n)
{
    auto* search = reinterpret_cast<hce::Search*>(s);
    hce::Search::RootMove buf[81];
    int n = search->get_root_moves(buf, (max_n < 81) ? max_n : 81);
    for (int i = 0; i < n; ++i) {
        out_moves[i] = buf[i].pos;
        out_scores[i] = buf[i].score;
    }
    return n;
}

// ============================================================================
// Iteration history
// ============================================================================
void hce_search_clear_history(hce_search_t* s) {
    reinterpret_cast<hce::Search*>(s)->clear_history();
}

const hce_iteration_t* hce_search_get_history(hce_search_t* s, int* out_count) {
    auto* search = reinterpret_cast<hce::Search*>(s);
    int count = 0;
    const auto* records = search->get_history(count);
    *out_count = count;
    // IterationRecord and hce_iteration_t are layout-identical
    // (same fields in same order, both standard-layout).
    return reinterpret_cast<const hce_iteration_t*>(records);
}

// ============================================================================
// FEN
// ============================================================================
int hce_board_to_fen(const hce_board_t* b, char* out_buf, int max_len) {
    const auto* board = reinterpret_cast<const hce::Board*>(b);
    std::string fen = board->to_fen();
    int len = static_cast<int>(fen.size());
    if (len >= max_len) len = max_len - 1;
    std::memcpy(out_buf, fen.data(), static_cast<size_t>(len));
    out_buf[len] = '\0';
    return len;
}

int hce_board_load_fen(hce_board_t* b, const char* fen) {
    auto* board = reinterpret_cast<hce::Board*>(b);
    return board->load_fen(fen) ? 1 : 0;
}
