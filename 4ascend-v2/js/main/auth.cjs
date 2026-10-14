/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 账号 / 手机号 / 邮箱 前端校验
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const AUTH_MAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const AUTH_PHONE_RE = /^1[3-9]\d{9}$/;
const AUTH_ACCOUNT_RE = /^[A-Za-z][A-Za-z0-9_]{3,15}$/;
const AUTH_CODE_RE = /^\d{5}$/;

// 与后端 PHONE_SMS_DEV_CODE 保持一致：手机号验证码暂为占位固定码
const AUTH_PHONE_DEV_CODE = '12345';

const AUTH_MAIL_SUPPORT = new Set([
    'sina.com', 'sina.cn', 'vip.sina.com', 'sina.com.cn', // 新浪
    '163.com', '126.com', 'yeah.net', 'vip.163.com', 'vip.126.com', // 网易
    'qq.com', 'foxmail.com', 'vip.qq.com', // 腾讯
    'clearlook.com', // 微软
    'gmail.com', // Google
    'aliyun.com', 'dingtalk.com', 'alibaba.com', // 阿里
    'icloud.com', // Apple
    'yahoo.com', // 雅虎
    '139.com', // 中国移动
    '189.cn', // 中国电信
    'wo.cn', 'wo.com.cn', // 中国联通
    'sohu.com', 'vip.sohu.com', 'sohu.cn', 'sogou.com', // 搜狐与搜狗
    '21cn.com', '21cn.net', // 21CN
    'tom.com', 'vip.tom.com', // TOM邮箱
    'proton.me', 'protonmail.com', 'protonmail.ch', // Proton (全球最大加密邮箱)
    'yandex.com', 'yandex.ru', 'mail.ru', // 俄罗斯主流
    'zoho.com', 'zoho.com.cn', // Zoho (主流商务/企业)
]);

const is_mail = (value) => AUTH_MAIL_RE.test(value || '');
const is_phone = (value) => AUTH_PHONE_RE.test(value || '');
const is_account = (value) => AUTH_ACCOUNT_RE.test(value || '');
const mail_supported = (mail) => AUTH_MAIL_SUPPORT.has(String(mail || '').split('@')[1]?.toLowerCase() ?? '');

/**
 * @description: 校验登录标识（账号/手机号/邮箱）
 * @param {string} value
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_login_ident = (value) => {
    const ident = String(value || '').trim();
    if (!ident) return '请输入账号/手机号/邮箱！';
    if (is_phone(ident) || is_account(ident)) return '';
    if (is_mail(ident)) return mail_supported(ident) ? '' : '您的邮箱暂不被支持！';
    return '账号/手机号/邮箱格式不正确！';
};

/**
 * @description: 校验注册标识（邮箱或手机号）
 * @param {string} value
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_mail_phone = (value) => {
    const ident = String(value || '').trim();
    if (!ident) return '请输入邮箱或手机号！';
    if (is_phone(ident)) return '';
    if (is_mail(ident)) return mail_supported(ident) ? '' : '您的邮箱暂不被支持！';
    return '请输入正确的邮箱或手机号！';
};

/**
 * @description: 校验注册账号
 * @param {string} value
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_account = (value) => {
    const account = String(value || '').trim();
    if (!account) return '请输入注册账号！';
    if (!is_account(account)) return '账号需以字母开头，4-16 位字母/数字/下划线！';
    return '';
};

/**
 * @description: 校验密码
 * @param {string} value
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_password = (value) => {
    const pass = String(value || '');
    if (!pass) return '请输入密码！';
    if (pass.length < 6 || pass.length > 64) return '密码长度需为 6-64 位！';
    return '';
};

/**
 * @description: 校验重复密码
 * @param {string} pass
 * @param {string} repeat
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_password_repeat = (pass, repeat) => {
    if (!repeat) return '请再次输入密码！';
    if (pass !== repeat) return '两次输入的密码不一致！';
    return '';
};

/**
 * @description: 校验验证码（后端固定 5 位数字）
 * @param {string} value
 * @return {string} 空串表示通过，否则为提示文案
 */
const check_code = (value) => {
    const code = String(value || '').trim();
    if (!code) return '请输入验证码！';
    if (!AUTH_CODE_RE.test(code)) return '验证码为 5 位数字！';
    return '';
};

window.AuthExports = {
    PHONE_DEV_CODE: AUTH_PHONE_DEV_CODE,
    is_mail,
    is_phone,
    is_account,
    mail_supported,
    check_login_ident,
    check_mail_phone,
    check_account,
    check_password,
    check_password_repeat,
    check_code,
};