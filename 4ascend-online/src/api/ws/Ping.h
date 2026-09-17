/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once


namespace Api {
namespace Ws {
namespace Ping {
// 装载所有路由
void load() noexcept;
// 运行
async_simple::coro::Lazy<bool> run(std::string_view body_, cinatra::coro_http_connection* client, std::string& output) noexcept;
} // namespace Friend
} // namespace Ws
} // namespace Api