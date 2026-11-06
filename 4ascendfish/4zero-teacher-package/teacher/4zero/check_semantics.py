import json, sys
import numpy as np
import onnxruntime as ort
from src.core.encoding import AlphaZeroStateEncoder
from src.core.state import GameState
from src.core.board import Board
from src.core.rules import RulesConfig
from src.core.types import Player, Phase

so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession('../4zero.onnx', so, providers=['CPUExecutionProvider'])
enc = AlphaZeroStateEncoder()

def val(grid, plants, hp, to_play, phase=Phase.NORMAL, mask=None, turn=0):
    b = Board(9); b.grid = np.array(grid, dtype=np.uint8).reshape(9,9)
    b.plants = np.array(plants, dtype=np.uint16).reshape(9,9)
    s = GameState(cfg=RulesConfig(), board=b, to_play=to_play, turn=turn, phase=phase,
                  attack_chain_mask=None if mask is None else np.array(mask, dtype=np.uint8).reshape(9,9))
    x = enc.encode(s, to_play)[None]
    return float(sess.run(None, {'input': x})[0].reshape(-1)[0])

# 位置：黑 (0,0)(1,0)(2,0)，白 (5,5)(5,6)，HP [5,4]，黑先
g = np.zeros(81, dtype=np.uint8); p = np.zeros(81, dtype=np.uint16)
for c in range(3): g[c] = 1
g[5*9+5] = 2; g[5*9+6] = 2
hp = [5, 4]
v0 = val(g, p, hp, Player.BLACK)
# 同盘，换行棋方
v1 = val(g, p, hp, Player.WHITE)
# 颜色镜像 + 换行棋方
g2 = np.where(g == 1, 2, np.where(g == 2, 1, 0)).astype(np.uint8)
v2 = val(g2, p, [4, 5], Player.WHITE)
print(f"v(black to move)      = {v0:+.4f}")
print(f"v(same board, WHITE)  = {v1:+.4f}   (相对视角应≈{-v0:+.4f}；绝对视角应≈{v0:+.4f})")
print(f"v(mirror colors, W)   = {v2:+.4f}   (相对视角应≈{v0:+.4f}；绝对视角应≈{-v0:+.4f})")

# 数据一致性
phase_cnt = {}; mask_ok = 0; mask_bad = 0; pmax = 0; lm_ok = 0; lm_bad = 0; n = 0
for line in open('data/sample_onnx.jsonl'):
    r = json.loads(line); n += 1
    phase_cnt[r['phase']] = phase_cnt.get(r['phase'], 0) + 1
    m = np.array(r['mask']).reshape(9,9)
    if r['phase'] == 'ATTACK_DEFENSE':
        (mask_ok := mask_ok + 1) if m.sum() > 0 else (mask_bad := mask_bad + 1)
    else:
        (mask_ok := mask_ok + 1) if m.sum() == 0 else (mask_bad := mask_bad + 1)
    pmax = max(pmax, max(r['plants']))
    if r['last_move'] is not None:
        rr, cc = r['last_move']
        cell = r['grid'][rr*9+cc]
        # 上一手若是成打手，棋子已被移除（0）；否则是 to_play 的对方颜色
        opp = 3 - r['to_play'] if r['to_play'] in (1,2) else None
        # to_play=0 是 BLACK, 1 是 WHITE（PY enum），映射
        tp = 1 if r['to_play'] == 0 else 2
        opp = 3 - tp
        if cell == 0 or cell == opp: lm_ok += 1
        else: lm_bad += 1
print(f"\nn={n}  phase={phase_cnt}")
print(f"mask 与 phase 一致 {mask_ok}/{n}  (bad {mask_bad})")
print(f"plants max = {pmax}  (<=2 才能无损恢复层数)")
print(f"last_move 格：空或对方色 {lm_ok}/{n}  (bad {lm_bad})")
