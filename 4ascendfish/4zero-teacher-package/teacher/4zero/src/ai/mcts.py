# ──────────────────────────────────────────────────────────────────────────────
# File: src/ai/mcts.py
# MCTS with **explicit chance nodes** (MCMS) for 4ascend-zero.
#
# 为什么重写
# ----------
# 旧实现把 `engine.step` 当成确定转移，但它在两处是随机的：
#   1. 每手之后刷草（`_refresh_plants`：weighted_candidates + random.shuffle）；
#   2. 结算时反击权重（`random.randint`）。
# 于是同一条边在不同 simulation 里会到达不同状态，而节点的先验/子树只在**第一个**
# 采样到的状态上建立过 —— 这就是结构性偏差。
#
# 新结构
# ------
#   Node(决策) --action a--> Chance(机会) --outcome o--> Node(决策) ...
#
# * `Node`：轮到 `to_play` 走；存 state / prior / 展开后的 children。
# * `Chance`：一个动作的**结果分布**；MCMS 采样，样本数随访问量渐进加宽
#   （`k_max = clamp(ceil(c * sqrt(N)), 1, k_cap)`），价值 = 样本均值（无符号翻转）。
# * `Outcome`：一次采样得到的确定后继（含 state）。子决策节点惰性展开。
#
# 价值约定（**全程只有一条**）
# ---------------------------
# * `_value(state)` 返回"轮到 `state.to_play` 的这一方"的期望收益。
# * 存进 Chance/Outcome 的 W/Q 一律是"**做出这一手的那一方**"的收益，
#   也就是父决策节点 `to_play` 的视角。
# * 回溯：叶子值 v（叶子 to_play 视角）→ 边值 = -v（父视角）→ 写到 Chance/Outcome
#   → 再往上一层继续翻符号。
#
# 其它修正
# --------
# * Dirichlet 噪声只加在**合法**动作上、且只在 `add_noise=True`（自对弈）时加；
#   正规化后 prior 之和仍为 1。
# * `reuse_tree` 复用前先校验状态（随机刷草会让"同一个动作"的后继不一致），
#   校验不过就重建根。
# * 终局价值用统一的 `_winner()`，不再各处重复推导。
# ──────────────────────────────────────────────────────────────────────────────
from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

try:  # torch 只在训练/自对弈环境里需要；推理适配器（ONNX/OpenVINO）不需要
    import torch
except Exception:  # pragma: no cover
    torch = None

from ..core.types import Player, Move
from ..core.engine import Engine
from ..core.state import GameState
from ..core.encoding import AlphaZeroStateEncoder


def _other(p: Player) -> Player:
    return Player.WHITE if p is Player.BLACK else Player.BLACK


# ──────────────────────────────────────────────────────────────────────────────
# Tree
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class Node:
    """决策节点：状态 + 轮到谁走。"""

    state: GameState
    to_play: Optional[Player] = None
    prior: float = 1.0
    N: int = 0
    W: float = 0.0
    Q: float = 0.0
    children: Dict[int, "Chance"] = field(default_factory=dict)
    expanded: bool = False

    def __post_init__(self):
        self.to_play = self.state.to_play


@dataclass
class Outcome:
    """一次 MCMS 采样得到的具体后继状态。"""

    state: GameState
    N: int = 0
    W: float = 0.0
    Q: float = 0.0
    child: Optional[Node] = None


@dataclass
class Chance:
    """一个动作的结果分布（刷草 / 结算随机）。"""

    prior: float
    outcomes: List[Outcome] = field(default_factory=list)
    N: int = 0
    W: float = 0.0
    Q: float = 0.0


