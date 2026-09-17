/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋盘
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "board.h"

#include <iostream>


Board::Board() {
    for (int i = 0; i < 81; ++i) {
        if (i % 9 != 0) nc0.set(i);
        if (i % 9 != 8) nc8.set(i);
    }
};
Board::~Board() = default;


uint8_t Board::xy2index(uint8_t x, uint8_t y) noexcept { return y * 9 + x; };
void    Board::index2xy(uint8_t index, uint8_t& x, uint8_t& y) noexcept {
    x = index % 9; // 列
    y = index / 9; // 行
};


void Board::set_point(std::bitset<81>& target, uint8_t x, uint8_t y, bool v) noexcept { target.set(xy2index(x, y), v); };
void Board::set_point(std::bitset<81>& target, uint8_t index, bool v) noexcept { target.set(index, v); };

bool Board::get_point(const std::bitset<81>& target, uint8_t x, uint8_t y) noexcept { return target.test(xy2index(x, y)); };
bool Board::get_point(const std::bitset<81>& target, uint8_t index) noexcept { return target.test(index); };

uint8_t Board::count_black() noexcept { return static_cast<uint8_t>((black & ~ascend & ~used).count()); };
uint8_t Board::count_white() noexcept { return static_cast<uint8_t>((white & ~ascend & ~used).count()); };
uint8_t Board::count_stone() noexcept { return static_cast<uint8_t>(((black | white) & ~ascend & ~used).count()); };

std::bitset<81> Board::get_ascend(const std::bitset<81>& target, uint8_t x, uint8_t y) noexcept {
    auto index = xy2index(x, y);

    std::bitset<81> result;

    // 建立中心点的独立掩码
    std::bitset<81> center_bit;
    center_bit.set(index);

    // 无边界限制（用于上下移动）
    static std::bitset<81> all_ones;
    all_ones.set();

    // 核心传播 Lambda：带早停（Early Exit）优化，移除内部计数
    auto propagate = [&](auto shift_fn, const std::bitset<81>& edge_mask) {
        std::bitset<81> out_seg;
        std::bitset<81> curr = center_bit;

        // 编译器会自动展开此循环
        for (int i = 0; i < 8; ++i) {
            curr = shift_fn(curr) & target & edge_mask;
            if (curr.none()) break; // 极大减少空旷盘面下的无效位移操作
            out_seg |= curr;
        }
        return out_seg; // 依赖 NRVO 优化，无复制开销
    };

    std::bitset<81> seg1, seg2;

    // --- 轴线 1：水平方向 (右 / 左) ---
    seg1 = propagate([](auto b) { return b << 1; }, nc0);
    seg2 = propagate([](auto b) { return b >> 1; }, nc8);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 2：垂直方向 (下 / 上) ---
    seg1 = propagate([](auto b) { return b << 9; }, all_ones);
    seg2 = propagate([](auto b) { return b >> 9; }, all_ones);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 3：主对角线 \ (右下 / 左上) ---
    seg1 = propagate([](auto b) { return b << 10; }, nc0);
    seg2 = propagate([](auto b) { return b >> 10; }, nc8);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 4：副对角线 / (左下 / 右上) ---
    // 【修复 Bug】 修正了原代码中副对角线边缘掩码颠倒的问题
    seg1 = propagate([](auto b) { return b << 8; }, nc8);
    seg2 = propagate([](auto b) { return b >> 8; }, nc0);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // 如果任何一个轴向形成了 ASCEND，中心点才会被合入结果
    if (result.any()) result.set(index);

    return result;
};
std::bitset<81> Board::get_ascend(const std::bitset<81>& target, uint8_t index) noexcept {
    std::bitset<81> result;

    // 建立中心点的独立掩码
    std::bitset<81> center_bit;
    center_bit.set(index);

    // 无边界限制（用于上下移动）
    static std::bitset<81> all_ones;
    all_ones.set();

    // 核心传播 Lambda：带早停（Early Exit）优化，移除内部计数
    auto propagate = [&](auto shift_fn, const std::bitset<81>& edge_mask) {
        std::bitset<81> out_seg;
        std::bitset<81> curr = center_bit;

        // 编译器会自动展开此循环
        for (int i = 0; i < 8; ++i) {
            curr = shift_fn(curr) & target & edge_mask;
            if (curr.none()) break; // 极大减少空旷盘面下的无效位移操作
            out_seg |= curr;
        }
        return out_seg; // 依赖 NRVO 优化，无复制开销
    };

    std::bitset<81> seg1, seg2;

    // --- 轴线 1：水平方向 (右 / 左) ---
    seg1 = propagate([](auto b) { return b << 1; }, nc0);
    seg2 = propagate([](auto b) { return b >> 1; }, nc8);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 2：垂直方向 (下 / 上) ---
    seg1 = propagate([](auto b) { return b << 9; }, all_ones);
    seg2 = propagate([](auto b) { return b >> 9; }, all_ones);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 3：主对角线 \ (右下 / 左上) ---
    seg1 = propagate([](auto b) { return b << 10; }, nc0);
    seg2 = propagate([](auto b) { return b >> 10; }, nc8);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // --- 轴线 4：副对角线 / (左下 / 右上) ---
    // 【修复 Bug】 修正了原代码中副对角线边缘掩码颠倒的问题
    seg1 = propagate([](auto b) { return b << 8; }, nc8);
    seg2 = propagate([](auto b) { return b >> 8; }, nc0);
    if ((seg1 | seg2).count() >= 3) result |= (seg1 | seg2);

    // 如果任何一个轴向形成了 ASCEND，中心点才会被合入结果
    if (result.any()) result.set(index);

    return result;
};

