// ============================================================================
// Evaluate — V4 hand-tuned + V5.1 trained weights
// ============================================================================

#include "evaluate.hpp"
#include "v5_weights.hpp"
#include "v6_table.hpp"
#include "v6_final_weights.hpp"
#include <algorithm>
#include <cstdint>
#include <immintrin.h>


#if defined(_MSC_VER) && !defined(__clang__)
#define __restrict__ __restrict
#endif



namespace hce {

// ─── M-bucket v4 ───────────────────────────────────────────────────
static int m_bucket_v4(int M) noexcept {
    if (M >= 10) return 7;
    if (M == 9 || M == 8) return 6;
    if (M == 7) return 5;
    if (M == 6) return 4;
    if (M == 5) return 3;
    if (M == 4) return 2;
    if (M == 3) return 1;
    return 0;
}

static void count_both(const uint8_t* __restrict__ board, int pos, int dir,
                       uint8_t us_c, uint8_t them_c,
                       int& self_cnt, int& opp_cnt) noexcept {
    int sc = 0, oc = 0;
    int n = G_AT.dir_len[pos][dir][0];
    for (int i = 0; i < n; ++i) {
        uint8_t cl = board[static_cast<size_t>(G_NB.fwd[pos][dir][i])];
        if (cl == us_c)   { if (oc > 0) break; ++sc; }
        else if (cl == them_c) { if (sc > 0) break; ++oc; }
        else break;
    }
    n = G_AT.dir_len[pos][dir][1];
    for (int i = 0; i < n; ++i) {
        uint8_t cl = board[static_cast<size_t>(G_NB.bwd[pos][dir][i])];
        if (cl == us_c)   { if (oc > 0) break; ++sc; }
        else if (cl == them_c) { if (sc > 0) break; ++oc; }
        else break;
    }
    self_cnt = sc; opp_cnt = oc;
}

// Count isolated stones of BOTH colors in ONE pass (2× faster)
static void count_isolated_both(const uint8_t* bd, uint8_t col_a, uint8_t col_b,
                                 int& cnt_a, int& cnt_b) noexcept {
    cnt_a = 0; cnt_b = 0;
    for (int p = 0; p < 81; ++p) {
        uint8_t pc = bd[p];
        if (pc != col_a && pc != col_b) continue;
        uint8_t target = pc;
        int r = p/9, c = p%9; bool has = false;
        for (int dr = -1; dr <= 1 && !has; ++dr)
            for (int dc = -1; dc <= 1 && !has; ++dc) {
                if (dr == 0 && dc == 0) continue;
                int nr = r+dr, nc = c+dc;
                if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && bd[nr*9+nc] == target) has = true;
            }
        if (!has) {
            if (target == col_a) ++cnt_a;
            else ++cnt_b;
        }
    }
}



// ─── Shared helpers for evaluate ---------------------------------
static int base_score(const Board& board, Player us, Player them,
                      const EvalAccum& a_us, const EvalAccum& a_th) noexcept {
    int score = 0;
    score += a_us.piece_count * EvalWeight::SELF_STONES
           + a_th.piece_count * EvalWeight::OPP_STONES;
    score += (board.hp(us) - board.hp(them)) * EvalWeight::HP_DIFF;
    score += a_us.pos_score   * EvalWeight::POS_SELF
           + a_th.pos_score   * EvalWeight::POS_OPP;
    score += a_us.edge_count  * EvalWeight::EDGE_SELF
           + a_th.edge_count  * EvalWeight::EDGE_OPP;
    score += a_us.conn_pairs  * EvalWeight::CONN_SELF
           + a_th.conn_pairs  * EvalWeight::CONN_OPP;
    score += EvalWeight::BIAS;  // BIAS = 1 × weight
    return score;
}

static constexpr int SW[]={EvalWeight::SELF_M2,EvalWeight::SELF_M3,EvalWeight::SELF_M4,
    EvalWeight::SELF_M5,EvalWeight::SELF_M6,EvalWeight::SELF_M7,
    EvalWeight::SELF_M8_9,EvalWeight::SELF_M10PLUS};
static constexpr int OW[]={EvalWeight::OPP_M2,EvalWeight::OPP_M3,EvalWeight::OPP_M4,
    EvalWeight::OPP_M5,EvalWeight::OPP_M6,EvalWeight::OPP_M7,
    EvalWeight::OPP_M8_9,EvalWeight::OPP_M10PLUS};

