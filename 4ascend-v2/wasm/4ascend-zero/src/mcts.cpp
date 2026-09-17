/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "mcts.h"

#include <cmath>


MCTS::MCTS(float c_puct, int sims, float dir_alpha, float dir_eps, uint64_t seed) : c_puct_(c_puct), sims_(sims), dir_alpha_(dir_alpha), dir_eps_(dir_eps), rng_(seed), net_() {};


std::vector<float> MCTS::run(Game& root_state) {
    int  root_player = root_state.state.turn_player;
    Node root{1.0f, root_player};

    auto [p, v] = policy_value(root_state, root_player);
    expand(&root, root_state, p);

    // 狄利克雷噪声（需要 RandMcts::dirichlet）
    auto noise = rng_.dirichlet(dir_alpha_, 81);
    for (int a = 0; a < 81; ++a) {
        if (root.children[a]) {
            root.children[a]->prior = (1.0f - dir_eps_) * root.children[a]->prior + dir_eps_ * noise[a];
        }
    }

    for (int i = 0; i < sims_; ++i) {
        simulate(root_state, &root);
    }

    std::vector<float> pi(81, 0.0f);
    float              sumN = 0.0f;
    for (int a = 0; a < 81; ++a) {
        if (root.children[a]) {
            pi[a]  = static_cast<float>(root.children[a]->N);
            sumN  += pi[a];
        }
    }
    if (sumN > 0.0f) {
        for (float& p : pi) p /= sumN;
    }

    // 保存根节点访问计数和 Q 值（供外部查询）
    last_root_N_.assign(81, 0);
    last_root_Q_.assign(81, 0.0f);
    for (int a = 0; a < 81; ++a) {
        if (root.children[a]) {
            last_root_N_[a] = root.children[a]->N;
            last_root_Q_[a] = root.children[a]->Q;
        }
    }

    return pi;
};

// std::pair<std::vector<float>, float> MCTS::policy_value(Game& state, int as_player) {
//     // TODO: 调用神经网络
//     std::vector<float> p(81, 1.0f / 81);
//     float              v = 0.0f;
//     return {p, v};
// };
std::pair<std::vector<float>, float> MCTS::policy_value(Game& state, int as_player) {
    // 暂时忽略 as_player 参数，因为编码时默认以 state.turn_player 为视角（待完善）
    std::vector<float> logits;
    float              v_raw;
    net_.predict(state, as_player, logits, v_raw);

    // softmax 数值稳定
    float              max_logit = *std::max_element(logits.begin(), logits.end());
    std::vector<float> p(81);
    float              sum = 0.0f;
    for (int i = 0; i < 81; ++i) {
        p[i]  = exp(logits[i] - max_logit);
        sum  += p[i];
    }
    for (int i = 0; i < 81; ++i) p[i] /= sum;

    // mask & renormalize
    auto  mask  = legal_mask(state);
    float p_sum = 0.0f;
    for (int i = 0; i < 81; ++i) {
        p[i]  *= mask[i];
        p_sum += p[i];
    }
    if (p_sum <= 1e-8f) {
        // 无合法动作或概率全零：均匀分布在合法动作上
        int n = 0;
        for (float m : mask) n += (m > 0.0f);
        if (n > 0) {
            for (int i = 0; i < 81; ++i) p[i] = (mask[i] > 0.0f) ? 1.0f / n : 0.0f;
        }
    } else {
        for (int i = 0; i < 81; ++i) p[i] /= p_sum;
    }

    return {p, v_raw};
};

void MCTS::simulate(Game root_state, Node* root) {
    Game                               state = root_state; // 拷贝，之后随意修改
    Node*                              node  = root;
    std::vector<std::pair<Node*, int>> path;

    // 选择
    while (node->is_expanded && node->has_children()) {
        auto [a, child] = select_child(node);
        path.emplace_back(node, a);
        state.step(a);
        node = child;
        uint8_t w;
        if (state.end(w)) break;
    }

    float   value;
    uint8_t w;
    if (!state.end(w)) {
        auto [p, v] = policy_value(state, state.state.turn_player);
        expand(node, state, p);
        value = v;
    } else {
        value = compute_terminal_value(state, node->to_play);
    }

    backup(path, -value);
};

