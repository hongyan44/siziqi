"""教师 policy 在灾荒/默认的可靠性：top1 概率、熵、与 1-ply 价值最优的一致率。"""
import json, sys
import numpy as np
import onnxruntime as ort
from src.core.engine import Engine
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Phase, Move
from src.core.encoding import AlphaZeroStateEncoder

sess = ort.InferenceSession('../4zero.onnx', providers=['CPUExecutionProvider'])
enc = AlphaZeroStateEncoder(); eng = Engine(win_k=4)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60

def state_from(r):
    b = Board(9)
    b.grid = np.array(r['grid'], dtype=np.uint8).reshape(9,9)
    b.plants = np.array(r['plants'], dtype=np.uint16).reshape(9,9)
    tp = Player.BLACK if r['to_play']==0 else Player.WHITE
    mask = np.array(r['mask'], dtype=np.uint8).reshape(9,9) if any(r['mask']) else None
    ph = Phase.ATTACK_DEFENSE if r['phase']=='ATTACK_DEFENSE' else Phase.NORMAL
    s = GameState(cfg=RulesConfig(), board=b, to_play=tp, turn=r['turn'], phase=ph, attack_chain_mask=mask)
    s.grow_count = r['grow_count']; s.unascend_charge = r['charge']
    s.Aunascend_charge_fast = np.array(r['chargef'], dtype=np.int32)
    s.over_fill = bool(r['over_fill']); s.just_unascend = bool(r['just_unascend'])
    return s

def policy_value(s):
    x = enc.encode(s, s.to_play)[None]
    out = sess.run(None, {'input': x})
    v = float(out[0].reshape(-1)[0]); logits = out[1].reshape(-1).astype(np.float64)
    legal = [m.r*9+m.c for m in s.legal_moves()]
    z = np.full(81, -1e18); z[legal] = logits[legal]
    p = np.exp(z - z.max()); p /= p.sum()
    return p, v, legal

for path, name in [('data/blight1.jsonl','blight'), ('data/default2.jsonl','default')]:
    top1=[]; ent=[]; agree=0; n=0
    for line in open(path):
        r = json.loads(line)
        s = state_from(r)
        if not s.legal_moves(): continue
        p, v, legal = policy_value(s)
        top1.append(float(p.max()))
        ent.append(float(-(p[p>1e-12]*np.log(p[p>1e-12])).sum()))
        if n < 20:  # 1-ply 价值最优（较贵，只做 20 个）
            best, bv = None, -1e9
            for m in s.legal_moves():
                ns = eng.step(s, m)
                x = enc.encode(ns, ns.to_play)[None]
                nv = -float(sess.run(None, {'input': x})[0].reshape(-1)[0])
                if nv > bv: bv, best = nv, m.r*9+m.c
            if best == int(np.argmax(p)): agree += 1
        n += 1
        if n >= N: break
    print(f"{name}: n={n} top1均值={np.mean(top1):.3f} 熵均值={np.mean(ent):.2f} 与1-ply最优一致={agree}/{min(n,20)}")