// ══════════════════════════════════════════════════════════════════
// evaluate — full 36-dim HCE V5
// ══════════════════════════════════════════════════════════════════
int evaluate(const Board& board) noexcept {
    if (board.ended()) [[unlikely]] {
        int w = board.winner();
        if (w == -2) return 0;
        Player us = board.turn();
        if ((us == Player::WHITE && w == 0) || (us == Player::BLACK && w == 1))
            return +EVAL_INF;
        return -EVAL_INF;
    }

    Player us = board.turn(), them = opponent(us);
    const uint8_t* bd = board.raw_board();
    uint8_t us_c = player_cell(us), them_c = player_cell(them);
    const auto& a_us = board.accum(us), a_th = board.accum(them);
    int hp_us = board.hp(us), hp_them = board.hp(them);
    const BitBoard& us_pb = (us==Player::WHITE)?board.white_bb():board.black_bb();
    const BitBoard& th_pb = (them==Player::WHITE)?board.white_bb():board.black_bb();

    int urg_self = std::max(0, 6-hp_us) * EvalWeight::HP_URGENCY_FACTOR;
    int urg_opp  = std::max(0, 6-hp_them) * EvalWeight::HP_URGENCY_FACTOR;

    // ── 1. BASE (9 dims) + ISOLATED (2 dims) = 11 ────────
    int score = base_score(board, us, them, a_us, a_th);
    int iso_self, iso_opp;
    count_isolated_both(bd, us_c, them_c, iso_self, iso_opp);
    score += iso_self * EvalWeight::ISOLATED_SELF
           + iso_opp * EvalWeight::ISOLATED_OPP;

    // ── 2. ATTACK STATE (5 dims) ───────────────────────────
    if (board.attack_active()) [[unlikely]] {
        score += EvalWeight::ATTACK_POS_FIELD;
        int M = board.attack_M();
        bool can_counter = false; int best_mM = 0;
        const auto& atk_bb = board.attack_positions_bb();
        atk_bb.foreach([&](int ap) noexcept {
            int dirs=0, mM=1;
            for(int d=0;d<NDIRS;++d){ int s,o; count_both(bd,ap,d,us_c,them_c,s,o); if(s>=1){++dirs;mM+=s;} }
            if(dirs>0){ can_counter=true; if(mM>best_mM)best_mM=mM; }
        });
        if (can_counter) {
            int me = std::max(0, M-1); if(best_mM>me) best_mM=me;
            score += best_mM * EvalWeight::COUNTER_PER_STONE;
        } else {
            bool off = false;
            board.empties().foreach([&](int p) noexcept {
                if(off||atk_bb.get(p))return;
                bool any=false; for(int d=0;d<NDIRS&&!any;++d) any=threat_possible(us_pb,p,d);
                if(!any)return;
                int dirs=0; for(int d=0;d<NDIRS;++d){int s,o;count_both(bd,p,d,us_c,them_c,s,o);if(s>=1)++dirs;}
                if(dirs>0)off=true;
            });
            if(off) score += EvalWeight::OFFSET_BONUS;
            else score -= M * EvalWeight::PENALTY_PER_STONE;
        }
        return score;
    }

    // ── 3. M-BUCKETS 2~10+ (16 dims) + FORK/BLOCK (3 dims) ──
    int sb[8]={}, ob[8]={}, sf=0, of_=0, blk=0;
    board.empties().foreach([&](int p) noexcept {
        int sd=0, sM=1, od=0, oM=1, brk=0; bool any=false;
        for(int d=0;d<NDIRS;++d){
            if(!threat_possible(us_pb,p,d) && !threat_possible(th_pb,p,d)) continue;
            any=true; int sc,oc; count_both(bd,p,d,us_c,them_c,sc,oc);
            if(sc>=1){++sd;sM+=sc;} if(oc>=1){++od;oM+=oc;} if(oc>=2)++brk;
        }
        if(!any) return;
        if(sd>0){int M=sM-(sd-1);if(M>=2)sb[m_bucket_v4(M)]++;if(sd>=2)sf++;}
        if(od>0){int M=oM-(od-1);if(M>=2)ob[m_bucket_v4(M)]++;if(od>=2)of_++;}
        if(brk>=2)blk++;
    });

    for(int i=0;i<8;++i) score+=sb[i]*SW[i]+ob[i]*OW[i];
    score += sf*EvalWeight::FORK + of_*EvalWeight::OPP_FORK + blk*EvalWeight::BLOCK_ONE;

    // ── 4. HP URGENCY (part of E. Attack state dims) ──
    int sn=0, on=0; for(int i=0;i<8;++i){sn+=sb[i];on+=ob[i];}
    score += (sn-on)*urg_self/100 + sn*urg_opp/80 + sf*urg_opp/50;
    return score;
}