std::bitset<81> Board::expand_neighbors(const std::bitset<81>& target, uint8_t x, uint8_t y, bool self) noexcept {
    auto index = xy2index(x, y);

    std::bitset<81> center;
    center.set(index);

    std::bitset<81> neighbors;
    neighbors |= (center << 9);          // 下
    neighbors |= (center >> 9);          // 上
    neighbors |= ((center << 1) & nc0);  // 右
    neighbors |= ((center >> 1) & nc8);  // 左
    neighbors |= ((center << 10) & nc0); // 右下
    neighbors |= ((center >> 10) & nc8); // 左上
    neighbors |= ((center << 8) & nc8);  // 左下
    neighbors |= ((center >> 8) & nc0);  // 右上

    std::bitset<81> result = neighbors & target;
    if (self && target.test(index)) result.set(index);
    return result;
};
std::bitset<81> Board::expand_neighbors(const std::bitset<81>& target, uint8_t index, bool self) noexcept {
    std::bitset<81> center;
    center.set(index);

    std::bitset<81> neighbors;
    neighbors |= (center << 9);          // 下
    neighbors |= (center >> 9);          // 上
    neighbors |= ((center << 1) & nc0);  // 右
    neighbors |= ((center >> 1) & nc8);  // 左
    neighbors |= ((center << 10) & nc0); // 右下
    neighbors |= ((center >> 10) & nc8); // 左上
    neighbors |= ((center << 8) & nc8);  // 左下
    neighbors |= ((center >> 8) & nc0);  // 右上

    std::bitset<81> result = neighbors & target;
    if (self && target.test(index)) result.set(index);
    return result;
}

