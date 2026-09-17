/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: MCTS 搜索器
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "game.h"
#include "net.h"
#include "node.h"
#include "rand.h"

#include <cstdint>
#include <utility>
#include <vector>


class MCTS {
public:
    MCTS(float c_puct, int sims, float dir_alpha, float dir_eps, uint64_t seed);

    // 主入口：返回策略 π (81 维概率分布)
    std::vector<float> run(Game& root_state);

    // 合法动作掩码（81 维，1.0 表示可落子）
    std::vector<float> legal_mask(Game& state);

    // 神经网络策略价值评估（TODO）
    std::pair<std::vector<float>, float> policy_value(Game& state, int as_player);

    // 展开节点：根据策略概率创建子节点
    void expand(Node* node, Game& state, std::vector<float>& priors);

    // UCT 选择：返回 (动作, 子节点)
    std::pair<int, Node*> select_child(Node* node);

    // 回传：沿路径更新统计量
    void backup(std::vector<std::pair<Node*, int>>& path, float value);

    // 终局价值计算（以 to_play 视角）
    float compute_terminal_value(Game& state, int to_play);

    // 单次模拟
    void simulate(Game root_state, Node* root);

    // 获取最后一次 run() 的根节点访问计数（未归一化）
    std::vector<int> get_root_counts();

    // 获取最后一次 run() 的根节点平均价值 Q
    std::vector<float> get_root_q();

    float get_root_winrate();

    std::vector<int>   last_root_N_;
    std::vector<float> last_root_Q_;

    // 超参数
    float c_puct_;
    int   sims_;
    float dir_alpha_;
    float dir_eps_;

    // 随机数（仅用于狄利克雷噪声）
    RandMcts rng_;

    Net net_;
};