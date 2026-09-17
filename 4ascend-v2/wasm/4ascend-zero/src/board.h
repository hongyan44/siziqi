/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <bitset>
#include <cstdint>
#include <algorithm>


class Board {
public:
    explicit Board();
    ~Board();

    // // 复制赋值与构造
    // Board(const Board&)            = delete;
    // Board& operator=(const Board&) = delete;

    // // 移动复制与构造
    // Board(Board&&)            = delete;
    // Board& operator=(Board&&) = delete;

    // 设置
    void set_point(std::bitset<81>& target, uint8_t x, uint8_t y, bool v = true) noexcept;
    void set_point(std::bitset<81>& target, uint8_t index, bool v = true) noexcept;

    // 获取
    [[nodiscard]] bool get_point(const std::bitset<81>& target, uint8_t x, uint8_t y) noexcept;
    [[nodiscard]] bool get_point(const std::bitset<81>& target, uint8_t index) noexcept;

    // 计算数量
    [[nodiscard]] uint8_t count_black() noexcept;
    [[nodiscard]] uint8_t count_white() noexcept;
    [[nodiscard]] uint8_t count_stone() noexcept;

    // 得到ASCEND掩码
    [[nodiscard]] std::bitset<81> get_ascend(const std::bitset<81>& target, uint8_t x, uint8_t y) noexcept;
    [[nodiscard]] std::bitset<81> get_ascend(const std::bitset<81>& target, uint8_t index) noexcept;

    // 植物生成算法所需
    [[nodiscard]] std::bitset<81> expand_neighbors(const std::bitset<81>& target, uint8_t x, uint8_t y, bool self) noexcept;
    [[nodiscard]] std::bitset<81> expand_neighbors(const std::bitset<81>& target, uint8_t index, bool self) noexcept;

    // 得到可落子点位掩码
    [[nodiscard]] std::bitset<81> get_turns(const std::bitset<81>& my, const std::bitset<81>& foe) noexcept;

    // 得到连线价值
    void get_align(const std::bitset<81>& target, uint8_t x, uint8_t y, uint8_t& max_align, uint8_t& max_align_total) noexcept;
    void get_align(const std::bitset<81>& target, uint8_t index, uint8_t& max_align, uint8_t& max_align_total) noexcept;

    // 坐标转换
    [[nodiscard]] static uint8_t xy2index(uint8_t x, uint8_t y) noexcept;

    void static index2xy(uint8_t index, uint8_t& x, uint8_t& y) noexcept;

    // 输出棋盘
    void print(const std::bitset<81>& data) noexcept;

    std::bitset<81> black;  // 所有黑子（含普通、升级、已使用）
    std::bitset<81> white;  // 所有白子（含普通、升级、已使用）
    std::bitset<81> ascend; // 处于升级(Ascend)状态的格子
    std::bitset<81> used;   // 处于已使用(Used)状态的格子

    std::bitset<81> plant_lvl1; // 1级草
    std::bitset<81> plant_lvl2; // 2级草

    std::bitset<81> nc0;
    std::bitset<81> nc8;

private:
};