# ──────────────────────────────────────────────────────────────────────────────
# MCTS
# ──────────────────────────────────────────────────────────────────────────────
class MCTS:
    def __init__(self,
                 model,
                 encoder: AlphaZeroStateEncoder,
                 engine: Engine,
                 board_size: int = 9,
                 c_puct: float = 2.0,
                 sims: int = 400,
                 dirichlet_alpha: float = 0.35,
                 dirichlet_eps: float = 0.25,
                 device: str = "cpu",
                 reuse_tree: bool = False,
                 # --- chance-node / MCMS ---
                 chance_c: float = 1.0,
                 chance_cap: int = 8):
        """
        parameters:
          - chance_c: MCMS 渐进加宽系数，k_max = ceil(chance_c * sqrt(N))
          - chance_cap: 每个动作最多保留多少个结果样本
        """
        self.model = model
        if hasattr(self.model, "eval"):
            self.model.eval()
        self.encoder = encoder
        self.engine = engine
        self.size = board_size
        self.c_puct = c_puct
        self.sims = sims
        self.dir_alpha = dirichlet_alpha
        self.dir_eps = dirichlet_eps
        self.device = device
        self.reuse_tree = reuse_tree
        self.chance_c = chance_c
        self.chance_cap = max(1, chance_cap)
        self.last_stats = {}

    # ------------------------------------------------------------------
    def _legal_mask(self, s: GameState) -> np.ndarray:
        return (s.board.grid == 0).astype(np.float32).reshape(-1)

    def _infer(self, x: np.ndarray) -> Tuple[np.ndarray, float]:
        """推理适配层：`model.infer_np` 优先（ONNX/OpenVINO 适配器），否则走 torch。"""
        infer = getattr(self.model, "infer_np", None)
        if infer is not None:
            p_logits, v = infer(x[None])  # [1,C,H,W] -> (logits[81], value[1])
            p_logits = np.asarray(p_logits).reshape(-1)
            v = float(np.asarray(v).reshape(-1)[0])
        else:
            if torch is None:
                raise RuntimeError("模型没有 infer_np，且当前环境没有 torch")
            with torch.inference_mode():
                t = torch.from_numpy(x).unsqueeze(0).to(self.device)
                p_logits_t, v_t = self.model(t)
                # 这里必须是**原始 logits**：下面统一做一次 softmax。
                # 早先这里先 softmax 了一次、再 softmax 一次，等于把先验压得接近均匀。
                p_logits = p_logits_t.cpu().numpy()[0]
                v = float(v_t.item())
        p = np.exp(p_logits - p_logits.max())
        p /= p.sum()
        return p, v

    def _policy_value(self, s: GameState, as_player: Player) -> Tuple[np.ndarray, float]:
        x = self.encoder.encode(s, as_player=as_player)
        p, v = self._infer(x)
        mask = self._legal_mask(s)
        p = p * mask
        ssum = p.sum()
        if ssum <= 1e-8:
            n = mask.sum()
            if n > 0:
                p = mask / n
        else:
            p /= ssum
        return p, v

    # ------------------------------------------------------------------
    def _expand(self, node: Node) -> float:
        """展开决策节点，返回该节点 to_play 视角的价值。"""
        p, v = self._policy_value(node.state, as_player=node.to_play)
        mask = self._legal_mask(node.state)
        for a in np.where(mask > 0.0)[0]:
            node.children[int(a)] = Chance(prior=float(p[a]))
        node.expanded = True
        return v

    def _k_max(self, n: int) -> int:
        return int(min(self.chance_cap, max(1, math.ceil(self.chance_c * math.sqrt(max(1, n))))))

    def _sample_outcome(self, node: Node, action: int, chance: Chance) -> Outcome:
        r, c = divmod(action, self.size)
        st = self.engine.step(node.state, Move(r, c))
        o = Outcome(state=st)
        chance.outcomes.append(o)
        return o

    def _pick_outcome(self, node: Node, action: int, chance: Chance) -> Outcome:
        """MCMS：样本不足就再采一个；够了就选访问最少的结果（保证期望估到）。"""
        if len(chance.outcomes) < self._k_max(chance.N):
            return self._sample_outcome(node, action, chance)
        return min(chance.outcomes, key=lambda o: (o.N, random.random()))

    # ------------------------------------------------------------------
    def _winner(self, s: GameState) -> Optional[Player]:
        """返回胜者；平局返回 None。"""
        if (s.hp <= 0).any():
            loser = Player.BLACK if s.hp[0] <= 0 else Player.WHITE
            return _other(loser)
        if s.hp[0] != s.hp[1]:
            return Player.BLACK if s.hp[0] > s.hp[1] else Player.WHITE
        black_cnt = int(np.sum(s.board.grid == 1))
        white_cnt = int(np.sum(s.board.grid == 2))
        if black_cnt != white_cnt:
            return Player.BLACK if black_cnt > white_cnt else Player.WHITE
        return None

    def _terminal_value(self, node: Node) -> float:
        w = self._winner(node.state)
        if w is None:
            return 0.0
        return 1.0 if w is node.to_play else -1.0

    # ------------------------------------------------------------------
    def _select(self, node: Node) -> Tuple[int, Chance]:
        sum_n = max(1, sum(ch.N for ch in node.children.values()))
        sqrt_n = math.sqrt(sum_n)
        best = (-1e18, -1, None)
        for a, ch in node.children.items():
            u = self.c_puct * ch.prior * sqrt_n / (1 + ch.N)
            score = ch.Q + u
            if score > best[0]:
                best = (score, a, ch)
        return int(best[1]), best[2]

    # ------------------------------------------------------------------
    def _simulate(self, root: Node) -> None:
        node = root
        path: List[Tuple[Node, int, Chance, Outcome]] = []
        while True:
            if node.state.is_terminal():
                v = self._terminal_value(node)
                break
            if not node.expanded:
                v = self._expand(node)
                break
            a, chance = self._select(node)
            outcome = self._pick_outcome(node, a, chance)
            path.append((node, a, chance, outcome))
            if outcome.child is None:
                outcome.child = Node(state=outcome.state)
            node = outcome.child

        # 回溯：v 是当前节点 to_play 视角；边的价值属于父节点那一方，所以先翻一次。
        for _node, _a, chance, outcome in reversed(path):
            v = -v
            outcome.N += 1
            outcome.W += v
            outcome.Q = outcome.W / outcome.N
            chance.N += 1
            chance.W += v
            chance.Q = chance.W / chance.N

    # ------------------------------------------------------------------
    def _apply_root_noise(self, root: Node) -> None:
        """只在合法动作上加 Dirichlet 噪声，且保持 prior 归一化。"""
        acts = list(root.children.keys())
        if not acts or self.dir_eps <= 0.0:
            return
        noise = np.random.dirichlet([self.dir_alpha] * len(acts))
        for k, a in enumerate(acts):
            ch = root.children[a]
            ch.prior = (1.0 - self.dir_eps) * ch.prior + self.dir_eps * float(noise[k])

    def _same_state(self, a: GameState, b: GameState) -> bool:
        return (np.array_equal(a.board.grid, b.board.grid)
                and np.array_equal(a.board.plants, b.board.plants)
                and np.array_equal(a.hp, b.hp)
                and a.to_play is b.to_play
                and int(a.grow_count) == int(b.grow_count)
                and int(a.unascend_charge) == int(b.unascend_charge)
                and a.phase is b.phase)

    # ------------------------------------------------------------------
    def run(self, root_state: GameState,
            prev_root: Optional[Node] = None,
            last_action: Optional[int] = None,
            turn_related_sim: Optional[int] = -1,
            turn_related_sim_coef: Optional[int] = 0.5,
            add_noise: bool = False,
            time_ms: float = 0.0) -> Tuple[np.ndarray, Node]:
        # --- 根节点 ---
        root = None
        if self.reuse_tree and prev_root is not None and last_action is not None:
            ch = prev_root.children.get(last_action)
            if ch is not None:
                for o in ch.outcomes:
                    if self._same_state(o.state, root_state):
                        root = o.child if o.child is not None else Node(state=root_state)
                        break
        if root is None:
            root = Node(state=root_state)
        if not root.expanded:
            self._expand(root)

        if add_noise:
            self._apply_root_noise(root)

        num_sim = self.sims
        if turn_related_sim and turn_related_sim > 0 and root_state.turn >= turn_related_sim:
            num_sim = int(self.sims * turn_related_sim_coef)

        if time_ms and time_ms > 0:
            # 等时对局：跑到时间用完为止。每 8 次测一次时钟（单次 sim ≈ 1ms，
            # 时钟调用本身 ~50ns，但没必要每次都测）。
            t0 = time.perf_counter()
            done = 0
            for _ in range(num_sim):
                self._simulate(root)
                done += 1
                if (done & 7) == 0 and (time.perf_counter() - t0) * 1000.0 >= time_ms:
                    break
            num_sim = done
        else:
            for _ in range(num_sim):
                self._simulate(root)

        pi = np.zeros(self.size * self.size, dtype=np.float32)
        for a, ch in root.children.items():
            pi[a] = ch.N
        if pi.sum() > 0:
            pi = pi / pi.sum()
        self.last_stats = {
            'sims': num_sim,
            'root_children': len(root.children),
            'mean_chance_samples': float(np.mean([len(ch.outcomes) for ch in root.children.values()])) if root.children else 0.0,
        }
        return pi, root
