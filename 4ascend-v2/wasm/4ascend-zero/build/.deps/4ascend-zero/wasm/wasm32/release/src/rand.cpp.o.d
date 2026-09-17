{
    files = {
        [[src\rand.cpp]]
    },
    depfiles = "build\\.objs\\4ascend-zero\\wasm\\wasm32\\release\\src\\__cpp_rand.cpp.cpp:   src\\rand.cpp src\\rand.h\
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
            "-ffast-math",
            "-fno-math-errno",
            "-funsafe-math-optimizations",
            "-msimd128",
            "-pthread",
            "--bind",
            "-DNDEBUG"
        }
    },
    depfiles_format = "gcc"
}