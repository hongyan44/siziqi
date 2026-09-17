/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "game.h"

#include <ncnn/net.h>


class Net {
public:
    explicit Net();
    ~Net();

    void encode(Game& game, int as_player, ncnn::Mat& in) noexcept;
    void predict(Game& game, int as_player, std::vector<float>& logits, float& value) noexcept;

private:
    ncnn::Net net;
};