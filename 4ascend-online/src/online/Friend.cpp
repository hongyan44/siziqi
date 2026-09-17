/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 房间对局
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Friend.h"

#include "Player.h"
#include "Room.h"

#include "../libs/only/Time.h"

#include <memory>
#include <unordered_map>
#include <vector>


namespace Online {
namespace Friend {
std::unordered_map<std::string, std::shared_ptr<Room>> rooms;

std::shared_ptr<Room> search(const std::string& key) noexcept {
    auto it = rooms.find(key);
    if (it == rooms.end()) return nullptr;
    return it->second;
};


// 过期房间删除
void room_delete() noexcept {
    auto now = Libs::Only::Time::timestamp_ms() - 40 * 1000; // 40s
    std::erase_if(rooms, [now](const auto& item) { return item.second->exp <= now; });
};

// 观战者删除
void observer_delete(std::shared_ptr<Room> room) noexcept {
    auto now = Libs::Only::Time::timestamp_ms() - 20 * 1000; // 20s
    std::erase_if(room->observers, [now](const auto& item) { return item.second->exp <= now; });
};


// 创建房间
bool room_create(const std::string& id) noexcept {
    // try_emplace
    auto room = std::make_shared<Room>();
    room->id  = id;
    room->exp = Libs::Only::Time::timestamp_ms();

    room->player1 = std::make_shared<Player>();
    room->player2 = std::make_shared<Player>();

    room->player1->score = -1;
    room->player2->score = -1;

    room_delete();

    return rooms.try_emplace(id, room).second;
};

// 得到房间
bool room_get(const std::string& id, std::shared_ptr<Room>& room) noexcept {
    room = search(id);
    return room != nullptr;
};

// 房间是否存在
bool room_exist(const std::string& id) noexcept {
    auto room = search(id);
    return room != nullptr;
};


// 房间得到心跳
bool room_exp(const std::string& id, int64_t& exp) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    exp = room->exp;
    return true;
};

// 得到所有房间信息
bool room_all(std::vector<std::shared_ptr<Room>>& rooms_) noexcept {
    rooms_.clear();
    rooms_.reserve(rooms.size());

    room_delete();

    for (const auto& [_, room] : rooms) {
        observer_delete(room);
        rooms_.emplace_back(room);
    }
    return true;
};

// 得到观众名字
bool room_observers(const std::string& id, std::vector<std::string>& names) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    observer_delete(room);
    for (const auto& [_, player] : room->observers) names.emplace_back(player->name);
    return true;
};


// 玩家加入
bool player_join(const std::string& id, const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    if (room->player1->uuid == uuid) {
        room->player1->client = client;
        room->player1->exp    = Libs::Only::Time::timestamp_ms();
        room->player1->name   = name;
        room->player1->leave  = false;

    } else if (room->player2->uuid == uuid) {
        room->player2->client = client;
        room->player2->exp    = Libs::Only::Time::timestamp_ms();
        room->player2->name   = name;
        room->player2->leave  = false;

    } else if (room->player1->uuid.empty()) {
        room->player1->uuid   = uuid;
        room->player1->client = client;
        room->player1->exp    = Libs::Only::Time::timestamp_ms();
        room->player1->name   = name;
        room->player1->leave  = false;

    } else if (room->player2->uuid.empty()) {
        room->player2->uuid   = uuid;
        room->player2->client = client;
        room->player2->exp    = Libs::Only::Time::timestamp_ms();
        room->player2->name   = name;
        room->player2->leave  = false;

    } else {
        return false;
    }
    return true;
};

// 观战者加入
bool observer_join(const std::string& id, const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    observer_delete(room);
    if (room->observers.size() >= 20) return false; // max 20

    auto it = room->observers.find(uuid);
    if (it == room->observers.end()) {
        auto player    = std::make_shared<Player>();
        player->client = client;
        player->exp    = Libs::Only::Time::timestamp_ms();
        player->name   = name;
        player->uuid   = uuid;
        player->leave  = false;
        room->observers.try_emplace(uuid, player);

    } else {
        it->second->exp    = Libs::Only::Time::timestamp_ms();
        it->second->name   = name;
        it->second->client = client;
        it->second->leave  = false;
    }

    return true;
};


// 房间心跳
bool room_heartbeat(const std::string& id) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    room->exp = Libs::Only::Time::timestamp_ms();
    return true;
};

// 玩家心跳
bool player_heartbeat(const std::string& id, const std::string& uuid) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    room_delete();

    if (room->player1->uuid == uuid) return (room->player1->exp = Libs::Only::Time::timestamp_ms(), true);
    else if (room->player2->uuid == uuid) return (room->player2->exp = Libs::Only::Time::timestamp_ms(), true);
    return false;
};

// 观众心跳
bool observer_heartbeat(const std::string& id, const std::string& uuid) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    auto it = room->observers.find(uuid);
    if (it == room->observers.end()) return false;

    it->second->exp = Libs::Only::Time::timestamp_ms();
    return true;
};


// 以玩家得到另外一位玩家
bool player2player(const std::string& id, const std::string& uuid, std::shared_ptr<Player>& player) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    if (room->player1->uuid == uuid) return (player = room->player2, true);
    else if (room->player2->uuid == uuid) return (player = room->player1, true);
    return false;
};

// 直接得到玩家
bool player2player_rers(const std::string& id, const std::string& uuid, std::shared_ptr<Player>& player) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    if (room->player1->uuid == uuid) return (player = room->player1, true);
    else if (room->player2->uuid == uuid) return (player = room->player2, true);
    return false;
};

// 以玩家得到所有观众
bool player2observers(const std::string& id, const std::string& uuid, std::vector<std::shared_ptr<Player>>& observers) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    if (room->player1->uuid != uuid && room->player2->uuid != uuid) return false;
    observer_delete(room);

    for (const auto& [_, player] : room->observers) observers.emplace_back(player);
    return true;
};

// 以观众得到所有观众
bool observer2observers(const std::string& id, const std::string& uuid, std::vector<std::shared_ptr<Player>>& observers) noexcept {
    auto room = search(id);
    if (room == nullptr) return false;

    auto it = room->observers.find(uuid);
    if (it == room->observers.end()) return false;
    observer_delete(room);

    for (const auto& [_, player] : room->observers) observers.emplace_back(player);
    return true;
};
} // namespace Friend
} // namespace Online