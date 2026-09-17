#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
ascend_tmp=$(mktemp -d)
trap 'rm -rf -- "$ascend_tmp"' EXIT
ascend_node=${NODE:-node}
ascend_python=${PYTHON:-../../4ascend/.venv/bin/python}
ascend_src=wasm/4ascend-zero/src
ascend_cpp=("$ascend_src/game.cpp" "$ascend_src/board.cpp" "$ascend_src/rand.cpp" "$ascend_src/utils.cpp")
g++ -std=c++20 -O2 -I"$ascend_src" tests/rules_probe.cpp "${ascend_cpp[@]}" -o "$ascend_tmp/rules_probe"
"$ascend_node" tests/plant_ai_regression.cjs "$ascend_tmp/rules_probe"
"$ascend_python" tests/encoding_parity.py "$ascend_tmp/rules_probe"
g++ -std=c++20 -O2 -Itests/stubs -I"$ascend_src" tests/mcts_probe.cpp "${ascend_cpp[@]}" "$ascend_src/mcts.cpp" -o "$ascend_tmp/mcts_probe"
"$ascend_tmp/mcts_probe"
