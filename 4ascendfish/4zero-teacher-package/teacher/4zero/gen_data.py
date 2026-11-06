import json, random, sys
import numpy as np
from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Phase, Move
from src.core.encoding import AlphaZeroStateEncoder
from infer import Teacher

OUT = sys.argv[1] if len(sys.argv) > 1 else 'data/sample.jsonl'
GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 2
MAX_P = int(sys.argv[3]) if len(sys.argv) > 3 else 60

t = Teacher('../ckpt105841.pt')
enc = AlphaZeroStateEncoder()
eng = Engine(win_k=4)
random.seed(7); np.random.seed(7)
vals = []; n = 0
with open(OUT, 'w') as f:
    for gi in range(GAMES):
        g = GameState(cfg=RulesConfig(), board=Board(9), to_play=Player.BLACK, turn=0)
        for ply in range(MAX_P):
            if g.is_terminal(): break
            x = enc.encode(g, g.to_play)
            v = t.value(x)[0]
            logits = t.policy(x)
            legal = g.legal_moves()
            if not legal: break
            lm = np.full(81, -1e9, dtype=np.float32)
            for m in legal: lm[m.r * 9 + m.c] = 0.0
            z = logits + lm; z -= z.max()
            pr = np.exp(z / 0.2); pr /= pr.sum()
            idx = int(np.random.choice(81, p=pr))
            m = Move(idx // 9, idx % 9)
            rec = {
                'game': gi, 'ply': ply, 'turn': int(g.turn),
                'to_play': int(g.to_play.value),
                'phase': g.phase.name,
                'hp': [int(g.hp[0]), int(g.hp[1])],
                'grid': [int(v) for v in g.board.grid.reshape(-1)],
                'plants': [int(v) for v in g.board.plants.reshape(-1)],
                'mask': [int(v) for v in (g.attack_chain_mask.reshape(-1) if g.attack_chain_mask is not None else np.zeros(81))],
                'last_move': [g.last_move.r, g.last_move.c] if g.last_move else None,
                'value': round(v, 6),
                'move': [m.r, m.c],
            }
            f.write(json.dumps(rec) + '\n')
            vals.append(v); n += 1
            g = eng.step(g, m)
print(f"wrote {OUT}: {n} positions")
a = np.array(vals)
print(f"value mean={a.mean():.4f} std={a.std():.4f} min={a.min():.4f} max={a.max():.4f}")
print(f"  >0.5: {(a>0.5).mean()*100:.1f}%   <-0.5: {(a<-0.5).mean()*100:.1f}%")
