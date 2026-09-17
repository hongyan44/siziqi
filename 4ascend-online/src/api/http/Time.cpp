/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Time.h"

#include "../Utils.h"

#include "../../libs/only/Time.h"


namespace Api {
namespace Http {
namespace Time {
// 毫秒时间戳
void time_ms(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    std::string buffer;
    api_end("time_ms", true, Libs::Only::Time::timestamp_ms(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 秒时间戳
void time_s(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    std::string buffer;
    api_end("time_s", true, Libs::Only::Time::timestamp_s(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/time/ms", time_ms);
    server.set_http_handler<cinatra::POST>("/time/s", time_s);
};
} // namespace Time
} // namespace Http
} // namespace Api