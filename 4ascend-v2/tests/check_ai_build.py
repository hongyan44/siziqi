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

    # 四子鱼权重必须随发布包一起发布，否则线上会在 /model/4ascend-fish.onnx 拿到 404，
    # 表现为“AI 引擎不可用”而无法开局。
    fish = read("model/4ascend-fish.onnx")
    require(fish, "四子鱼 ONNX model exists")
    require(fish == read("root/model/4ascend-fish.onnx"), "published 四子鱼 ONNX model matches source")

    worker = read("js/worker/ai.cjs").decode("utf-8")
    require("/js/global/fascend.min.js" in worker, "worker loads the canonical JS rules")
    require("/js/ai.min.js" in worker, "worker loads the new JS MCTS implementation")
    require("/model/4ascend-fish.onnx" in worker, "worker loads the 四子鱼 model")
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
    # 四子鱼前端已下架：选项保留为注释，恢复时删除注释即可。
    require(b"<!-- <sl-option value='4ascend-fish'>" in local_page, "local page keeps the 四子鱼 opponent commented out")
    require(b"hiddenRandomSearchGame" in read("root/js/worker/ai.min.js"), "ordinary levels use hidden-seed search")
    require((APP_DIR / "tests/browser_smoke.html").is_file(), "browser smoke test source exists")


if __name__ == "__main__":
    main()
