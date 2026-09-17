/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include <cinatra.hpp>

#pragma once


namespace Online {
class Player {
public:
    cinatra::coro_http_connection* client;

    std::string name;
    std::string uuid;

    bool leave;
    int64_t exp;

    std::string archive;
    int64_t submit;

    int64_t score;
    bool win;
};
} // namespace Online