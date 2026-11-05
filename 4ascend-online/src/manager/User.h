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
// 查询昵称颜色（空串表示未设置）
bool get_name_color(std::string_view uuid, std::string& out) noexcept;
// 设置昵称颜色（空串表示清除）
bool set_name_color(std::string_view uuid, std::string_view color) noexcept;

// 查询经济数据：棋币余额与累计经验
bool get_wallet(std::string_view uuid, int64_t& coin, int64_t& exp) noexcept;
// 增减棋币（amount 可为负，余额不会低于 0）
bool add_coin(std::string_view uuid, int64_t amount) noexcept;
// 增减经验（amount 可为负，累计经验不会低于 0）
bool add_exp(std::string_view uuid, int64_t amount) noexcept;
// 同组玩家同场对局的结算占位：首次插入返回 true，重复上传返回 false
bool claim_coin_match(std::string_view uuid_a, std::string_view uuid_b, int64_t bucket) noexcept;

// 棋币购买权限等级：返回 0 成功、1 已拥有更高等级、2 棋币不足、-1 失败
int purchase_level(std::string_view uuid, int target_level, int64_t price, int& level, int64_t& coin) noexcept;

// 查询已购皮肤：棋子（黑白合并）/ 高级定制棋子 / 草 / 金菱草 / 白玉玲珑 / 火与钢 / 棋盘 / 玄金棋盘 / 风格 UI / 留青 UI（仅自己可见的外观光效）
bool get_skins(std::string_view uuid, bool& piece, bool& piece_rouge, bool& piece_atlantis, bool& grass, bool& grass_gold, bool& grass_jade, bool& grass_firesteel, bool& board, bool& board_gold, bool& board_atlantis, bool& theme, bool& theme_black, bool& theme_liuqing) noexcept;
// 棋币购买皮肤：返回 0 成功、1 已拥有、2 棋币不足、-1 失败
int purchase_skin(std::string_view uuid, std::string_view item, int64_t price, bool& owned, int64_t& coin) noexcept;

// 查询单局投稿券数量
bool get_tickets(std::string_view uuid, int64_t& tickets) noexcept;
// 增减单局投稿券（amount 可为负，数量不会低于 0）
bool add_tickets(std::string_view uuid, int64_t amount) noexcept;
// 棋币购买单局投稿券：返回 0 成功、2 棋币不足、-1 失败
int purchase_ticket(std::string_view uuid, int64_t price, int64_t& tickets, int64_t& coin) noexcept;
// 消耗一张单局投稿券（仅当余量 ≥1 时成功）
bool consume_ticket(std::string_view uuid) noexcept;

// 3000 棋币兑换券面值（使用一张可增加等量棋币）
inline constexpr int64_t COIN_VOUCHER_VALUE = 3000;
// 查询 3000 棋币兑换券数量
bool get_vouchers(std::string_view uuid, int64_t& vouchers) noexcept;
// 增减 3000 棋币兑换券（amount 可为负，数量不会低于 0）
bool add_vouchers(std::string_view uuid, int64_t amount) noexcept;
// 使用一张 3000 棋币兑换券：返回 0 成功、2 数量不足、-1 失败
int use_voucher(std::string_view uuid, int64_t value, int64_t& coin, int64_t& vouchers) noexcept;

// 500 棋币兑换券面值（残局投稿审核通过奖励，使用一张可增加等量棋币）
inline constexpr int64_t COIN_VOUCHER_PUZZLE_VALUE = 500;
// 查询 500 棋币兑换券数量
bool get_vouchers_puzzle(std::string_view uuid, int64_t& vouchers) noexcept;
// 增减 500 棋币兑换券（amount 可为负，数量不会低于 0）
bool add_vouchers_puzzle(std::string_view uuid, int64_t amount) noexcept;
// 使用一张 500 棋币兑换券：返回 0 成功、2 数量不足、-1 失败
int use_voucher_puzzle(std::string_view uuid, int64_t value, int64_t& coin, int64_t& vouchers) noexcept;

// 好友赠礼：500 棋币赠礼个数与最近购买自然日（东八区日序号）
bool get_gift_vouchers(std::string_view uuid, int64_t& vouchers, int64_t& day) noexcept;
// 棋币购买好友赠礼（每日限购 1 个）：返回 0 成功、2 棋币不足、3 今日已购、-1 失败
int purchase_gift_voucher(std::string_view uuid, int64_t price, int64_t day, int64_t& vouchers, int64_t& coin) noexcept;
// 赠送好友：扣减自己 1 个赠礼并给对方背包增加 1 张 500 棋币兑换券；返回 0 成功、2 数量不足、-1 失败
int send_gift_voucher(std::string_view from, std::string_view to) noexcept;
// 东八区自然日序号（毫秒时间戳 → 天），用于每日限购判定
int64_t day_index(int64_t now_ms) noexcept;
// 东八区自然周序号（周一 0 点为换周分界），用于每周限购判定
int64_t week_index(int64_t now_ms) noexcept;

// 好友赠礼 3000：3000 棋币赠礼个数与最近购买自然周（周一 0 点刷新，仅 3 级及以上可购买）
bool get_gift_vouchers_3000(std::string_view uuid, int64_t& vouchers, int64_t& week) noexcept;
// 棋币购买 3000 好友赠礼（每周限购 1 个）：返回 0 成功、2 棋币不足、3 本周已购、-1 失败
int purchase_gift_voucher_3000(std::string_view uuid, int64_t price, int64_t week, int64_t& vouchers, int64_t& coin) noexcept;
// 赠送好友：扣减自己 1 个 3000 赠礼并给对方背包增加 1 张 3000 棋币兑换券；返回 0 成功、2 数量不足、-1 失败
int send_gift_voucher_3000(std::string_view from, std::string_view to) noexcept;

// 经验曲线：1→2 级 100，2→3 级 120，此后每级按上一级 1.2 倍向下取整
int exp_level(int64_t exp) noexcept;
int64_t exp_need(int level) noexcept;
int64_t exp_within(int64_t exp) noexcept;

// 查询玩家展示统计：AI 对局场次与成就展示（逗号分隔的成就 id，最多 3 个）
bool get_profile_stats(std::string_view uuid, int64_t& ai_games, std::string& showcase) noexcept;
// 写入 AI 对局场次（仅允许增大，避免多端上报时回退）
bool set_ai_games(std::string_view uuid, int64_t ai_games) noexcept;
// 设置成就展示（逗号分隔的成就 id）
bool set_showcase(std::string_view uuid, std::string_view showcase) noexcept;

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