void MCTS::backup(std::vector<std::pair<Node*, int>>& path, float value) {
    float v = value;
    for (auto it = path.rbegin(); it != path.rend(); ++it) {
        Node* parent  = it->first;
        int   a       = it->second;
        Node* child   = parent->children[a].get();
        child->N     += 1;
        child->W     += v;
        child->Q      = child->W / child->N;
        v             = -v;
    }
};

std::pair<int, Node*> MCTS::select_child(Node* node) {
    float sumN = 0.0f;
    for (int a = 0; a < 81; ++a)
        if (node->children[a]) sumN += node->children[a]->N;
    sumN = std::max<float>(1.0f, sumN);

    int   best_a     = -1;
    Node* best_child = nullptr;
    float best_score = -1e9f;

    for (int a = 0; a < 81; ++a) {
        if (!node->children[a]) continue;
        Node* child = node->children[a].get();
        float u     = c_puct_ * child->prior * std::sqrt(sumN) / (1.0f + child->N);
        float score = child->Q + u;
        if (score > best_score) {
            best_score = score;
            best_a     = a;
            best_child = child;
        }
    }
    return {best_a, best_child};
};

void MCTS::expand(Node* node, Game& state, std::vector<float>& priors) {
    node->is_expanded = true;
    auto  mask        = legal_mask(state);
    float sum         = 0.0f;
    for (int a = 0; a < 81; ++a)
        if (mask[a] > 0.0f) sum += priors[a];
    if (sum <= 0.0f) return;

    for (int a = 0; a < 81; ++a) {
        if (mask[a] > 0.0f) {
            node->children[a]          = std::make_unique<Node>();
            node->children[a]->prior   = priors[a] / sum;
            node->children[a]->to_play = state.state.turn_player ^ 1;
        }
    }
};

float MCTS::compute_terminal_value(Game& state, int to_play) {
    uint8_t winner;
    bool    ended = state.end(winner);
    if (!ended) return 0.0f;      // 理论上不会发生
    if (winner == 2) return 0.0f; // 平局
    return (winner == to_play) ? 1.0f : -1.0f;
};

std::vector<float> MCTS::legal_mask(Game& state) {
    std::bitset<81> my    = *state.stones[state.state.turn_player];
    std::bitset<81> foe   = *state.stones[state.state.turn_player ^ 1];
    std::bitset<81> moves = state.board.get_turns(my, foe);

    std::vector<float> mask(81, 0.0f);
    for (int i = 0; i < 81; ++i)
        if (moves.test(i)) mask[i] = 1.0f;
    return mask;
};

// std::vector<float> MCTS::legal_mask(Game& state) {
//     std::bitset<81>    my    = *state.stones[state.state.turn_player];
//     std::bitset<81>    foe   = *state.stones[state.state.turn_player ^ 1];
//     std::bitset<81>    empty = ~(my | foe); // 仅空格
//     std::vector<float> mask(81, 0.0f);
//     for (int i = 0; i < 81; ++i)
//         if (empty.test(i)) mask[i] = 1.0f;
//     return mask;
// };


std::vector<int> MCTS::get_root_counts() { return last_root_N_; };

std::vector<float> MCTS::get_root_q() { return last_root_Q_; };

float MCTS::get_root_winrate() {
    float total = 0.0f, weighted_q = 0.0f;
    for (size_t a = 0; a < last_root_N_.size(); ++a) {
        weighted_q += last_root_Q_[a] * last_root_N_[a];
        total += last_root_N_[a];
    }
    // Edge Q is already from the parent/current player's perspective.
    return total > 0.0f ? (weighted_q / total + 1.0f) * 0.5f : 0.5f;
};
