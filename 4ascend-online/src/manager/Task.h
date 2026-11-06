/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 每日任务管理
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>


namespace Manager {
namespace Task {
// 免费刷新次数与付费刷新单价
inline constexpr int64_t FREE_REFRESH      = 2;
inline constexpr int64_t PAID_REFRESH_COST = 50;

struct TaskRecord {
    std::string id;
    std::string kind; // multi / single / puzzle / story
    std::string title;
    int64_t target;
    int64_t progress;
    int64_t reward;
    bool done;
    bool claimed; // 完成奖励是否已领取
};

// 刷新结果：ok 成功；invalid_task 指定任务不可刷新（不存在 / 已完成 / 投稿任务）；
// no_candidate 该组未抽到的任务已用尽；no_coin 棋币不足；error 其他错误
enum class RefreshResult { ok, invalid_task, no_candidate, no_coin, error };

// 领奖结果：ok 成功；invalid_task 指定任务不可领取（不存在 / 未完成 / 已领取）；error 其他错误
enum class ClaimResult { ok, invalid_task, error };

void init() noexcept;
void close() noexcept;

// 当前日期序号（北京时间 UTC+8 的 0 点切换）
int64_t today() noexcept;

// 读取某天的任务；首次访问自动按规则生成（3 个多人 + 2 个单人 + 1 个投稿；
// 权限等级 ≥ 2 的账号额外生成 1 个剧情投稿任务）
bool daily_tasks(std::string_view uuid, int64_t day, std::vector<TaskRecord>& records) noexcept;

// 当天已刷新次数
int64_t refresh_count(std::string_view uuid, int64_t day) noexcept;

// 刷新指定的未完成任务：从同组「从未抽到过」的任务里替换，投稿任务与已完成任务不可刷新。
// cost 输出本次费用（前 2 次免费，之后 50 棋币），coin 输出扣费后的余额。
RefreshResult refresh(std::string_view uuid, int64_t day, std::string_view task_id, int64_t& cost, int64_t& coin, std::vector<TaskRecord>& records) noexcept;

// 领取指定已完成任务的奖励（棋币 + 等额经验），同一任务只能领取一次。
// reward 输出本次领取的奖励值，coin 输出领取后的余额。
ClaimResult claim(std::string_view uuid, int64_t day, std::string_view task_id, int64_t& reward, int64_t& coin, std::vector<TaskRecord>& records) noexcept;

// 上报一次任务事件（ranked_play / ranked_win / room_play / spectate / ai_play / ai_win / ai_win_hard / puzzle_submit / story_submit）
// 只推进进度，奖励需玩家在任务面板手动领取；返回 0（保留返回值以兼容既有调用方）
int64_t event(std::string_view uuid, std::string_view name, int64_t day) noexcept;
} // namespace Task
} // namespace Manager
