/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 房间对局
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "Player.h"
#include "Room.h"

#include <memory>
#include <string>
#include <vector>


namespace Online {
namespace Friend {
// 创建房间
bool room_create(const std::string& id) noexcept;
// 得到房间
bool room_get(const std::string& id, std::shared_ptr<Room>& room) noexcept;
// 房间是否存在
bool room_exist(const std::string& id) noexcept;
// 房间得到心跳
bool room_exp(const std::string& id, int64_t& exp) noexcept;
// 得到所有房间信息
bool room_all(std::vector<std::shared_ptr<Room>>& rooms_) noexcept;
// 得到观众名字
bool room_observers(const std::string& id, std::vector<std::string>& names) noexcept;

// 连接断开：清空房间/观战者里指向该连接的指针
void client_detach(cinatra::coro_http_connection* client) noexcept;

// 玩家加入
bool player_join(const std::string& id, const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept;
// 观战者加入
bool observer_join(const std::string& id, const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept;

// 房间心跳
bool room_heartbeat(const std::string& id) noexcept;
// 玩家心跳
bool player_heartbeat(const std::string& id, const std::string& uuid) noexcept;
// 观众心跳
bool observer_heartbeat(const std::string& id, const std::string& uuid) noexcept;

// 以玩家得到另外一位玩家
bool player2player(const std::string& id, const std::string& uuid, std::shared_ptr<Player>& player) noexcept;
// 直接得到玩家
bool player2player_rers(const std::string& id, const std::string& uuid, std::shared_ptr<Player>& player) noexcept;
// 以玩家得到所有观众
bool player2observers(const std::string& id, const std::string& uuid, std::vector<std::shared_ptr<Player>>& observers) noexcept;
// 以观众得到所有观众
bool observer2observers(const std::string& id, const std::string& uuid, std::vector<std::shared_ptr<Player>>& observers) noexcept;
} // namespace Friend
} // namespace Online
