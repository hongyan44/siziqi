/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <sqlite/sqlite3.h>


namespace Libs {
namespace DB {
namespace Sqlite3 {
void open(std::string_view path, sqlite3*& db) noexcept;
} // namespace Sqlite3
} // namespace DB
} // namespace Libs