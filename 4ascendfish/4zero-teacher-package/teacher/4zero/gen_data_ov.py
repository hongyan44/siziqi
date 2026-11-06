"""Lockstep batched teacher data generation via OpenVINO CPU (fp32).

Openings (changed 2026-10-31 at user request):
  * 5-12 random stones already on the board (uniform random legal moves, so
    plants / grow counters / parity stay exactly as the rules produce them)
  * both sides start with a random HP in [1, 10]; a small fraction (ASYM_FRAC,
    default 0.2) start with a 1-4 HP difference instead of a symmetric one

Every record carries its provenance, so different sources can be separated
downstream:
  src        : 'sym' | 'asym'
  open_stones: number of random opening stones
  hp0, hp1   : starting HP of black / white
(the output file itself is also per-run, and game ids are offset per run).

Backend: OpenVINO CPU fp32.  Measured vs ONNX Runtime CPU EP on this box,
batch 32, 5 threads: 0.21 vs 1.75 ms/pos (8.5x), value max|diff| 2.9e-06,
policy max|diff| 7.4e-06 - plain fp32 reassociation noise, no precision loss.
The f32 precision hint is forced so the CPU plugin cannot fall back to bf16.
"""
import json
import os
import sys
import time

import numpy as np
import openvino as ov

from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Move
from src.core.encoding_fast import FastEncoder

OUT = sys.argv[1] if len(sys.argv) > 1 else 'data/sample_ov.jsonl'
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 32
MAX_P = int(sys.argv[3]) if len(sys.argv) > 3 else 60
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
GAME0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
MODE = sys.argv[6] if len(sys.argv) > 6 else 'default'
SLOTS = int(os.environ.get('SLOTS', '64'))
THREADS = int(os.environ.get('OV_THREADS', '5'))
ASYM_FRAC = float(os.environ.get('ASYM_FRAC', '0.2'))
OPEN_MIN, OPEN_MAX = 5, 12
HP_MIN, HP_MAX = 1, 10


class BlightEngine(Engine):
    # 灾荒：完全无草（自然刷新与结算强制刷新都禁用）
    def _refresh_plants(self, *a, **k):
        return None


def sample_opening(rng):
    k = int(rng.integers(OPEN_MIN, OPEN_MAX + 1))
    if rng.random() < ASYM_FRAC:
        a = int(rng.integers(HP_MIN, HP_MAX + 1))
        d = int(rng.integers(1, 5))
        b = a - d if a - d >= HP_MIN else min(HP_MAX, a + d)
        hp = [a, b] if rng.random() < 0.5 else [b, a]
        src = 'asym'
    else:
        h = int(rng.integers(HP_MIN, HP_MAX + 1))
        hp = [h, h]
        src = 'sym'
    return k, hp, src


def main():
    core = ov.Core()
    model = core.read_model('../4zero.onnx')
    compiled = core.compile_model(model, 'CPU', {
        'INFERENCE_NUM_THREADS': THREADS,
        'INFERENCE_PRECISION_HINT': 'f32',
    })
    in_port = compiled.input(0)
    out_v = compiled.output(0)
    out_p = compiled.output(1)
    eng = BlightEngine(win_k=4) if MODE == 'blight' else Engine(win_k=4)

    z81 = [0] * 81
    slots = [None] * SLOTS
    vals = []
    stats = {'sym': 0, 'asym': 0}
    hp_hist = {}
    open_hist = {}
    low = 0
    n = 0
    next_game = GAME0
    rng_master = np.random.default_rng(SEED)

    def new_game(gid):
        r = np.random.default_rng(gid * 1000003 + 17)
        for _attempt in range(6):
            g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
            k, hp, src = sample_opening(r)
            ok = True
            for _ in range(k):
                legal = g.legal_moves()
                if not legal or g.is_terminal():
                    ok = False
                    break
                g = eng.step(g, legal[int(r.integers(len(legal)))])
            if ok and not g.is_terminal():
                g.hp = np.array(hp, dtype=np.int32)
                return {'id': gid, 'g': g, 'enc': FastEncoder(), 'ply': 0, 'rng': r,
                        'src': src, 'open_stones': k, 'hp': hp}
        g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
        g.hp = np.array([HP_MAX, HP_MAX], dtype=np.int32)
        return {'id': gid, 'g': g, 'enc': FastEncoder(), 'ply': 0, 'rng': r,
                'src': 'sym', 'open_stones': 0, 'hp': [HP_MAX, HP_MAX]}

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

            res = compiled({in_port: x})
            vv = np.asarray(res[out_v]).reshape(B)
            lg = np.asarray(res[out_p]).reshape(B, 81)

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
                    'mask': (g.attack_chain_mask.ravel().tolist() if g.attack_chain_mask is not None else z81),
                    'last_move': [g.last_move.r, g.last_move.c] if g.last_move else None,
                    'value': round(v, 6), 'low_confidence': lc,
                    'grow_count': int(g.grow_count), 'charge': int(g.unascend_charge),
                    'chargef': [int(g.Aunascend_charge_fast[0]), int(g.Aunascend_charge_fast[1])],
                    'over_fill': int(bool(g.over_fill)),
                    'just_unascend': int(bool(g.just_unascend)),
                    'move': [mv.r, mv.c],
                    # provenance
                    'src': s['src'], 'open_stones': int(s['open_stones']),
                    'hp0': int(s['hp'][0]), 'hp1': int(s['hp'][1]), 'mode': MODE,
                }
                f.write(json.dumps(rec) + '\n')
                vals.append(v)
                stats[s['src']] += 1
                hp_hist[(s['hp'][0], s['hp'][1])] = hp_hist.get((s['hp'][0], s['hp'][1]), 0) + 1
                open_hist[s['open_stones']] = open_hist.get(s['open_stones'], 0) + 1
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
    print(f"wrote {OUT}: {n} positions in {dt:.1f}s  ({n/dt:.0f} pos/s)  slots={SLOTS} threads={THREADS} backend=openvino mode={MODE}")
    print(f"value mean={a.mean():.4f} std={a.std():.4f} range=[{a.min():.3f},{a.max():.3f}]")
    print(f"low_confidence (HP<=0): {low} ({100*low/max(1,n):.2f}%)")
    print(f"src: {stats}   open_stones: {dict(sorted(open_hist.items()))}")
    print(f"hp pairs: {len(hp_hist)} distinct, top {sorted(hp_hist.items(), key=lambda kv: -kv[1])[:6]}")


if __name__ == '__main__':
    main()