void Board::get_align(const std::bitset<81>& target, uint8_t x, uint8_t y, uint8_t& max_align, uint8_t& max_align_total) noexcept {
    std::bitset<81> center_bit;
    center_bit.set(xy2index(x, y));

    static std::bitset<81> all_ones;
    all_ones.set();

    // 完美的 Lambda 模板：带早停优化，无内部计数开销
    auto propagate = [&](auto shift_fn, const std::bitset<81>& edge_mask) {
        std::bitset<81> out_seg;
        std::bitset<81> curr = center_bit;

        for (int i = 0; i < 8; ++i) {
            curr = shift_fn(curr) & target & edge_mask;
            if (curr.none()) break; // 空旷盘面下极大减少无效操作
            out_seg |= curr;
        }
        return out_seg;
    };

    // --- 严格对齐你的方向与掩码映射 ---
    // 轴线 1：垂直方向 (下 / 上)
    auto axis1 = propagate([](auto b) { return b << 9; }, all_ones) | propagate([](auto b) { return b >> 9; }, all_ones);

    // 轴线 2：水平方向 (右 / 左)
    auto axis2 = propagate([](auto b) { return b << 1; }, nc0) | propagate([](auto b) { return b >> 1; }, nc8);

    // 轴线 3：主对角线 \ (右下 / 左上)
    auto axis3 = propagate([](auto b) { return b << 10; }, nc0) | propagate([](auto b) { return b >> 10; }, nc8);

    // 轴线 4：副对角线 / (左下 / 右上)
    auto axis4 = propagate([](auto b) { return b << 8; }, nc8) | propagate([](auto b) { return b >> 8; }, nc0);

    // 计算每条轴线上的连续棋子总数（各轴线不含中心点，故统一 +1）
    uint8_t len1 = static_cast<uint8_t>(axis1.count() + 1);
    uint8_t len2 = static_cast<uint8_t>(axis2.count() + 1);
    uint8_t len3 = static_cast<uint8_t>(axis3.count() + 1);
    uint8_t len4 = static_cast<uint8_t>(axis4.count() + 1);

    // 取最大连线长度
    max_align = std::max({len1, len2, len3, len4});

    // 计算所有方向总连续长度
    // 绝妙之处：因为 4 条轴线完全互斥，直接将它们全 OR 起来做一次 popcnt，加上中心点 1 即可
    max_align_total = static_cast<uint8_t>((axis1 | axis2 | axis3 | axis4).count() + 1);
};
void Board::get_align(const std::bitset<81>& target, uint8_t index, uint8_t& max_align, uint8_t& max_align_total) noexcept {
    std::bitset<81> center_bit;
    center_bit.set(index);

    static std::bitset<81> all_ones;
    all_ones.set();

    // 完美的 Lambda 模板：带早停优化，无内部计数开销
    auto propagate = [&](auto shift_fn, const std::bitset<81>& edge_mask) {
        std::bitset<81> out_seg;
        std::bitset<81> curr = center_bit;

        for (int i = 0; i < 8; ++i) {
            curr = shift_fn(curr) & target & edge_mask;
            if (curr.none()) break; // 空旷盘面下极大减少无效操作
            out_seg |= curr;
        }
        return out_seg;
    };

    // --- 严格对齐你的方向与掩码映射 ---
    // 轴线 1：垂直方向 (下 / 上)
    auto axis1 = propagate([](auto b) { return b << 9; }, all_ones) | propagate([](auto b) { return b >> 9; }, all_ones);

    // 轴线 2：水平方向 (右 / 左)
    auto axis2 = propagate([](auto b) { return b << 1; }, nc0) | propagate([](auto b) { return b >> 1; }, nc8);

    // 轴线 3：主对角线 \ (右下 / 左上)
    auto axis3 = propagate([](auto b) { return b << 10; }, nc0) | propagate([](auto b) { return b >> 10; }, nc8);

    // 轴线 4：副对角线 / (左下 / 右上)
    auto axis4 = propagate([](auto b) { return b << 8; }, nc8) | propagate([](auto b) { return b >> 8; }, nc0);

    // 计算每条轴线上的连续棋子总数（各轴线不含中心点，故统一 +1）
    uint8_t len1 = static_cast<uint8_t>(axis1.count() + 1);
    uint8_t len2 = static_cast<uint8_t>(axis2.count() + 1);
    uint8_t len3 = static_cast<uint8_t>(axis3.count() + 1);
    uint8_t len4 = static_cast<uint8_t>(axis4.count() + 1);

    // 取最大连线长度
    max_align = std::max({len1, len2, len3, len4});

    // 计算所有方向总连续长度
    // 绝妙之处：因为 4 条轴线完全互斥，直接将它们全 OR 起来做一次 popcnt，加上中心点 1 即可
    max_align_total = static_cast<uint8_t>((axis1 | axis2 | axis3 | axis4).count() + 1);
};

std::bitset<81> Board::get_turns(const std::bitset<81>& my, const std::bitset<81>& foe) noexcept {
    // 没有任何棋子的空位（既不是我方，也不是敌方）
    std::bitset<81> empty_mask = ~(my | foe);

    // 必须是敌方棋子，且该位置处于 ASCEND 状态
    std::bitset<81> attack_mask = foe & ascend;

    // 两种情况取并集即为可落子点位
    return empty_mask | attack_mask;
};

void Board::print(const std::bitset<81>& data) noexcept {
    // 打印顶部列坐标 (0-8)
    std::cout << "  ";
    for (uint8_t x = 0; x < 9; ++x) {
        std::cout << (int)x << " ";
    }
    std::cout << "\n+-------------------\n";

    for (uint8_t y = 0; y < 9; ++y) {
        // 打印左侧行坐标
        std::cout << (int)y << "| ";

        for (uint8_t x = 0; x < 9; ++x) {
            // 调用你类内部的坐标转换函数
            uint8_t index = xy2index(x, y);

            // test() 用于检查该位是否为 1
            // 每一个字符后面加个空格，在控制台看起更像正方形
            std::cout << (data.test(index) ? "X " : ". ");
        }
        std::cout << "\n";
    }
    std::cout << "--------------------\n";
};