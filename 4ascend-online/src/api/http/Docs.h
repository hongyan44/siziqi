/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 文档 HTTP 接口（游戏规则 / 使用手册）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Docs {
void load(cinatra::coro_http_server& server) noexcept;
} // namespace Docs
} // namespace Http
} // namespace Api