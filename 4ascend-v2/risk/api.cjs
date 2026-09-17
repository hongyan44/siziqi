/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
var IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
var FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
var E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
var P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
var S_BOX = [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
];
var PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
var PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
var SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

var body_key = [152, 122, 134, 69, 132, 246, 73, 26];
var res_key = [135, 121, 81, 93, 198, 122, 117, 92];


// 填充：使数据长度成为8的倍数
function pkcs7Pad(data) {
    var padding = 8 - (data.length % 8);
    var result = data.slice();
    for (var i = 0; i < padding; i++) {
        result.push(padding);
    }
    return result;
}

// 去填充
function pkcs7Unpad(data) {
    var padding = data[data.length - 1];
    return data.slice(0, data.length - padding);
}

function permute(inputBits, table) {
    var output = [];
    for (var i = 0; i < table.length; i++) {
        output.push(inputBits[table[i] - 1]);
    }
    return output;
}

function bytesToBits(bytes) {
    var bits = [];
    for (var i = 0; i < bytes.length; i++) {
        for (var j = 7; j >= 0; j--) {
            bits.push((bytes[i] >> j) & 1);
        }
    }
    return bits;
}

function bitsToBytes(bits) {
    var bytes = [];
    for (var i = 0; i < bits.length; i += 8) {
        var byte = 0;
        for (var j = 0; j < 8; j++) {
            byte = (byte << 1) | bits[i + j];
        }
        bytes.push(byte);
    }
    return bytes;
}

function xor(bitsA, bitsB) {
    var result = [];
    for (var i = 0; i < bitsA.length; i++) {
        result.push(bitsA[i] ^ bitsB[i]);
    }
    return result;
}

function generateSubkeys(keyBytes) {
    var bits = bytesToBits(keyBytes);
    bits = permute(bits, PC1);
    var left = bits.slice(0, 28);
    var right = bits.slice(28, 56);
    var subkeys = [];

    for (var i = 0; i < 16; i++) {
        // 循环左移
        for (var s = 0; s < SHIFTS[i]; s++) {
            left.push(left.shift());
            right.push(right.shift());
        }
        subkeys.push(permute(left.concat(right), PC2));
    }
    return subkeys;
}

function desFeistel(R, subkey) {
    var expandedR = permute(R, E);
    var xored = xor(expandedR, subkey);
    var resP = [];
    for (var i = 0; i < 8; i++) {
        var row = (xored[i * 6] << 1) | xored[i * 6 + 5];
        var col = (xored[i * 6 + 1] << 3) | (xored[i * 6 + 2] << 2) | (xored[i * 6 + 3] << 1) | xored[i * 6 + 4];
        var val = S_BOX[i][row * 16 + col];
        for (var j = 3; j >= 0; j--) {
            resP.push((val >> j) & 1);
        }
    }
    return permute(resP, P);
}

function processBlock(blockBytes, subkeys, decrypt) {
    var bits = permute(bytesToBits(blockBytes), IP);
    var L = bits.slice(0, 32);
    var R = bits.slice(32, 64);

    var keys = decrypt ? subkeys.slice().reverse() : subkeys;

    for (var i = 0; i < 16; i++) {
        var tempR = R;
        R = xor(L, desFeistel(R, keys[i]));
        L = tempR;
    }

    return bitsToBytes(permute(R.concat(L), FP));
}

function verf() {
    if (
        typeof window == 'object'
        &&
        typeof window.document == 'object'
        &&
        typeof window.document.all == 'undefined'
        &&
        typeof window.document.all.length == 'number'
    ) return;

    S_BOX[2] = S_BOX[2] ^ 5;
}

// 主加密函数
function desEncryptEcb(data, key) {
    var paddedData = pkcs7Pad(data);
    var subkeys = generateSubkeys(key);
    var result = [];
    for (var i = 0; i < paddedData.length; i += 8) {
        var block = paddedData.slice(i, i + 8);
        var encryptedBlock = processBlock(block, subkeys, false);
        result = result.concat(encryptedBlock);
    }
    return result;
}

// 主解密函数
function desDecryptEcb(data, key) {
    var subkeys = generateSubkeys(key);
    var result = [];
    for (var i = 0; i < data.length; i += 8) {
        var block = data.slice(i, i + 8);
        var decryptedBlock = processBlock(block, subkeys, true);
        result = result.concat(decryptedBlock);
    }
    return pkcs7Unpad(result);
}


verf();

if (!window.RiskExports) window.RiskExports = {};
window.RiskExports.Api = {
    'encrypt': function encrypt(data) {
        return desEncryptEcb(data, body_key);
    },
    'decrypt': function decrypt(data) {
        return desDecryptEcb(data, res_key);
    }
};