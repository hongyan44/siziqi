--[[
Author: CsVeryLoveXieWenLi
Description: 4ascend-online
@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
--]]
-- xmake project -k compile_commands


-- 模式
add_rules('mode.release')
-- add_rules('mode.releasedbg')


-- 指令集
add_vectorexts('avx2')
-- add_vectorexts('sse4.2')


-- 头文件
add_includedirs('/root/libs/static-lto/libressl-4.3.2/x64/include')
add_includedirs('/root/libs/static-lto/sqlite-amalgamation-3530400/x64/include')
add_includedirs('/root/libs/static-lto/cryptopp-cmake-8.9.0/x64/include')

add_includedirs('/root/libs/header-only/cinatra-1.0.0')
add_includedirs('/root/libs/header-only/jsoncons-1.9.0')


-- 库文件
add_linkdirs('/root/libs/static-lto/libressl-4.3.2/x64/lib')
add_linkdirs('/root/libs/static-lto/cryptopp-cmake-8.9.0/x64/lib')
add_linkdirs('/root/libs/static-lto/sqlite-amalgamation-3530400/x64/lib')


-- 链接
add_links('tls', 'ssl', 'crypto')
add_links('cryptopp')
add_links('sqlite3')


-- 优化
set_optimize('fastest')


-- 语言版本
set_languages('clatest', 'c++20')
set_policy('build.optimization.lto', true)


-- 工具链
toolchain('musl')
    set_kind('standalone')
    set_toolset('cc', '/root/libs/toolchain/x86_64-unknown-linux-musl/bin/x86_64-unknown-linux-musl-gcc')
    set_toolset('cxx', '/root/libs/toolchain/x86_64-unknown-linux-musl/bin/x86_64-unknown-linux-musl-g++')
    set_toolset('ld', '/root/libs/toolchain/x86_64-unknown-linux-musl/bin/x86_64-unknown-linux-musl-g++')
toolchain_end()

set_toolchains('musl')


-- 任务配置
target('4ascend-online')
    set_kind('binary')
    add_files('src/**.cpp')

    add_defines('YLT_ENABLE_SSL')
    add_defines('CINATRA_ENABLE_SSL')
    add_defines('CRYPTOPP_ENABLE_NAMESPACE_WEAK=1')
    
    add_ldflags('-static', {force = true})
    add_ldflags('-static-libgcc', '-static-libstdc++', {force = true})

    add_cxflags('-flto=auto', {force = true})
    add_ldflags('-flto=auto', {force = true})

    add_ldflags('-fuse-ld=mold')

    set_pcxxheader('src/Pch.h')

    set_strip('all')
    set_symbols('hidden')

    after_build(function (target)
        os.rm(path.join(target:targetdir(), "bin"))
        os.cp("assets/resource/bin", path.join(target:targetdir()))
    end)