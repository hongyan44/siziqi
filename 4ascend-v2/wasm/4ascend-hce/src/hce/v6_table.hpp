#pragma once
#include <cstdint>

namespace hce { namespace V6 {

// TABLE_MAXCONSEC[512] — max consecutive 1-bits for each 9-bit pattern.
// Used for M2/M3 counting with end_type filtering (dead_3 exclusion).
extern uint8_t TABLE_MAXCONSEC[512];

}} // namespace hce::V6
