/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#pragma once

#include "../Config.h"

#include "../libs/crypto/DES.h"
#include "../libs/crypto/Pad.h"
#include "../libs/crypto/UnPad.h"

// #include "../libs/coder/Base64.h"

#include <cinatra/coro_http_response.hpp>
#include <jsoncons_ext/msgpack/msgpack.hpp>

#include <optional>


inline std::vector<cinatra::coro_http_connection*> ws_clients;


inline void api_end(std::string_view op, bool status, const jsoncons::json& result, std::string& output) noexcept {
    jsoncons::json sjson;
    sjson["op"]     = op;
    sjson["status"] = status;
    sjson["result"] = result;
    jsoncons::msgpack::try_encode_msgpack(sjson, output);

    // std::cout << jsoncons::pretty_print(sjson) << std::endl;

    // std::string debug;
    // Libs::Coder::Base64::encode(RES_KEY, debug);
    // printf("%s\n", debug.data());

    Libs::Crypto::Pad::pkcs7(output, 8);
    Libs::Crypto::DES::encrypt_ecb(output, RES_KEY, output);
};

inline void api_ws_error(std::string_view op, std::string& buffer) noexcept {
    // cp
    api_end(op, false, jsoncons::json::null(), buffer);
};

inline void api_http_error(std::string_view op, cinatra::coro_http_response& response) noexcept {
    std::string buffer;
    api_end(op, false, jsoncons::json::null(), buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
};


inline std::optional<jsoncons::basic_json<char>> api_body(std::string_view input) noexcept {
    std::string output;
    output.resize(input.size());

    // std::string debug;
    // Libs::Coder::Base64::encode(BODY_KEY, debug);
    // printf("%s\n", debug.data());

    // Libs::Coder::Base64::encode(input, debug);
    // printf("%s\n", debug.data());

    Libs::Crypto::DES::decrypt_ecb(input, BODY_KEY, output);
    Libs::Crypto::UnPad::pkcs7(output);

    auto result = jsoncons::msgpack::try_decode_msgpack<jsoncons::json>(output);
    if (!result || !result->is_object()) return std::nullopt;
    return result.value();
};