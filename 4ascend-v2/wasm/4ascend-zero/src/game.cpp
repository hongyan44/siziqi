/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "game.h"
#include "utils.h"

#include <algorithm>


Game::Game(uint32_t seed_aic, uint32_t seed_uinty, bool plant) : rand_aic(seed_aic), rand_uinty(seed_uinty), plant(plant) {
    stones[0] = &board.black;
    stones[1] = &board.white;
};
Game::~Game() = default;


void Game::seed_cell(uint8_t index, uint8_t stone, uint8_t plant_value) noexcept {
    if (index >= 81) return;
    board.black.set(index, false);
    board.white.set(index, false);
    board.ascend.set(index, false);
    board.used.set(index, false);
    board.plant_lvl1.set(index, false);
    board.plant_lvl2.set(index, false);
    if (stone == 1) board.black.set(index);
    else if (stone == 2) board.white.set(index);
    if (plant_value == 1) board.plant_lvl1.set(index);
    else if (plant_value == 2) board.plant_lvl2.set(index);
}

void Game::seed_turn(uint8_t player, uint16_t count) noexcept {
    state.turn_player = player & 1;
    state.turn_first = player & 1;
    state.turn_count = count;
}

void Game::seed_hp(uint8_t black_hp, uint8_t white_hp) noexcept {
    state.hp[0] = static_cast<int8_t>(black_hp);
    state.hp[1] = static_cast<int8_t>(white_hp);
}


void Game::start_turn(uint8_t index) noexcept {
    // Match Python Engine.step: history is the board BEFORE this move.
    if (history_count < 7) {
        history_boards[history_count] = board; // Board 的拷贝构造
        history_count++;
    } else {
        for (int i = 0; i < 6; ++i) history_boards[i] = history_boards[i + 1]; // 环形覆盖：满了就把旧的移出去，新的放最后
        history_boards[6] = board;
    }

    // ASCEND
    auto& foe_stone = *stones[state.turn_player ^ 1];
    if (foe_stone.test(index)) {
        foe_stone.set(index, false);    // 移除敌方棋子
        board.ascend.set(index, false); // 移除升变标记
        board.used.set(index, false);   // 移除已使用标记
    }

    // 设置己方棋子
    board.set_point(*stones[state.turn_player], index);
    state.turn_pos = index;


};

void Game::check_ascend() noexcept {
    if (state.turn_count < 6) return;

    auto solid_self = *stones[state.turn_player] & ~board.ascend & ~board.used;
    auto ascend     = board.get_ascend(solid_self, state.turn_pos);
    if (!ascend.any() && state.ascend_status == 0) return; // 发起必须进行ASCEND，回应允许不进行ASCEND

    // 升级棋子
    board.ascend |= ascend;

    // 提前标记
    board.used |= ascend;

    // 改变ASCEND状态
    ++state.ascend_status; // NONE, START, END
};

void Game::clear_ascend() noexcept {
    if (state.ascend_status != 2) return; // 必须已经结算

    std::vector<uint8_t>  power_black;
    std::vector<uint8_t>  power_white;
    std::vector<uint8_t>* power_targets[2] = {&power_white, &power_black};

    auto bits = board.ascend & (board.black | board.white);
    for (size_t i = 0; i < 81; ++i) {
        if (!bits[i]) continue;
        uint8_t power = 1 + (board.plant_lvl2[i] ? 2 : board.plant_lvl1[i] ? 1 : 0);
        power_targets[board.black[i]]->push_back(power);

        board.plant_lvl1.set(i, false);
        board.plant_lvl2.set(i, false);
    }

    ATK::parse(power_black, power_white, plant);

    // 造成伤害
    state.hp[0] -= power_white.size();
    state.hp[1] -= power_black.size();
};

void Game::end_turn() noexcept {
    state.turn_player ^= 1;
    ++state.turn_count;
};

