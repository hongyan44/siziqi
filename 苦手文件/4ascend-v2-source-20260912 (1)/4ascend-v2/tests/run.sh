#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
ascend_python=${PYTHON:-python}
"$ascend_python" dev/build.py --include-browser-tests
"$ascend_python" tests/check_ai_build.py

echo "Static AI checks passed."
echo "For the browser rules/MCTS test, serve root/ and open /dev/browser_smoke.html."
