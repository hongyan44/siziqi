/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 枚举
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
/**
 * @readonly
 * @enum {symbol}
 */
const STONE_ENUM = Object.freeze({
    'NONE': Symbol('NONE'),

    'BLACK': Symbol('BLACK'),
    'WHITE': Symbol('WHITE'),

    'BLACK_ASCEND': Symbol('BLACK_ASCEND'),
    'WHITE_ASCEND': Symbol('WHITE_ASCEND'),

    'BLACK_USED': Symbol('BLACK_USED'),
    'WHITE_USED': Symbol('WHITE_USED'),
});

/**
 * @readonly
 * @enum {symbol}
 */
const PLANT_ENUM = Object.freeze({
    'NONE': Symbol('NONE'),
    'ONE': Symbol('ONE'),
    'TWO': Symbol('TWO'),
});

/**
 * @readonly
 * @enum {symbol}
 */
const PLAYER_ENUM = Object.freeze({
    'BLACK': Symbol('BLACK'),
    'WHITE': Symbol('WHITE'),
});

/**
 * @readonly
 * @enum {symbol}
 */
const ASCEND_ENUM = Object.freeze({
    'NONE': Symbol('NONE'),
    'START': Symbol('START'),
    'END': Symbol('END'),
});

/**
 * @readonly
 * @enum {symbol}
 */
const OVER_ENUM = Object.freeze({
    'NONE': Symbol('NONE'),
    'ENABLE': Symbol('ENABLE'),
    'EXECUTE': Symbol('EXECUTE'),
});


export { PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, OVER_ENUM, ASCEND_ENUM };