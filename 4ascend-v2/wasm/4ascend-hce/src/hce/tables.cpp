#include "tables.hpp"
#include "v6_table.hpp"

namespace hce {

AttackTables G_AT;
NeighborTables G_NB;
int16_t POS_WEIGHT[BOARD_SIZE];

// V6 line scan tables
uint64_t LINE_MASK_LO[NUM_LINES];
uint64_t LINE_MASK_HI[NUM_LINES];
int      LINE_POP_LO[NUM_LINES];
int      LINE_LENGTH[NUM_LINES];
int16_t  LINE_ENDPOINTS[NUM_LINES][2];
bool     LINE_IS_DIAG[NUM_LINES];
uint64_t LINE_PAD[NUM_LINES];

void init_tables() noexcept {
    // Initialize neighbor tables (all -1 = out of bounds)
    for (int p = 0; p < BOARD_SIZE; ++p) {
        int r = row(p), c = col(p);
        for (int d = 0; d < NDIRS; ++d) {
            for (int k = 0; k < 8; ++k) {
                G_NB.fwd[p][d][k] = -1;
                G_NB.bwd[p][d][k] = -1;
            }
            int dr = DR[d], dc = DC[d];
            // fwd: +(k+1) steps
            for (int k = 0, nr = r+dr, nc = c+dc;
                 k < 8 && nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
                 ++k, nr += dr, nc += dc) {
                G_NB.fwd[p][d][k] = static_cast<int16_t>(sq(nr, nc));
            }
            // bwd: -(k+1) steps
            for (int k = 0, nr = r-dr, nc = c-dc;
                 k < 8 && nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
                 ++k, nr -= dr, nc -= dc) {
                G_NB.bwd[p][d][k] = static_cast<int16_t>(sq(nr, nc));
            }
        }
    }

    for (int p = 0; p < BOARD_SIZE; ++p) {
        int r = row(p), c = col(p);
        for (int d = 0; d < NDIRS; ++d) {
            int dr = DR[d], dc = DC[d];

            // Clear masks
            G_AT.line_mask[p][d].clear_all();
            for (int k = 0; k <= 4; ++k)
                G_AT.stretch[p][d][k].clear_all();

            // +direction
            int cnt_pos = 0;
            for (int nr = r + dr, nc = c + dc;
                 nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
                 nr += dr, nc += dc) {
                int sq_idx = sq(nr, nc);
                G_AT.line_mask[p][d].set(sq_idx);
                ++cnt_pos;
            }
            // -direction
            int cnt_neg = 0;
            for (int nr = r - dr, nc = c - dc;
                 nr >= 0 && nr < BOARD_DIM && nc >= 0 && nc < BOARD_DIM;
                 nr -= dr, nc -= dc) {
                int sq_idx = sq(nr, nc);
                G_AT.line_mask[p][d].set(sq_idx);
                ++cnt_neg;
            }
            // Include the position itself
            G_AT.line_mask[p][d].set(p);

            G_AT.dir_len[p][d][0] = cnt_pos;
            G_AT.dir_len[p][d][1] = cnt_neg;

            // Precompute stretch masks for k=1..4
            // stretch[k] = cells exactly k steps away in ±direction
            for (int k = 1; k <= 4; ++k) {
                BitBoard& st = G_AT.stretch[p][d][k];
                // +direction: k steps forward
                if (k <= cnt_pos) {
                    int nr = r + dr*k, nc = c + dc*k;
                    st.set(sq(nr, nc));
                }
                // -direction: k steps backward
                if (k <= cnt_neg) {
                    int nr = r - dr*k, nc = c - dc*k;
                    st.set(sq(nr, nc));
                }
            }
        }
    }

    // Positional weights: center-max (100), corner-min (20)
    for (int r = 0; r < BOARD_DIM; ++r) {
        for (int c = 0; c < BOARD_DIM; ++c) {
            int dist = (r < 4 ? 4 - r : r - 4) + (c < 4 ? 4 - c : c - 4);
            POS_WEIGHT[sq(r, c)] = static_cast<int16_t>(100 - dist * 10);
        }
    }

    // ====================================================================
    // V6 PEXT line masks: rows (0-8), cols (9-17), diagonals ↘ (18-34), ↙ (35-51)
    // ====================================================================
    for (int i = 0; i < NUM_LINES; ++i) {
        LINE_MASK_LO[i] = 0;
        LINE_MASK_HI[i] = 0;
        LINE_POP_LO[i] = 0;
        LINE_LENGTH[i] = 0;
        LINE_ENDPOINTS[i][0] = -1;
        LINE_ENDPOINTS[i][1] = -1;
        LINE_IS_DIAG[i] = false;
    }

    // Rows: 0..8
    for (int r = 0; r < NUM_ROWS; ++r) {
        int idx = r;
        for (int c = 0; c < BOARD_DIM; ++c) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
        }
        LINE_ENDPOINTS[idx][0] = sq(r, 0);
        LINE_ENDPOINTS[idx][1] = sq(r, 8);
    }

