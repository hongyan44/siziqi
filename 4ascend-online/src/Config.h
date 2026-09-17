/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 程序配置
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once


inline std::string TOKEN_KEY;
inline std::string TOKEN_SALT;

inline std::string BODY_KEY;
inline std::string RES_KEY;

inline std::string SMS_SALT;
inline std::string LEVEL_SALT;

static int64_t TOKEN_EXP = 15 * 24 * 60 * 60 * 1 * 1000;