void Game::scan_point(bool flag3, bool flag4, std::vector<uint8_t>& points) noexcept {
    auto target_mask = (~(board.black | board.white) | board.used) & ~board.plant_lvl2;
    auto solid_stone = (board.black | board.white) & ~board.ascend & ~board.used;
    auto used_black  = board.black & board.used;
    auto used_white  = board.white & board.used;

    // bool flag3       = (state.ascend_status == 2);
    // bool flag4       = flag3 && (state.unascend_charge == 0);
    bool over_active = (state.over_status != 0);

    // 构造第一轮的 tst 掩码 (set of allowed stone types)
    std::bitset<81> tst_mask;
    if (state.unascend_chargef[0] == 0) tst_mask |= used_black;
    if (state.unascend_chargef[1] == 0) tst_mask |= used_white;
    if (tst_mask.none()) tst_mask = solid_stone; // 双方冷却都在，用活子

    // 第一轮扫描
    std::bitset<81> candidates;
    for (uint8_t i = 0; i < 81; ++i) {
        bool filled = solid_stone.test(i);
        bool in_tst = tst_mask.test(i);
        bool a      = in_tst || (filled && (flag4 || over_active));
        bool b      = filled;

        bool use_as_src = flag3 ? a : b;
        if (!use_as_src) continue;

        candidates |= board.expand_neighbors(target_mask, i, flag3);
    }

    // 第二轮扫描：如果第一轮没结果 或 不是完整ASCEND，则把双方USED也加入tst_mask后重新扫描
    if (candidates.none() || !flag3) {
        // 第二轮：tst_mask 扩大为包含双方 USED
        tst_mask |= used_black;
        tst_mask |= used_white;
        // 注意：第二轮开始前清空 candidates？JS 是追加还是重新？
        // JS 中第二轮会重新遍历整个 board.data，并追加符合条件的点，所以不清空，而是继续累加。
        // 但为了避免重复，应在第二轮循环中再次判断并加进去（bitset 自动去重）。
        for (uint8_t i = 0; i < 81; ++i) {
            bool filled = solid_stone.test(i);
            bool in_tst = tst_mask.test(i);
            bool a      = in_tst || (filled && (flag4 || over_active));
            bool b      = filled;

            bool use_as_src = flag3 ? a : b;
            if (!use_as_src) continue;

            candidates |= board.expand_neighbors(target_mask, i, flag3);
        }
    }

    // 提取并排序
    for (uint8_t i = 0; i < 81; ++i) {
        if (candidates.test(i)) points.push_back(i);
    }
    std::sort(points.begin(), points.end(), [](uint8_t a, uint8_t b) {
        uint8_t ay = a / 9, ax = a % 9;
        uint8_t by = b / 9, bx = b % 9;
        return ay != by ? ay < by : ax < bx;
    });
};
void Game::scan_score(uint8_t plant_count, bool atk, bool flag, bool flag2, bool flag4, std::vector<uint8_t>& points, std::vector<uint8_t>& result) noexcept {
    struct ScoreEntry {
        uint8_t index;
        int     score;
        uint8_t bit; // 0, 1, 2
    };

    // ---------- 初始化 ----------
    const uint8_t self_index = state.turn_player;
    const uint8_t foe_index  = state.turn_player ^ 1;

    auto self_solid = (*stones[self_index]) & ~board.ascend & ~board.used;
    auto foe_solid  = (*stones[foe_index]) & ~board.ascend & ~board.used;

    // tst_mask 的构造逻辑与 scan_point 第一轮完全一致
    auto solid_stone = (board.black | board.white) & ~board.ascend & ~board.used;
    auto used_black  = board.black & board.used;
    auto used_white  = board.white & board.used;

    std::bitset<81> tst_mask;
    if (state.unascend_chargef[0] == 0) tst_mask |= used_black;
    if (state.unascend_chargef[1] == 0) tst_mask |= used_white;
    if (tst_mask.none()) tst_mask = solid_stone;

    std::vector<ScoreEntry> result_entries;
    std::vector<ScoreEntry> buf_entries;

    uint8_t _byte = 0;

    // ---------- 遍历每个候选点 ----------
    for (uint8_t index : points) {
        int score = 500;

        bool flag5 = false;
        bool flag6 = atk; // JS: flag6 = atk || FS_OVER; FS_OVER 恒为 false，简化

        uint8_t abyte = 0;

        // 获取己方/对方连线
        uint8_t self_align, self_align_t;
        uint8_t foe_align, foe_align_t;
        board.get_align(self_solid, index, self_align, self_align_t);
        board.get_align(foe_solid, index, foe_align, foe_align_t);

        // --- 四连以上特殊处理 ---
        if (self_align >= 4 || foe_align >= 4) {
            if (state.over_status == 2) { // OVER_ENUM.EXECUTE
                uint8_t byte = 0;
                if (self_align < 4 && !flag2) byte |= 2; // 己方? 注意 JS 映射: byte|=2 对应己方 (BLACK?)
                if (foe_align < 4 && !flag) byte |= 1;   // 对方

                if (byte == 1 || byte == 2) {
                    score += 450;
                    if (!board.plant_lvl1.test(index) && !board.plant_lvl2.test(index)) score += 100; // 无草

                    if (byte == 1) flag6 = true; // JS 原样
                    abyte = byte;
                }
            }
            score -= 450;
        }

        // --- 核心加分逻辑 ---
        if (flag6) {
            if (self_align_t < foe_align_t) score -= std::abs(static_cast<int>(self_align_t) - static_cast<int>(foe_align_t)) * 3;
            if (self_align < foe_align) score -= std::abs(static_cast<int>(self_align) - static_cast<int>(foe_align)) * 15;

            if (self_align == 3 && foe_align <= 1) {
                if (flag4) flag5 = true;
                else score += static_cast<int>(AIC::zsin(25.0f - state.unascend_charge, 25.0f) * 120.0f);
            }
        } else {
            if (self_align_t < foe_align_t && flag && !flag2) score += std::abs(static_cast<int>(self_align_t) - static_cast<int>(foe_align_t)) * 6;
            else if (self_align_t > foe_align_t && !flag && flag2) score += std::abs(static_cast<int>(self_align_t) - static_cast<int>(foe_align_t)) * 6;
            else if (self_align_t != foe_align_t) score -= std::abs(static_cast<int>(self_align_t) - static_cast<int>(foe_align_t)) * 3;

            if (self_align != foe_align) score -= std::abs(static_cast<int>(self_align) - static_cast<int>(foe_align)) * 15;
        }

        // 植物惩罚 / 加成
        if ((board.plant_lvl1.test(index) || board.plant_lvl2.test(index)) && !flag4) score -= 30;
        else if (atk && tst_mask.test(index)) score += 50;

        // 随机扰动
        score += static_cast<int>(rand_aic.xorr(20));

        // 分类存放
        if (abyte > 0) {
            _byte |= abyte;
            buf_entries.push_back({index, score, abyte});
        } else {
            result_entries.push_back({index, score, 0});
            if (flag5) {
                plant_count++; // 额外名额
                int extra_score = score + 30 - static_cast<int>(rand_aic.xorr(90));
                result_entries.push_back({index, extra_score, 0});
            }
        }
    }

    // ---------- 处理 buf（超载补偿） ----------
    if (_byte > 0) {
        rand_uinty.shuffle(buf_entries); // 打乱顺序

        size_t buf_index = 0;
        while (buf_index < buf_entries.size() && _byte > 0) {
            ScoreEntry& entry = buf_entries[buf_index];
            if ((_byte & entry.bit) != 0) {
                _byte &= ~entry.bit; // 消耗该 bit
                plant_count++;

                // 加入原条目
                result_entries.push_back(entry);

                // 额外副本（分数微调）
                ScoreEntry copy  = entry;
                copy.score      += 40 - static_cast<int>(rand_aic.xorr(120));
                result_entries.push_back(copy);
            }
            buf_index++;
        }
    }

    // ---------- 最终排序并截断 ----------
    rand_uinty.shuffle(result_entries);
    CsharpSort::Sort(result_entries, [](const ScoreEntry& a, const ScoreEntry& b) {
        return a.score > b.score; // 降序
    });

    plant_count = std::min<uint8_t>(plant_count, 6);
    result.clear();


    // for (auto& obj : result_entries) {
    //     uint8_t x, y;
    //     board.index2xy(obj.index, x, y);
    //     printf("point: %hhu, %hhu || score: %d\n", x, y, obj.score);
    // }


    // 之前：std::bitset<81> used_in_result;
    std::bitset<81> fix; // 仅记录原本有一级草且已被选中的点

    for (const ScoreEntry& entry : result_entries) {
        if (plant_count == 0) break;

        // 如果该点已被 fix 标记（即原本有草且已选过），跳过
        if (fix.test(entry.index)) continue;

        result.push_back(entry.index);
        --plant_count;

        // 如果该点原本就有一级草，则加入 fix，防止后续重复选中
        if (board.plant_lvl1.test(entry.index)) {
            fix.set(entry.index);
        }

        // unascend_chargef 更新保持不变
        if (entry.bit & 1) state.unascend_chargef[self_index] = std::max<uint8_t>(state.unascend_chargef[self_index], 4);
        if (entry.bit & 2) state.unascend_chargef[foe_index] = std::max<uint8_t>(state.unascend_chargef[foe_index], 4);
    }
}
void Game::scan_run(uint8_t plant_count, std::vector<uint8_t>& result) noexcept {
    uint8_t self_index = state.turn_player;
    uint8_t foe_index  = state.turn_player ^ 1;

    bool atk = state.ascend_status == 2; // 临时

    bool flag  = state.unascend_chargef[self_index] > 0;
    bool flag2 = state.unascend_chargef[foe_index] > 0;
    bool flag3 = atk;
    bool flag4 = atk && state.unascend_charge <= 0;


    if (state.unascend_chargef[self_index] > 0) atk = false;


    // 扫描符合规则点位
    std::vector<uint8_t> points;
    scan_point(flag3, flag4, points);

    // // 在 scan_run 的 scan_point(points) 之后，scan_score 之前插入
    // static int debug_plant_gen_count = 0;
    // debug_plant_gen_count++;
    // if (debug_plant_gen_count == 1) { // 仅首次植物生成打印
    //     printf("[C++] First plant gen state:\n");
    //     printf(
    //         "  turn=%d status=%d grow=%d unascend=%d chargef=[%d,%d] over=%d\n",
    //         state.turn_count,
    //         state.ascend_status,
    //         state.grow_count,
    //         state.unascend_charge,
    //         state.unascend_chargef[0],
    //         state.unascend_chargef[1],
    //         state.over_status
    //     );
    //     printf("  points(%zu): ", points.size());
    //     for (auto idx : points) {
    //         uint8_t x, y;
    //         board.index2xy(idx, x, y);
    //         printf("(%d,%d) ", x, y);
    //     }
    //     printf("\n");
    // }


    // 若超载EX，增加1数量
    // 取最小数量
    // 若符合点位数量为0，则不进行任何生成
    if (state.over_status == 2) plant_count++;
    plant_count = std::min(plant_count, static_cast<uint8_t>(points.size()));
    if (plant_count <= 0) return;

    // 对点位计分，筛选，得到最终点位
    scan_score(plant_count, atk, flag, flag2, flag4, points, result);
};