    // Columns: 9..17
    for (int c = 0; c < NUM_COLS; ++c) {
        int idx = NUM_ROWS + c;
        for (int r = 0; r < BOARD_DIM; ++r) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
        }
        LINE_ENDPOINTS[idx][0] = sq(0, c);
        LINE_ENDPOINTS[idx][1] = sq(8, c);
    }

    // Diagonals ↘ (top-left to bottom-right): 18..34
    // Start positions: (r,0) for r=0..8, (0,c) for c=1..8
    int di = NUM_ROWS + NUM_COLS;
    for (int start = 0; start < BOARD_DIM; ++start) {
        // Diagonals starting from (start, 0)
        int idx = di++;
        LINE_IS_DIAG[idx] = true;
        int r = start, c = 0;
        while (r < BOARD_DIM && c < BOARD_DIM) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
            if (LINE_ENDPOINTS[idx][0] < 0) LINE_ENDPOINTS[idx][0] = p;
            LINE_ENDPOINTS[idx][1] = p;
            ++r; ++c;
        }
    }
    for (int start = 1; start < BOARD_DIM; ++start) {
        // Diagonals starting from (0, start)
        int idx = di++;
        LINE_IS_DIAG[idx] = true;
        int r = 0, c = start;
        while (r < BOARD_DIM && c < BOARD_DIM) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
            if (LINE_ENDPOINTS[idx][0] < 0) LINE_ENDPOINTS[idx][0] = p;
            LINE_ENDPOINTS[idx][1] = p;
            ++r; ++c;
        }
    }

    // Diagonals ↙ (bottom-left to top-right): 35..51
    for (int start = 0; start < BOARD_DIM; ++start) {
        // Diagonals starting from (start, 0) going up-right
        int idx = di++;
        LINE_IS_DIAG[idx] = true;
        int r = start, c = 0;
        while (r >= 0 && c < BOARD_DIM) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
            if (LINE_ENDPOINTS[idx][0] < 0) LINE_ENDPOINTS[idx][0] = p;
            LINE_ENDPOINTS[idx][1] = p;
            --r; ++c;
        }
    }
    for (int start = 1; start < BOARD_DIM; ++start) {
        // Diagonals starting from (8, start) going up-right
        int idx = di++;
        LINE_IS_DIAG[idx] = true;
        int r = 8, c = start;
        while (r >= 0 && c < BOARD_DIM) {
            int p = sq(r, c);
            if (p < 64) {
                LINE_MASK_LO[idx] |= (1ULL << p);
                ++LINE_POP_LO[idx];
            } else {
                LINE_MASK_HI[idx] |= (1ULL << (p - 64));
            }
            ++LINE_LENGTH[idx];
            if (LINE_ENDPOINTS[idx][0] < 0) LINE_ENDPOINTS[idx][0] = p;
            LINE_ENDPOINTS[idx][1] = p;
            --r; ++c;
        }
    }

    // Precompute LINE_PAD: for lines shorter than 9, fill trailing bits with 1s
    // (virtual cells beyond the board are "blocked" — cannot extend into them)
    for (int i = 0; i < NUM_LINES; ++i) {
        LINE_PAD[i] = 0;
        for (int b = LINE_LENGTH[i]; b < 9; ++b) {
            LINE_PAD[i] |= (1ULL << b);
        }
    }

    // V6 TABLE_LINE initialized via global initializer
}

} // namespace hce