// ══════════════════════════════════════════════════════════════════
// evaluate_v5 — 36-dim HCE using V5 trained weights with CPP_SCALE
// ══════════════════════════════════════════════════════════════════
// Feature extraction for V5 trained weights. Fills int16 feat[36] with
// raw feature values matching the V5 training data format.
// Used by evaluate_v51() for dot product with V5::WEIGHTS.
void extract_features_v5(const Board& board,
                                int16_t* feat) noexcept {
    Player us = board.turn(), them = opponent(us);
    const uint8_t* bd = board.raw_board();
    uint8_t us_c = player_cell(us), them_c = player_cell(them);
    const auto& a_us = board.accum(us), a_th = board.accum(them);
    int hp_us = board.hp(us), hp_them = board.hp(them);
    const BitBoard& us_pb = (us==Player::WHITE)?board.white_bb():board.black_bb();
    const BitBoard& th_pb = (them==Player::WHITE)?board.white_bb():board.black_bb();

    // Clear all features first
    for (int i = 0; i < 36; ++i) feat[i] = 0;

    // [0..8] Base incremental
    feat[0] = static_cast<int16_t>(a_us.piece_count);  // SELF_STONES
    feat[1] = static_cast<int16_t>(a_th.piece_count);  // OPP_STONES
    feat[2] = static_cast<int16_t>(hp_us - hp_them);   // HP_DIFF
    feat[3] = static_cast<int16_t>(a_us.pos_score);    // POS_SELF
    feat[4] = static_cast<int16_t>(a_th.pos_score);    // POS_OPP
    feat[5] = static_cast<int16_t>(a_us.edge_count);   // EDGE_SELF
    feat[6] = static_cast<int16_t>(a_th.edge_count);   // EDGE_OPP
    feat[7] = static_cast<int16_t>(a_us.conn_pairs);   // CONN_SELF
    feat[8] = static_cast<int16_t>(a_th.conn_pairs);   // CONN_OPP
    feat[9] = 1;  // BIAS

    // [10..11] Isolated counts (combined pass)
    int iso_self, iso_opp;
    count_isolated_both(bd, us_c, them_c, iso_self, iso_opp);
    feat[10] = static_cast<int16_t>(iso_self);   // ISOLATED_SELF
    feat[11] = static_cast<int16_t>(iso_opp);    // ISOLATED_OPP
    // Note: HP urgency scalar for [35] will be set below

    if (board.attack_active()) {
        // [31..34] Attack state features
        feat[31] = 1;  // ATTACK_POS_FIELD
        int M = board.attack_M();
        const auto& atk_bb = board.attack_positions_bb();
        bool can_counter = false; int best_mM = 0;
        atk_bb.foreach([&](int ap) noexcept {
            int dirs=0, mM=1;
            for(int d=0;d<NDIRS;++d){ int s,o; count_both(bd,ap,d,us_c,them_c,s,o); if(s>=1){++dirs;mM+=s;} }
            if(dirs>0){ can_counter=true; if(mM>best_mM)best_mM=mM; }
        });
        if (can_counter) {
            int me = std::max(0, M-1); if(best_mM>me) best_mM=me;
            feat[32] = static_cast<int16_t>(best_mM);  // COUNTER_PER_STONE
        } else {
            bool off = false;
            board.empties().foreach([&](int p) noexcept {
                if(off||atk_bb.get(p))return;
                bool any=false; for(int d=0;d<NDIRS&&!any;++d) any=threat_possible(us_pb,p,d);
                if(!any)return;
                int dirs=0; for(int d=0;d<NDIRS;++d){int s,o;count_both(bd,p,d,us_c,them_c,s,o);if(s>=1)++dirs;}
                if(dirs>0)off=true;
            });
            if (off) {
                feat[33] = 1;  // OFFSET_BONUS
            } else {
                feat[34] = static_cast<int16_t>(M);  // PENALTY_PER_STONE
            }
        }
        // Attack state urgency stays 0 (M-buckets not computed)
    } else {
        // [12..27] M-buckets + [28..30] Fork/Block
        int sb[8]={}, ob[8]={}, sf=0, of_=0, blk=0;
        board.empties().foreach([&](int p) noexcept {
            int sd=0, sM=1, od=0, oM=1, brk=0; bool any=false;
            for(int d=0;d<NDIRS;++d){
                if(!threat_possible(us_pb,p,d) && !threat_possible(th_pb,p,d)) continue;
                any=true; int sc,oc; count_both(bd,p,d,us_c,them_c,sc,oc);
                if(sc>=1){++sd;sM+=sc;} if(oc>=1){++od;oM+=oc;} if(oc>=2)++brk;
            }
            if(!any) return;
            if(sd>0){int M=sM-(sd-1);if(M>=2)sb[m_bucket_v4(M)]++;if(sd>=2)sf++;}
            if(od>0){int M=oM-(od-1);if(M>=2)ob[m_bucket_v4(M)]++;if(od>=2)of_++;}
            if(brk>=2)blk++;
        });
        for(int i=0;i<8;++i) {
            feat[12+i] = static_cast<int16_t>(sb[i]);  // SELF_M2..M10PLUS
            feat[20+i] = static_cast<int16_t>(ob[i]);  // OPP_M2..M10PLUS
        }
        feat[28] = static_cast<int16_t>(sf);   // SELF_FORK
        feat[29] = static_cast<int16_t>(of_);  // OPP_FORK
        feat[30] = static_cast<int16_t>(blk);  // BLOCK_ONE
        // HP urgency: same blended formula as gen_selfplay_v2.cpp
        // = (sn-on)*hpd_self/100 + sn*hpd_opp/80 + sf*hpd_opp/50
        int hpd_s = std::max(0, 6 - hp_us);
        int hpd_o = std::max(0, 6 - hp_them);
        int sn=0, on=0;
        for(int i=0;i<8;++i){ sn+=sb[i]; on+=ob[i]; }
        feat[35] = static_cast<int16_t>(
            (sn - on) * hpd_s / 100 + sn * hpd_o / 80 + sf * hpd_o / 50);
    }
}

