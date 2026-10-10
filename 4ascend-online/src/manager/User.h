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
// 创建用户（mail 与 phone 至少一个非空；account/pass 用于账密登录）
bool create_user(
    std::string_view mail, std::string_view phone, std::string_view account, std::string_view pass, std::string_view uuid, int64_t time,
    std::string_view name, std::string_view avatar
) noexcept;
// 删除用户
bool delete_user(std::string_view uuid) noexcept;
// 更新用户信息
bool update_user(std::string_view uuid, std::string_view name, std::string_view avatar) noexcept;
// 查询用户信息
bool info_user(std::string_view uuid, std::string& name, std::string& avatar, std::string& mail, int64_t& time) noexcept;
// 查询账号与手机号
bool account_user(std::string_view uuid, std::string& account, std::string& phone) noexcept;
// 设置登录账号（仅当前账号为空时可写，设置后不可再改）
bool update_account(std::string_view uuid, std::string_view account) noexcept;
// 查询用户权限等级
bool get_level(std::string_view uuid, int& level) noexcept;
// 使用秘钥解锁权限等级（只允许升级）
bool unlock_level(std::string_view uuid, std::string_view secret, int& level) noexcept;
// 生成一次性权限秘钥并写入数据库
bool generate_level_key(int target_level, std::string& secret) noexcept;
// 查询用户昵称
bool name_user(std::string_view uuid, std::string& name) noexcept;

// 查询用户专属短 ID（用于好友搜索）
bool friend_id_user(std::string_view uuid, std::string& friend_id) noexcept;
// 专属短 ID 反查用户标识
bool friend_id_uuid(std::string_view friend_id, std::string& uuid) noexcept;
// 确保用户拥有专属短 ID：缺失则生成并写入，返回最终短 ID
bool ensure_friend_id(std::string_view uuid, std::string& friend_id) noexcept;
// 为所有缺失专属短 ID 的用户回填（启动时调用）
void ensure_all_friend_id() noexcept;

// 是否存在标识
bool exist_user(std::string_view uuid) noexcept;
// 是否存在邮箱或手机号（注册标识）
bool exist_ident(std::string_view ident) noexcept;
// 是否存在账号
bool exist_account(std::string_view account) noexcept;

// 标识（邮箱/手机号/账号）得到标识
bool ident2uuid(std::string_view ident, std::string& uuid) noexcept;
// 校验密码
bool check_pass(std::string_view uuid, std::string_view password) noexcept;
// 是否已设置登录密码
bool has_pass(std::string_view uuid, bool& has) noexcept;
// 更新登录密码
bool update_pass(std::string_view uuid, std::string_view pass) noexcept;
} // namespace User
} // namespace Manager