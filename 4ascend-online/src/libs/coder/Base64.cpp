/*** 
 * @Author: CsVeryLoveXieWenLi
 * @Description: BASE64
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Base64.h"

#include <cryptopp/base64.h>


namespace Libs {
namespace Coder {
namespace Base64 {
// Base64 编码
void encode(std::string_view input, std::string& output) noexcept {
    CryptoPP::Base64Encoder encoder(nullptr, false);
    encoder.Put(reinterpret_cast<const unsigned char*>(input.data()), input.size());
    encoder.MessageEnd();

    auto size = encoder.MaxRetrievable();
    if (size > 0) {
        output.resize(size);
        encoder.Get(reinterpret_cast<unsigned char*>(output.data()), size);
    }
}
std::string encode(std::string_view input) noexcept {
    CryptoPP::Base64Encoder encoder(nullptr, false);
    encoder.Put(reinterpret_cast<const unsigned char*>(input.data()), input.size());
    encoder.MessageEnd();

    std::string output;
    auto size = encoder.MaxRetrievable();
    if (size > 0) {
        output.resize(size);
        encoder.Get(reinterpret_cast<unsigned char*>(output.data()), size);
    }
    return output;
}

// Base64 解码
void decode(std::string_view input, std::string& output) noexcept {
    CryptoPP::Base64Decoder decoder;
    decoder.Put(reinterpret_cast<const unsigned char*>(input.data()), input.size());
    decoder.MessageEnd();

    auto size = decoder.MaxRetrievable();
    if (size > 0) {
        output.resize(size);
        decoder.Get(reinterpret_cast<unsigned char*>(output.data()), size);
    }
}
std::string decode(std::string_view input) noexcept {
    CryptoPP::Base64Decoder decoder;
    decoder.Put(reinterpret_cast<const unsigned char*>(input.data()), input.size());
    decoder.MessageEnd();

    std::string output;
    auto size = decoder.MaxRetrievable();
    if (size > 0) {
        output.resize(size);
        decoder.Get(reinterpret_cast<unsigned char*>(output.data()), size);
    }
    return output;
}
} // namespace Base64
} // namespace Coder
} // namespace Libs