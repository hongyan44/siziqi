/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 程序配置
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string_view>


// 手机验证码：接入云片短信后，手机号验证码将真实下发（仅 11 位手机号）。
// 未配置 SMS_YUNPIAN_APIKEY / SMS_YUNPIAN_TPL_ID 时回退为占位：使用该固定验证码且不实际下发，仅供开发/测试。
inline constexpr std::string_view PHONE_SMS_DEV_CODE = "12345";

// 云片短信配置：在 bin/sms_yunpian_apikey.bin、bin/sms_yunpian_tpl_id.bin 中读取，缺失则回退占位。
inline std::string SMS_YUNPIAN_APIKEY;
inline std::string SMS_YUNPIAN_TPL_ID;
// 云片「指定模板单发」接口（走 https，scheme 由 coro_http_client 依据 use_ssl 补全）
inline constexpr std::string_view SMS_YUNPIAN_HOST = "sms.yunpian.com/v2/sms/tpl_single_send.json";


inline std::string TOKEN_KEY;
inline std::string TOKEN_SALT;

inline std::string BODY_KEY;
inline std::string RES_KEY;

inline std::string SMS_SALT;
inline std::string LEVEL_SALT;

static int64_t TOKEN_EXP = 15 * 24 * 60 * 60 * 1 * 1000;