"""4zero MCTS（ONNX 版） vs 我们的引擎；同时收集对局数据。
用法: teacher_match2.py <model.bin> <games> <our_is_black> <time_ms> <sims> <out.jsonl>
"""
import json, subprocess, sys
import numpy as np
import onnxruntime as ort
from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Move
from src.core.encoding import AlphaZeroStateEncoder
import sys as _sys, types as _types
_sys.modules.setdefault('torch', _types.ModuleType('torch'))
from src.ai.mcts import MCTS

MODEL = sys.argv[1]
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 1
OUR_BLACK = int(sys.argv[3]) if len(sys.argv) > 3 else 1
TIME_MS = int(sys.argv[4]) if len(sys.argv) > 4 else 100
SIMS = int(sys.argv[5]) if len(sys.argv) > 5 else 100
OUT = sys.argv[6] if len(sys.argv) > 6 else 'data/free_games.jsonl'

sess = ort.InferenceSession('../4zero.onnx', providers=['CPUExecutionProvider'])
enc = AlphaZeroStateEncoder()
eng = Engine(win_k=4)

class _Dummy:
    def eval(self): pass

class OnnxMCTS(MCTS):
    def __init__(self, sims=100):
        super().__init__(model=_Dummy(), encoder=enc, engine=eng, sims=sims, device='cpu')
    def _policy_value(self, s, as_player):
        x = enc.encode(s, as_player)[None]
        out = sess.run(None, {'input': x})
        v = float(out[0].reshape(-1)[0])
        logits = out[1].reshape(-1).astype(np.float64)
        p = np.exp(logits - logits.max()); p /= p.sum()
        mask = self._legal_mask(s)
        p = p * mask
        if p.sum() <= 1e-8:
            p = mask / max(1, mask.sum())
        else:
            p /= p.sum()
        return p, v

import time as _time
mcts = OnnxMCTS(SIMS)

def run_timed(m, root_state, budget_ms):
    """时间预算版 MCTS：跑到 deadline 就停，返回 (pi, root, sims)。"""
    root_player = root_state.to_play
    from src.ai.mcts import Node
    root = Node(prior=1.0, to_play=root_player)
    p, v = m._policy_value(root_state, as_player=root_player)
    m._expand(root, root_state, p)
    t0 = _time.perf_counter()
    n = 0
    while (_time.perf_counter() - t0) * 1000.0 < budget_ms:
        m._simulate(root_state, root)
        n += 1
    pi = np.zeros(m.size * m.size, dtype=np.float32)
    for a, child in root.children.items():
        pi[a] = child.N
    if pi.sum() > 0:
        pi = pi / pi.sum()
    return pi, root, n

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

proc = subprocess.Popen(['/nnue-engine/fascend/target/release/examples/bestmove', MODEL],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

def our_move(s):
    proc.stdin.write(json.dumps(state_json(s)) + '\n'); proc.stdin.flush()
    idx = int(proc.stdout.readline().strip())
    return Move(idx // 9, idx % 9)

results = []
out = open(OUT, 'a')
for gi in range(GAMES):
    our_black = (OUR_BLACK == 1) if gi % 2 == 0 else (OUR_BLACK == 0)
    g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
    recs = []
    for ply in range(300):
        if g.is_terminal(): break
        recs.append((state_json(g), g.to_play))
        ours = (g.to_play is Player.BLACK) == our_black
        if ours:
            m = our_move(g)
        else:
            pi, _, nsim = run_timed(mcts, g, TIME_MS)
            m = Move(int(np.argmax(pi)) // 9, int(np.argmax(pi)) % 9)
        g = eng.step(g, m)
    w = None
    if (g.hp <= 0).any():
        w = Player.BLACK if g.hp[1] <= 0 else Player.WHITE
    our_win = (w is not None) and ((w is Player.BLACK) == our_black)
    results.append('W' if our_win else ('L' if w is not None else 'D'))
    for st, player in recs:
        z = 0.0 if w is None else (1.0 if w is player else -1.0)
        st2 = dict(st); st2['value'] = z; st2['game'] = gi; st2['low_confidence'] = 0
        out.write(json.dumps(st2) + '\n')
    out.flush()
    print(f"game {gi}: our_black={our_black} hp={list(g.hp)} -> {results[-1]}", flush=True)
out.close()
print("results:", ''.join(results))
proc.stdin.write('quit\n'); proc.stdin.flush()
