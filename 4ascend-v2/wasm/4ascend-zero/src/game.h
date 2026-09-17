/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "board.h"
#include "rand.h"
#include "state.h"

#include <array>


class Game {
public:
    explicit Game(uint32_t seed_aic, uint32_t seed_uinty, bool plant);
    Game(const Game& other);
    ~Game();

    // Game(const Game&)            = delete;
    Game& operator=(const Game&) = delete; // pointers must never alias another board
    // Game(Game&&)                 = delete;
    // Game& operator=(Game&&)      = delete;

    void               step(uint8_t index) noexcept;
    void               seed_cell(uint8_t index, uint8_t stone, uint8_t plant) noexcept;
    void               seed_turn(uint8_t player, uint16_t turn_count) noexcept;
    void               seed_hp(uint8_t black, uint8_t white) noexcept;
    [[nodiscard]] bool end(uint8_t& winer) noexcept;

    [[nodiscard]] Game clone() noexcept;

    Board board;
    State state;

    std::bitset<81>* stones[2];

    std::array<Board, 7> history_boards;    // 最近 7 步的棋盘快照
    uint8_t              history_count = 0; // 已存储的快照数量（最多 7）

private:
    void start_turn(uint8_t index) noexcept;

    void check_ascend() noexcept;
    void clear_ascend() noexcept;

    void end_turn() noexcept;

    void scan_point(bool flag3, bool flag4, std::vector<uint8_t>& points) noexcept;
    void scan_score(uint8_t plant_count, bool atk, bool flag, bool flag2, bool flag4, std::vector<uint8_t>& points, std::vector<uint8_t>& result) noexcept;
    void scan_run(uint8_t plant_count, std::vector<uint8_t>& result) noexcept;

    void create_plant() noexcept;
    void clear_plant() noexcept;

    RandAIC   rand_aic;
    RandUinty rand_uinty;

    bool plant;
};