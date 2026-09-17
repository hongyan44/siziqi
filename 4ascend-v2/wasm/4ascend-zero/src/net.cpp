/***
 * @Author: CsVeryLoveXieWenLi
 * @Description:
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "net.h"
#include "encoding.h"


Net::Net() {
    // ========== 1. 线程配置 ==========
    // 设为 CPU 核心数，但浏览器 Worker 有限制，建议 2-4
    // net.opt.num_threads = 1; // 与 THREAD_POOL_SIZE 匹配

    // ========== 2. 精度优化（Wasm 重点）==========
    // 启用 BF16 存储：减少内存带宽，速度提升 10-30%
    net.opt.use_bf16_storage = true;

    // 禁用 FP16 packed（Wasm SIMD 对 FP16 支持有限）
    net.opt.use_fp16_packed     = false;
    net.opt.use_fp16_storage    = false;
    net.opt.use_fp16_arithmetic = false;

    // ========== 3. 卷积优化 ==========
    // Winograd 在 Wasm 上可能因 SIMD 限制导致负优化
    // 建议：3x3 卷积用 Winograd，其他不用
    net.opt.use_winograd_convolution = true; // 保留，ncnn 会自动判断

    // ========== 6. Vulkan（必须关闭）==========
    net.opt.use_vulkan_compute = false;

    // ========== 7. Wasm 特有优化 ==========
    // 强制使用 SIMD 指令集（编译时已加 -msimd128）
    // ncnn 会自动检测，无需额外设置

    // ========== 加载模型 ==========
    int ret1 = net.load_param("4ascend_zero.param");
    int ret2 = net.load_model("4ascend_zero.bin");

    // 可选：预热（首次推理会触发编译优化）
    // 创建 dummy input 进行一次推理
}
Net::~Net() = default;


void Net::encode(Game& game, int as_player, ncnn::Mat& in) noexcept {
    encode_state(game, as_player, in);
};

void Net::predict(Game& game, int as_player, std::vector<float>& logits, float& value) noexcept {
    ncnn::Mat in(9, 9, 25);
    encode(game, as_player, in);

    ncnn::Extractor ex = net.create_extractor();
    ex.input("in0", in);

    ncnn::Mat out_logits, out_value;
    ex.extract("out0", out_logits); // (81,)
    ex.extract("out1", out_value);  // (1,)

    logits.resize(81);
    memcpy(logits.data(), out_logits.channel(0), 81 * sizeof(float));
    value = out_value[0];
};