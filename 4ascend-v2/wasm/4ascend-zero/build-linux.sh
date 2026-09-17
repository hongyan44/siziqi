#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
: "${NCNN_PREFIX:?Set NCNN_PREFIX to an ncnn Emscripten installation (SIMD, pthread)}"
ascend_emxx=${EMXX:-em++}
ascend_output=${1:-build/wasm/wasm32/release/4ascend-zero.js}
mkdir -p -- "$(dirname -- "$ascend_output")"
"$ascend_emxx" -std=c++20 -O3 -msimd128 -pthread --bind \
    src/main.cpp src/mcts.cpp src/net.cpp src/game.cpp src/board.cpp src/rand.cpp src/utils.cpp \
    -I"$NCNN_PREFIX/include" -L"$NCNN_PREFIX/lib" -lncnn \
    --embed-file model/4ascend_zero.param@/4ascend_zero.param \
    --embed-file model/4ascend_zero.bin@/4ascend_zero.bin \
    -sWASM_BIGINT=1 -sINITIAL_MEMORY=335544320 -sSINGLE_FILE=1 \
    -sMODULARIZE=1 -sEXPORT_NAME=create_4ascend_zero -sMALLOC=emmalloc \
    -o "$ascend_output"
