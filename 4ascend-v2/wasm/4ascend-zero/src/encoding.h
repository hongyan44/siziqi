#pragma once
#include "game.h"
#include <algorithm>

// 25 input planes; retain the Web first-player semantics for plane 7.
template <class Tensor>
void encode_state(Game& game, int as_player, Tensor& in) noexcept {
    uint8_t my_index  = as_player;
    uint8_t foe_index = my_index ^ 1;

    auto& my_stone  = *game.stones[my_index];
    auto& foe_stone = *game.stones[foe_index];

    auto my_solid  = my_stone & ~game.board.ascend & ~game.board.used;
    auto foe_solid = foe_stone & ~game.board.ascend & ~game.board.used;


    float* my_plane              = in.channel(0);
    float* foe_plane             = in.channel(1);
    float* ascend_stone_plane    = in.channel(2);
    float* myascend_click_plane  = in.channel(9);
    float* foeascend_click_plane = in.channel(10);
    float* plant_plane           = in.channel(3);

    for (int i = 0; i < 81; ++i) {
        float plant_val = 0.0f;
        if (game.board.plant_lvl2.test(i)) plant_val = 2.0f;
        else if (game.board.plant_lvl1.test(i)) plant_val = 1.0f;
        plant_plane[i] = plant_val;

        ascend_stone_plane[i] = static_cast<float>(game.board.ascend.test(i));

        foe_plane[i] = static_cast<float>(foe_solid.test(i));

        my_plane[i] = static_cast<float>(my_solid.test(i));

        // Only >=4 axes contribute; own occupied cells are zero in training.
        myascend_click_plane[i] = my_solid[i] ? 0.0f : static_cast<float>(game.board.get_ascend(my_solid, i).count());
        foeascend_click_plane[i] = foe_solid[i] ? 0.0f : static_cast<float>(game.board.get_ascend(foe_solid, i).count());
    }

    // 4. 我方生命值
    float* myhp_plane = in.channel(4);
    std::fill(myhp_plane, myhp_plane + 81, static_cast<float>(game.state.hp[my_index]));

    // 5. 对方生命值
    float* foehp_plane = in.channel(5);
    std::fill(foehp_plane, foehp_plane + 81, static_cast<float>(game.state.hp[foe_index]));

    // 6. 是否处于ASCEND已发起状态
    float* ascend_status_plane = in.channel(6);
    std::fill(ascend_status_plane, ascend_status_plane + 81, static_cast<float>(game.state.ascend_status)); // NONE, START, END

    // 7. 是否是先手的回合。
    float* frist_plane = in.channel(7);
    std::fill(frist_plane, frist_plane + 81, static_cast<float>(game.state.turn_player == game.state.turn_first));

    // 8. 植物生成冷却，如果处于发起ASCEND状态为1
    // 8. 如果为偶数，则为0，如果为奇数，则为1
    float* plantcd_plane = in.channel(8);
    // std::fill(plantcd_plane, plantcd_plane + 81, game.state.ascend_status == 1 ? 1.0f : static_cast<float>(game.state.grow_count % 2));

    float grow_flag = (game.state.ascend_status != 0) ? 1.0f : static_cast<float>(game.state.grow_count % 2);
    std::fill(plantcd_plane, plantcd_plane + 81, grow_flag);

    // 11-24: newest PRE-move board first; color order follows historical turn parity.
    // This intentionally matches Python, rather than using as_player for history.
    int ch = 11;

    const int turn = game.state.turn_count; // 当前回合数（已自增）
    for (int j = 1; j <= 7; ++j) {
        if (j > game.history_count) {
            // 历史不足，填零
            float* zero1 = in.channel(ch++);
            float* zero2 = in.channel(ch++);
            std::fill(zero1, zero1 + 81, 0.0f);
            std::fill(zero2, zero2 + 81, 0.0f);
        } else {
            const Board& hist     = game.history_boards[game.history_count - j]; // 较新的在末尾
            int          move_idx = turn - j;                                    // 该步的绝对回合数
            int          p_id     = (move_idx % 2 == 0) ? 1 : 2;                 // 黑=1，白=2

            float* me_plane  = in.channel(ch++);
            float* opp_plane = in.channel(ch++);

            // Historical ASCEND/USED markers are empty in Python grid.
            for (int i = 0; i < 81; ++i) {
                if (p_id == 1) {
                    me_plane[i]  = (hist.black & ~hist.ascend & ~hist.used)[i];
                    opp_plane[i] = (hist.white & ~hist.ascend & ~hist.used)[i];
                } else {
                    me_plane[i]  = (hist.white & ~hist.ascend & ~hist.used)[i];
                    opp_plane[i] = (hist.black & ~hist.ascend & ~hist.used)[i];
                }
            }
        }
    }
};
