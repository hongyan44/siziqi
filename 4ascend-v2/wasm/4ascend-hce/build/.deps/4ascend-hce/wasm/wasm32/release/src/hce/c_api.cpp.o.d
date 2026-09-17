{
    depfiles_format = "gcc",
    depfiles = "build\\.objs\\4ascend-hce\\wasm\\wasm32\\release\\src\\hce\\__cpp_c_api.cpp.cpp:   src\\hce\\c_api.cpp src\\hce\\c_api.h src\\hce\\board.hpp   src\\hce\\bitboard.hpp src\\hce\\types.hpp src\\hce\\evaluate.hpp   src\\hce\\search.hpp src\\hce\\tt.hpp src\\hce\\tables.hpp\
",
    files = {
        [[src\hce\c_api.cpp]]
    },
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