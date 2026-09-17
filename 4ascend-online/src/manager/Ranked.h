/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Ranked
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string_view>


namespace Manager {
namespace Ranked {
// 初始化数据库与表结构
void init() noexcept;
// 关闭数据库连接并释放预编译语句
void close() noexcept;

// 增加分数
bool add_score(std::string_view uuid, int64_t score) noexcept;
// 减少分数
bool sub_score(std::string_view uuid, int64_t score) noexcept;
// 获取当前分数
bool get_score(std::string_view uuid, int64_t& score) noexcept;
// 直接覆盖修改分数
bool update_score(std::string_view uuid, int64_t score) noexcept;
// 插入新用户
bool insert_score(std::string_view uuid, int64_t score) noexcept;
// 查询所有
bool get_all(std::vector<std::string>& names, std::vector<std::string>& uuids, std::vector<int64_t>& scores) noexcept;
// 结算
void endgame(int64_t& score_a, int64_t& score_b, const std::string& result_status = "none", std::string winner = "none") noexcept;
} // namespace Ranked
} // namespace Manager