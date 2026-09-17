/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Player.h"

#include <memory>
#include <unordered_map>

#pragma once


namespace Online {
class Room {
public:
    std::shared_ptr<Player> player1;
    std::shared_ptr<Player> player2;

    std::unordered_map<std::string, std::shared_ptr<Player>> observers;

    std::string id;
    int64_t exp;
};
} // namespace Online