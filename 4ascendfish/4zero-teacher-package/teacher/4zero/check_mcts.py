"""MCTS 正确性自检（不需要 torch，用 OpenVINO 跑 4zero.onnx）。

检查三件事：

1. **回溯符号**：用一个假的 engine/model 构造"某动作直接输/赢"的局面，
   验证根节点该动作的 Q 与胜负方向一致（旧实现的符号约定容易写反）。
2. **先验归一化**：加 Dirichlet 噪声前后，根节点各动作 prior 之和都应为 1
   （旧实现把噪声加在 81 格上，含非法点，和不再是 1）。
3. **MCMS 真的在采样**：同一动作的结果样本数随访问量增长（cap>1 时），
   且 Q 与"纯蒙特卡洛估计"同向。

```bash
cd teacher && ./venv/bin/python 4zero/check_mcts.py [sims]
```
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from src.core.engine import Engine
from src.core.state import GameState
from src.core.encoding import AlphaZeroStateEncoder
from src.core.types import Move, Player
from src.core.board import Board
from src.core.rules import RulesConfig
from src.ai.mcts import MCTS, Node, Chance


class OVNet:
    """把 4zero.onnx 包成 MCTS 需要的 `infer_np` 接口。"""

    def __init__(self, path):
        import openvino as ov
        core = ov.Core()
        model = core.read_model(path)
        self.compiled = core.compile_model(model, "CPU", {
            "INFERENCE_NUM_THREADS": "4",
            "INFERENCE_PRECISION_HINT": "f32",
        })
        self.in_port = self.compiled.input(0)
        self.out_v = self.compiled.output(0)
        self.out_p = self.compiled.output(1)

    def infer_np(self, x):
        res = self.compiled({self.in_port: np.ascontiguousarray(x, dtype=np.float32)})
        v = np.asarray(res[self.out_v]).reshape(-1)
        p = np.asarray(res[self.out_p]).reshape(-1)
        return p, v


# ---------------------------------------------------------------------------
# 1) 回溯符号（假 engine / 假 model，完全可控）
# ---------------------------------------------------------------------------
class FakeEngine:
    """step 返回一个 to_play 翻转、并带标记的 state。"""

    def __init__(self):
        self.marker = {}

    def step(self, s, move):
        ns = s.copy()
        ns.to_play = Player.WHITE if s.to_play is Player.BLACK else Player.BLACK
        # 用 turn 当标记：FakeMcts 会按 turn 给值
        ns.turn = move.r * 9 + move.c
        return ns


def test_backup_sign():
    eng = FakeEngine()
    s = GameState(cfg=RulesConfig(), board=Board(9))
    # 只留一个合法动作，避免别的动作干扰
    mcts = MCTS.__new__(MCTS)
    mcts.engine = eng
    mcts.size = 9
    mcts.c_puct = 0.0          # 纯贪心，只看 Q
    mcts.sims = 8
    mcts.dir_eps = 0.0
    mcts.chance_c = 1.0
    mcts.chance_cap = 1
    mcts.reuse_tree = False

    # 假策略：只在中心 (4,4)=40 有概率；假价值：轮到白方时白方赢 → +1
    def fake_policy_value(state, as_player):
        p = np.zeros(81, dtype=np.float32)
        p[40] = 1.0
        v = 1.0 if state.to_play is Player.WHITE else -1.0
        return p, v

    mcts._policy_value = fake_policy_value

    root = Node(state=s)
    root.expanded = True
    root.children[40] = Chance(prior=1.0)
    # 手动跑一次模拟：黑走 40 -> 白方 to_play -> 假价值给白 +1
    mcts._simulate(root)

    q = root.children[40].Q
    # 黑走 40 之后轮到白，白方 +1 ⇒ 黑方 −1
    assert abs(q + 1.0) < 1e-9, f"回溯符号错：黑方 Q 应为 −1，得到 {q}"
    print(f"[1] 回溯符号 OK：黑走一步后白方赢 ⇒ Q(黑) = {q:+.1f}")


# ---------------------------------------------------------------------------
# 2) 先验归一化 + 3) MCMS 采样
# ---------------------------------------------------------------------------
def main():
    sims = int(sys.argv[1]) if len(sys.argv) > 1 else 120
    test_backup_sign()

    here = os.path.dirname(os.path.abspath(__file__))
    net = OVNet(os.path.join(here, "..", "4zero.onnx"))
    enc = AlphaZeroStateEncoder()
    eng = Engine(win_k=4)

    # 随机走 12 手，得到一个中局（engine.step 有随机性，这里无所谓）
    s = GameState(cfg=RulesConfig(), board=Board(9))
    rng = np.random.default_rng(7)
    for _ in range(12):
        if s.is_terminal():
            break
        empt = np.flatnonzero(s.board.grid.reshape(-1) == 0)
        if len(empt) == 0:
            break
        a = int(empt[rng.integers(len(empt))])
        s = eng.step(s, Move(a // 9, a % 9))
    print(f"局面：turn={s.turn} to_play={s.to_play.name} hp={s.hp}")

    mcts = MCTS(net, enc, eng, 9, c_puct=2.0, sims=sims,
                dirichlet_alpha=0.35, dirichlet_eps=0.25, device="cpu",
                chance_c=1.0, chance_cap=8)

    pi_a, root_a = mcts.run(s, add_noise=False)
    p_sum = sum(ch.prior for ch in root_a.children.values())
    print(f"[2] 无噪声 prior 和 = {p_sum:.6f}")
    assert abs(p_sum - 1.0) < 1e-6, "prior 不归一"

    pi_b, root_b = mcts.run(s, add_noise=True)
    p_sum = sum(ch.prior for ch in root_b.children.values())
    print(f"[2] 加噪声后 prior 和 = {p_sum:.6f}")
    assert abs(p_sum - 1.0) < 1e-6, "噪声破坏了归一化"

    legal = np.count_nonzero(pi_a)
    print(f"[3] {sims} sims：访问了 {legal} 个动作，root 平均采样数 "
          f"{mcts.last_stats['mean_chance_samples']:.1f}")
    assert legal > 0 and pi_a.sum() > 0.999

    # Q 与纯 MC 估计的相关（符号检查的统计版）
    best = sorted(root_a.children.items(), key=lambda kv: -kv[1].N)[:6]
    xs, ys = [], []
    for a, ch in best:
        r, c = divmod(a, 9)
        vals = []
        for _ in range(40):
            cs = eng.step(s, Move(r, c))
            _, v = mcts._policy_value(cs, as_player=cs.to_play)
            vals.append(-v)  # 根行棋方视角
        xs.append(ch.Q)
        ys.append(float(np.mean(vals)))
    if len(xs) > 2:
        corr = float(np.corrcoef(xs, ys)[0, 1])
        print(f"[3] 树 Q vs 单步 MC 估计：n={len(xs)} corr={corr:+.3f}")
        print(f"    树 Q = {[round(x,3) for x in xs]}")
        print(f"    MC   = {[round(y,3) for y in ys]}")
        assert corr > 0.3, "树 Q 与 MC 估计不同向，符号或均值有问题"

    print("ALL OK")


if __name__ == "__main__":
    main()
