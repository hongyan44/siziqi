"""4zero 引擎（tag c68b53f）+ ONNX 教师，生成默认模式数据。
HP<=0 的局面标记 low_confidence（训练时降权），不直接丢，便于统计。
"""
import json, random, sys, time
import numpy as np
import onnxruntime as ort
from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Phase, Move
from src.core.encoding_fast import FastEncoder

OUT = sys.argv[1] if len(sys.argv) > 1 else 'data/sample_onnx.jsonl'
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 2
MAX_P = int(sys.argv[3]) if len(sys.argv) > 3 else 60
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
GAME0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
MODE = sys.argv[6] if len(sys.argv) > 6 else 'default'

so = ort.SessionOptions(); so.intra_op_num_threads = int(__import__('os').environ.get('ORT_THREADS','4'))
sess = ort.InferenceSession('../4zero.onnx', so, providers=['CPUExecutionProvider'])

class BlightEngine(Engine):
    # 灾荒：完全无草（自然刷新与结算强制刷新都禁用）
    def _refresh_plants(self, *a, **k):
        return None

eng = BlightEngine(win_k=4) if MODE == 'blight' else Engine(win_k=4)
random.seed(SEED); np.random.seed(SEED)

vals = []; low = 0; n = 0
t0 = time.perf_counter()
with open(OUT, 'w') as f:
    for gi in range(GAME0, GAME0 + GAMES):
        g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
        enc = FastEncoder()
        for ply in range(MAX_P):
            if g.is_terminal(): break
            x = enc.encode(g, g.to_play)[None]
            out = sess.run(None, {'input': x})
            v = float(out[0].reshape(-1)[0]); logits = out[1].reshape(-1)
            legal = g.legal_moves()
            if not legal: break
            lm = np.full(81, -1e9, dtype=np.float32)
            for m in legal: lm[m.r * 9 + m.c] = 0.0
            z = logits + lm; z -= z.max()
            pr = np.exp(z / 0.2); pr /= pr.sum()
            idx = int(np.random.choice(81, p=pr))
            mv = Move(idx // 9, idx % 9)
            lc = int(g.hp[0] <= 0 or g.hp[1] <= 0)
            if lc: low += 1
            rec = {
                'game': gi, 'ply': ply, 'turn': int(g.turn),
                'to_play': int(g.to_play.value), 'phase': g.phase.name,
                'hp': [int(g.hp[0]), int(g.hp[1])],
                'grid': [int(v) for v in g.board.grid.reshape(-1)],
                'plants': [int(v) for v in g.board.plants.reshape(-1)],
                'mask': [int(v) for v in (g.attack_chain_mask.reshape(-1) if g.attack_chain_mask is not None else np.zeros(81))],
                'last_move': [g.last_move.r, g.last_move.c] if g.last_move else None,
                'value': round(v, 6), 'low_confidence': lc,
                'grow_count': int(g.grow_count), 'charge': int(g.unascend_charge),
                'chargef': [int(g.Aunascend_charge_fast[0]), int(g.Aunascend_charge_fast[1])],
                'over_fill': int(bool(g.over_fill)),
                'just_unascend': int(bool(g.just_unascend)),
                'move': [mv.r, mv.c],
            }
            f.write(json.dumps(rec) + '\n')
            vals.append(v); n += 1
            g = eng.step(g, mv)
dt = time.perf_counter() - t0
a = np.array(vals)
print(f"wrote {OUT}: {n} positions in {dt:.1f}s  ({n/dt:.0f} pos/s)")
print(f"value mean={a.mean():.4f} std={a.std():.4f} range=[{a.min():.3f},{a.max():.3f}]")
print(f"low_confidence (HP<=0): {low} ({100*low/max(1,n):.2f}%)")
