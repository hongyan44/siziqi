/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>
#include <iterator>
#include <utility>
#include <vector>


class ATK {
public:
    static void parse(std::vector<uint8_t>& a, std::vector<uint8_t>& b, bool plant) noexcept;
};


class AIC {
public:
    static float mmx(float minnum, float thenum, float maxnum);

    static float zsin(float num, float _mx);
    static float sin(float x);
    static float cos(float x);
};


class CsharpSort {
public:
    // 默认需要传入 lambda 函数（强制传入比较器）
    template <typename T, typename Compare>
    static void Sort(std::vector<T>& vec, Compare comp);

    // 便捷重载：使用默认的 < 比较（C++ 中常见的“默认”）
    template <typename T>
    static void Sort(std::vector<T>& vec) {
        Sort(vec, std::less<T>{});
    }

private:
    static constexpr int IntrosortSizeThreshold = 16;

    // 内省排序递归主体
    template <typename Iter, typename Compare>
    static void IntroSort(Iter first, Iter last, int depthLimit, Compare comp);

    // 插入排序（用于长度 ≤ 16 的子数组）
    template <typename Iter, typename Compare>
    static void InsertionSort(Iter first, Iter last, Compare comp);

    // 堆排序（当递归深度超限时启用）
    template <typename Iter, typename Compare>
    static void Heapsort(Iter first, Iter last, Compare comp);

    // 下滤操作（用于堆排序）
    template <typename Iter, typename Compare>
    static void SiftDown(Iter first, Iter last, Iter root, Compare comp);

    // 选取枢轴并完成分区，返回枢轴最终位置的迭代器
    template <typename Iter, typename Compare>
    static Iter PickPivotAndPartition(Iter first, Iter last, Compare comp);
};

template <typename T, typename Compare>
void CsharpSort::Sort(std::vector<T>& vec, Compare comp) {
    if (vec.size() <= 1) return;
    // 深度限制：2 * log2(N) —— 与 .NET 完全相同
    int depthLimit = 2 * static_cast<int>(std::log2(vec.size()));
    IntroSort(vec.begin(), vec.end(), depthLimit, comp);
}

template <typename Iter, typename Compare>
void CsharpSort::IntroSort(Iter first, Iter last, int depthLimit, Compare comp) {
    // 尾递归优化为循环
    while (std::distance(first, last) > IntrosortSizeThreshold) {
        if (depthLimit == 0) {
            // 递归过深，切换为堆排序，防止最坏情况 O(N^2)
            Heapsort(first, last, comp);
            return;
        }
        --depthLimit;

        // 分区，pivot 已经位于最终位置
        Iter pivot = PickPivotAndPartition(first, last, comp);

        // 先递归较短的一侧？.NET 并没有显式优先较短侧，但采用固定尾递归：
        // 右侧递归，左侧继续循环（与 .NET 的 IntroSort(Slice) 效果一致）
        IntroSort(pivot + 1, last, depthLimit, comp);
        last = pivot; // 缩小左侧范围，继续循环
    }

    // 长度 ≤ 阈值，使用插入排序
    if (first < last) {
        InsertionSort(first, last, comp);
    }
}

template <typename Iter, typename Compare>
void CsharpSort::InsertionSort(Iter first, Iter last, Compare comp) {
    if (first == last) return;

    // .NET 针对长度 2 和 3 做了展开，此处提供等效实现
    auto size = std::distance(first, last);
    if (size == 2) {
        if (comp(*(first + 1), *first)) { // 若 second < first
            std::iter_swap(first, first + 1);
        }
        return;
    }
    if (size == 3) {
        // 三元素排序网络，确保结果有序
        if (comp(*(first + 1), *first)) std::iter_swap(first, first + 1);
        if (comp(*(first + 2), *(first + 1))) {
            std::iter_swap(first + 1, first + 2);
            if (comp(*(first + 1), *first)) std::iter_swap(first, first + 1);
        }
        return;
    }

    for (Iter it = first + 1; it != last; ++it) {
        auto val  = std::move(*it);
        Iter hole = it;
        // 逐一向左移动，直到找到合适位置
        while (hole > first && comp(val, *(hole - 1))) {
            *hole = std::move(*(hole - 1));
            --hole;
        }
        *hole = std::move(val);
    }
}

template <typename Iter, typename Compare>
void CsharpSort::Heapsort(Iter first, Iter last, Compare comp) {
    auto n = std::distance(first, last);
    if (n < 2) return;

    // 建堆：从最后一个非叶子节点开始下滤
    for (auto i = n / 2 - 1; i >= 0; --i) {
        SiftDown(first, last, first + i, comp);
    }

    // 排序：反复将堆顶（最大）交换到末尾，再下滤
    for (auto it = last - 1; it > first; --it) {
        std::iter_swap(first, it);
        SiftDown(first, it, first, comp); // 堆大小递减
    }
}

template <typename Iter, typename Compare>
void CsharpSort::SiftDown(Iter first, Iter last, Iter root, Compare comp) {
    auto n = std::distance(first, last);
    auto i = std::distance(first, root);
    while (true) {
        auto child = 2 * i + 1;
        if (child >= n) break;
        // 如果右子存在且左子 < 右子，则选右子
        if (child + 1 < n && comp(*(first + child), *(first + child + 1))) {
            ++child;
        }
        // 若父节点不小于选出的更大子节点，则堆性质满足
        if (!comp(*(first + i), *(first + child))) break;

        std::iter_swap(first + i, first + child);
        i = child;
    }
}

template <typename Iter, typename Compare>
Iter CsharpSort::PickPivotAndPartition(Iter first, Iter last, Compare comp) {
    // 完全复刻 .NET 的三数取中 + Hoare 分区
    Iter mid = first + (std::distance(first, last) - 1) / 2; // middle 索引（向下取整）
    Iter hi  = last - 1;

    // 三数排序：使 *first <= *mid <= *hi
    if (comp(*mid, *first)) std::iter_swap(first, mid);
    if (comp(*hi, *first)) std::iter_swap(first, hi);
    if (comp(*hi, *mid)) std::iter_swap(mid, hi);

    // 将枢轴（mid）交换到 hi - 1 位置（安全位置）
    std::iter_swap(mid, hi - 1);
    auto pivotVal = std::move(*(hi - 1));

    Iter left  = first + 1;
    Iter right = hi - 2;

    while (left <= right) {
        // 左侧找到 >= pivot 的元素
        while (comp(*left, pivotVal)) ++left;
        // 右侧找到 <= pivot 的元素
        while (comp(pivotVal, *right)) --right;

        if (left > right) break;
        std::iter_swap(left, right);
        ++left;
        --right;
    }

    // 将枢轴放入正确位置（left 即为最终位置）
    std::iter_swap(left, hi - 1);
    return left;
}