// ============================================================================
// evaluate_v51 — V5.1 trained evaluation (Z-Score normalized weights)
//
// Uses V5::WEIGHTS[36] + V5::BIAS from v5_weights.hpp.
// The weights are pre-computed as W_cpp[i] = w[i] * CPP_SCALE / std[i],
// with BIAS absorbing the Z-Score normalization mean offset.
// ============================================================================
int evaluate_v51(const Board& board) noexcept {
    if (board.ended()) [[unlikely]] {
        int w = board.winner();
        if (w == -2) return 0;
        Player us = board.turn();
        if ((us == Player::WHITE && w == 0) || (us == Player::BLACK && w == 1))
            return +EVAL_INF;
        return -EVAL_INF;
    }

    int16_t feat[36];
    extract_features_v5(board, feat);

    int score = V5::BIAS;
    for (int i = 0; i < 36; ++i) {
        score += static_cast<int>(feat[i]) * static_cast<int>(V5::WEIGHTS[i]);
    }
    return score;
}

// ══════════════════════════════════════════════════════════════════
// V6 Final — mixed forward pass (line table + global features)
// ══════════════════════════════════════════════════════════════════

// ─── helper: compute end_type for a line ─────────────────────────
// end_type = bit0: endpoint 0 blocked by opponent, bit1: endpoint 1 blocked
static int compute_end_type(const uint8_t* bd, int li, uint8_t opp_c) noexcept {
    int et = 0;
    int e0 = LINE_ENDPOINTS[li][0];
    int e1 = LINE_ENDPOINTS[li][1];
    if (e0 >= 0 && bd[static_cast<size_t>(e0)] == opp_c) et |= 1;
    if (e1 >= 0 && bd[static_cast<size_t>(e1)] == opp_c) et |= 2;
    return et;
}

