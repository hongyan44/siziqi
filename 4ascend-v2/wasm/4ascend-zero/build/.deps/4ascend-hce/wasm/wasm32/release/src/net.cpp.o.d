{
    depfiles_format = "gcc",
    files = {
        [[src\net.cpp]]
    },
    depfiles = "build\\.objs\\4ascend-hce\\wasm\\wasm32\\release\\src\\__cpp_net.cpp.cpp:   src\\net.cpp src\\net.h src\\game.h src\\board.h src\\rand.h src\\state.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\net.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\blob.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\mat.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\allocator.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\platform.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\ncnn_export.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\option.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\layer.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\modelbin.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\paramdict.h\
",
    values = {
        [[C:\MyData\App\Git\emsdk\upstream\emscripten\emcc.bat]],
        {
            "-fvisibility=hidden",
            "-fvisibility-inlines-hidden",
            "-O3",
            "-std=c++20",
            [[-IC:\MyData\Libs\StaticWasm\ncnn-20260526\x64\include]],
            "-fno-exceptions",
            "-msimd128",
            "-pthread",
            "--bind",
            "-DNDEBUG"
        }
    }
}