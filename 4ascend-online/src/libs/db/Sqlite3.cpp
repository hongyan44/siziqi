/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Sqlite3.h"


namespace Libs {
namespace DB {
namespace Sqlite3 {
const char* performance_pragmas[] = {
    "PRAGMA synchronous = NORMAL;",     // 关闭同步，提升写入速度，但可能在崩溃时丢数据
    "PRAGMA journal_mode = WAL;",       // 使用内存日志，减少磁盘 I/O
    "PRAGMA temp_store = MEMORY;",      // 临时表存放在内存中
    "PRAGMA cache_size = -20000;",      // 设置缓存大小（负数表示 KB 单位，这里约 20MB）
    "PRAGMA locking_mode = EXCLUSIVE;", // 独占锁，避免频繁锁切换
    "PRAGMA mmap_size = 268435456;",    // 使用内存映射文件 (256MB)，加快读写
    "PRAGMA foreign_keys = OFF;",       // 关闭外键检查，提升插入性能
    "PRAGMA automatic_index = OFF;",    // 关闭自动索引，减少额外开销
    "PRAGMA threads = 4;"               // 使用多线程（SQLite 3.33+ 支持）
};


void open(std::string_view path, sqlite3*& db) noexcept {
    int rc = sqlite3_open(path.data(), &db);
    if (rc != SQLITE_OK) {
        std::cerr << "无法打开数据库: " << (db ? sqlite3_errmsg(db) : "未知错误") << std::endl;
        if (db) sqlite3_close(db);
        db = nullptr;
        return;
    }

    for (const char* pragma : performance_pragmas) {
        if (sqlite3_exec(db, pragma, nullptr, nullptr, nullptr) != SQLITE_OK)
            std::cerr << "SQLite 配置失败: " << pragma << std::endl;
    }
};
} // namespace Sqlite3
} // namespace DB
} // namespace Libs