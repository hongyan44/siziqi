/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 初始化
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "Config.h"

#include "api/Utils.h"

#include "api/http/Replay.h"
#include "api/http/Time.h"
#include "api/http/User.h"

#include "api/ws/Friend.h"
#include "api/ws/Ping.h"
#include "api/ws/Ranked.h"

#include "manager/Contest.h"
#include "manager/Puzzle.h"
#include "manager/Replay.h"
#include "manager/Ranked.h"
#include "manager/Sms.h"
#include "manager/User.h"

#include "libs/only/Flie.h"
#include "libs/only/String.h"

#include "online/Friend.h"

#include <csignal>
#include <cstdlib>


// 初始化
inline void init() {
    // 数据库初始化
    Manager::Sms::init();
    Manager::User::init();
    Manager::Ranked::init();
    Manager::Replay::init();
    // Manager::Token::init();


    // 数据库 数据初始化
    std::vector<std::string> uuids;
    Manager::User::all_user(uuids);
    for (auto& uuid : uuids) Manager::Ranked::insert_score(uuid, 0);


    // 数据库安全关闭
    struct sigaction sa;
    sa.sa_handler = [](int sig) {
        Manager::Sms::close();
        Manager::User::close();
        Manager::Ranked::close();
        Manager::Replay::close();
        // Manager::Token::close();

        exit(0);
    };
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;

    sigaction(SIGINT, &sa, nullptr);  // Ctrl+C
    sigaction(SIGTERM, &sa, nullptr); // kill


    // 随机数
    std::srand(static_cast<unsigned int>(time(nullptr)));


    // 密码
    Libs::Only::Flie::read("bin/token_key.bin", TOKEN_KEY);
    Libs::Only::Flie::read("bin/token_salt.bin", TOKEN_SALT);

    Libs::Only::Flie::read("bin/body_key.bin", BODY_KEY);
    Libs::Only::Flie::read("bin/res_key.bin", RES_KEY);

    Libs::Only::Flie::read("bin/sms_salt.bin", SMS_SALT);

    // 热重启，重新创建房间
    std::string room_txt;
    Libs::Only::Flie::read("txt/rooms.txt", room_txt);

    std::vector<std::string> rooms;
    Libs::Only::String::split(room_txt, '#', rooms);
    for (auto& room : rooms) Online::Friend::room_create(room);
};


// API
inline void api(cinatra::coro_http_server& server) {
    // HTTP

    // 用户相关
    Api::Http::User::load(server);
    Api::Http::Replay::load(server);
    Api::Http::Time::load(server);


    // WS
    server.set_http_handler<cinatra::GET>(
        "/game/ws",
        [](cinatra::coro_http_request& request, cinatra::coro_http_response& _) -> async_simple::coro::Lazy<void> {
            cinatra::websocket_result result{};
            cinatra::coro_http_connection* connect = nullptr;

            while (true) {
                connect = request.get_conn();
                if (!connect) break;

                auto it = std::find(ws_clients.begin(), ws_clients.end(), connect);
                if (it == ws_clients.end()) ws_clients.push_back(connect);

                if (!connect) break;
                result = co_await connect->read_websocket();
                if (result.ec || result.type == cinatra::ws_frame_type::WS_CLOSE_FRAME) break;

                // std::string debug;
                // Libs::Coder::Base64::encode(result.data, debug);
                // printf("%s\n", debug.data());

                // 分发
                std::string output;
                if (!co_await Api::Ws::Ping::run(result.data, connect, output) && !co_await Api::Ws::Friend::run(result.data, connect, output)
                    && !co_await Api::Ws::Ranked::run(result.data, connect, output))
                    continue;
                if (output.empty()) continue;

                // printf("success\n");

                // Libs::Coder::Base64::encode(output, debug);
                // printf("%s\n", debug.data());

                if (!connect) break;
                auto ec = co_await connect->write_websocket(output, cinatra::opcode::binary);
                if (ec) break;
            }

            std::erase(ws_clients, connect);
        }
    );


    // 联机相关
    Api::Ws::Friend::load();
    Api::Ws::Ping::load();
    Api::Ws::Ranked::load();
};