{
    depfiles_format = "gcc",
    depfiles = "build\\.objs\\4ascend-hce\\wasm\\wasm32\\release\\src\\hce\\__cpp_evaluate.cpp.cpp:   src\\hce\\evaluate.cpp src\\hce\\evaluate.hpp src\\hce\\board.hpp   src\\hce\\bitboard.hpp src\\hce\\types.hpp src\\hce\\v5_weights.hpp   src\\hce\\v6_table.hpp src\\hce\\v6_final_weights.hpp\
",
    files = {
        [[src\hce\evaluate.cpp]]
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