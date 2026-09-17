--[[
Author: CsVeryLoveXieWenLi
Description: 4ascend-zero
@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
--]]


-- xmake project -k compile_commands


-- 模式
add_rules('mode.release')
-- add_rules('mode.releasedbg')


-- 优化等级
set_optimize('fastest')


-- 语言版本
set_languages('clatest', 'c++20')


-- 编译选项
set_policy('build.optimization.lto', true)
set_policy('build.across_targets_in_parallel', true)


-- 优化
add_cxflags('-fno-exceptions')
add_cxflags('-ffast-math')
add_cxflags('-fno-math-errno')
add_cxflags('-funsafe-math-optimizations')

add_ldflags('-s WASM=1')
add_ldflags('-s WASM_BIGINT=1')

add_ldflags('-s DISABLE_EXCEPTION_CATCHING=1')

-- add_ldflags('-s PROXY_TO_PTHREAD=1')
-- add_ldflags('-s PTHREAD_POOL_SIZE_STRICT=0')
-- add_ldflags('-s THREAD_POOL_SIZE=8')
-- add_ldflags('-s EXIT_RUNTIME=1')
-- add_ldflags('-s USE_PTHREADS=1')

-- add_ldflags('-s ALLOW_BLOCKING_ON_MAIN_THREAD=1')

-- add_ldflags('-s ASSERTIONS=1')
-- add_ldflags('-s ASSERTIONS=2')

add_cxflags('-msimd128')
add_ldflags('-msimd128')

add_cxflags('-pthread')
add_ldflags('-pthread')

add_cxflags('--bind')
add_ldflags('--bind')

add_ldflags('-s MALLOC=emmalloc')

add_ldflags('-s INITIAL_MEMORY=320MB')
add_ldflags('-s INLINING_LIMIT=100')

add_ldflags('-s ERROR_ON_UNDEFINED_SYMBOLS=1')

add_ldflags('-s SHARED_MEMORY=1')

add_ldflags('-s SINGLE_FILE=1')

add_ldflags('-s MODULARIZE=1')
add_ldflags('-s EXPORT_NAME="create_4ascend_zero"')


-- 头文件路径
add_includedirs('C:/MyData/Libs/StaticWasm/ncnn-20260526/x64/include')


-- 库文件路径
add_linkdirs('C:/MyData/Libs/StaticWasm/ncnn-20260526/x64/lib')


-- 链接 ncnn
add_links('ncnn')


-- 任务配置
target('4ascend-zero')
    set_kind('binary')
    add_files('src/**.cpp')
    add_files('src/**.c')

    set_filename('4ascend-zero.js')

    set_strip('all')
    set_symbols('hidden')

    add_ldflags('--embed-file model/4ascend_zero.param@/4ascend_zero.param', {force = true})
    add_ldflags('--embed-file model/4ascend_zero.bin@/4ascend_zero.bin', {force = true})