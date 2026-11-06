/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 全服消息 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Notice {
// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept;
} // namespace Notice
} // namespace Http
} // namespace Api
