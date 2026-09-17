/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 主入口 (含 WebAssembly 调试打印)
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "hce/board.hpp"
#include "hce/search.hpp"
#include "hce/evaluate.hpp"
#include "hce/tables.hpp"

#include <cstdio>
#include <chrono>
#include <algorithm>
#include <emscripten/bind.h>

using namespace hce;

class AiHce {
public:
    AiHce(uint8_t first) {
        // 确保全局预计算表初始化（如果 CLI 里需要，WASM 往往也需要）
        static bool tables_initialized = false;
        if (!tables_initialized) {
            init_tables();
            tables_initialized = true;
        }
        board.set_first(first); 
        std::printf("[WASM Init] Board initialized. First player: %d\n", first);
    };

    // 打印棋盘辅助函数（移植自你的 CLI）
    void debug_show_board() {
        std::printf("\n   ");
        for (int c = 0; c < 9; ++c) std::printf(" %d", c);
        std::printf("\n");
        for (int r = 0; r < 9; ++r) {
            std::printf("%d ", r);
            for (int c = 0; c < 9; ++c) {
                Cell cl = board.cell(r * 9 + c);
                if (cl == Cell::WHITE)       std::printf(" ●");
                else if (cl == Cell::BLACK)  std::printf(" ○");
                else                         std::printf(" .");
            }
            std::printf("\n");
        }
        std::printf("HP: W=%d B=%d  Turn: %s  Moves: %d\n",
            board.hp(Player::WHITE), board.hp(Player::BLACK),
            board.turn() == Player::WHITE ? "WHITE" : "BLACK",
            board.move_count());

        if (board.attack_active()) {
            std::printf("⚡ ATTACK! M=%d, positions: ", board.attack_M());
            board.attack_positions_bb().foreach([&](int p) {
                std::printf("(%d,%d) ", p / 9, p % 9);
            });
            std::printf("\n");
        }
        if (board.ended()) {
            int w = board.winner();
            if (w == 0)       std::printf("🏆 WHITE wins!\n");
            else if (w == 1)  std::printf("🏆 BLACK wins!\n");
            else if (w == -2) std::printf("🤝 DRAW\n");
        }
    }

    void turn(uint8_t index) {
        int r = index / 9;
        int c = index % 9;
        std::printf("\n[WASM Turn] Received move index: %d -> Coordinate: (%d,%d)\n", index, r, c);
        
        if (index >= 81 || board.cell(index) != Cell::EMPTY) {
            std::printf("❌ [WASM ERROR] Invalid external move! Cell occupied or Out of bounds!\n");
            return;
        }

        (void)board.make_move(index);
        
        // 落子后打印棋盘状态
        debug_show_board();
    };

    uint8_t think(uint32_t time, uint32_t num_threads) {
        std::printf("\n[WASM Think] AI thinking started... Time limit: %d ms, Threads: %d\n", time, num_threads);
        
        if (board.ended()) { 
            std::printf("❌ [WASM WARNING] AI requested to think, but game has already ended.\n"); 
            return 255; 
        }

        search.reset_stats();
        auto t0 = std::chrono::steady_clock::now();
        
        int best = search.think(board, time, num_threads);
        
        // 验证最佳走法（移植自你的 CLI 防御性逻辑，防止不合法的 TT 残留）
        if (best < 0 || best >= 81 || board.cell(best) != Cell::EMPTY) {
            std::printf("⚠️ [WASM WARNING] AI returned invalid move index %d! Falling back to first empty cell.\n", best);
            best = -1;
            for (int p = 0; p < 81; ++p) {
                if (board.cell(p) == Cell::EMPTY) { best = p; break; }
            }
        }
        
        auto t1 = std::chrono::steady_clock::now();
        auto elapsed_us = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();

        uint64_t nps = elapsed_us > 0
            ? search.nodes() * 1000000ULL / static_cast<uint64_t>(elapsed_us)
            : 0;

        if (best >= 0) {
            std::printf("\n━━━━━━━━━━━━━━━ AI SEARCH INFO ━━━━━━━━━━━━━━━\n");
            std::printf("Best move index: %d -> Coordinate: (%d,%d)\n", best, best / 9, best % 9);
            std::printf("Depth reached: %d | Nodes: %llu\n", search.depth_reached(), static_cast<unsigned long long>(search.nodes()));
            std::printf("Time: %lld.%03lld ms | NPS: %llu\n", 
                static_cast<long long>(elapsed_us) / 1000, 
                static_cast<long long>(elapsed_us) % 1000, 
                static_cast<unsigned long long>(nps));

            // 提取并打印 PV Line (主要对局路线)
            {
                Board pv_board = board.clone();
                int pv[64];
                int pv_len = 0;
                search.extract_pv(pv_board, pv, pv_len);
                if (pv_len > 0) {
                    std::printf("PV Line: ");
                    for (int i = 0; i < pv_len && i < 10; ++i)
                        std::printf("(%d,%d) ", pv[i] / 9, pv[i] % 9);
                    std::printf("\n");
                }
            }
            std::printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

            // AI 执行落子
            (void)board.make_move(best);
        } else {
            std::printf("❌ [WASM ERROR] AI couldn't find any valid move!\n");
        }

        // AI 落子后展示棋盘
        debug_show_board();
        
        return static_cast<uint8_t>(best);
    };

private:
    hce::Board  board;
    hce::Search search;
};

// 导出
EMSCRIPTEN_BINDINGS(my_wasm_module) {
    emscripten::class_<AiHce>("AI_HCE")
        .constructor<uint8_t>()
        .function("turn", &AiHce::turn)
        .function("think", &AiHce::think);
}