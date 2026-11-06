"""4zero（1-ply 价值头） vs 我们的引擎（bestmove 子进程）。
用法: teacher_match.py <model.bin> <games> <our_is_black 0/1> <time_ms>
"""
import json, subprocess, sys
import numpy as np
import onnxruntime as ort
from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Move, Phase
from src.core.encoding import AlphaZeroStateEncoder

MODEL = sys.argv[1]
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 1
OUR_BLACK = int(sys.argv[3]) if len(sys.argv) > 3 else 1
TIME_MS = int(sys.argv[4]) if len(sys.argv) > 4 else 100

sess = ort.InferenceSession('../4zero.onnx', providers=['CPUExecutionProvider'])
enc = AlphaZeroStateEncoder()
eng = Engine(win_k=4)

def state_json(s):
    mask = np.zeros(81, dtype=np.uint8) if s.attack_chain_mask is None else s.attack_chain_mask.reshape(-1)
    return {
        'to_play': int(s.to_play.value), 'phase': s.phase.name,
        'hp': [int(s.hp[0]), int(s.hp[1])],
        'grid': [int(x) for x in s.board.grid.reshape(-1)],
        'plants': [int(x) for x in s.board.plants.reshape(-1)],
        'mask': [int(x) for x in mask],
        'last_move': [s.last_move.r, s.last_move.c] if s.last_move else None,
        'turn': int(s.turn), 'grow_count': int(s.grow_count),
        'charge': int(s.unascend_charge),
        'chargef': [int(s.Aunascend_charge_fast[0]), int(s.Aunascend_charge_fast[1])],
        'over_fill': int(bool(s.over_fill)), 'just_unascend': int(bool(s.just_unascend)),
        'time_ms': TIME_MS, 'depth': 6,
    }

def teacher_value(s):
    x = enc.encode(s, s.to_play)[None]
    return float(sess.run(None, {'input': x})[0].reshape(-1)[0])

def teacher_move(s):
    best, bv = None, -1e9
    for m in s.legal_moves():
        ns = eng.step(s, m)
        v = -teacher_value(ns)  # 结果局面轮到对方，取负
        if v > bv:
            bv, best = v, m
    return best

proc = subprocess.Popen(['/nnue-engine/fascend/target/release/examples/bestmove', MODEL],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

def our_move(s):
    proc.stdin.write(json.dumps(state_json(s)) + '\n'); proc.stdin.flush()
    line = proc.stdout.readline().strip()
    idx = int(line)
    assert idx >= 0, line
    return Move(idx // 9, idx % 9)

results = []
for gi in range(GAMES):
    # 交替颜色；OUR_BLACK 决定第一局
    our_black = (OUR_BLACK == 1) if gi % 2 == 0 else (OUR_BLACK == 0)
    g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
    for ply in range(300):
        if g.is_terminal(): break
        ours = (g.to_play is Player.BLACK) == our_black
        m = our_move(g) if ours else teacher_move(g)
        if m is None: break
        g = eng.step(g, m)
    w = None
    if (g.hp <= 0).any():
        w = Player.BLACK if g.hp[1] <= 0 else Player.WHITE
    our_win = (w is not None) and ((w is Player.BLACK) == our_black)
    results.append('W' if our_win else ('L' if w is not None else 'D'))
    print(f"game {gi}: our_black={our_black} hp={list(g.hp)} -> {results[-1]}", flush=True)

print("results:", ''.join(results))
proc.stdin.write('quit\n'); proc.stdin.flush()
