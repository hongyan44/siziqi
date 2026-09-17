{
    depfiles_format = "gcc",
    files = {
        [[src\mctsf.cpp]]
    },
    depfiles = "build\\.objs\\4ascend-zero\\wasm\\wasm32\\release\\src\\__cpp_mctsf.cpp.cpp:   src\\mctsf.cpp src\\mctsf.h src\\nodef.h src\\game.h src\\board.h   src\\rand.h src\\state.h src\\net.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\net.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\blob.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\mat.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\allocator.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\platform.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\ncnn_export.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\option.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\layer.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\modelbin.h   C:\\MyData\\Libs\\StaticWasm\\ncnn-20260526\\x64\\include\\ncnn\\paramdict.h\
",
    values = {
        [[C:\MyData\App\Git\emsdk\upstream\emscripten\emcc.bat]],
        {
            "-fvisibility=hidden",
            "-fvisibility-inlines-hidden",
            "-O3",
            "-std=c++20",
            [[-IC:\MyData\Libs\StaticWasm\ncnn-20260526\x64\include]],
            "-ffast-math",
            "-fno-math-errno",
            "-funsafe-math-optimizations",
            "-msimd128",
            "-pthread",
            "--bind",
            "-DNDEBUG"
        }
    }
}