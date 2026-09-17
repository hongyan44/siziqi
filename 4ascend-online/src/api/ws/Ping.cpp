/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Ping.h"

#include "../Utils.h"

#include <string_view>


namespace Api {
namespace Ws {
namespace Ping {
std::unordered_map<
    std::string,
    async_simple::coro::Lazy<void> (*)(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output)>
    dispatch;


// 连通性测试
async_simple::coro::Lazy<void> ping(jsoncons::basic_json<char>& rjson, cinatra::coro_http_connection* client, std::string& output) {
    api_end("ping", true, jsoncons::json::null(), output);
    co_return;
};


// 装载所有路由
void load() noexcept { dispatch["ping"] = ping; };


// 运行
async_simple::coro::Lazy<bool> run(std::string_view body_, cinatra::coro_http_connection* client, std::string& output) noexcept {
    auto body = api_body(body_);
    if (!body) co_return false;
    auto rjson = body.value();

    auto op = rjson["op"].as<std::string>();
    // printf("%s\n", op.data());
    auto it = dispatch.find(op);
    if (it != dispatch.end()) {
        co_await it->second(rjson, client, output);
        co_return true;
    }
    co_return false;
};
} // namespace Ping
} // namespace Ws
} // namespace Api