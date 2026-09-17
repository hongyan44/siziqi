#!/usr/bin/env python3
"""Generate 4zero-code reference outputs for the browser parity harness."""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort


APP_DIR = Path(__file__).resolve().parents[1]
TTR_DIR = APP_DIR.parents[1]
REFERENCE_DIR = TTR_DIR / "4zero-code"
sys.path.insert(0, str(REFERENCE_DIR))

from src.ai.inference import OnnxPolicyValue  # noqa: E402
from src.ai.mcts import MCTS  # noqa: E402
from src.core.board import Board  # noqa: E402
from src.core.encoding import AlphaZeroStateEncoder  # noqa: E402
from src.core.engine import Engine  # noqa: E402
from src.core.rules import RulesConfig  # noqa: E402
from src.core.state import GameState  # noqa: E402
from src.core.types import Move, Phase, Player  # noqa: E402


SIZE = 9
CELLS = SIZE * SIZE
MODEL_PATH = APP_DIR / "model" / "4ascend-zero.onnx"
OUTPUT_PATH = APP_DIR / "root" / "dev" / "python_benchmark.json"


def empty_grid() -> np.ndarray:
    return np.zeros((SIZE, SIZE), dtype=np.uint8)


def history_from_moves(moves: list[tuple[int, int, int]]) -> tuple[list[np.ndarray], np.ndarray]:
    grid = empty_grid()
    history: list[np.ndarray] = []
    for row, column, stone in moves:
        history.append(grid.copy())
        grid[row, column] = stone
    return history[-7:], grid


def make_state(spec: dict) -> GameState:
    cfg = RulesConfig(board_size=SIZE)
    board = Board(SIZE)
    board.grid = np.asarray(spec["grid"], dtype=np.uint8).reshape(SIZE, SIZE).copy()
    board.plants = np.asarray(spec["plants"], dtype=np.uint16).reshape(SIZE, SIZE).copy()
    state = GameState(cfg=cfg, board=board)
    state.to_play = Player.BLACK if spec["toPlay"] == 0 else Player.WHITE
    state.turn = spec["turn"]
    state.phase = Phase.ATTACK_DEFENSE if spec["phase"] == "attack" else Phase.NORMAL
    state.last_moves = [np.asarray(item, dtype=np.uint8).reshape(SIZE, SIZE).copy() for item in spec["history"]]
    state.hp = np.asarray(spec["hp"], dtype=np.int32)
    mask = spec.get("attackMask")
    state.attack_chain_mask = None if mask is None else np.asarray(mask, dtype=np.uint8).reshape(SIZE, SIZE)
    state.grow_count = spec["growCount"]
    state.unascend_charge = spec["unascendCharge"]
    state.Aunascend_charge_fast = np.asarray(spec["fastCharge"], dtype=np.int32)
    state.just_unascend = spec["justUnascend"]
    state.over_fill = spec["overFill"]
    return state


def summary(state: GameState) -> dict:
    return {
        "grid": state.board.grid.reshape(-1).astype(int).tolist(),
        "plants": state.board.plants.reshape(-1).astype(int).tolist(),
        "toPlay": state.to_play.value,
        "turn": state.turn,
        "phase": "attack" if state.phase is Phase.ATTACK_DEFENSE else "normal",
        "history": [item.reshape(-1).astype(int).tolist() for item in state.last_moves[-7:]],
        "hp": state.hp.astype(int).tolist(),
        "attackMask": None if state.attack_chain_mask is None else state.attack_chain_mask.reshape(-1).astype(int).tolist(),
        "growCount": state.grow_count,
        "unascendCharge": state.unascend_charge,
        "fastCharge": state.Aunascend_charge_fast.astype(int).tolist(),
        "justUnascend": bool(state.just_unascend),
        "overFill": bool(state.over_fill),
    }


def base_spec(name: str, grid: np.ndarray, history: list[np.ndarray], *, to_play: int, turn: int) -> dict:
    return {
        "name": name,
        "firstPhysical": 0,
        "grid": grid.reshape(-1).astype(int).tolist(),
        "plants": np.zeros(CELLS, dtype=np.uint8).astype(int).tolist(),
        "toPlay": to_play,
        "turn": turn,
        "phase": "normal",
        "history": [item.reshape(-1).astype(int).tolist() for item in history[-7:]],
        "hp": [6, 6],
        "attackMask": None,
        # Keep refresh far outside the shallow comparison tree so Python's
        # global random module and the web engine's two RNGs are irrelevant.
        "growCount": 101,
        "unascendCharge": 25,
        "fastCharge": [9, 9],
        "justUnascend": False,
        "overFill": False,
        "transitionActions": [],
        "compareMcts": False,
    }


