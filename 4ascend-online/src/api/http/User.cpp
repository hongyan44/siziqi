/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "User.h"

#include "../Utils.h"

#include "../../manager/Ranked.h"
#include "../../manager/Sms.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include "../../manager/Friend.h"
#include "../../manager/Puzzle.h"
#include "../../manager/Replay.h"

#include "../../libs/only/Random.h"
#include "../../libs/only/Time.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <jsoncons_ext/msgpack/msgpack.hpp>

#include <stdexcept>
#include <string>
#include <string_view>


namespace Api {
namespace Http {
namespace User {
namespace {
// 手机号：11 位、以 1 开头、第二位 3-9
bool is_phone(std::string_view value) noexcept {
    if (value.size() != 11 || value[0] != '1' || value[1] < '3' || value[1] > '9') return false;
    for (const char c : value) {
        if (c < '0' || c > '9') return false;
    }
    return true;
}

// 邮箱：本地部分与域名部分非空，域名含点且顶级域非空
bool is_mail(std::string_view value) noexcept {
    const auto at = value.find('@');
    if (at == std::string_view::npos || at == 0 || at + 1 >= value.size()) return false;
    const auto dot = value.rfind('.');
    if (dot == std::string_view::npos || dot <= at + 1 || dot + 1 >= value.size()) return false;
    return true;
}

// 账号：字母开头，4-16 位字母/数字/下划线
bool is_account(std::string_view value) noexcept {
    if (value.size() < 4 || value.size() > 16) return false;
    const char first = value[0];
    if (!((first >= 'A' && first <= 'Z') || (first >= 'a' && first <= 'z'))) return false;
    for (const char c : value) {
        const bool allowed = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_';
        if (!allowed) return false;
    }
    return true;
}

// 密码：6-64 位
bool is_pass(std::string_view value) noexcept {
    return value.size() >= 6 && value.size() <= 64;
}

// 昵称显示长度：非 ASCII（中文等）记 2 单位，ASCII 记 1 单位，与前端 name_length 保持一致
size_t name_length(std::string_view value) noexcept {
    size_t length = 0;
    for (size_t index = 0; index < value.size();) {
        const unsigned char c = static_cast<unsigned char>(value[index]);
        if (c < 0x80) {
            length += 1;
            index += 1;
            continue;
        }
        length += 2;
        if ((c & 0xE0) == 0xC0) index += 2;
        else if ((c & 0xF0) == 0xE0) index += 3;
        else if ((c & 0xF8) == 0xF0) index += 4;
        else index += 1;
    }
    return length;
}

// 昵称：非空且不超过 16 显示单位
bool is_name(std::string_view value) noexcept {
    return !value.empty() && name_length(value) <= 16;
}

// 纯色：# 加恰好 6 位十六进制（大小写均可）
bool is_solid_color(std::string_view value) noexcept {
    if (value.size() != 7 || value[0] != '#') return false;
    for (size_t index = 1; index < 7; ++index) {
        const char c = value[index];
        const bool hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
        if (!hex) return false;
    }
    return true;
}

// 渐变：linear-gradient(90deg,#rrggbb,#rrggbb[, #rrggbb])，禁止空格，仅 2 或 3 个色标
bool is_gradient_color(std::string_view value) noexcept {
    static constexpr std::string_view PREFIX = "linear-gradient(90deg,";
    if (value.size() <= PREFIX.size() + 1) return false;
    if (value.compare(0, PREFIX.size(), PREFIX) != 0) return false;
    if (value.back() != ')') return false;

    const auto body = value.substr(PREFIX.size(), value.size() - PREFIX.size() - 1);
    int stops = 0;
    size_t start = 0;
    while (true) {
        const auto comma = body.find(',', start);
        const auto end   = comma == std::string_view::npos ? body.size() : comma;
        if (!is_solid_color(body.substr(start, end - start))) return false;
        stops += 1;
        if (comma == std::string_view::npos) break;
        start = comma + 1;
    }
    return stops == 2 || stops == 3;
}

// 流动彩虹：固定标记 rainbow（4 级专属，具体动画由渲染层实现）
bool is_rainbow_color(std::string_view value) noexcept {
    return value == "rainbow";
}

// 头像：仅接受前端裁剪压缩后的 data:image/... 数据（限制体积，避免超长文本写入数据库）
bool is_avatar(std::string_view value) noexcept {
    constexpr size_t MAX_AVATAR_SIZE = 200 * 1024;
    return value.size() <= MAX_AVATAR_SIZE && value.compare(0, 11, "data:image/") == 0;
}

// 成就 id：小写字母/数字/下划线，最长 24
bool is_achievement_id(std::string_view value) noexcept {
    if (value.empty() || value.size() > 24) return false;
    for (const char c : value) {
        const bool allowed = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_';
        if (!allowed) return false;
    }
    return true;
}

// 展示成就字符串（逗号分隔）转数组
jsoncons::json split_showcase(std::string_view showcase) noexcept {
    jsoncons::json result = jsoncons::json::array();
    size_t start = 0;
    while (start <= showcase.size()) {
        const auto comma = showcase.find(',', start);
        const auto end   = comma == std::string_view::npos ? showcase.size() : comma;
        const auto id    = showcase.substr(start, end - start);
        if (is_achievement_id(id)) result.push_back(std::string(id));
        if (comma == std::string_view::npos) break;
        start = comma + 1;
    }
    return result;
}
} // namespace

// 用户注册（邮箱或手机号 + 验证码 + 账号 + 密码，注册后不自动登录）
void user_register(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident   = rjson["ident"].as<std::string>();
    auto code    = rjson["code"].as<std::string>();
    auto account = rjson["account"].as<std::string>();
    auto pass    = rjson["pass"].as<std::string>();
    // 昵称选填，未填写时使用默认昵称
    std::string name = rjson.contains("name") && rjson["name"].is_string() ? rjson["name"].as<std::string>() : std::string();
    if (name.empty()) name = "无名氏";

    // 标识必须是邮箱或手机号，账号与密码需符合规则，昵称长度需合法，且验证码有效（验证码校验放最后，避免无谓消耗）
    if ((!is_mail(ident) && !is_phone(ident)) || !is_account(account) || !is_pass(pass) || !is_name(name)
        || Manager::User::exist_ident(ident) || Manager::User::exist_account(account) || !Manager::Sms::verify_sms(ident, code))
        return api_http_error("user_register", response); // cp

    auto uuid = Libs::Only::Random::uuid_v7();

    std::string mail  = is_mail(ident) ? ident : std::string();
    std::string phone = is_phone(ident) ? ident : std::string();
    if (!Manager::User::create_user(mail, phone, account, pass, uuid, Libs::Only::Time::timestamp_ms(), name, ""))
        return api_http_error("user_register", response); // cp
    Manager::Ranked::insert_score(uuid, 0);

    std::string buffer;
    api_end("user_register", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户登录（标识为 账号/手机号/邮箱；密码与验证码二选一）
void user_login(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident = rjson["ident"].as<std::string>();
    auto pass  = rjson["pass"].as<std::string>();
    auto code  = rjson["code"].as<std::string>();

    std::string uuid;
    if (!Manager::User::ident2uuid(ident, uuid)) return api_http_error("user_login", response); // cp

    bool passed = false;
    if (!pass.empty()) {
        passed = Manager::User::check_pass(uuid, pass);
    } else if (!code.empty() && (is_mail(ident) || is_phone(ident))) {
        // 验证码只能发往邮箱或手机号，账号名不支持验证码登录
        passed = Manager::Sms::verify_sms(ident, code);
    }
    if (!passed) return api_http_error("user_login", response); // cp

    std::string token;
    Manager::Token::uuid2token(uuid, token);

    std::string buffer;
    api_end("user_login", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);

    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 发送验证码（邮箱真实发送；手机号在配置云片后真实下发，未配置时回退占位固定码）
async_simple::coro::Lazy<void> user_sms(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) co_return;
    auto rjson = body.value();

    auto ident = rjson["ident"].as<std::string>();
    auto time  = Libs::Only::Time::timestamp_ms();

    std::string code;
    bool dev = false;

    if (is_phone(ident)) {
        if (!Manager::Sms::phone_sms_ready()) {
            // 未接入短信服务商：回退占位，使用固定验证码且不实际下发
            dev = true;
            if (!Manager::Sms::create_sms(ident, time, code, PHONE_SMS_DEV_CODE)) co_return api_http_error("user_sms", response); // cp
        } else {
            if (!Manager::Sms::create_sms(ident, time, code)) co_return api_http_error("user_sms", response); // cp
            if (!(co_await Manager::Sms::send_phone_sms(ident, code, request.get_conn()->get_executor()))) {
                Manager::Sms::delete_sms(ident);
                co_return api_http_error("user_sms", response); // cp
            }
        }
    } else if (is_mail(ident)) {
        if (!Manager::Sms::create_sms(ident, time, code)) co_return api_http_error("user_sms", response); // cp
        if (!(co_await Manager::Sms::send_sms(ident, code, request.get_conn()->get_executor()))) {
            Manager::Sms::delete_sms(ident);
            co_return api_http_error("user_sms", response); // cp
        }
    } else {
        co_return api_http_error("user_sms", response); // cp
    }

    // dev 为 true 表示手机号走占位固定码（前端据此提示固定验证码）
    jsoncons::json result = jsoncons::json::object();
    result["dev"] = dev;

    std::string buffer;
    api_end("user_sms", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 标识（邮箱或手机号）是否已注册
void user_exist(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto ident  = rjson["ident"].as<std::string>();
    auto status = Manager::User::exist_ident(ident);

    std::string buffer;
    api_end("user_exist", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户删除
void user_delete(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    Manager::Token::token2uuid(token, uuid);
    auto status = Manager::User::delete_user(uuid);

    std::string buffer;
    api_end("user_delete", status, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


// 用户信息
void user_info(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    int64_t time;
    int64_t score;
    std::string uuid, name, avatar, mail, account, phone;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::info_user(uuid, name, avatar, mail, time)
        || !Manager::User::account_user(uuid, account, phone) || !Manager::Ranked::get_score(uuid, score))
        return api_http_error("user_info", response); // cp

    std::string buffer;
    jsoncons::json info = jsoncons::json::object();
    info["name"]        = name;
    info["avatar"]      = avatar;
    info["time"]        = time;
    info["mail"]        = mail;
    info["account"]     = account;
    info["phone"]       = phone;
    info["uuid"]        = uuid;
    int level = 1;
    if (!Manager::User::get_level(uuid, level)) return api_http_error("user_info", response);
    bool has_pass = false;
    if (!Manager::User::has_pass(uuid, has_pass)) return api_http_error("user_info", response);

    info["score"] = score;
    info["level"] = level;
    // 萌新证：新注册账号为 true，前端登录后弹出新手引导，弹出后调用 /user/newbie_clear 销毁。
    bool newbie = false;
    if (!Manager::User::get_newbie(uuid, newbie)) return api_http_error("user_info", response);
    info["newbie"] = newbie;
    // 经济系统：棋币余额与经验等级，供账号信息 / 商店 / 玩家资料展示。
    int64_t coin = 0, exp = 0;
    Manager::User::get_wallet(uuid, coin, exp);
    info["coin"]      = coin;
    info["exp"]       = exp;
    info["exp_level"] = Manager::User::exp_level(exp);
    info["exp_cur"]   = Manager::User::exp_within(exp);
    info["exp_need"]  = Manager::User::exp_need(Manager::User::exp_level(exp));
    // 背包消耗品：单局投稿券数量，账号信息与商店读取。
    int64_t tickets = 0;
    Manager::User::get_tickets(uuid, tickets);
    info["tickets"] = tickets;
    // 背包消耗品：3000 棋币兑换券数量，赛事冠军奖励，可在背包内使用。
    int64_t vouchers = 0;
    Manager::User::get_vouchers(uuid, vouchers);
    info["vouchers"] = vouchers;
    // 背包消耗品：500 棋币兑换券数量，残局投稿审核通过奖励，可在背包内使用。
    int64_t vouchers_500 = 0;
    Manager::User::get_vouchers_puzzle(uuid, vouchers_500);
    info["vouchers_500"] = vouchers_500;
    // 背包消耗品：好友赠礼个数与是否今日已购买（商店每日限购 1 个）。
    int64_t gift_vouchers = 0;
    int64_t gift_day      = 0;
    Manager::User::get_gift_vouchers(uuid, gift_vouchers, gift_day);
    const int64_t today = Manager::User::day_index(Libs::Only::Time::timestamp_ms());
    info["gift_vouchers"] = gift_vouchers;
    info["gift_today"]    = gift_day == today;
    // 背包消耗品：3000 好友赠礼个数与本周是否已购买（商店每周限购 1 个，周一 0 点刷新）。
    int64_t gift_3000_vouchers = 0;
    int64_t gift_3000_week     = 0;
    Manager::User::get_gift_vouchers_3000(uuid, gift_3000_vouchers, gift_3000_week);
    const int64_t this_week = Manager::User::week_index(Libs::Only::Time::timestamp_ms());
    info["gift3000_vouchers"] = gift_3000_vouchers;
    info["gift3000_week"]     = gift_3000_week == this_week;
    // 密码以 HMAC 摘要存储，无法还原明文，这里只暴露“是否已设置”，供前端展示密码状态。
    info["has_pass"] = has_pass;
    // 昵称颜色：老数据行可能没有该列值，读取失败时回退为空串，不阻断信息返回。
    std::string name_color;
    Manager::User::get_name_color(uuid, name_color);
    info["name_color"] = name_color;
    // 好友专属短 ID：缺失时补发，供「账号信息」展示与好友搜索。
    std::string friend_id;
    if (!Manager::User::ensure_friend_id(uuid, friend_id)) return api_http_error("user_info", response);
    info["friend_id"] = friend_id;
    // 玩家展示数据：AI 对局场次与展示的成就，供「我的成就」页读取。
    int64_t ai_games = 0;
    std::string showcase;
    Manager::User::get_profile_stats(uuid, ai_games, showcase);
    info["ai_games"] = ai_games;
    info["showcase"] = split_showcase(showcase);
    // 已购皮肤：仅本人读取，用于在本机替换棋子 / 草 / 棋盘的外观（不影响对手）。
    bool skin_piece = false, skin_piece_rouge = false, skin_piece_atlantis = false, skin_grass = false, skin_grass_gold = false, skin_grass_jade = false, skin_grass_firesteel = false, skin_board = false, skin_board_gold = false, skin_board_atlantis = false, skin_theme = false, skin_theme_black = false, skin_theme_liuqing = false;
    if (!Manager::User::get_skins(uuid, skin_piece, skin_piece_rouge, skin_piece_atlantis, skin_grass, skin_grass_gold, skin_grass_jade, skin_grass_firesteel, skin_board, skin_board_gold, skin_board_atlantis, skin_theme, skin_theme_black, skin_theme_liuqing)) return api_http_error("user_info", response);
    jsoncons::json skins = jsoncons::json::array();
    if (skin_piece) skins.push_back(std::string("piece"));
    if (skin_piece_rouge) skins.push_back(std::string("piece_rouge"));
    if (skin_piece_atlantis) skins.push_back(std::string("piece_atlantis"));
    if (skin_grass) skins.push_back(std::string("grass"));
    if (skin_grass_gold) skins.push_back(std::string("grass_gold"));
    if (skin_grass_jade) skins.push_back(std::string("grass_jade"));
    if (skin_grass_firesteel) skins.push_back(std::string("grass_firesteel"));
    if (skin_board) skins.push_back(std::string("board"));
    if (skin_board_gold) skins.push_back(std::string("board_gold"));
    if (skin_board_atlantis) skins.push_back(std::string("board_atlantis"));
    if (skin_theme) skins.push_back(std::string("theme"));
    if (skin_theme_black) skins.push_back(std::string("theme_black"));
    if (skin_theme_liuqing) skins.push_back(std::string("theme_liuqing"));
    info["skins"] = skins;
    api_end("user_info", true, info, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 销毁萌新证（新手引导弹出后调用，重复销毁也返回成功）
void user_newbie_clear(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::clear_newbie(uuid))
        return api_http_error("user_newbie_clear", response); // cp

    std::string buffer;
    api_end("user_newbie_clear", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户刷新凭证
void user_rtoken(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string token_;
    if (!Manager::Token::token2token(token, token_)) return api_http_error("user_rtoken", response); // cp

    std::string buffer;
    api_end("user_rtoken", true, jsoncons::byte_string(reinterpret_cast<unsigned char*>(token.data()), token.size()), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 解锁用户权限
void user_unlock_level(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto secret = rjson["secret"].as<std::string>();

    std::string uuid;
    int level = 1;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)
        || !Manager::User::unlock_level(uuid, secret, level))
        return api_http_error("user_unlock_level", response);

    std::string buffer;
    jsoncons::json result = jsoncons::json::object();
    result["level"] = level;
    api_end("user_unlock_level", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 商店购买：2 级 / 3 级权限码，以及棋子 / 草 / 棋盘皮肤（皮肤仅本人本机生效）
void user_shop_buy(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("shop_buy", response);
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto item = rjson["item"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)) return api_http_error("shop_buy", response);

    int target_level = 0;
    int64_t price    = 0;
    // 皮肤定价：棋子（黑白合并）999 棋币，高级定制棋子 1830 棋币，亚特兰蒂斯棋子 1499 棋币，草 599 棋币，金菱草 325 棋币，白玉玲珑 899 棋币，火与钢 1299 棋币，棋盘 999 棋币，玄金棋盘 799 棋币，亚特兰蒂斯棋盘 1999 棋币，风格 UI 3999 棋币，黑派 UI 4999 棋币，留青 UI 1399 棋币。
    int64_t skin_price = 0;
    // 消耗品定价：单局投稿券 49 棋币；好友赠礼 500 棋币（每日限购 1 个）；3000 棋币好友赠礼 3000 棋币（每周限购 1 个，仅 Lv.3+）。
    int64_t ticket_price     = 0;
    int64_t gift_price       = 0;
    int64_t gift_3000_price  = 0;
    if (item == "level2") {
        target_level = 2;
        price        = 499;
    } else if (item == "level3") {
        target_level = 3;
        price        = 3999;
    } else if (item == "piece") {
        skin_price = 999;
    } else if (item == "piece_rouge") {
        skin_price = 1830;
    } else if (item == "piece_atlantis") {
        skin_price = 1499;
    } else if (item == "grass") {
        skin_price = 599;
    } else if (item == "grass_gold") {
        skin_price = 325;
    } else if (item == "grass_jade") {
        skin_price = 899;
    } else if (item == "grass_firesteel") {
        skin_price = 1299;
    } else if (item == "board") {
        skin_price = 999;
    } else if (item == "board_gold") {
        skin_price = 799;
    } else if (item == "board_atlantis") {
        skin_price = 1999;
    } else if (item == "theme") {
        skin_price = 3999;
    } else if (item == "theme_black") {
        skin_price = 4999;
    } else if (item == "theme_liuqing") {
        skin_price = 1399;
    } else if (item == "ticket") {
        ticket_price = 49;
    } else if (item == "gift500") {
        gift_price = 500;
    } else if (item == "gift3000") {
        gift_3000_price = 3000;
    } else {
        return api_http_error("shop_buy", response);
    }

    // 3000 好友赠礼仅对权限等级 3 及以上开放，避免低等级账号绕过前端直接购买。
    if (gift_3000_price > 0) {
        int current_level = 1;
        if (!Manager::User::get_level(uuid, current_level)) return api_http_error("shop_buy", response);
        if (current_level < 3) return api_http_error("shop_buy", response);
    }

    int level          = 1;
    int64_t coin       = 0;
    int64_t tickets    = 0;
    int64_t gifts      = 0;
    int64_t gift_day   = 0;
    int64_t gifts_3000 = 0;
    int64_t gift_week  = 0;
    bool skin_owned    = false;
    int purchase       = -1;
    if (ticket_price > 0) {
        purchase = Manager::User::purchase_ticket(uuid, ticket_price, tickets, coin);
    } else if (gift_price > 0) {
        const int64_t today = Manager::User::day_index(Libs::Only::Time::timestamp_ms());
        purchase = Manager::User::purchase_gift_voucher(uuid, gift_price, today, gifts, coin);
    } else if (gift_3000_price > 0) {
        const int64_t this_week = Manager::User::week_index(Libs::Only::Time::timestamp_ms());
        purchase = Manager::User::purchase_gift_voucher_3000(uuid, gift_3000_price, this_week, gifts_3000, coin);
    } else if (skin_price > 0) {
        purchase = Manager::User::purchase_skin(uuid, item, skin_price, skin_owned, coin);
    } else {
        purchase = Manager::User::purchase_level(uuid, target_level, price, level, coin);
    }
    if (purchase < 0) return api_http_error("shop_buy", response);
    if (!Manager::User::get_level(uuid, level)) return api_http_error("shop_buy", response);

    int64_t exp = 0;
    Manager::User::get_wallet(uuid, coin, exp);
    if (ticket_price > 0 && !Manager::User::get_tickets(uuid, tickets)) return api_http_error("shop_buy", response);

    jsoncons::json result = jsoncons::json::object();
    result["ok"]        = purchase == 0;
    result["reason"]    = purchase == 1 ? "owned" : purchase == 2 ? "coin" : purchase == 3 ? (gift_3000_price > 0 ? "weekly" : "daily") : "";
    result["level"]     = level;
    result["coin"]      = coin;
    result["tickets"]   = tickets;
    result["exp_level"] = Manager::User::exp_level(exp);
    result["exp_cur"]   = Manager::User::exp_within(exp);
    result["exp_need"]  = Manager::User::exp_need(Manager::User::exp_level(exp));

    // 好友赠礼：回传最新个数与今日是否已购，前端据此刷新商店卡片状态。
    if (gift_price > 0) {
        if (!Manager::User::get_gift_vouchers(uuid, gifts, gift_day)) return api_http_error("shop_buy", response);
        result["gift_vouchers"] = gifts;
        result["gift_today"]    = gift_day == Manager::User::day_index(Libs::Only::Time::timestamp_ms());
    }
    // 3000 好友赠礼：回传最新个数与本周是否已购，前端据此刷新商店卡片状态。
    if (gift_3000_price > 0) {
        if (!Manager::User::get_gift_vouchers_3000(uuid, gifts_3000, gift_week)) return api_http_error("shop_buy", response);
        result["gift3000_vouchers"] = gifts_3000;
        result["gift3000_week"]     = gift_week == Manager::User::week_index(Libs::Only::Time::timestamp_ms());
    }

    // 回传最新皮肤清单，前端据此刷新本机皮肤缓存（仅自己可见）。
    bool skin_piece = false, skin_piece_rouge = false, skin_piece_atlantis = false, skin_grass = false, skin_grass_gold = false, skin_grass_jade = false, skin_grass_firesteel = false, skin_board = false, skin_board_gold = false, skin_board_atlantis = false, skin_theme = false, skin_theme_black = false, skin_theme_liuqing = false;
    if (!Manager::User::get_skins(uuid, skin_piece, skin_piece_rouge, skin_piece_atlantis, skin_grass, skin_grass_gold, skin_grass_jade, skin_grass_firesteel, skin_board, skin_board_gold, skin_board_atlantis, skin_theme, skin_theme_black, skin_theme_liuqing)) return api_http_error("shop_buy", response);
    jsoncons::json skins = jsoncons::json::array();
    if (skin_piece) skins.push_back(std::string("piece"));
    if (skin_piece_rouge) skins.push_back(std::string("piece_rouge"));
    if (skin_piece_atlantis) skins.push_back(std::string("piece_atlantis"));
    if (skin_grass) skins.push_back(std::string("grass"));
    if (skin_grass_gold) skins.push_back(std::string("grass_gold"));
    if (skin_grass_jade) skins.push_back(std::string("grass_jade"));
    if (skin_grass_firesteel) skins.push_back(std::string("grass_firesteel"));
    if (skin_board) skins.push_back(std::string("board"));
    if (skin_board_gold) skins.push_back(std::string("board_gold"));
    if (skin_board_atlantis) skins.push_back(std::string("board_atlantis"));
    if (skin_theme) skins.push_back(std::string("theme"));
    if (skin_theme_black) skins.push_back(std::string("theme_black"));
    if (skin_theme_liuqing) skins.push_back(std::string("theme_liuqing"));
    result["skins"] = skins;

    std::string buffer;
    api_end("shop_buy", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 使用一张 3000 棋币兑换券：扣减 1 张并按面值增加棋币
void user_voucher_use(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("user_voucher_use", response);
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid))
        return api_http_error("user_voucher_use", response);

    int64_t coin     = 0;
    int64_t vouchers = 0;
    const int use    = Manager::User::use_voucher(uuid, Manager::User::COIN_VOUCHER_VALUE, coin, vouchers);
    if (use < 0) return api_http_error("user_voucher_use", response);

    std::string buffer;
    jsoncons::json result = jsoncons::json::object();
    result["ok"]       = use == 0;
    result["reason"]   = use == 2 ? "none" : "";
    result["coin"]     = coin;
    result["vouchers"] = vouchers;
    api_end("user_voucher_use", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 使用一张 500 棋币兑换券：扣减 1 张并按面值增加棋币
void user_voucher_500_use(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("user_voucher_500_use", response);
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid))
        return api_http_error("user_voucher_500_use", response);

    int64_t coin     = 0;
    int64_t vouchers = 0;
    const int use    = Manager::User::use_voucher_puzzle(uuid, Manager::User::COIN_VOUCHER_PUZZLE_VALUE, coin, vouchers);
    if (use < 0) return api_http_error("user_voucher_500_use", response);

    std::string buffer;
    jsoncons::json result = jsoncons::json::object();
    result["ok"]           = use == 0;
    result["reason"]       = use == 2 ? "none" : "";
    result["coin"]         = coin;
    result["vouchers_500"] = vouchers;
    api_end("user_voucher_500_use", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 赠送好友赠礼：扣减自己 1 个，给对方背包增加对应面额的棋币兑换券，并在会话中留一条赠礼消息
void user_voucher_gift_send(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("user_voucher_gift_send", response);
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    const auto target = rjson.contains("uuid") ? rjson["uuid"].as<std::string>() : std::string();
    // kind：gift500（默认）或 gift3000，决定扣减哪种赠礼并发放对应面额兑换券。
    const auto kind = rjson.contains("kind") ? rjson["kind"].as<std::string>() : std::string("gift500");
    if (kind != "gift500" && kind != "gift3000") return api_http_error("user_voucher_gift_send", response);

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid))
        return api_http_error("user_voucher_gift_send", response);
    if (target.empty() || target == uuid || !Manager::User::exist_user(target))
        return api_http_error("user_voucher_gift_send", response);

    // 仅好友之间可赠送
    bool is_friend = false;
    Manager::Friend::are_friends(uuid, target, is_friend);
    if (!is_friend) return api_http_error("user_voucher_gift_send", response);

    const bool gift_3000 = kind == "gift3000";
    const int sent = gift_3000 ? Manager::User::send_gift_voucher_3000(uuid, target) : Manager::User::send_gift_voucher(uuid, target);
    if (sent < 0) return api_http_error("user_voucher_gift_send", response);

    int64_t vouchers = 0;
    int64_t day      = 0;
    if (gift_3000) {
        if (!Manager::User::get_gift_vouchers_3000(uuid, vouchers, day))
            return api_http_error("user_voucher_gift_send", response);
    } else {
        if (!Manager::User::get_gift_vouchers(uuid, vouchers, day))
            return api_http_error("user_voucher_gift_send", response);
    }

    // 赠送成功后在会话里留下提示，接收方打开聊天即可看到；消息写入失败不影响赠礼结果。
    if (sent == 0) {
        Manager::Friend::send_message(
            uuid,
            target,
            gift_3000 ? "【好友赠礼】赠送给你 1 张 3000 棋币兑换券，已存入你的背包。"
                      : "【好友赠礼】赠送给你 1 张 500 棋币兑换券，已存入你的背包。",
            Libs::Only::Time::timestamp_ms()
        );
    }

    std::string buffer;
    jsoncons::json result = jsoncons::json::object();
    result["ok"]            = sent == 0;
    result["reason"]        = sent == 2 ? "none" : "";
    result["kind"]          = kind;
    result[gift_3000 ? "gift3000_vouchers" : "gift_vouchers"] = vouchers;
    api_end("user_voucher_gift_send", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 用户更新信息
void user_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto name   = rjson["name"].as<std::string>();
    auto avatar = rjson["avatar"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !is_name(name))
        return api_http_error("user_update", response); // cp

    // 头像为空表示保持原头像（旧版前端不携带头像，避免误清空）；
    // 非空时只接受前端裁剪压缩后的 data:image/... 数据。
    if (avatar.empty()) {
        std::string old_name, mail;
        int64_t time = 0;
        if (!Manager::User::info_user(uuid, old_name, avatar, mail, time)) return api_http_error("user_update", response); // cp
    } else if (!is_avatar(avatar)) {
        return api_http_error("user_update", response); // cp
    }

    Manager::User::update_user(uuid, name, avatar);

    std::string buffer;
    api_end("user_update", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 设置昵称颜色（2 级可用纯色，3 级额外可用彩色渐变，4 级额外可用流动彩虹；空串表示清除）
void user_set_color(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    int level = 0;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !Manager::User::get_level(uuid, level)
        || level < 2)
        return api_http_error("user_set_color", response); // cp

    const auto color = rjson.contains("color") && rjson["color"].is_string() ? rjson["color"].as<std::string>() : std::string();
    if (color.size() > 128) return api_http_error("user_set_color", response); // cp

    // 空串=清除；纯色 2 级可用；彩色渐变 3 级可用；流动彩虹仅 4 级可用，且均需严格匹配语法。
    const bool valid = color.empty()
        || is_solid_color(color)
        || (level >= 3 && is_gradient_color(color))
        || (level >= 4 && is_rainbow_color(color));
    if (!valid) return api_http_error("user_set_color", response); // cp

    if (!Manager::User::set_name_color(uuid, color)) return api_http_error("user_set_color", response); // cp

    std::string buffer;
    api_end("user_set_color", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 批量查询昵称颜色（公开接口，无需登录；仅返回 2 级及以上用户的颜色）
void user_colors(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    if (!rjson.contains("uuids") || !rjson["uuids"].is_array()) return api_http_error("user_colors", response); // cp

    const auto& uuids = rjson["uuids"];
    jsoncons::json result = jsoncons::json::array();
    size_t index = 0;
    for (const auto& item : uuids.array_range()) {
        // 最多处理 32 个标识，避免超大请求拖慢响应。
        if (index++ >= 32) break;
        if (!item.is_string()) continue;

        const auto uuid = item.as<std::string>();
        if (uuid.empty() || !Manager::User::exist_user(uuid)) continue;

        int level = 0;
        if (!Manager::User::get_level(uuid, level)) continue;

        std::string color;
        if (level >= 2) Manager::User::get_name_color(uuid, color);

        jsoncons::json entry = jsoncons::json::object();
        entry["uuid"]  = uuid;
        entry["color"] = color;
        entry["level"] = level;
        result.push_back(std::move(entry));
    }

    std::string buffer;
    api_end("user_colors", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 玩家公开资料（好友列表 / 排行榜头像与昵称点击后展示）
// 无需登录即可查看基础资料；携带 token 时附带与查看者的好友关系，用于「添加好友」按钮。
void user_profile(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    if (!rjson.contains("uuid") || !rjson["uuid"].is_string()) return api_http_error("user_profile", response);
    const auto uuid = rjson["uuid"].as<std::string>();
    if (uuid.empty() || !Manager::User::exist_user(uuid)) return api_http_error("user_profile", response); // cp

    std::string name, avatar, mail;
    int64_t time = 0;
    if (!Manager::User::info_user(uuid, name, avatar, mail, time)) return api_http_error("user_profile", response); // cp

    int level = 1;
    Manager::User::get_level(uuid, level);

    std::string name_color, friend_id;
    Manager::User::get_name_color(uuid, name_color);
    Manager::User::friend_id_user(uuid, friend_id);

    // 最近活跃：在线窗口与好友心跳保持一致（60s）
    int64_t last_seen = 0;
    const bool has_seen = Manager::Friend::last_seen(uuid, last_seen);
    const auto now = Libs::Only::Time::timestamp_ms();
    const bool online = has_seen && last_seen > 0 && now - last_seen <= 60 * 1000;

    // 账号对局：回放本体只保留最近 100 局，但累计场次由 player_stats 持续统计，不受 100 局限制。
    int64_t retained_games = 0, retained_wins = 0;
    Manager::Replay::stats_player(uuid, static_cast<int64_t>(Manager::Replay::MAX_PLAYER_REPLAYS), retained_games, retained_wins);

    int64_t total_games = 0, total_wins = 0, total_ai = 0;
    const bool has_total = Manager::Replay::stats_total(uuid, total_games, total_wins, total_ai);
    (void)total_wins; // 总胜场暂不展示，胜率仍按最近 100 场计算
    const int64_t real_games = has_total && total_games > retained_games ? total_games : retained_games;
    const int64_t real_wins  = retained_wins;

    int64_t ai_games = 0;
    std::string showcase;
    Manager::User::get_profile_stats(uuid, ai_games, showcase);
    // AI 场次同时参考服务端累计值与客户端上报值，取较大者，上限远高于 10000。
    if (total_ai > ai_games) ai_games = total_ai;
    if (ai_games > Manager::Replay::MAX_STAT_GAMES) ai_games = Manager::Replay::MAX_STAT_GAMES;

    // 好友关系：未登录或 token 失效时按陌生人处理
    std::string relation = "none";
    if (rjson.contains("token") && rjson["token"].is_byte_string()) {
        auto bin = rjson["token"].as<jsoncons::byte_string_view>();
        std::string token(bin.begin(), bin.end());

        std::string viewer;
        if (Manager::Token::token2uuid(token, viewer) && !viewer.empty() && Manager::User::exist_user(viewer)) {
            if (viewer == uuid) {
                relation = "self";
            } else {
                bool is_friend = false;
                Manager::Friend::are_friends(viewer, uuid, is_friend);
                if (is_friend) {
                    relation = "friend";
                } else {
                    bool outgoing = false, incoming = false;
                    Manager::Friend::request_exists(viewer, uuid, outgoing);
                    Manager::Friend::request_exists(uuid, viewer, incoming);
                    if (outgoing) relation = "outgoing";
                    else if (incoming) relation = "incoming";
                }
            }
        }
    }

    jsoncons::json result = jsoncons::json::object();
    result["uuid"]         = uuid;
    result["name"]         = name;
    result["avatar"]       = avatar;
    result["level"]        = level;
    // 公开资料只展示经验等级：棋币余额与经验进度仅本人可在「账号信息」中查看。
    int64_t coin = 0, exp = 0;
    Manager::User::get_wallet(uuid, coin, exp);
    result["exp_level"] = Manager::User::exp_level(exp);
    result["name_color"]   = name_color;
    result["friend_id"]    = friend_id;
    result["online"]       = online;
    result["last_seen"]    = last_seen;
    result["real_games"]   = real_games;
    result["real_wins"]    = real_wins;
    // 胜率基数单独返回：累计场次可能超过 100，但胜率仍只统计最近 100 场。
    result["recent_games"] = retained_games;
    result["recent_wins"]  = retained_wins;
    result["ai_games"]     = ai_games;
    // 破解残局数：只统计首次通关的不同残局（关卡号 / 每日残局版本），重复挑战不重复计数。
    int64_t puzzle_clears = 0;
    Manager::Puzzle::count_clears(uuid, puzzle_clears);
    result["puzzle_clears"] = puzzle_clears;
    result["achievements"] = split_showcase(showcase);
    result["relation"]     = relation;

    // 对方的好友申请设置：前端据此禁用「添加好友」按钮（deny 时不接受申请）
    std::string request_mode;
    Manager::Friend::request_mode(uuid, request_mode);
    result["request_mode"] = request_mode;

    std::string buffer;
    api_end("user_profile", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 同步玩家展示数据：AI 对局场次（仅增大）与展示的成就（最多 3 个）
void user_stats_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid)) return api_http_error("user_stats_update", response); // cp

    if (rjson.contains("ai_games") && rjson["ai_games"].is_number()) {
        int64_t ai_games = rjson["ai_games"].as<int64_t>();
        if (ai_games < 0) ai_games = 0;
        if (ai_games > 1000000000) ai_games = 1000000000;
        Manager::User::set_ai_games(uuid, ai_games);
    }

    if (rjson.contains("showcase") && rjson["showcase"].is_array()) {
        std::string joined;
        size_t count = 0;
        for (const auto& item : rjson["showcase"].array_range()) {
            if (count >= 3) break;
            if (!item.is_string()) continue;
            const auto id = item.as<std::string>();
            if (!is_achievement_id(id)) continue;
            if (joined.find(id) != std::string::npos) continue;
            if (!joined.empty()) joined.push_back(',');
            joined += id;
            count += 1;
        }
        Manager::User::set_showcase(uuid, joined);
    }

    // 回读保存结果，前端据此刷新展示柜
    int64_t ai_games = 0;
    std::string showcase;
    Manager::User::get_profile_stats(uuid, ai_games, showcase);

    jsoncons::json result = jsoncons::json::object();
    result["ai_games"]     = ai_games;
    result["showcase"]     = split_showcase(showcase);

    std::string buffer;
    api_end("user_stats_update", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 设置/修改登录密码（需验证码校验，验证码发往已绑定的邮箱或手机号；设置后即可账密登录）
void user_set_pass(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto code = rjson["code"].as<std::string>();
    auto pass = rjson["pass"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !is_pass(pass))
        return api_http_error("user_set_pass", response); // cp

    std::string name, avatar, mail, account, phone;
    int64_t time = 0;
    if (!Manager::User::info_user(uuid, name, avatar, mail, time) || !Manager::User::account_user(uuid, account, phone))
        return api_http_error("user_set_pass", response); // cp

    // 验证码只能发往已绑定的邮箱或手机号，优先使用邮箱；账号名不支持接收验证码
    const std::string ident = !mail.empty() ? mail : phone;
    if (ident.empty() || !Manager::Sms::verify_sms(ident, code)) return api_http_error("user_set_pass", response); // cp

    if (!Manager::User::update_pass(uuid, pass)) return api_http_error("user_set_pass", response); // cp

    std::string buffer;
    api_end("user_set_pass", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};

// 设置登录账号（仅当前账号为空时可设置，设置后固定；需验证码校验，验证码发往已绑定的邮箱或手机号）
void user_set_account(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return;
    auto rjson = body.value();

    auto bin = rjson["token"].as<jsoncons::byte_string_view>();
    std::string token(bin.begin(), bin.end());
    auto code    = rjson["code"].as<std::string>();
    auto account = rjson["account"].as<std::string>();

    std::string uuid;
    if (!Manager::Token::token2uuid(token, uuid) || !Manager::User::exist_user(uuid) || !is_account(account))
        return api_http_error("user_set_account", response); // cp

    // 账号一旦设置便不可再改；账号需全局唯一
    std::string current, phone;
    if (!Manager::User::account_user(uuid, current, phone) || !current.empty() || Manager::User::exist_account(account))
        return api_http_error("user_set_account", response); // cp

    std::string name, avatar, mail;
    int64_t time = 0;
    if (!Manager::User::info_user(uuid, name, avatar, mail, time)) return api_http_error("user_set_account", response); // cp

    // 验证码只能发往已绑定的邮箱或手机号，优先使用邮箱
    const std::string ident = !mail.empty() ? mail : phone;
    if (ident.empty() || !Manager::Sms::verify_sms(ident, code)) return api_http_error("user_set_account", response); // cp

    // 依赖 SQL 的 account = '' 条件原子兜底，避免并发下重复设置
    if (!Manager::User::update_account(uuid, account)) return api_http_error("user_set_account", response); // cp

    std::string buffer;
    api_end("user_set_account", true, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


// 生成一次性权限秘钥
void generate_level_key(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    // URL 参数鉴权：password 不应通过公共代理或第三方链接传递，否则可能进入访问日志。
    static constexpr std::string_view ADMIN_PASSWORD = "REMOVED";
    if (request.get_query_value("password") != ADMIN_PASSWORD) {
        response.set_status_and_content(cinatra::status_type::unauthorized, "unauthorized");
        return;
    }

    int level = 0;
    try {
        const auto level_value = request.get_query_value("level");
        if (level_value.empty()) throw std::invalid_argument("missing level");
        size_t parsed = 0;
        level = std::stoi(std::string(level_value), &parsed);
        if (parsed != level_value.size()) throw std::invalid_argument("invalid level");
    } catch (...) {
        response.set_status_and_content(cinatra::status_type::bad_request, "level must be 2, 3 or 4");
        return;
    }
    if (level < 2 || level > 4) {
        response.set_status_and_content(cinatra::status_type::bad_request, "level must be 2, 3 or 4");
        return;
    }

    std::string secret;
    if (!Manager::User::generate_level_key(level, secret)) {
        response.set_status_and_content(cinatra::status_type::internal_server_error, "failed to generate level key");
        return;
    }

    // 管理接口返回明文 JSON，不走 MsgPack + DES 业务协议。
    jsoncons::json result = jsoncons::json::object();
    result["level"] = level;
    result["key"] = secret;
    result["used"] = false;
    std::string buffer;
    result.dump(buffer);
    response.add_header("Content-Type", "application/json; charset=utf-8");
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 装载所有路由
void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/user/register", user_register);
    server.set_http_handler<cinatra::POST>("/user/login", user_login);

    server.set_http_handler<cinatra::POST>("/user/sms", user_sms);
    server.set_http_handler<cinatra::POST>("/user/exist", user_exist);

    server.set_http_handler<cinatra::POST>("/user/delete", user_delete);
    server.set_http_handler<cinatra::POST>("/user/rtoken", user_rtoken);
    server.set_http_handler<cinatra::POST>("/user/info", user_info);
    server.set_http_handler<cinatra::POST>("/user/newbie_clear", user_newbie_clear);
    server.set_http_handler<cinatra::POST>("/user/update", user_update);
    server.set_http_handler<cinatra::POST>("/user/set_color", user_set_color);
    server.set_http_handler<cinatra::POST>("/user/colors", user_colors);
    server.set_http_handler<cinatra::POST>("/user/profile", user_profile);
    server.set_http_handler<cinatra::POST>("/user/stats", user_stats_update);
    server.set_http_handler<cinatra::POST>("/user/set_pass", user_set_pass);
    server.set_http_handler<cinatra::POST>("/user/set_account", user_set_account);
    server.set_http_handler<cinatra::POST>("/user/unlock_level", user_unlock_level);
    server.set_http_handler<cinatra::POST>("/user/shop_buy", user_shop_buy);
    server.set_http_handler<cinatra::POST>("/user/voucher_use", user_voucher_use);
    server.set_http_handler<cinatra::POST>("/user/voucher_500_use", user_voucher_500_use);
    server.set_http_handler<cinatra::POST>("/user/voucher_gift_send", user_voucher_gift_send);
    server.set_http_handler<cinatra::GET>("/admin/generate_level_key", generate_level_key);
};
} // namespace User
} // namespace Http
} // namespace Api