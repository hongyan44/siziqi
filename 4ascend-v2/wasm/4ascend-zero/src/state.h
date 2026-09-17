/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>


struct State {
    uint16_t turn_count = 0;

    uint8_t turn_first = 0; // BLACK, WHITE

    uint8_t turn_player = 0; // BLACK, WHITE
    uint8_t turn_pos    = 0; // index

    uint8_t ascend_status = 0;      // NONE, START, END
    int8_t  hp[2]         = {6, 6}; // BLACK, WHITE

    uint8_t unascend_charge     = 25;
    uint8_t unascend_chargef[2] = {9, 9}; // BLACK, WHITE

    bool always_overload = false; // GameNight
    uint8_t over_status   = 0;     // NONE, ENABLE, EXECUTE
    bool    just_unascend = false; // 如果必须用 int，可以写成 int just_unascend = 0;
    uint8_t grow_count    = 11;    // max 11
};