void Game::create_plant() noexcept {
    if (!plant) return;

    if (state.ascend_status == 1) return;
    bool atk = state.ascend_status == 2;


    if (!atk) {
        if (state.unascend_charge > 0) --state.unascend_charge;

        if (state.unascend_chargef[1] > 0) --state.unascend_chargef[1];
        if (state.unascend_chargef[0] > 0) --state.unascend_chargef[0];

        state.just_unascend = false;
    }


    state.grow_count--;
    if (state.grow_count > 0 && !(atk && !state.just_unascend)) return;

    uint8_t self_index = state.turn_player;
    uint8_t foe_index  = state.turn_player ^ 1;

    auto stone_count = board.count_stone();
    auto plant_count = state.turn_count >= 65 ? 3 : 2;


    // 最低7回合，最大11回合，每22回合减少2最大回合数（11）
    state.grow_count = std::max(7, 11 - (state.turn_count / 22) * 2);


    if (state.always_overload) state.over_status = 2;

    // 44子则超载，若我方血量少于或者等于敌方，进入超载EX
    // 22子以下，则取消所有超载状态
    if (stone_count >= 44 && state.over_status == 0) state.over_status = 1;
    if (state.over_status == 1 && state.over_status != 2 && state.hp[self_index] <= state.hp[foe_index]) state.over_status = 2;
    if (!state.always_overload && state.over_status != 0 && stone_count < 22) state.over_status = 0;


    // 生成并创建草
    std::vector<uint8_t> result;
    scan_run(plant_count, result);

    // printf("%zu\n", result.size());
    // for (uint8_t index : result) {
    //     uint8_t x, y;
    //     board.index2xy(index, x, y);
    //     printf("point: %hhu, %hhu\n", x, y);
    // }

    for (uint8_t index : result) {
        if (board.plant_lvl2.test(index)) continue;
        if (board.plant_lvl1.test(index)) {
            board.plant_lvl1.reset(index);
            board.plant_lvl2.set(index);
        } else board.plant_lvl1.set(index);
    }


    // 若超载，减少50%冷却
    // 若冷却为偶数，减少1，变为奇数（保证轮流生成草）
    if (state.over_status != 0) state.grow_count = state.grow_count / 2;
    if (state.grow_count % 2 == 0) state.grow_count--;


    // 完整ASCEND后改变数据
    if (atk) {
        state.unascend_charge              = std::ceil(AIC::mmx(12.5f, state.unascend_charge + (25.0f - state.unascend_charge) * 0.4f, 25.0f));
        state.unascend_chargef[self_index] = std::max<uint8_t>(state.unascend_chargef[self_index], state.over_status != 0 ? 4 : 9);
        state.just_unascend                = true;
    }
};
void Game::clear_plant() noexcept {
    if (state.ascend_status != 2) return;
    state.ascend_status = 0;

    board.black &= ~board.ascend;
    board.white &= ~board.ascend;

    board.ascend.reset();
    board.used.reset();
};