// ─── compute_line_index: flat index for a single full-length line ─
// Returns (pattern * 4 + end_type) for training data generation.
// Returns -1 if the line is not a full-length line.
int compute_line_index(const BitBoard& stones,
                       const BitBoard& opp_stones,
                       int line_idx) noexcept {
    if (LINE_LENGTH[line_idx] != 9) return -1;
    uint64_t pat = pext_line(stones.b[0], stones.b[1], line_idx) & 0x1FF;
    // For end_type, "opponent" cells are determined by opp_stones
    // We need the raw board to check endpoints. Since we only have bitboards here,
    // this is a simplified version. The full version in gen_selfplay uses the board.
    // For eval-time lookup, we call evaluate_v6() which handles this internally.
    return static_cast<int>(pat) * 4;  // end_type=0 default
}

// ══════════════════════════════════════════════════════════════════
// extract_global_features — 32-dim global feature vector
// ══════════════════════════════════════════════════════════════════
void extract_global_features(const Board& board,
                                     int16_t* feat) noexcept {
    // Clear all 32 features
    for (int i = 0; i < 32; ++i) feat[i] = 0;
    feat[31] = 1;  // BIAS slot

    Player us = board.turn(), them = opponent(us);
    const uint8_t* bd = board.raw_board();
    uint8_t us_c = player_cell(us), them_c = player_cell(them);
    const auto& a_us = board.accum(us);
    const auto& a_th = board.accum(them);
    const BitBoard& bb_us = (us == Player::WHITE) ? board.white_bb() : board.black_bb();
    const BitBoard& bb_th = (them == Player::WHITE) ? board.white_bb() : board.black_bb();
    int hp_us = board.hp(us), hp_them = board.hp(them);

    // ── [0-10] Incremental accumulator features (from Board accum) ──
    feat[0] = static_cast<int16_t>(a_us.piece_count);   // SELF_STONES
    feat[1] = static_cast<int16_t>(a_th.piece_count);   // OPP_STONES
    feat[2] = static_cast<int16_t>(hp_us - hp_them);    // HP_DIFF

    int iso_self, iso_opp;
    count_isolated_both(bd, us_c, them_c, iso_self, iso_opp);
    feat[3] = static_cast<int16_t>(iso_self);            // ISOLATED_SELF
    feat[4] = static_cast<int16_t>(iso_opp);             // ISOLATED_OPP

    feat[5] = static_cast<int16_t>(a_us.pos_score);      // POS_SELF
    feat[6] = static_cast<int16_t>(a_th.pos_score);      // POS_OPP
    feat[7] = static_cast<int16_t>(a_us.edge_count);     // EDGE_SELF
    feat[8] = static_cast<int16_t>(a_th.edge_count);     // EDGE_OPP
    feat[9] = static_cast<int16_t>(a_us.conn_pairs);     // CONN_SELF
    feat[10] = static_cast<int16_t>(a_th.conn_pairs);    // CONN_OPP

    // ── [11-14] M2/M3 counts from PEXT (filtered: end_type < 3) ─
    // Full-length lines: TABLE_MAXCONSEC lookup + end_type filter
    int sm2 = 0, sm3 = 0, om2 = 0, om3 = 0;
    for (int li = 0; li < NUM_LINES; ++li) {
        int plen = LINE_LENGTH[li];
        if (plen == 9) {
            // Full-length: TABLE_MAXCONSEC + end_type filter
            uint64_t pat = pext_line(bb_us.b[0], bb_us.b[1], li) & 0x1FF;
            int et = compute_end_type(bd, li, them_c);
            uint8_t mc = V6::TABLE_MAXCONSEC[pat];
            if (mc >= 2 && et < 3) {
                if (mc == 2) ++sm2; else ++sm3;
            }

            pat = pext_line(bb_th.b[0], bb_th.b[1], li) & 0x1FF;
            et = compute_end_type(bd, li, us_c);
            mc = V6::TABLE_MAXCONSEC[pat];
            if (mc >= 2 && et < 3) {
                if (mc == 2) ++om2; else ++om3;
            }
        } else if (plen >= 2) {
            // Short diagonal: raw consecutive count, no end_type filter
            uint64_t raw = pext_line(bb_us.b[0], bb_us.b[1], li);
            int maxc = 0, run = 0;
            for (int b = 0; b < plen; ++b, raw >>= 1) {
                if (raw & 1) { ++run; if (run > maxc) maxc = run; }
                else run = 0;
            }
            if (maxc == 2) ++sm2; else if (maxc >= 3) ++sm3;

            raw = pext_line(bb_th.b[0], bb_th.b[1], li);
            maxc = 0; run = 0;
            for (int b = 0; b < plen; ++b, raw >>= 1) {
                if (raw & 1) { ++run; if (run > maxc) maxc = run; }
                else run = 0;
            }
            if (maxc == 2) ++om2; else if (maxc >= 3) ++om3;
        }
    }
    feat[11] = static_cast<int16_t>(sm2);   // SELF_M2
    feat[12] = static_cast<int16_t>(om2);   // OPP_M2
    feat[13] = static_cast<int16_t>(sm3);   // SELF_M3
    feat[14] = static_cast<int16_t>(om3);   // OPP_M3

    // ── [15] EMPTINESS ──────────────────────────────────────────────
    feat[15] = static_cast<int16_t>(board.empties().popcount());

    // ── [16-17] HP nonlinear + TEMPO ───────────────────────────────
    feat[16] = static_cast<int16_t>(std::abs(hp_us - hp_them));  // HP_DIFF_NL
    feat[17] = static_cast<int16_t>(board.empties().popcount() / 9);  // TEMPO 0..9

    // ── [18-19] Death line ─────────────────────────────────────────
    feat[18] = (hp_us <= 1) ? 1 : 0;    // SELF_DEATH_LINE
    feat[19] = (hp_them <= 1) ? 1 : 0;  // OPP_DEATH_LINE

    // ── [20-28] Attack state features ───────────────────────────────
    if (board.attack_active()) {
        Player atk = board.attacker();
        int M = board.attack_M();
        // FORCED_COUNTER: is there a counter-attack available?
        const auto& atk_bb = board.attack_positions_bb();
        bool can_counter = false;
        int best_counter_size = 0;
        atk_bb.foreach([&](int ap) {
            for (int d = 0; d < NDIRS; ++d) {
                int cnt = count_consecutive(bd, ap, d, us_c);
                if (cnt >= 1) { can_counter = true; best_counter_size += cnt + 1; break; }
            }
        });
        if (can_counter) {
            int me = std::max(0, M - 1);
            if (best_counter_size > me) best_counter_size = me;
            feat[22] = 1;  // SELF_FORCED_COUNTER (defender can counter)
            feat[25] = static_cast<int16_t>(best_counter_size);  // COUNTER_PER_STONE
        } else {
            feat[23] = 1;  // OPP_FORCED_COUNTER (attacker has safe ascension)
        }

        // BLOODSELL_EV: if defender has an offset (non-attack-position) counter
        bool has_offset = false;
        board.empties().foreach([&](int p) {
            if (has_offset || atk_bb.get(p)) return;
            for (int d = 0; d < NDIRS && !has_offset; ++d) {
                if (count_consecutive(bd, p, d, us_c) >= 1) has_offset = true;
            }
        });

        if (us == atk) {
            // We are the attacker (situation reversed in some search paths)
            feat[24] = 1;  // ATTACK_POS_FIELD
            feat[27] = static_cast<int16_t>(M);  // PENALTY_PER_STONE (for opponent)
        } else {
            // We are the defender
            feat[24] = 1;  // ATTACK_POS_FIELD
            if (!can_counter) {
                if (has_offset) {
                    feat[26] = 1;  // OFFSET_BONUS
                } else {
                    feat[28] = static_cast<int16_t>(M);  // URGENCY (forced HP loss)
                }
            }
        }

        // HP urgency blended
        int hpd_us = std::max(0, 6 - hp_us);
        int hpd_th = std::max(0, 6 - hp_them);
        int total_m = sm2 + sm3;
        feat[28] = static_cast<int16_t>(
            feat[28] + (total_m - om2 - om3) * hpd_us / 100 + total_m * hpd_th / 80);
    }
}

