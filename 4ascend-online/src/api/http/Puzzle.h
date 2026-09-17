/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局关卡 HTTP 接口
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Puzzle {
void load(cinatra::coro_http_server& server) noexcept;
} // namespace Puzzle
} // namespace Http
} // namespace Api
