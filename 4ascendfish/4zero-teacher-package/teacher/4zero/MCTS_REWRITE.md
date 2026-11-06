# 4zero 搜索重写：决策节点 + 机会节点（MCMS）

2026-10-31。旧实现：[`archive/mcts_old_2026-10-31.py`](../../archive/mcts_old_2026-10-31.py)；
新实现：[`src/ai/mcts.py`](src/ai/mcts.py)；自检：[`check_mcts.py`](check_mcts.py)。

## 1. 旧实现的结构性偏差

| # | 问题 | 后果 |
|---|---|---|
| 1 | **机会事件被当成确定转移**。`engine.step` 里有两处随机：每手刷草（`weighted_candidates` + `random.shuffle` + `random.randint`）和结算反击权重。搜索对同一条边反复 `step`，每次得到**不同**后继，但该边的先验和子树只在**第一次采样到的**状态上建立过。 | Q 是"混合状态"的均值，子树与先验对不上；访问计数也不对应任何一个真实局面。 |
| 2 | **根节点 Dirichlet 噪声加在全部 81 格**（含已被占的格），且**无条件**加（评估时也加）。`prior = 0.75·prior + 0.25·noise[a]`，合法点上的噪声质量只有 `n_legal/81`。 | prior 之和不再是 1。40 子时只剩 **0.877**，等于把 PUCT 的探索项整体系数砍掉 ~12%，越到中后盘探索越少——这是"结构性"的，不是随机的。 |
| 3 | **复用树不校验状态**：`root = prev_root.children[last_action]`，但同一动作的实际后继因刷草而不唯一。 | 复用到的子树可能属于另一个随机结果。 |
| 4 | 终局胜负在三处各写一遍（`_simulate` / `_backup` 附近），容易不一致。 | 维护风险。 |

> 注意：**价值符号不是 bug**。旧代码 `_backup(path, -v)` 是对的——叶子值属于叶子的 `to_play`，
> 而边上存的是"做这一手那一方"的收益，第一步正好翻一次符号。我最初也怀疑这里，
> 用假 engine/假模型写了确定性用例才确认它正确（见自检 [1]）。

## 2. 新结构

```
Node(决策) --action a--> Chance(机会) --outcome o--> Node(决策) ...
```

* **Node**：`state`、`to_play`、`prior`、`children: {action: Chance}`。
  展开时用模型算 `(p, v)`，`p` 只保留合法动作。
* **Chance**：一个动作的**结果分布**。`N/W/Q` 与顶层一致，`Q` 是样本均值。
* **Outcome**：一次 MCMS 采样得到的确定后继，自带 `state` 和子 `Node`（惰性展开）。

**MCMS（Monte-Carlo Marginal Sampling）**：
每个机会节点的样本数按 `k_max = clamp(ceil(c·√N), 1, cap)` **渐进加宽**；
样本不足就再采一个，够了就挑**访问最少**的结果下降（保证每个结果都被估到）。
`cap=1` 退化成旧行为，方便 A/B。

**价值约定（只此一条）**：所有 `v` 都是"轮到 `state.to_play` 那一方"的收益；
存进 Chance/Outcome 的 `W/Q` 是"做出该动作那一方"的收益（父节点视角）。
回溯时每上一层翻一次符号。

## 3. 其它修正

* Dirichlet 只加合法动作、逐样本归一（加噪声后 prior 和仍为 1），且只在
  `add_noise=True`（自对弈）时加；`selfplay.py` 已显式传 `add_noise=True`。
* `reuse_tree` 复用前用 `_same_state()` 校验（grid/plants/hp/to_play/grow/charge/phase），
  校验不过就重建根。
* 终局价值统一走 `_winner()`。
* `_infer()` 支持 `model.infer_np`（ONNX/OpenVINO），没有 torch 也能跑；
  torch 变成可选导入。这样数据生成链路可以直接用搜索。

## 4. 自检结果

```bash
cd teacher && ./venv/bin/python 4zero/check_mcts.py 100
```

```
[1] 回溯符号 OK：黑走一步后白方赢 ⇒ Q(黑) = -1.0
[2] 无噪声 prior 和 = 1.000000
[2] 加噪声后 prior 和 = 1.000000
[3] 100 sims：访问了 4 个动作
[3] 树 Q vs 单步 MC 估计：n=6 corr=+0.818
    树 Q = [0.778, 0.665, 0.724, 0.745, 0.0, 0.0]
    MC   = [0.853, 0.741, 0.738, 0.738, 0.683, 0.574]
ALL OK
```

400 sims 的实测：**0.46 s**（1.15 ms/sim，含 OpenVINO fp32 推理），
根节点 69 个动作里访问了 4 个（π 最大 0.855）。

## 5. 已知的调参问题（不是 bug）

400 sims 只访问 4/69 个动作，是 PUCT 在"价值头给所有动作都打高分"时的正常行为：
未访问动作的 `u = c·P·√N/(1+0)` 约 0.58，而最优动作的 Q 已到 0.86。
自对弈时有 25% 的根噪声会把它推开；**纯评估**时如果希望更宽，应该调 `c_puct`
或加 FPU reduction，而不是再往代码里塞特判。
