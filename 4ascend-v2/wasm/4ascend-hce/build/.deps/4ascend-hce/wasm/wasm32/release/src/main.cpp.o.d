{
    files = {
        [[src\main.cpp]]
    },
    depfiles_format = "gcc",
    depfiles = "build\\.objs\\4ascend-hce\\wasm\\wasm32\\release\\src\\__cpp_main.cpp.cpp:   src\\main.cpp src\\hce\\board.hpp src\\hce\\bitboard.hpp src\\hce\\types.hpp   src\\hce\\search.hpp src\\hce\\tt.hpp src\\hce\\evaluate.hpp   src\\hce\\tables.hpp\
",
    values = {
        [[C:\MyData\App\Git\emsdk\upstream\emscripten\emcc.bat]],
        {
            "-fvisibility=hidden",
            "-fvisibility-inlines-hidden",
            "-O3",
            "-std=c++20",
            "-fno-exceptions",
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