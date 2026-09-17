/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 主入口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Init.h"

#include <cinatra.hpp>


int main(int argc, char* argv[]) {
    // 初始化
    init();


    // 服务器
    cinatra::coro_http_server server(1, std::stoi(argv[2]), argv[1], true);
    api(server);


    // 启动
    auto ec = server.sync_start();
    return ec.value();
};