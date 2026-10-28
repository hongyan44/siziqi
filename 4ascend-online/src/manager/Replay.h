/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Replay
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>


namespace Manager {
namespace Replay {
inline constexpr uint32_t MAX_PLAYER_REPLAYS = 100;

struct Record {
    uint64_t id;
    uint64_t time;
    uint64_t duration;
    int64_t mode;
    int64_t first;
    int64_t black_hp;
    int64_t white_hp;
    std::string category;
    std::string player_a;
    std::string player_b;
    std::string black_uuid;
    std::string white_uuid;
    std::string black_name;
    std::string white_name;
    std::string result;
};

void init() noexcept;
void close() noexcept;

bool add_replay(
    std::string_view player_a,
    std::string_view player_b,
    std::string_view black_uuid,
    std::string_view white_uuid,
    std::string_view black_name,
    std::string_view white_name,
    uint64_t time,
    uint64_t duration,
    int64_t mode,
    int64_t first,
    int64_t black_hp,
    int64_t white_hp,
    std::string_view category,
    std::string_view result,
    std::string_view hash,
    std::string_view data,
    uint64_t& id
) noexcept;

bool delete_replay(uint64_t id) noexcept;
bool query_replay(std::string_view player, std::vector<Record>& result) noexcept;
bool get_replay(uint64_t id, std::string_view player, std::string& result) noexcept;

// 统计玩家最近 limit 场真实对局的场次与胜利数（回放按玩家只保留最近 100 场）
bool stats_player(std::string_view player, int64_t limit, int64_t& games, int64_t& wins) noexcept;
} // namespace Replay
} // namespace Manager