/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 排位赛
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "Player.h"


namespace Online {
namespace Ranked {
// 加入随机匹配池
bool ranked_join(const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept;
// 匹配池进行匹配
bool ranked_match(const std::string& uuid, int64_t seconds, std::vector<std::shared_ptr<Player>>& players, std::string& room) noexcept;
// 得到匹配池是所有玩家
bool ranked_all(std::vector<std::shared_ptr<Player>>& players) noexcept;
// 结算
bool ranked_endgame(
    const std::string& uuid,
    const std::string& room,
    const std::string& archive,
    const std::string& win,
    int64_t& my_score,
    int64_t& foe_score,
    std::string& win_p,
    bool is_backbg
) noexcept;
} // namespace Ranked
} // namespace Online