/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: User
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "User.h"

#include <cstdint>
#include <string_view>


namespace Manager {
namespace User {
// 初始化
void init() noexcept;
// 关闭
void close() noexcept;

// 所有用户
bool all_user(std::vector<std::string>& uuids) noexcept;
// 创建用户
bool create_user(std::string_view mail, std::string_view uuid, int64_t time, std::string_view name, std::string_view avatar) noexcept;
// 删除用户
bool delete_user(std::string_view uuid) noexcept;
// 更新用户信息
bool update_user(std::string_view uuid, std::string_view name, std::string_view avatar) noexcept;
// 查询用户信息
bool info_user(std::string_view uuid, std::string& name, std::string& avatar, std::string& mail, int64_t& time) noexcept;
// 查询用户权限等级
bool get_level(std::string_view uuid, int& level) noexcept;
// 使用秘钥解锁权限等级（只允许升级）
bool unlock_level(std::string_view uuid, std::string_view secret, int& level) noexcept;
// 生成一次性权限秘钥并写入数据库
bool generate_level_key(int target_level, std::string& secret) noexcept;
// 查询用户昵称
bool name_user(std::string_view uuid, std::string& name) noexcept;

// 是否存在标识
bool exist_user(std::string_view uuid) noexcept;
// 是否存在邮箱
bool exist_mail(std::string_view mail) noexcept;

// 邮箱得到标识
bool mail2uuid(std::string_view mail, std::string& uuid) noexcept;
} // namespace User
} // namespace Manager