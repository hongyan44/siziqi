/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情角色管理（角色代表图与表情图；管理员可新增、删除角色并更换代表图）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>


namespace Manager {
namespace Story {
// 单张图片（data URL）上限：8MB
constexpr std::size_t IMAGE_LIMIT = 8 * 1024 * 1024;

struct ExpressionRecord {
    uint64_t id = 0;
    std::string name;
    std::string image;           // 120×180 压缩图（data URL），供前端加载；原图只落盘
    std::string image_original;  // 原图在服务端磁盘上的路径（空表示尚未保存原图，下载时回退为 image）
};

struct CharacterRecord {
    uint64_t id = 0;
    std::string name;
    std::string rep;             // 120×180 压缩图（data URL），供前端加载；原图只落盘
    std::string rep_original;    // 原图在服务端磁盘上的路径（空表示尚未保存原图，下载时回退为 rep）
    uint64_t updated_at = 0;
    std::vector<ExpressionRecord> expressions;
};

// 剧情投稿：等级 2/3 的编辑操作先入库，由等级 4 审核通过后再应用到正式数据。
struct SubmissionRecord {
    uint64_t id = 0;
    std::string kind;        // level / character / expression / update_rep / update_expression_image
    uint64_t level_from = 0; // 编辑前的关卡序号；0 表示新建关卡
    uint64_t level_to = 0;   // 提交后的关卡序号
    std::string name;        // 关卡标题 / 角色名 / 表情名
    std::string payload;     // JSON 载荷（剧本、图片 data URL、角色/表情 id 等）
    std::string creator;
    uint64_t created_at = 0;
    int status = 0;          // 0 待审 / 1 通过 / 2 拒绝
    std::string reviewer;
    uint64_t reviewed_at = 0;
};

void init() noexcept;
void close() noexcept;

// 全部角色（含各自的表情），按新增顺序返回
bool query_characters(std::vector<CharacterRecord>& result) noexcept;

bool exist_character_name(std::string_view name) noexcept;
bool exist_character_id(uint64_t id) noexcept;
bool exist_expression_name(uint64_t character_id, std::string_view name) noexcept;

bool add_character(std::string_view name, std::string_view rep, std::string_view rep_original, std::string_view creator, uint64_t updated_at, uint64_t& id) noexcept;
bool add_expression(uint64_t character_id, std::string_view name, std::string_view image, std::string_view image_original, std::string_view creator, uint64_t updated_at, uint64_t& id) noexcept;
// 覆盖已有表情图片（压缩图 + 原图路径），用于把旧大图降采样为 120×180 压缩图
bool update_expression_image(uint64_t character_id, uint64_t expression_id, std::string_view image, std::string_view image_original, uint64_t updated_at) noexcept;

// 更换角色代表图（缩略图 + 原图路径）
bool update_character_rep(uint64_t id, std::string_view rep, std::string_view rep_original, uint64_t updated_at) noexcept;
// 读取角色代表图（名称 / 缩略图 / 原图路径），供管理员下载原图
bool query_character_rep(uint64_t id, std::string& name, std::string& image, std::string& original) noexcept;
// 读取单个表情（名称 / 缩略图 / 原图路径），供管理员下载原图
bool query_expression_image(uint64_t character_id, uint64_t expression_id, std::string& name, std::string& image, std::string& original) noexcept;
// 收集角色（代表图 + 全部表情）的原图路径，删除角色前调用以清理磁盘文件
bool query_character_originals(uint64_t id, std::vector<std::string>& originals) noexcept;
// 删除角色及其全部表情（同一事务内完成）
bool delete_character(uint64_t id) noexcept;
// 删除单个表情（需同时匹配所属角色，避免误删）
bool delete_expression(uint64_t character_id, uint64_t expression_id) noexcept;

// 新增一条待审投稿；id 输出新记录主键
bool add_submission(
    std::string_view kind,
    uint64_t level_from,
    uint64_t level_to,
    std::string_view name,
    std::string_view payload,
    std::string_view creator,
    uint64_t created_at,
    uint64_t& id
) noexcept;
// 查询投稿：creator 非空时只查该账号的投稿；pending_only 为 true 时只返回待审记录
bool query_submissions(bool pending_only, std::string_view creator, std::vector<SubmissionRecord>& result) noexcept;
bool query_submission(uint64_t id, SubmissionRecord& result) noexcept;
// 仅当记录仍处于 from_status 时更新为 to_status，用于审核与失败回滚
bool set_submission_status(uint64_t id, int from_status, int to_status, std::string_view reviewer, uint64_t reviewed_at) noexcept;
} // namespace Story
} // namespace Manager
