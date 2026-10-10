#pragma once

#include "Config.h"

#include "api/Utils.h"

#include "api/http/Contest.h"
#include "api/http/Puzzle.h"
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
    // 密码与摘要盐必须先于数据库模块加载，避免权限秘钥在初始化时使用空盐。
    Libs::Only::Flie::read("bin/token_key.bin", TOKEN_KEY);
    Libs::Only::Flie::read("bin/token_salt.bin", TOKEN_SALT);
    Libs::Only::Flie::read("bin/body_key.bin", BODY_KEY);
    Libs::Only::Flie::read("bin/res_key.bin", RES_KEY);
    Libs::Only::Flie::read("bin/sms_salt.bin", SMS_SALT);
    Libs::Only::Flie::read("bin/level_salt.bin", LEVEL_SALT);

    // 云片短信配置可选：缺失时留空，手机验证码回退为占位固定码
    Libs::Only::Flie::read("bin/sms_yunpian_apikey.bin", SMS_YUNPIAN_APIKEY);
    Libs::Only::Flie::read("bin/sms_yunpian_tpl_id.bin", SMS_YUNPIAN_TPL_ID);

    // 数据库初始化
    Manager::Sms::init();
    Manager::User::init();
    Manager::Ranked::init();
    Manager::Replay::init();
    Manager::Puzzle::init();
    Manager::Contest::init();
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
        Manager::Puzzle::close();
        Manager::Contest::close();
        // Manager::Token::close();

        exit(0);
    };
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;

    sigaction(SIGINT, &sa, nullptr);  // Ctrl+C
    sigaction(SIGTERM, &sa, nullptr); // kill


    // 随机数
    std::srand(static_cast<unsigned int>(time(nullptr)));


    // 热重启，重新创建房间
    std::string room_txt;
    Libs::Only::Flie::read("txt/rooms.txt", room_txt);

    std::vector<std::string> rooms;
    Libs::Only::String::split(room_txt, '#', rooms);
    for (auto& room : rooms) Online::Friend::room_create(room);
};


// ========== 新增：提取 WebSocket 处理函数（解决 GCC ICE） ==========
__attribute__((optimize("O2")))
static async_simple::coro::Lazy<void> handle_websocket(cinatra::coro_http_request& request,
                                                       cinatra::coro_http_response& _) {
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

        // 分发
        std::string output;
        if (!co_await Api::Ws::Ping::run(result.data, connect, output) &&
            !co_await Api::Ws::Friend::run(result.data, connect, output) &&
            !co_await Api::Ws::Ranked::run(result.data, connect, output))
            continue;
        if (output.empty()) continue;

        if (!connect) break;
        auto ec = co_await connect->write_websocket(output, cinatra::opcode::binary);
        if (ec) break;
    }

    std::erase(ws_clients, connect);
}
// ===================================================================


// API
inline void api(cinatra::coro_http_server& server) {
    // HTTP

    // 用户相关
    Api::Http::User::load(server);
    Api::Http::Puzzle::load(server);
    Api::Http::Replay::load(server);
    Api::Http::Contest::load(server);
    Api::Http::Time::load(server);


    // WS —— 此处直接调用独立函数，不再使用 lambda
    server.set_http_handler<cinatra::GET>("/game/ws", handle_websocket);


    // 联机相关
    Api::Ws::Friend::load();
    Api::Ws::Ping::load();
    Api::Ws::Ranked::load();
};