/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <array>
#include <memory>


struct Node {
    float prior;
    int   to_play;

    int   N = 0;
    float W = 0.0f;
    float Q = 0.0f;

    std::array<std::unique_ptr<Node>, 81> children; // 默认全部为 nullptr

    bool is_expanded = false;

    bool has_children() const {
        for (int a = 0; a < 81; ++a)
            if (children[a]) return true;
        return false;
    };
};