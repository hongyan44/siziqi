"""Lockstep batched data generation with the 4zero teacher.

Why: a single position at a time costs 2.6-7.8 ms of ONNX forward (tiny 9x9
convs are launch/overhead bound on the CPU EP).  Batching 32 positions drops
that to 1.44 ms/pos (6 threads).  Positions of one game are sequential, so we
run SLOTS games in lockstep: one batch = SLOTS positions, one from each game.

Feature encoding uses the incremental FastEncoder (6x faster than the
reference encoder); everything else is identical to gen_data_onnx.py, so the
output JSONL schema is the same and the existing bridge/training pipeline can
consume it unchanged.
"""
import json
import os
import sys
import time

import numpy as np
import onnxruntime as ort

from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Phase, Move
from src.core.encoding_fast import FastEncoder

OUT = sys.argv[1] if len(sys.argv) > 1 else 'data/sample_batch.jsonl'
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 32
MAX_P = int(sys.argv[3]) if len(sys.argv) > 3 else 60
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
GAME0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
MODE = sys.argv[6] if len(sys.argv) > 6 else 'default'
SLOTS = int(os.environ.get('SLOTS', '32'))
ORT_THREADS = int(os.environ.get('ORT_THREADS', '6'))


class BlightEngine(Engine):
    # 灾荒：完全无草（自然刷新与结算强制刷新都禁用）
    def _refresh_plants(self, *a, **k):
        return None


so = ort.SessionOptions()
so.intra_op_num_threads = ORT_THREADS
so.inter_op_num_threads = 1
sess = ort.InferenceSession('../4zero.onnx', so, providers=['CPUExecutionProvider'])
eng = BlightEngine(win_k=4) if MODE == 'blight' else Engine(win_k=4)

Z81 = [0] * 81
rng = np.random.default_rng(SEED)
slots = [None] * SLOTS
vals = []
low = 0
n = 0
next_game = GAME0


def new_game(seed):
    return {
        'id': seed,
        'g': GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0),
        'enc': FastEncoder(),
        'ply': 0,
        'rng': np.random.default_rng(seed * 1000003 + 17),
    }


for i in range(SLOTS):
    if next_game < GAME0 + GAMES:
        slots[i] = new_game(next_game)
        next_game += 1

xbuf = np.zeros((SLOTS, 25, 9, 9), dtype=np.float32)
t0 = time.perf_counter()

with open(OUT, 'w') as f:
    while any(s is not None for s in slots):
        active = [i for i, s in enumerate(slots) if s is not None]
        B = len(active)
        x = xbuf[:B] if B == SLOTS else np.zeros((B, 25, 9, 9), dtype=np.float32)
        for k, i in enumerate(active):
            s = slots[i]
            np.copyto(x[k], s['enc'].encode(s['g'], s['g'].to_play))

        out = sess.run(None, {'input': x})
        vv = out[0].reshape(B)
        lg = out[1].reshape(B, 81)

        for k, i in enumerate(active):
            s = slots[i]
            g = s['g']
            v = float(vv[k])
            logits = lg[k]
            empty = np.flatnonzero(g.board.grid.reshape(-1) == 0)
            if len(empty) == 0:
                slots[i] = None
                continue
            z = logits[empty]
            z = z - z.max()
            p = np.exp(z / 0.2)
            p /= p.sum()
            r = s['rng'].random()
            idx = empty[int(np.searchsorted(np.cumsum(p), r, side='right'))]
            if idx >= 81:
                idx = empty[-1]
            mv = Move(int(idx) // 9, int(idx) % 9)
            lc = int(g.hp[0] <= 0 or g.hp[1] <= 0)
            if lc:
                low += 1
            rec = {
                'game': int(s['id']), 'ply': int(s['ply']), 'turn': int(g.turn),
                'to_play': int(g.to_play.value), 'phase': g.phase.name,
                'hp': [int(g.hp[0]), int(g.hp[1])],
                'grid': g.board.grid.ravel().tolist(),
                'plants': g.board.plants.ravel().tolist(),
                'mask': (g.attack_chain_mask.ravel().tolist() if g.attack_chain_mask is not None else Z81),
                'last_move': [g.last_move.r, g.last_move.c] if g.last_move else None,
                'value': round(v, 6), 'low_confidence': lc,
                'grow_count': int(g.grow_count), 'charge': int(g.unascend_charge),
                'chargef': [int(g.Aunascend_charge_fast[0]), int(g.Aunascend_charge_fast[1])],
                'over_fill': int(bool(g.over_fill)),
                'just_unascend': int(bool(g.just_unascend)),
                'move': [mv.r, mv.c],
            }
            f.write(json.dumps(rec) + '\n')
            vals.append(v)
            n += 1
            s['ply'] += 1
            ng = eng.step(g, mv)
            s['g'] = ng
            if ng.is_terminal() or s['ply'] >= MAX_P:
                if next_game < GAME0 + GAMES:
                    slots[i] = new_game(next_game)
                    next_game += 1
                else:
                    slots[i] = None

dt = time.perf_counter() - t0
a = np.array(vals)
print(f"wrote {OUT}: {n} positions in {dt:.1f}s  ({n/dt:.0f} pos/s)  slots={SLOTS} threads={ORT_THREADS}")
print(f"value mean={a.mean():.4f} std={a.std():.4f} range=[{a.min():.3f},{a.max():.3f}]")
print(f"low_confidence (HP<=0): {low} ({100*low/max(1,n):.2f}%)")
