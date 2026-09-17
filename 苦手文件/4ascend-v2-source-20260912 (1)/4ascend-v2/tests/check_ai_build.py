#!/usr/bin/env python3
"""Dependency-free checks for the published JS/ONNX AI runtime."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]


def read(relative: str) -> bytes:
    return (APP_DIR / relative).read_bytes()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


def main() -> None:
    metadata = json.loads(read("model/4ascend-zero.json"))
    model = read("model/4ascend-zero.onnx")
    digest = hashlib.sha256(model).hexdigest()

    require(metadata["signature"]["config"]["in_planes"] == 25, "model expects 25 feature planes")
    require(metadata["signature"]["config"]["board_size"] == 9, "model expects a 9x9 board")
    require(digest == metadata["onnx_sha256"], "ONNX model checksum matches metadata")
    require(model == read("root/model/4ascend-zero.onnx"), "published ONNX model matches source")

    worker = read("js/worker/ai.cjs").decode("utf-8")
    require("/js/global/fascend.min.js" in worker, "worker loads the canonical JS rules")
    require("/js/ai.min.js" in worker, "worker loads the new JS MCTS implementation")
    require("4ascend-zero.js" not in worker, "worker does not load the legacy C++ MCTS")
    require("4ascend-hce.js" not in worker, "worker does not load the legacy C++ HCE engine")
    require(read("js/worker/ai.cjs") == read("root/js/worker/ai.min.js"), "published worker is current")
    ai_bundle = read("root/js/ai.min.js")
    require(ai_bundle, "AI browser bundle exists")
    require(b"Symbol('BLACK')" not in ai_bundle, "AI bundle does not duplicate canonical Symbol enums")
    require(b"gl_cf_synchronize_random" in read("root/js/core/ai.min.js"), "published AI game core forwards the RNG mode")
    require(b"ai_synchronize_random" in read("root/js/main/ai.min.js"), "published AI page maps the ??? RNG mode")
    require(b"opt === '6'" in read("root/js/main/ai.min.js"), "published ??? level uses its dedicated configuration")
    local_page = read("root/pages/local/ai.html")
    require(b"value='6'>???" in local_page, "local page publishes the synchronized-seed ??? level")
    require(b"hiddenRandomSearchGame" in read("root/js/worker/ai.min.js"), "ordinary levels use hidden-seed search")
    require(b"class EndgameSolver" not in ai_bundle, "obsolete dedicated endgame solver is absent")
    require(not (APP_DIR / "js/ai/endgame.cjs").exists(), "obsolete dedicated endgame solver source is removed")
    require(b"ENDGAME_LOAD" in read("root/js/worker/ai.min.js"), "worker accepts complete endgame snapshots")
    require(b"ENDGAME_THINK" in read("root/js/worker/ai.min.js"), "worker exposes pure 4zero MCTS endgame search")
    require(b"ENDGAME_ANALYZE" not in read("root/js/worker/ai.min.js"), "worker no longer exposes the dedicated endgame solver")
    require(b"ENDGAME_APPLY" in read("root/js/worker/ai.min.js"), "worker commits endgame moves explicitly")
    require(b"game.natural_plant === false" in ai_bundle, "no-plant games fix the grow parity feature to one")
    require(b"ARCHIVE_VERSION = 2" in read("root/js/global/endgame.min.js"), "published endgame archive stores V2 deterministic state")
    challenge_page = read("root/pages/endgame/challenge.html")
    require(b"ENDGAME_THINK(ENDGAME_SIMULATIONS)" in challenge_page, "endgame challenge uses 4zero MCTS")
    require(b"ENDGAME_SIMULATIONS = 888" in challenge_page, "endgame challenge uses 888 MCTS simulations")
    require(b"ZERO_THINK(AI_SIMULATIONS)" not in challenge_page, "endgame challenge no longer uses ordinary MCTS directly")
    require((APP_DIR / "tests/browser_smoke.html").is_file(), "browser smoke test source exists")


if __name__ == "__main__":
    main()
