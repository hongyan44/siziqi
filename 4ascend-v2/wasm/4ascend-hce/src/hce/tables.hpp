#pragma once

#include "bitboard.hpp"

// ============================================================================
// Table Initialization — precompute all lookup tables
//
// Called once at startup. Computes:
//   - line_mask[81][4]          — bitmask of all cells on the line
//   - dir_len[81][4][2]         — forward/backward step counts
//   - stretch[81][4][5]         — N-step direction masks
//   - POS_WEIGHT[81]            — center-weighted positional values
// ============================================================================

namespace hce {

void init_tables() noexcept;

} // namespace hce