void Game::step(uint8_t index) noexcept {
    start_turn(index);
    check_ascend();
    clear_ascend();
    end_turn();

    create_plant();
    clear_plant();

    // printf(
    //     "[C++] turn=%d player=%d pos=(%d,%d) asc=%d hp=%d/%d over=%d grow=%d unasc=%d chf=[%d,%d] just=%d\n",
    //     state.turn_count,
    //     state.turn_player,
    //     index % 9,
    //     index / 9,
    //     state.ascend_status,
    //     state.hp[0],
    //     state.hp[1],
    //     state.over_status,
    //     state.grow_count,
    //     state.unascend_charge,
    //     state.unascend_chargef[0],
    //     state.unascend_chargef[1],
    //     state.just_unascend
    // );
};

bool Game::end(uint8_t& winer) noexcept {
    // 一方血量归零，直接判负
    if (state.hp[1] <= 0) {
        winer = 0;
        return true;
    } else if (state.hp[0] <= 0) {
        winer = 1;
        return true;
    }

    const uint8_t black = board.count_black();
    const uint8_t white = board.count_white();

    // 棋盘未满，继续
    if (black + white < 81) return false;

    // 棋盘下满，优先按血量
    if (state.hp[0] != state.hp[1]) {
        winer = (state.hp[0] > state.hp[1]) ? 0 : 1;
        return true;
    }

    // 血量相同，按棋子数
    winer = (black != white) ? ((black > white) ? 0 : 1) : 2;
    return true;
};

Game::Game(const Game& other)
: board(other.board),
  state(other.state),
  history_boards(other.history_boards),
  history_count(other.history_count),
  rand_aic(other.rand_aic),
  rand_uinty(other.rand_uinty),
  plant(other.plant) {
    stones[0] = &board.black;
    stones[1] = &board.white;
};