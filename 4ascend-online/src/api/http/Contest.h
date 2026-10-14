/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 赛事签表 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Contest {
void load(cinatra::coro_http_server& server) noexcept;
} // namespace Contest
} // namespace Http
} // namespace Api
