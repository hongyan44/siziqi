/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: Sms
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Sms.h"

#include "../Config.h"

#include "../libs/db/Sqlite3.h"

// #include "../libs/coder/Base64.h"
#include "../libs/digest/Hmac.h"

#include "../libs/only/Random.h"
#include "../libs/only/Time.h"

#include "../libs/security/Bytes.h"

#include <cinatra/smtp_client.hpp>
#include <sqlite/sqlite3.h>

#include <string>


namespace Manager {
namespace Sms {
sqlite3* db = nullptr;

sqlite3_stmt* p_upsert_sms = nullptr;
sqlite3_stmt* p_delete_sms = nullptr;
sqlite3_stmt* p_info_sms   = nullptr;


// 初始化
void init() noexcept {
    // 打开数据库
    Libs::DB::Sqlite3::open("db/sms.db", db);

    // 没有表则创建
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS smss (mail TEXT UNIQUE NOT NULL, code BLOB NOT NULL, time INTEGER NOT NULL) STRICT",
        nullptr,
        nullptr,
        nullptr
    );

    // 预编译
    sqlite3_prepare_v2(
        db,
        "INSERT INTO smss (mail, code, time) VALUES (?, ?, ?) "
        "ON CONFLICT(mail) DO UPDATE SET code=excluded.code, time=excluded.time;",
        -1,
        &p_upsert_sms,
        nullptr
    );