// ══════════════════════════════════════════════════════════════════
// evaluate_v6 — optimized mixed forward pass
//   Single 52-line PEXT pass: LINE_WEIGHT + M2/M3 in one scan.
//   4-way accumulators to break the 20-step dependency chain.
//   Global features computed inline (no duplicate PEXT for M2/M3).
// ══════════════════════════════════════════════════════════════════
int evaluate_v6(const Board& board) noexcept {
    if (board.ended()) [[unlikely]] {
        int w = board.winner();
        if (w == -2) return 0;
        Player us = board.turn();
        if ((us == Player::WHITE && w == 0) || (us == Player::BLACK && w == 1))
            return +EVAL_INF;
        return -EVAL_INF;
    }

    Player us = board.turn(), them = opponent(us);
    const uint8_t* bd = board.raw_board();
    uint8_t us_c = player_cell(us), them_c = player_cell(them);
    const BitBoard& bb_us = (us == Player::WHITE) ? board.white_bb() : board.black_bb();
    const BitBoard& bb_th = (them == Player::WHITE) ? board.white_bb() : board.black_bb();
    const auto& a_us = board.accum(us);
    const auto& a_th = board.accum(them);
    int hp_us = board.hp(us), hp_them = board.hp(them);

    // ── Single 52-line pass: LINE_WEIGHT + M2/M3 ────────────────
    // 4-way accumulators break dependency chain for out-of-order execution.
    int lw[4] = {0};       // LINE_WEIGHT accumulators
    int sm2 = 0, sm3 = 0;  // SELF M2/M3
    int om2 = 0, om3 = 0;  // OPP M2/M3
    int fline = 0;          // full-length line counter (0..19 → slot via &3)

    for (int li = 0; li < NUM_LINES; ++li) {
        int plen = LINE_LENGTH[li];
        if (plen < 2) continue;

        // Extract BOTH sides with one pext_line call each (no duplicate PEXT)
        uint64_t rs = pext_line(bb_us.b[0], bb_us.b[1], li);
        uint64_t ro = pext_line(bb_th.b[0], bb_th.b[1], li);

        if (plen == 9) {
            // Full-length line: LINE_WEIGHT + TABLE_MAXCONSEC M2/M3
            int e0 = LINE_ENDPOINTS[li][0];
            int e1 = LINE_ENDPOINTS[li][1];

            int et_s = 0;
            if (e0 >= 0 && bd[static_cast<size_t>(e0)] == them_c) et_s |= 1;
            if (e1 >= 0 && bd[static_cast<size_t>(e1)] == them_c) et_s |= 2;
            int et_o = 0;
            if (e0 >= 0 && bd[static_cast<size_t>(e0)] == us_c) et_o |= 1;
            if (e1 >= 0 && bd[static_cast<size_t>(e1)] == us_c) et_o |= 2;

            int slot = fline++ & 3;
            lw[slot] += V6::LINE_WEIGHT_SELF[rs & 0x1FF][et_s];
            lw[slot] += V6::LINE_WEIGHT_OPP[ro & 0x1FF][et_o];

            // M2/M3 with end_type < 3 filter (dead_3 exclusion)
            uint8_t mc = V6::TABLE_MAXCONSEC[rs & 0x1FF];
            if (mc >= 2 && et_s < 3) { if (mc == 2) ++sm2; else ++sm3; }
            mc = V6::TABLE_MAXCONSEC[ro & 0x1FF];
            if (mc >= 2 && et_o < 3) { if (mc == 2) ++om2; else ++om3; }
        } else {
            // Short diagonal: raw M2/M3 counting (no LINE_WEIGHT)
            auto add_m = [](uint64_t raw, int pl, int& m2, int& m3) {
                int maxc = 0, run = 0;
                for (int b = 0; b < pl; ++b, raw >>= 1) {
                    if (raw & 1) { ++run; if (run > maxc) maxc = run; }
                    else run = 0;
                }
                if (maxc == 2) ++m2; else if (maxc >= 3) ++m3;
            };
            add_m(rs, plen, sm2, sm3);
            add_m(ro, plen, om2, om3);
        }
    }

    int score = V6::BIAS + lw[0] + lw[1] + lw[2] + lw[3];

    // ── Global features (32-dim, inline, no duplicate PEXT) ─────
    alignas(32) int16_t feat[32] = {0};
    feat[31] = 1;  // BIAS slot

    // [0-10] Incremental accumulator features
    feat[0] = static_cast<int16_t>(a_us.piece_count);
    feat[1] = static_cast<int16_t>(a_th.piece_count);
    feat[2] = static_cast<int16_t>(hp_us - hp_them);
    int iso_self, iso_opp;
    count_isolated_both(bd, us_c, them_c, iso_self, iso_opp);
    feat[3] = static_cast<int16_t>(iso_self);
    feat[4] = static_cast<int16_t>(iso_opp);
    feat[5] = static_cast<int16_t>(a_us.pos_score);
    feat[6] = static_cast<int16_t>(a_th.pos_score);
    feat[7] = static_cast<int16_t>(a_us.edge_count);
    feat[8] = static_cast<int16_t>(a_th.edge_count);
    feat[9] = static_cast<int16_t>(a_us.conn_pairs);
    feat[10] = static_cast<int16_t>(a_th.conn_pairs);

    // [11-14] M2/M3 (pre-computed in merged loop above)
    feat[11] = static_cast<int16_t>(sm2);
    feat[12] = static_cast<int16_t>(om2);
    feat[13] = static_cast<int16_t>(sm3);
    feat[14] = static_cast<int16_t>(om3);

    // [15] EMPTINESS
    int n_empty = board.empties().popcount();
    feat[15] = static_cast<int16_t>(n_empty);

    // [16-17] HP nonlinear + TEMPO
    feat[16] = static_cast<int16_t>(std::abs(hp_us - hp_them));
    feat[17] = static_cast<int16_t>(n_empty / 9);

    // [18-19] Death line
    feat[18] = (hp_us <= 1) ? 1 : 0;
    feat[19] = (hp_them <= 1) ? 1 : 0;

    // [24-28] Attack state (cold path — function call is fine)
    if (board.attack_active()) [[unlikely]] {
        feat[24] = 1;  // ATTACK_POS_FIELD
        int M = board.attack_M();
        const auto& atk_bb = board.attack_positions_bb();
        bool can_counter = false;
        int best_ctr = 0;
        atk_bb.foreach([&](int ap) {
            for (int d = 0; d < NDIRS; ++d) {
                int cnt = count_consecutive(bd, ap, d, us_c);
                if (cnt >= 1) { can_counter = true; best_ctr += cnt + 1; break; }
            }
        });
        if (can_counter) {
            feat[22] = 1;  // SELF_FORCED_COUNTER
            int me = std::max(0, M - 1);
            if (best_ctr > me) best_ctr = me;
            feat[25] = static_cast<int16_t>(best_ctr);
        } else {
            feat[23] = 1;  // OPP_FORCED_COUNTER
        }
        // Urgency blended
        int hpd_us = std::max(0, 6 - hp_us);
        int hpd_th = std::max(0, 6 - hp_them);
        feat[28] = static_cast<int16_t>(
            feat[28] + (sm2+sm3 - om2-om3) * hpd_us / 100 + (sm2+sm3) * hpd_th / 80);
    }

    // ── 32-dim AVX2 dot product ──
#if defined(__AVX2__) && defined(__BMI2__)
    __m256i s0 = _mm256_madd_epi16(
        _mm256_load_si256((const __m256i*)&feat[0]),
        _mm256_load_si256((const __m256i*)&V6::WEIGHT_GLOBAL[0]));
    __m256i s1 = _mm256_madd_epi16(
        _mm256_load_si256((const __m256i*)&feat[16]),
        _mm256_load_si256((const __m256i*)&V6::WEIGHT_GLOBAL[16]));
    __m256i sum = _mm256_add_epi32(s0, s1);
    __m128i lo = _mm256_castsi256_si128(sum);
    __m128i hi = _mm256_extracti128_si256(sum, 1);
    __m128i tot128 = _mm_add_epi32(lo, hi);
    tot128 = _mm_hadd_epi32(tot128, tot128);
    tot128 = _mm_hadd_epi32(tot128, tot128);
    score += _mm_cvtsi128_si32(tot128);
#else
    for (int i = 0; i < 32; ++i)
        score += static_cast<int>(feat[i]) * static_cast<int>(V6::WEIGHT_GLOBAL[i]);
#endif

    // Normalize to cp space: 100cp ≈ sigmoid(0.6) ≈ 64% win prob.
    // Calibrated for K=1/136, SCALE=652 (Gen 5). Ensures values fit int16 TT.
    return static_cast<int>(static_cast<float>(score) * V6::K * 166.67f
                           / static_cast<float>(V6::CPP_SCALE));
}
    // Clear all 64 features
} // namespace hce
