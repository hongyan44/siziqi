"""生成一份和真实直播格式完全一致的假对局，给 UI 调样式用。

真实对局由 `arena_match.py` 产出；本脚本只是把 Python 规则引擎当棋盘，
随机走到终局，再编造每手耗时/节点数，写进 `web/fixture.json`。

    teacher/venv/bin/python teacher/4zero/gen_fixture.py
"""
from __future__ import annotations

import json
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np

from src.core.board import Board
from src.core.engine import Engine
from src.core.rules import RulesConfig
from src.core.state import GameState
from src.core.types import Move, Phase, Player

OUT = os.path.join(HERE, "..", "..", "web", "fixture.json")

SYM = {0: ".", 1: "b", 2: "w", 3: "B", 4: "W", 5: "x", 6: "X"}


class BlightEngine(Engine):
    """灾荒：永不刷草（与 fascend 的 Mode::Blight 对齐）。"""

    def _refresh_plants(self, *a, **k):
        return None


def board_str(s: GameState) -> str:
    g = s.board.grid
    out = []
    for r in range(9):
        for c in range(9):
            ch = SYM[int(g[r, c])]
            # 攻防阶段：被打起来的连子用大写标记（Python 引擎把链子从 grid 删掉了，
            # 攻方 = 当前行棋方(守方)的对手）
            if s.attack_chain_mask is not None and s.attack_chain_mask[r, c]:
                ch = "B" if s.to_play is Player.WHITE else "W"
            out.append(ch)
    return "".join(out)


def main() -> None:
    rng = random.Random(20261031)
    eng = BlightEngine(win_k=4)
    s = GameState(cfg=RulesConfig(), board=Board(9))
    boards = [board_str(s)]
    hps = [[6, 6]]
    moves = []
    t0 = time.time()
    winner = None

    for n in range(400):
        if s.is_terminal():
            break
        legal = s.legal_moves()
        if not legal:
            break
        mv = legal[rng.randrange(len(legal))]
        s = eng.step(s, mv)
        boards.append(board_str(s))
        hps.append([int(s.hp[0]), int(s.hp[1])])
        ms = rng.randint(240, 340)
        side = "a" if n % 2 == 0 else "b"
        rec = {"n": n, "side": side, "mv": mv.r * 9 + mv.c, "ms": ms}
        if n >= 8:  # 开局是随机走子，不算"思考"
            if side == "a":
                q = round(rng.uniform(-0.6, 0.6), 3)
                rec.update(
                    sims=rng.randint(200, 300),
                    q=q,
                    top=[
                        {"mv": rec["mv"], "p": round(abs(q) + 0.3, 3)},
                        {"mv": legal[0].r * 9 + legal[0].c, "p": 0.21},
                        {"mv": legal[-1].r * 9 + legal[-1].c, "p": 0.14},
                    ],
                )
            else:
                rec.update(
                    nodes=rng.randint(40000, 160000),
                    depth=rng.randint(3, 6),
                    score=rng.randint(-900, 900),
                )
        moves.append(rec)

    if (s.hp <= 0).any():
        winner = 0 if s.hp[0] <= 0 else 1
    elif s.turn >= s.cfg.max_turns:
        winner = None

    for m in moves:
        if "q" in m:
            m["eval"] = round(m["q"], 3) * (1 if m["side"] == "b" else 1)
        elif "score" in m:
            m["eval"] = round(m["score"] / 4000.0, 3)

    live = {
        "v": 1,
        "ts": time.time(),
        "match": {
            "mode": "blight",
            "time_ms": 300,
            "games": 10,
            "open_plies": 8,
            "a": {
                "id": "4zero",
                "name": "4zero",
                "sub": "ONNX ResNet · MCTS",
                "detail": "根节点 Q + 机会节点树搜索",
                "accent": "#c8792c",
            },
            "b": {
                "id": "v9.1",
                "name": "v9.1",
                "sub": "NNUE 612 · PVS",
                "detail": "等时 alpha-beta",
                "accent": "#5f9ea0",
            },
            "score": {"a": 3, "b": 2, "d": 0, "done": 5},
            "history": [
                {"i": 0, "black": "a", "winner": "b", "plies": 63, "dur_ms": 41200},
                {"i": 1, "black": "b", "winner": "b", "plies": 58, "dur_ms": 38900},
                {"i": 2, "black": "a", "winner": "a", "plies": 71, "dur_ms": 46500},
                {"i": 3, "black": "b", "winner": "a", "plies": 55, "dur_ms": 35100},
                {"i": 4, "black": "a", "winner": "a", "plies": 60, "dur_ms": 39400},
            ],
        },
        "game": {
            "i": 5,
            "black": "a",
            "to_play": 0 if s.to_play is Player.BLACK else 1,
            "plies": len(moves),
            "winner": winner,
            "hp": [int(s.hp[0]), int(s.hp[1])],
            "grow": int(s.grow_count),
            "charge": int(s.unascend_charge),
            "chargef": [int(s.Aunascend_charge_fast[0]), int(s.Aunascend_charge_fast[1])],
            "over": 0,
            "ascend": 1 if s.phase is Phase.ATTACK_DEFENSE else 0,
            "last": moves[-1]["mv"] if moves else None,
            "plants": [],
            "boards": boards,
            "hps": hps,
            "moves": moves,
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(live, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {os.path.normpath(OUT)}  plies={len(moves)}  winner={winner}  {time.time()-t0:.2f}s")


if __name__ == "__main__":
    main()
