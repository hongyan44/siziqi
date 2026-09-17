// ============================================================================
// Board — 9×9 stone game with attack/ascend mechanics
// ============================================================================

#include "board.hpp"
#include "tt.hpp"     // for compute_hash, zobrist tables
#include "evaluate.hpp"  // for evaluate_fast (lazy cache)
#include <cstdio>
#include <cstdlib>

#include <algorithm>
#include <cstring>
#include <charconv>

namespace hce {

// ============================================================================
// Construction
// ============================================================================
Board::Board() noexcept {
    reset();
}

void Board::reset() noexcept {
    board_.fill(0);
    white_.clear_all();
    black_.clear_all();
    turn_ = Player::WHITE;
    hp_[0] = MAX_HP;
    hp_[1] = MAX_HP;
    move_cnt_ = 0;
    attack_active_ = false;
    attack_M_ = 0;
    attacker_ = Player::WHITE;
    accum_[0].clear();
    accum_[1].clear();
    atk_pos_bb_.clear_all();
    last_move_ = -1;
    hash_valid_ = false;
    cached_fast_valid_ = false;
    cached_full_valid_ = false;
    history_top_ = -1;
}

// ─── Tactical seeding — full state recomputation ────────────────────
// Bypasses make_move to set arbitrary positions. Recomputes ALL derived
// state: zobrist hash, accumulators, bitboards, cached evals.
// Called once per game start — recompute cost (~1µs) is negligible.
void Board::load_seed(const int8_t* cells, int n) noexcept {
    reset();
    int nw = 0, nb = 0;
    for (int i = 0; i < n; ++i) {
        int pos = cells[i];
        bool is_white = (i < n/2);
        board_[static_cast<size_t>(pos)] = is_white ? 1 : 2;
        if (is_white) { white_.set(pos); ++nw; }
        else          { black_.set(pos); ++nb; }
    }
    turn_ = (nw > nb) ? Player::BLACK : Player::WHITE;
    move_cnt_ = nw + nb;
    history_top_ = -1;
    recompute_state();
}

void Board::recompute_state() noexcept {
    hash_ = 0;
    accum_[0].clear();
    accum_[1].clear();

    // ── 防御性攻击态检测 ──────────────────────────────────────────
    // load_seed() 的种子模式禁止创建 ≥4 连子（应在此前触发了升仙移除）。
    // 用 PEXT 扫描所有线，发现 ≥4 则断言失败。
    for (int li = 0; li < NUM_LINES; ++li) {
        if (LINE_LENGTH[li] < 4) continue;
        auto check_line = [&](const BitBoard& bb) -> bool {
            uint64_t pat = pext_line(bb.b[0], bb.b[1], li);
            int run = 0;
            for (int b = 0; b < LINE_LENGTH[li]; ++b) {
                if ((pat >> b) & 1) { if (++run >= 4) return true; }
                else run = 0;
            }
            return false;
        };
        if (check_line(white_) || check_line(black_)) {
            fprintf(stderr, "FATAL: load_seed() created ≥4-in-a-row (line %d). "
                            "Seed patterns must not create ascensions.\\n", li);
            std::abort();
        }
    }
    attack_active_ = false;
    atk_pos_bb_.clear_all();

    for (int p = 0; p < BOARD_SIZE; ++p) {
        uint8_t cl = board_[static_cast<size_t>(p)];
        if (cl == 0) continue;
        int idx = (cl == 1) ? 0 : 1;
        int r = p / BOARD_DIM, c = p % BOARD_DIM;
        hash_ ^= zobrist_table[p][static_cast<int>(cl)];
        accum_[idx].piece_count++;
        accum_[idx].pos_score += POS_WEIGHT[static_cast<size_t>(p)];
        if (r == 0 || r == BOARD_DIM-1 || c == 0 || c == BOARD_DIM-1)
            accum_[idx].edge_count++;
    }

    for (int p = 0; p < BOARD_SIZE; ++p) {
        uint8_t cl = board_[static_cast<size_t>(p)];
        if (cl == 0) continue;
        int idx = (cl == 1) ? 0 : 1;
        int adj = count_adjacent_same(board_.data(), p, cl);
        accum_[idx].conn_pairs += adj;
        if (adj == 0) accum_[idx].isolated++;
    }
    accum_[0].conn_pairs /= 2;
    accum_[1].conn_pairs /= 2;

    // XOR HP and turn state into hash (seeded boards have full HP)
    hash_ ^= zobrist_hp[0][static_cast<size_t>(hp_[0])];
    hash_ ^= zobrist_hp[1][static_cast<size_t>(hp_[1])];
    if (turn_ == Player::BLACK) hash_ ^= zobrist_turn;

    hash_valid_ = true;
    cached_fast_valid_ = false;
    cached_full_valid_ = false;
}

Board Board::clone() const noexcept {
    Board b;
    b.board_ = board_;
    b.white_ = white_;
    b.black_ = black_;
    b.turn_ = turn_;
    b.hp_[0] = hp_[0]; b.hp_[1] = hp_[1];
    b.move_cnt_ = move_cnt_;
    b.attack_active_ = attack_active_;
    b.attack_M_ = attack_M_;
    b.attacker_ = attacker_;
    b.accum_[0] = accum_[0];
    b.accum_[1] = accum_[1];
    b.atk_pos_bb_ = atk_pos_bb_;
    b.last_move_ = last_move_;
    b.hash_ = hash_;
    b.hash_valid_ = hash_valid_;
    b.history_top_ = -1;
    return b;
}

// ============================================================================
// FEN: export current position to string
// ============================================================================
std::string Board::to_fen() const noexcept {
    std::string fen;
    fen.reserve(128);

    // Board rows (top = row 0, bottom = row 8)
    for (int r = 0; r < BOARD_DIM; ++r) {
        int empty_run = 0;
        for (int c = 0; c < BOARD_DIM; ++c) {
            Cell cl = cell(sq(r, c));
            if (cl == Cell::EMPTY) {
                ++empty_run;
            } else {
                if (empty_run > 0) {
                    fen += static_cast<char>('0' + empty_run);
                    empty_run = 0;
                }
                fen += (cl == Cell::WHITE) ? 'w' : 'b';
            }
        }
        if (empty_run > 0)
            fen += static_cast<char>('0' + empty_run);
        if (r < BOARD_DIM - 1)
            fen += '/';
    }

    // Side to move
    fen += ' ';
    fen += (turn_ == Player::WHITE) ? 'w' : 'b';

    // HP
    fen += ' ';
    fen += static_cast<char>('0' + hp_[0]);
    fen += ' ';
    fen += static_cast<char>('0' + hp_[1]);

    // Attack state (if active)
    if (attack_active_) {
        fen += " attack ";
        fen += static_cast<char>('0' + attack_M_);
        fen += ' ';
        fen += (attacker_ == Player::WHITE) ? 'W' : 'B';
        atk_pos_bb_.foreach([&](int p) {
            char buf[4];
            auto [ptr, ec] = std::to_chars(buf, buf + 4, p);
            *ptr = '\0';
            fen += ' ';
            fen += buf;
        });
    }

    // Move count
    fen += ' ';
    char buf[8];
    auto [ptr, ec] = std::to_chars(buf, buf + 8, move_cnt_);
    *ptr = '\0';
    fen += buf;

    return fen;
}

// ============================================================================
// FEN: load position from string
// ============================================================================
bool Board::load_fen(const char* fen) noexcept {
    reset();

    const char* p = fen;

    // ── Parse board rows ─────────────────────────────────────────────
    for (int r = 0; r < BOARD_DIM; ++r) {
        int c = 0;
        while (c < BOARD_DIM && *p && *p != ' ' && *p != '/') {
            if (*p >= '1' && *p <= '9') {
                int skip = static_cast<int>(*p - '0');
                c += skip;
                ++p;
            } else if (*p == 'w') {
                int pos = sq(r, c);
                board_[static_cast<size_t>(pos)] = 1;
                white_.set(pos);
                ++c; ++p;
            } else if (*p == 'b') {
                int pos = sq(r, c);
                board_[static_cast<size_t>(pos)] = 2;
                black_.set(pos);
                ++c; ++p;
            } else {
                return false;  // invalid char
            }
        }
        if (*p == '/') ++p;
    }

    // Skip any spaces before side-to-move
    while (*p == ' ') ++p;

    // ── Side to move ─────────────────────────────────────────────────
    if (*p == 'w') { turn_ = Player::WHITE; ++p; }
    else if (*p == 'b') { turn_ = Player::BLACK; ++p; }
    else return false;

    // ── HP ───────────────────────────────────────────────────────────
    while (*p == ' ') ++p;
    if (*p >= '0' && *p <= '9') { hp_[0] = static_cast<int>(*p - '0'); ++p; }
    else return false;
    while (*p == ' ') ++p;
    if (*p >= '0' && *p <= '9') { hp_[1] = static_cast<int>(*p - '0'); ++p; }
    else return false;

    // ── Attack state (optional) ──────────────────────────────────────
    while (*p == ' ') ++p;
    if (std::strncmp(p, "attack", 6) == 0) {
        p += 6;
        while (*p == ' ') ++p;
        // M value
        if (*p >= '0' && *p <= '9') { attack_M_ = static_cast<int>(*p - '0'); ++p; }
        else return false;
        while (*p == ' ') ++p;
        // Attacker
        if (*p == 'W') { attacker_ = Player::WHITE; ++p; }
        else if (*p == 'B') { attacker_ = Player::BLACK; ++p; }
        else return false;
        // Attack positions — read exactly attack_M_ coordinates
        int pos_read = 0;
        while (*p == ' ') ++p;
        while (*p >= '0' && *p <= '9' && pos_read < attack_M_) {
            int pos = 0;
            while (*p >= '0' && *p <= '9') {
                pos = pos * 10 + static_cast<int>(*p - '0');
                ++p;
            }
            if (pos >= 0 && pos < BOARD_SIZE)
                atk_pos_bb_.set(pos);
            ++pos_read;
            while (*p == ' ') ++p;
        }
        attack_active_ = true;
    }

    // ── Move count (optional, default computed from stones) ─────────
    while (*p == ' ') ++p;
    if (*p >= '0' && *p <= '9') {
        move_cnt_ = 0;
        while (*p >= '0' && *p <= '9') {
            move_cnt_ = move_cnt_ * 10 + static_cast<int>(*p - '0');
            ++p;
        }
    } else {
        move_cnt_ = white_.popcount() + black_.popcount();
    }

    // ── Recompute accumulators + hash from scratch ──────────────────
    // recompute_state() will abort if ≥4 exists on board, but a valid
    // FEN describes a post-ascension board (stones already removed),
    // so this check should pass.
    hash_ = 0;
    accum_[0].clear();
    accum_[1].clear();

    for (int pos = 0; pos < BOARD_SIZE; ++pos) {
        uint8_t cl = board_[static_cast<size_t>(pos)];
        if (cl == 0) continue;
        int idx = (cl == 1) ? 0 : 1;
        int r = pos / BOARD_DIM, c = pos % BOARD_DIM;
        hash_ ^= zobrist_table[pos][static_cast<int>(cl)];
        accum_[idx].piece_count++;
        accum_[idx].pos_score += POS_WEIGHT[static_cast<size_t>(pos)];
        if (r == 0 || r == BOARD_DIM - 1 || c == 0 || c == BOARD_DIM - 1)
            accum_[idx].edge_count++;
    }

    // Connectivity + isolated (need full board pass)
    for (int pos = 0; pos < BOARD_SIZE; ++pos) {
        uint8_t cl = board_[static_cast<size_t>(pos)];
        if (cl == 0) continue;
        int idx = (cl == 1) ? 0 : 1;
        int adj = count_adjacent_same(board_.data(), pos, cl);
        accum_[idx].conn_pairs += adj;
        if (adj == 0) accum_[idx].isolated++;
    }
    accum_[0].conn_pairs /= 2;
    accum_[1].conn_pairs /= 2;

    // HP hash
    hash_ ^= zobrist_hp[0][static_cast<size_t>(hp_[0])];
    hash_ ^= zobrist_hp[1][static_cast<size_t>(hp_[1])];

    // Turn hash
    if (turn_ == Player::BLACK)
        hash_ ^= zobrist_turn;

    // Attack state hash (if active)
    if (attack_active_) {
        hash_ ^= zobrist_attack_active;
        if (attack_M_ >= 0 && attack_M_ < 10)
            hash_ ^= zobrist_attack_M[static_cast<size_t>(attack_M_)];
    }

    hash_valid_ = true;
    cached_fast_valid_ = false;
    cached_full_valid_ = false;
    history_top_ = -1;
    last_move_ = -1;
    return true;
}

// ============================================================================
// Per-cell threat profile: how many directions form ≥4 for each side
// Used by evaluate with quick pre-filter.
// ============================================================================


// ============================================================================
// Ascension detection
// ============================================================================
AscensionResult Board::detect_ascension(int pos) const noexcept {
    AscensionResult result;
    Cell color = cell(pos);
    if (color == Cell::EMPTY) return result;

    int r = pos / BOARD_DIM, c = pos % BOARD_DIM;
    int as_buf[BOARD_SIZE];
    int as_n = 0;

    for (int d = 0; d < NDIRS; ++d) {
        int dr = DR[d], dc = DC[d];
        int line[BOARD_SIZE];
        int ln = 0;
        line[ln++] = pos;

        // +direction
        for (int nr = r + dr, nc = c + dc;
             nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
             nr += dr, nc += dc) {
            if (board_[static_cast<size_t>(nr * BOARD_DIM + nc)] != static_cast<uint8_t>(color))
                break;
            line[ln++] = nr * BOARD_DIM + nc;
        }
        // -direction
        for (int nr = r - dr, nc = c - dc;
             nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
             nr -= dr, nc -= dc) {
            if (board_[static_cast<size_t>(nr * BOARD_DIM + nc)] != static_cast<uint8_t>(color))
                break;
            line[ln++] = nr * BOARD_DIM + nc;
        }

        if (ln >= 4) {
            // Add unique cells to result buffer
            for (int i = 0; i < ln; ++i) {
                bool dup = false;
                for (int j = 0; j < as_n; ++j) {
                    if (as_buf[j] == line[i]) { dup = true; break; }
                }
                if (!dup) as_buf[as_n++] = line[i];
            }
        }
    }

    // Copy to result (sorted)
    std::sort(as_buf, as_buf + as_n);
    for (int i = 0; i < as_n; ++i)
        result.cells[static_cast<size_t>(i)] = as_buf[i];
    result.count = as_n;
    return result;
}

// ============================================================================
// Legal moves (fills span, returns count)
// ============================================================================
int Board::legal_moves(std::span<int> out) const noexcept {
    int count = 0;
    for (int i = 0; i < BOARD_SIZE && count < static_cast<int>(out.size()); ++i) {
        if (board_[static_cast<size_t>(i)] == 0)
            out[static_cast<size_t>(count++)] = i;
    }
    return count;
}

// ============================================================================
// Step — core move logic with INCREMENTAL ZOBRIST HASH
// ============================================================================
bool Board::step(int pos) noexcept {
    if (pos < 0 || pos >= BOARD_SIZE) return false;
    if (board_[static_cast<size_t>(pos)] != 0) return false;

    // Initialize hash if needed (first move)
    if (!hash_valid_) {
        hash_ = compute_hash(*this);
        hash_valid_ = true;
    }

    if (attack_active_) {
        // ── Attack response ─────────────────────────────────────────
        Player defender = turn_;
        Player atk = attacker_;
        uint8_t def_c = player_cell(defender);

        // Incr hash: cell EMPTY → defender stone
        hash_ ^= zobrist_table[pos][0];
        hash_ ^= zobrist_table[pos][static_cast<int>(def_c)];

        board_[static_cast<size_t>(pos)] = def_c;
        if (defender == Player::WHITE) white_.set(pos);
        else                           black_.set(pos);
        accum_[to_underlying(defender)].piece_count++;
        accum_[to_underlying(defender)].pos_score += POS_WEIGHT[static_cast<size_t>(pos)];
        accum_[to_underlying(defender)].conn_pairs +=
            count_adjacent_same(board_.data(), pos, def_c);

        // Check for counter-ascension
        auto da = detect_ascension(pos);
        if (!da.empty()) {
            for (int i = 0; i < da.count; ++i) {
                int p = da.cells[static_cast<size_t>(i)];
                Cell old_c = static_cast<Cell>(board_[static_cast<size_t>(p)]);
                hash_ ^= zobrist_table[p][static_cast<int>(old_c)];
                hash_ ^= zobrist_table[p][0];
                Player owner = (old_c == Cell::WHITE) ? Player::WHITE : Player::BLACK;
                if (is_edge(p)) accum_[to_underlying(owner)].edge_count--;
                int r_ = row(p), c_ = col(p);
                uint8_t oc = static_cast<uint8_t>(old_c);
                if (r_ > 0          && board_[sq(r_-1, c_)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (r_ < BOARD_DIM-1 && board_[sq(r_+1, c_)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (c_ > 0          && board_[sq(r_, c_-1)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (c_ < BOARD_DIM-1 && board_[sq(r_, c_+1)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                board_[static_cast<size_t>(p)] = 0;
                if (owner == Player::WHITE) white_.clear(p);
                else                         black_.clear(p);
                accum_[to_underlying(owner)].piece_count--;
                accum_[to_underlying(owner)].pos_score -= POS_WEIGHT[static_cast<size_t>(p)];
            }
        }

        // Handle attack positions
        if (atk_pos_bb_.get(pos)) atk_pos_bb_.clear(pos);
        int A = atk_pos_bb_.count() - da.count;
        if (A > 0) {
            int idx = to_underlying(defender);
            hash_ ^= zobrist_hp[idx][hp_[idx]];
            hp_[idx] = std::max(0, hp_[idx] - A);
            hash_ ^= zobrist_hp[idx][hp_[idx]];
        } else if (A < 0) {
            int idx = to_underlying(atk);
            hash_ ^= zobrist_hp[idx][hp_[idx]];
            hp_[idx] = std::max(0, hp_[idx] + A);
            hash_ ^= zobrist_hp[idx][hp_[idx]];
        }

        hash_ ^= zobrist_attack_active;
        if (attack_M_ >= 0 && attack_M_ < 10) hash_ ^= zobrist_attack_M[static_cast<size_t>(attack_M_)];
        attack_active_ = false;
        atk_pos_bb_.clear_all();
        turn_ = atk;
        hash_ ^= zobrist_turn;
        ++move_cnt_;
        return true;
    } else {
        // ── Normal move ─────────────────────────────────────────────
        Player player = turn_;
        uint8_t p_cell = player_cell(player);

        hash_ ^= zobrist_table[pos][0];
        hash_ ^= zobrist_table[pos][static_cast<int>(p_cell)];

        board_[static_cast<size_t>(pos)] = p_cell;
        if (player == Player::WHITE) white_.set(pos);
        else                         black_.set(pos);
        accum_[to_underlying(player)].piece_count++;
        accum_[to_underlying(player)].pos_score += POS_WEIGHT[static_cast<size_t>(pos)];
        if (is_edge(pos)) accum_[to_underlying(player)].edge_count++;
        accum_[to_underlying(player)].conn_pairs +=
            count_adjacent_same(board_.data(), pos, p_cell);

        // Check for ascension
        auto da = detect_ascension(pos);
        if (!da.empty()) {
            int M = da.count;
            for (int i = 0; i < da.count; ++i) {
                int p = da.cells[static_cast<size_t>(i)];
                Cell old_c = static_cast<Cell>(board_[static_cast<size_t>(p)]);
                hash_ ^= zobrist_table[p][static_cast<int>(old_c)];
                hash_ ^= zobrist_table[p][0];
                Player owner = (old_c == Cell::WHITE) ? Player::WHITE : Player::BLACK;
                if (is_edge(p)) accum_[to_underlying(owner)].edge_count--;
                int r_ = row(p), c_ = col(p);
                uint8_t oc = static_cast<uint8_t>(old_c);
                if (r_ > 0          && board_[sq(r_-1, c_)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (r_ < BOARD_DIM-1 && board_[sq(r_+1, c_)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (c_ > 0          && board_[sq(r_, c_-1)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                if (c_ < BOARD_DIM-1 && board_[sq(r_, c_+1)] == oc) accum_[to_underlying(owner)].conn_pairs--;
                board_[static_cast<size_t>(p)] = 0;
                if (owner == Player::WHITE) white_.clear(p);
                else                         black_.clear(p);
                accum_[to_underlying(owner)].piece_count--;
                accum_[to_underlying(owner)].pos_score -= POS_WEIGHT[static_cast<size_t>(p)];
            }
            attack_active_ = true;
            attack_M_ = M;
            attacker_ = player;
            hash_ ^= zobrist_attack_active;
            if (M >= 0 && M < 10) hash_ ^= zobrist_attack_M[static_cast<size_t>(M)];
            atk_pos_bb_.clear_all();
            for (int i = 0; i < da.count; ++i)
                atk_pos_bb_.set(da.cells[static_cast<size_t>(i)]);
        }

        turn_ = opponent(player);
        hash_ ^= zobrist_turn;
        ++move_cnt_;
        return true;
    }
}

// ============================================================================
// make_move — save full state + hash, then step
// ============================================================================
bool Board::make_move(int pos) noexcept {
    if (history_top_ < MAX_PLY - 1) {
        ++history_top_;
    } else {
        history_top_ = 0;
    }

    auto& u = history_[static_cast<size_t>(history_top_)];
    auto& st = u.state;
    std::copy(board_.begin(), board_.end(), st.board);
    st.white_bb = white_;
    st.black_bb = black_;
    st.turn = to_underlying(turn_);
    st.hp[0] = static_cast<int8_t>(hp_[0]);
    st.hp[1] = static_cast<int8_t>(hp_[1]);
    st.move_cnt = static_cast<int16_t>(move_cnt_);
    st.attack_active = attack_active_ ? 1 : 0;
    st.attack_M = static_cast<int16_t>(attack_M_);
    st.attacker = to_underlying(attacker_);
    st.accum[0] = accum_[0];
    st.accum[1] = accum_[1];
    st.attack_bits[0] = atk_pos_bb_.b[0];
    st.last_move = static_cast<int16_t>(last_move_);
    st.attack_bits[1] = atk_pos_bb_.b[1];

    // Ensure hash is valid BEFORE saving it
    if (!hash_valid_) {
        hash_ = compute_hash(*this);
        hash_valid_ = true;
    }
    u.hash = hash_;
    u.fast_eval = cached_fast_eval_;
    u.fast_valid = cached_fast_valid_;
    u.full_eval = cached_full_eval_;
    u.full_valid = cached_full_valid_;

    // Update last move (before step so attack state can reference it)
    last_move_ = pos;

    bool result = step(pos);

    // Invalidate eval caches
    cached_fast_valid_ = false;
    cached_full_valid_ = false;

    return result;
}

// ============================================================================
// unmake_move — restore full state + saved hash
// ============================================================================
void Board::unmake_move() noexcept {
    if (history_top_ < 0) return;

    const auto& u = history_[static_cast<size_t>(history_top_)];
    const auto& st = u.state;
    std::copy(st.board, st.board + BOARD_SIZE, board_.begin());
    white_ = st.white_bb;
    black_ = st.black_bb;
    turn_ = static_cast<Player>(st.turn);
    hp_[0] = st.hp[0];
    hp_[1] = st.hp[1];
    move_cnt_ = st.move_cnt;
    attack_active_ = st.attack_active != 0;
    attack_M_ = st.attack_M;
    attacker_ = static_cast<Player>(st.attacker);
    accum_[0] = st.accum[0];
    accum_[1] = st.accum[1];
    atk_pos_bb_.b[0] = st.attack_bits[0];
    atk_pos_bb_.b[1] = st.attack_bits[1];
    last_move_ = st.last_move;

    // Restore hash and cached evals
    hash_ = u.hash;
    hash_valid_ = true;
    cached_fast_eval_ = u.fast_eval;
    cached_fast_valid_ = u.fast_valid;
    cached_full_eval_ = u.full_eval;
    cached_full_valid_ = u.full_valid;

    --history_top_;
}

// ============================================================================
// Winner detection
// ============================================================================
int Board::winner() const noexcept {
    if (hp_[0] <= 0) return 1;
    if (hp_[1] <= 0) return 0;
    if (!is_full()) return -1;

    if (hp_[0] > hp_[1]) return 0;
    if (hp_[1] > hp_[0]) return 1;

    int wc = white_.popcount();
    int bc = black_.popcount();
    if (wc > bc) return 0;
    if (bc > wc) return 1;
    return -2;
}

// ============================================================================
// Hash — always valid with incremental updates
// ============================================================================
uint64_t Board::hash() const noexcept {
    if (!hash_valid_) [[unlikely]] {
        hash_ = compute_hash(*this);
        hash_valid_ = true;
    }
    return hash_;
}

// ============================================================================
// Fast eval — lazily computed and cached
// Used by null-move, futility, razoring pruning (called 1-3× per node)
// ============================================================================
int Board::fast_eval() const noexcept {
    if (!cached_fast_valid_) [[unlikely]] {
        cached_fast_eval_ = evaluate_fast(*this);
        cached_fast_valid_ = true;
    }
    return cached_fast_eval_;
}

// ============================================================================
// Full V6 eval — lazily computed and cached (for search leaf nodes)
// Cache is invalidated on every make_move/unmake_move.
// ============================================================================
int Board::full_eval_v6() const noexcept {
    if (!cached_full_valid_) [[unlikely]] {
#if defined(USE_EVAL_v51)
        cached_full_eval_ = evaluate_v51(*this);
#else
        cached_full_eval_ = evaluate_v6(*this);
#endif
        cached_full_valid_ = true;
    }
    return cached_full_eval_;
}

} // namespace hce
