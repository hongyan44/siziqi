/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情角色 HTTP 接口（角色与表情图片）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cinatra/coro_http_server.hpp>


namespace Api {
namespace Http {
namespace Story {
void load(cinatra::coro_http_server& server) noexcept;
} // namespace Story
} // namespace Http
} // namespace Api