def fixture_specs() -> list[dict]:
    initial = base_spec("initial", empty_grid(), [], to_play=0, turn=0)
    initial["transitionActions"] = [40]

    moves = [
        (4, 4, 1), (3, 4, 2), (2, 2, 1), (5, 5, 2),
        (4, 3, 1), (3, 3, 2), (6, 6, 1),
    ]
    history, mid_grid = history_from_moves(moves)
    mid = base_spec("normal_midgame", mid_grid, history, to_play=1, turn=7)
    mid_plants = np.zeros((SIZE, SIZE), dtype=np.uint8)
    mid_plants[4, 4] = 2
    mid_plants[3, 4] = 1
    mid_plants[1, 7] = 1
    mid["plants"] = mid_plants.reshape(-1).astype(int).tolist()
    mid["hp"] = [5, 4]
    mid["transitionActions"] = [0]
    mid["compareMcts"] = True

    white_first = dict(mid)
    white_first["name"] = "normal_midgame_white_first"
    white_first["firstPhysical"] = 1
    white_first["transitionActions"] = []
    white_first["compareMcts"] = False

    trigger_moves = [
        (4, 1, 1), (0, 0, 2), (4, 2, 1),
        (0, 1, 2), (4, 3, 1), (1, 0, 2),
    ]
    trigger_history, trigger_grid = history_from_moves(trigger_moves)
    trigger = base_spec("ascend_trigger", trigger_grid, trigger_history, to_play=0, turn=6)
    trigger["transitionActions"] = [40]

    defense_grid = empty_grid()
    defense_grid[0, 0] = 2
    defense_grid[1, 0] = 2
    defense_grid[2, 0] = 1
    defense_mask = np.zeros((SIZE, SIZE), dtype=np.uint8)
    defense_mask[4, 1:5] = 1
    defense = base_spec("ascend_response", defense_grid, [], to_play=1, turn=7)
    defense["phase"] = "attack"
    defense["attackMask"] = defense_mask.reshape(-1).astype(int).tolist()
    defense_plants = np.zeros((SIZE, SIZE), dtype=np.uint8)
    defense_plants[4, 1] = 1
    defense_plants[4, 3] = 2
    defense["plants"] = defense_plants.reshape(-1).astype(int).tolist()
    defense["justUnascend"] = True
    defense["transitionActions"] = [38]

    return [initial, mid, white_first, trigger, defense]


def mcts_result(state: GameState, model: OnnxPolicyValue, encoder: AlphaZeroStateEncoder, *, eps: float, seed: int) -> dict:
    random.seed(seed)
    np.random.seed(seed)
    search = MCTS(
        model,
        encoder,
        Engine(win_k=4),
        board_size=SIZE,
        c_puct=2.0,
        sims=32,
        dirichlet_alpha=0.3,
        dirichlet_eps=eps,
        reuse_tree=False,
    )
    policy, root = search.run(state, turn_related_sim=-1)
    ranked = sorted(root.children.items(), key=lambda item: (-item[1].N, -item[1].prior, item[0]))
    return {
        "action": int(np.argmax(policy)),
        "visits": {str(action): child.N for action, child in root.children.items() if child.N},
        "top": [
            {"action": int(action), "visits": int(child.N), "q": float(child.Q), "prior": float(child.prior)}
            for action, child in ranked[:8]
        ],
    }


def main() -> None:
    encoder = AlphaZeroStateEncoder(last_k=8)
    engine = Engine(win_k=4)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(MODEL_PATH), sess_options=options, providers=["CPUExecutionProvider"])
    search_model = OnnxPolicyValue(MODEL_PATH, threads=1)

    fixtures = []
    for spec in fixture_specs():
        state = make_state(spec)
        encoded = encoder.encode(state, state.to_play).astype(np.float32)
        logits, value = session.run(["policy_logits", "value"], {"state": encoded[None, ...]})
        item = {
            "spec": spec,
            "encoding": encoded.reshape(-1).astype(float).tolist(),
            "policyLogits": logits[0].astype(float).tolist(),
            "value": float(value.reshape(-1)[0]),
            "legal": [move.r * SIZE + move.c for move in state.legal_moves()],
            "transitions": {},
        }
        for action in spec["transitionActions"]:
            random.seed(20260912)
            next_state = engine.step(state, Move(*divmod(action, SIZE)))
            item["transitions"][str(action)] = summary(next_state)
        if spec["compareMcts"]:
            item["mctsDeterministic"] = mcts_result(state, search_model, encoder, eps=0.0, seed=0)
        fixtures.append(item)

    payload = {
        "reference": "4zero-code",
        "onnxRuntime": ort.__version__,
        "model": str(MODEL_PATH),
        "mctsSimulations": 32,
        "fixtures": fixtures,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUTPUT_PATH}")
    for fixture in fixtures:
        mcts = fixture.get("mctsDeterministic")
        if mcts:
            print(f"deterministic action={mcts['action']} top={mcts['top'][:3]}")


if __name__ == "__main__":
    main()