    sqlite3_prepare_v2(db, "DELETE FROM smss WHERE mail = ?;", -1, &p_delete_sms, nullptr);
    sqlite3_prepare_v2(db, "SELECT code, time FROM smss WHERE mail = ?;", -1, &p_info_sms, nullptr);
};

// 关闭
void close() noexcept {
    sqlite3_finalize(p_upsert_sms);
    sqlite3_finalize(p_delete_sms);
    sqlite3_finalize(p_info_sms);

    sqlite3_close(db);
    db = nullptr;
};


// 创建验证码
bool create_sms(std::string_view mail, int64_t time, std::string& code, std::string_view fixed_code) noexcept {
    auto now = Libs::Only::Time::timestamp_ms();

    sqlite3_bind_text(p_info_sms, 1, mail.data(), mail.size(), nullptr);

    int rc = sqlite3_step(p_info_sms);
    if (rc == SQLITE_ROW && now - sqlite3_column_int64(p_info_sms, 1) < 40 * 1000) {
        sqlite3_reset(p_info_sms);
        return false;
    }

    // code = std::to_string(Libs::Only::Random::uint32(10000, 99999));
    // code = std::to_string(Libs::Only::Random::uint32(1000, 9999));

    if (!fixed_code.empty()) {
        code.assign(fixed_code);
    } else {
        code.clear();
        for (int i = 0; i < 5; ++i) {
            int digit  = Libs::Only::Random::mod(10);
            code      += std::to_string(digit);
        }
    }

    std::string digest;
    Libs::Digest::Hmac::md5(code, SMS_SALT, digest);

    sqlite3_bind_text(p_upsert_sms, 1, mail.data(), mail.size(), nullptr);
    sqlite3_bind_blob(p_upsert_sms, 2, digest.data(), digest.size(), nullptr);
    sqlite3_bind_int64(p_upsert_sms, 3, time);

    rc = sqlite3_step(p_upsert_sms);
    sqlite3_reset(p_info_sms);
    sqlite3_reset(p_upsert_sms);
    if (rc != SQLITE_DONE) return false;

    return true;
};

// 验证验证码
bool verify_sms(std::string_view mail, std::string_view code) noexcept {
    auto now = Libs::Only::Time::timestamp_ms();

    sqlite3_bind_text(p_info_sms, 1, mail.data(), mail.size(), nullptr);

    int rc = sqlite3_step(p_info_sms);
    if (rc != SQLITE_ROW || now - sqlite3_column_int64(p_info_sms, 1) > 3 * 60 * 1000) {
        sqlite3_reset(p_info_sms);
        return false;
    }

    auto output = static_cast<const char*>(sqlite3_column_blob(p_info_sms, 0));

    std::string digest;
    Libs::Digest::Hmac::md5(code, SMS_SALT, digest);

    // std::string debug;
    // Libs::Coder::Base64::encode(output, debug);
    // printf("%s\n", debug.data());

    // Libs::Coder::Base64::encode(digest, debug);
    // printf("%s\n", debug.data());

    if (Libs::Security::Bytes::safe_equal(digest, std::string_view(output, digest.size()))) {
        sqlite3_bind_text(p_delete_sms, 1, mail.data(), mail.size(), nullptr);
        sqlite3_step(p_delete_sms);
        sqlite3_reset(p_delete_sms);
        sqlite3_reset(p_info_sms);
        return true;
    }

    sqlite3_reset(p_info_sms);
    return false;
};


// 发送验证码
async_simple::coro::Lazy<bool> send_sms(std::string_view mail, std::string_view code, coro_io::ExecutorWrapper<>* executor) noexcept {
    cinatra::smtp::client client(executor);

    bool connected = co_await client.connect("smtp.siziqi.net", "465");
    if (!connected) co_return false;

    // 数据构造
    cinatra::smtp::email_data data;
    data.from_email = "martcat2js@siziqi.net"; // 你的发件箱
    data.from_name  = "Siziqi";
    data.to_email   = {mail.data()}; // 收件人列表

    std::string template_html = R"(
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                max-width: 440px;
                margin: 0 auto;
                padding: 32px 28px;
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
                border: 1px solid #f0f0f0;">
        
        <!-- 顶部品牌标识 -->
        <div style="text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #f5f5f5;
                    margin-bottom: 24px;">
            <span style="font-size: 15px;
                         font-weight: 500;
                         color: #8c8c8c;
                         letter-spacing: 0.3px;">
                siziqi.net
            </span>
        </div>

        <!-- 正文 -->
        <p style="margin: 0 0 8px 0;
                  font-size: 15px;
                  color: #4a4a4a;
                  line-height: 1.6;">
            您好，您请求的验证码是：
        </p>

        <!-- 验证码数字 (醒目但不过分) -->
        <div style="margin: 20px 0 22px 0;
                    padding: 14px 0;
                    text-align: center;
                    background: #fafafa;
                    border-radius: 12px;
                    border: 1px solid #f0f0f0;">
            <span style="font-size: 36px;
                         font-weight: 500;
                         color: #2c3e50;
                         letter-spacing: 6px;
                         font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;">
                {}
            </span>
        </div>

        <!-- 有效期提示 -->
        <p style="margin: 0 0 4px 0;
                  font-size: 13px;
                  color: #a0a0a0;
                  text-align: center;
                  letter-spacing: 0.2px;">
            此验证码 <strong style="color: #6b6b6b; font-weight: 500;">3 分钟</strong>内有效
        </p>

        <!-- 底部小提示 -->
        <div style="margin-top: 24px;
                    padding-top: 18px;
                    border-top: 1px solid #f5f5f5;
                    text-align: center;
                    font-size: 12px;
                    color: #c0c0c0;
                    line-height: 1.5;">
            若非本人操作，请忽略此邮件
        </div>
    </div>)";

    data.subject   = std::format("[ Siziqi ] 您的验证码是：{}，有效期3分钟", code);
    data.text      = std::format("[ Siziqi ]\n您的验证码是：{}，有效期 3 分钟。\n请勿将验证码告知他人。", code);
    data.html_text = std::vformat(template_html, std::make_format_args(code));
    data.is_html   = true;

    data.user_name = "martcat2js@siziqi.net"; // 账号
    data.auth_pwd  = "TD%$j*y5oMKJox$C";      // 授权码或密码
    // data.auth_pwd = "YCdZn36w7d9ikNHh"; // 授权码或密码

    // 发送邮件
    co_return co_await client.send_email(data);
};
} // namespace Sms
} // namespace Manager