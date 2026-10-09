/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 程序配置
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include <string_view>


// 手机验证码占位：暂未接入短信服务商，手机号统一使用该固定验证码，且不实际下发短信。
// 前端会同步提示该固定验证码，接入真实短信通道后应移除。
inline constexpr std::string_view PHONE_SMS_DEV_CODE = "12345";


inline std::string TOKEN_KEY;
inline std::string TOKEN_SALT;

inline std::string BODY_KEY;
inline std::string RES_KEY;

inline std::string SMS_SALT;
inline std::string LEVEL_SALT;

static int64_t TOKEN_EXP = 15 * 24 * 60 * 60 * 1 * 1000;