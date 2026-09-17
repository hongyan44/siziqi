/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 排位赛
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Ranked.h"

#include "Friend.h"
#include "Player.h"

#include "../api/Utils.h"

#include "../libs/only/Random.h"
#include "../libs/only/Time.h"

#include "../manager/Ranked.h"

#include <memory>
#include <unordered_map>


namespace Online {
namespace Ranked {
std::unordered_map<std::string, std::shared_ptr<Player>> pool;


// 清理
void pool_delete() noexcept {
    for (auto [_, player] : pool) {
        auto it = std::find(ws_clients.begin(), ws_clients.end(), player->client);
        if (it != ws_clients.end()) continue;
        pool.erase(player->uuid);
    }
};


// 加入随机匹配池
bool ranked_join(const std::string& uuid, const std::string& name, cinatra::coro_http_connection* client) noexcept {
    pool_delete();
    if (pool.size() >= 20) return false;

    if (pool.contains(uuid)) {
        auto player    = pool[uuid];
        player->name   = name;
        player->client = client;
        player->uuid   = uuid;
    } else {
        auto player    = std::make_shared<Player>();
        player->name   = name;
        player->client = client;
        player->uuid   = uuid;
        pool.try_emplace(uuid, player);
    }
    return true;
};

// 匹配池进行匹配
bool ranked_match(const std::string& uuid, int64_t seconds, std::vector<std::shared_ptr<Player>>& players, std::string& room) noexcept {
    if (!pool.contains(uuid)) return false;

    auto my = pool[uuid];
    my->exp = seconds;

    if (seconds < 2) return false;
    pool.erase(uuid);
    pool_delete();

    std::vector<std::shared_ptr<Player>> foes;
    for (auto [_, player] : pool) {
        if (player->exp < 2) continue;
        pool.erase(_);
        foes.emplace_back(player);
    }

    // 如果没有对手，填回
    // 如果只有一名对手，并且申请配对方没有等待二十四秒，则不允许配对
    // printf("%zu %ld\n", foes.size(), seconds);
    if (foes.size() == 0 || (seconds < 6 && foes.size() == 1)) {
        pool.try_emplace(uuid, my);
        for (auto player : foes) pool.try_emplace(player->uuid, player);
        return false;
    }
    auto foe = foes[Libs::Only::Random::mod(foes.size())];
    for (auto player : foes)
        if (player != foe) pool.try_emplace(player->uuid, player);

    players.emplace_back(my);
    players.emplace_back(foe);

    room  = "SUB_";
    room += Libs::Only::Random::uint32(65, 90);
    room += Libs::Only::Random::uint32(65, 90);

    while (Friend::room_exist(room)) {
        room  = "SUB_";
        room += Libs::Only::Random::uint32(65, 90);
        room += Libs::Only::Random::uint32(65, 90);
    }

    // printf("%s\n", room.c_str());
    return true;
};

// 得到匹配池是所有玩家
bool ranked_all(std::vector<std::shared_ptr<Player>>& players) noexcept {
    pool_delete();
    for (auto [_, player] : pool) players.emplace_back(player);
    return true;
};

// 验证对局并计分
bool ranked_endgame(
    const std::string& uuid,
    const std::string& room,
    const std::string& archive,
    const std::string& win,
    int64_t& my_score,
    int64_t& foe_score,
    std::string& win_p,
    bool is_backbg
) noexcept {
    if (!Friend::room_exist(room)) return false; // 如果房间不存在，不进行结算

    auto now = Libs::Only::Time::timestamp_ms();

    // 储存回放哈希
    std::shared_ptr<Player> my;
    std::shared_ptr<Player> foe;
    Friend::player2player_rers(room, uuid, my);
    Friend::player2player(room, uuid, foe);

    // 如果有分数则直接返回
    if (my->score != -1 && foe->score != -1) {
        my_score  = my->score;
        foe_score = foe->score;

        win_p = my->win ? "my" : "foe";
        return true;
    }

    if (is_backbg) return false;

    auto my_leave  = my->leave || my->exp < now - 25 * 1000;
    auto foe_leave = foe->leave || foe->exp < now - 25 * 1000;

    // printf("[ranked_endgame] my_leave: %d (leave:%d, exp:%ld < %ld)\n", my_leave, my->leave, my->exp, now - 25 * 1000);
    // printf("[ranked_endgame] foe_leave: %d (leave:%d, exp:%ld < %ld)\n", foe_leave, foe->leave, foe->exp, now - 25 * 1000);

    // 必须双人都拥有哈希
    // 或者如果逃跑或离开也可以
    if (foe->archive != archive && !my_leave && !foe_leave) {
        my->archive = archive;
        return false;
    }

    // 得到分数并计分
    if (!Manager::Ranked::get_score(uuid, my_score)) {
        my_score = 0;
        Manager::Ranked::insert_score(uuid, my_score);
    }

    if (!Manager::Ranked::get_score(foe->uuid, foe_score)) {
        foe_score = 0;
        Manager::Ranked::insert_score(foe->uuid, foe_score);
    }

    // 逃跑与离线
    std::string leave;
    if (my_leave) leave = "A";
    else if (foe_leave) leave = "B";
    else leave = "none";

    // 胜利，前端已适配

    // 计分
    Manager::Ranked::endgame(my_score, foe_score, leave, win);
    // printf("%ld %ld %s %s\n", my_score, foe_score, leave.c_str(), win.c_str());

    // 分数
    my->score  = my_score;
    foe->score = foe_score;

    // 胜利者
    if (win == "A") {
        my->win = true;
        win_p   = "my";
    } else if (win == "B") {
        foe->win = true;
        win_p    = "foe";
    }

    // 重新更新
    Manager::Ranked::update_score(uuid, my_score);
    Manager::Ranked::update_score(foe->uuid, foe_score);
    return true;
};
} // namespace Ranked
} // namespace Online