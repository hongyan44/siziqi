/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Replay {
// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept;
} // namespace User
} // namespace Http
} // namespace Api