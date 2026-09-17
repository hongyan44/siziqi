/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 主入口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "game.h"
#include "mcts.h"

#include <cstdlib>
#include <emscripten/bind.h>

#include <cstdint>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <numeric>


class AiZero {
public:
    AiZero(uint32_t seed1, uint32_t seed2, uint8_t first, uint8_t hp, bool plant) : game(seed1, seed2, plant) {
        game.state.turn_player = first;
        game.state.turn_first  = first;

        game.state.hp[0] = hp;
        game.state.hp[1] = hp;

        srand(time(NULL));
    };

    void set_overload(bool enabled) { game.state.always_overload = enabled; };

    // 载入残局初始盘面，不经过回合推进，保留棋子上的草状态。
    void set_cell(uint8_t index, uint8_t stone, uint8_t plant) { game.seed_cell(index, stone, plant); };

    void set_turn(uint8_t player) { game.state.turn_player = player & 1; game.state.turn_first = player & 1; };

    void set_turn_count(uint16_t count) { game.state.turn_count = count; };

    void set_hp(uint8_t black, uint8_t white) { game.seed_hp(black, white); };

    void turn(uint8_t index) { game.step(index); };

    uint8_t think(uint32_t sim) {
        MCTS mcts(2.0f, sim, 0.30f, 0.0f, rand());
        auto pi = mcts.run(game);

        int   best   = -1;
        float best_n = -1.0f;
        for (int a = 0; a < 81; ++a) {
            if (pi[a] > 0.0f && pi[a] > best_n) {
                best_n = pi[a];
                best   = a;
            }
        }

        // 显示详细的搜索统计
        auto counts     = mcts.get_root_counts();
        auto qvals      = mcts.get_root_q();
        int  total_sims = 0;
        for (int a = 0; a < 81; ++a) total_sims += counts[a];

        std::cout << "搜索统计 (总模拟次数: " << total_sims << ")\n";
        std::cout << "Top 5 动作:\n";
        // 按访问次数排序
        std::vector<int> idx(81);
        std::iota(idx.begin(), idx.end(), 0);
        std::partial_sort(idx.begin(), idx.begin() + 5, idx.end(), [&](int a, int b) { return counts[a] > counts[b]; });

        for (int i = 0; i < 5; ++i) {
            int a = idx[i];
            if (counts[a] == 0) break;
            float win_rate = (qvals[a] + 1.0f) * 0.5f; // 从 Q 值转换胜率
            std::cout << "  (" << (a % 9) << "," << (a / 9) << ") 访问: " << std::setw(4) << counts[a] << "  胜率: " << std::fixed << std::setprecision(1)
                      << win_rate * 100.0f << "%\n";
        }
        std::cout << "==========================================================\n";

        game.step(best);
        return best;
    };

    float winrate(uint32_t sim) {
        MCTS mcts(2.0f, sim, 0.30f, 0.0f, rand());
        auto pi = mcts.run(game);

        return mcts.get_root_winrate();
    };

private:
    Game game;
};

EMSCRIPTEN_BINDINGS(my_wasm_module) {
    emscripten::class_<AiZero>("AI_ZERO")
        .constructor<uint32_t, uint32_t, uint8_t, uint8_t, bool>()
        .function("set_overload", &AiZero::set_overload)
        .function("set_cell", &AiZero::set_cell)
        .function("set_turn", &AiZero::set_turn)
        .function("set_turn_count", &AiZero::set_turn_count)
        .function("set_hp", &AiZero::set_hp)
        .function("turn", &AiZero::turn)
        .function("think", &AiZero::think)
        .function("winrate", &AiZero::winrate);
}