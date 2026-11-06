# 4ASCEND-Zero 教师模型（4zero）完整组件包

打包日期：2026-10-31　来源：`/nnue-engine/teacher/4zero`

本包把教师模型**从特征编码、搜索、推理后端到数据生成**的完整链路连同
我们对它的三处改造一起打包，可直接脱离原仓库阅读和复现。

## 一、目录

```
teacher/
  4zero.onnx            3.0 MB  fp32 模型（OpenVINO / onnxruntime 通用）
  4zero_int8.onnx       0.8 MB  量化模型
  ckpt105841.pt         9.4 MB  PyTorch checkpoint（含优化器状态）
  4zero/                        源码（54 个文件）
    src/core/encoding.py          参考实现：25 平面 AlphaZero 编码（逐局面全量重算）
    src/core/encoding_fast.py     ★ 我们的增量编码（见 §2.2）
    src/core/{engine,board,rules,state,types}.py   规则内核
    src/ai/mcts.py                ★ 重写后的搜索（MCMS，见 §2.1）
    src/ai/model.py               网络结构：10 个残差块 × 64 通道，policy+value 双头
    src/ai/selfplay.py            自对弈（已改为 add_noise=True）
    gen_data_ov.py                ★ 8.5× 数据生成后端（见 §2.3）
    gen_data_batch.py             批量生成（线程池 + FastEncoder）
    gen_data_onnx.py              单条 onnxruntime 生成（对照基线）
    gen_data.py                   参考实现（逐条 torch，最慢）
    MCTS_REWRITE.md               搜索重写的完整说明 + 自检输出
    check_mcts.py                 搜索自检（符号/概率归一化/MC 一致性）
    arena_match.py                对局直播裁判（供 web 面板）
    replay_game.py / gen_fixture.py / infer.py / policy_check.py / check_semantics.py
    README.md / requirements.txt / 4ascend_rules_en.md / 安装教程.pdf
engine-side/                      ★ 我们引擎侧的对应增量（见 §3）
  fascend/src/{features,search,nnue,tt}.rs
  distill/src/bin/{gen_labels,bridge}.rs
  ITERATION_LOG.md
```

## 二、我们改动的三处（重点）

### 2.1 搜索函数：`src/core/ai/mcts.py` —— 决策节点 + 机会节点（MCMS）

**为什么**：旧实现把 `engine.step` 当确定转移，但它在两处是随机的——每手刷草
（`weighted_candidates` + `random.shuffle`）和结算时的反击权重。同一条边在不同
simulation 里到达不同状态，而先验和子树只在第一个采样到的状态上建立过，Q 值是
"混合状态"的均值，与任何一个真实局面都对不上。

**改了什么**（详见 `MCTS_REWRITE.md`）：

| # | 修正 | 旧行为 | 新行为 |
|---|---|---|---|
| 1 | 机会节点 | 随机转移当确定 | `Node --a--> Chance --o--> Node`，MCMS 渐进加宽采样，`cap=1` 可退回旧行为做 A/B |
| 2 | 根 Dirichlet 噪声 | 加在全部 81 格、且评估时也加，prior 和掉到 0.877 | 只加合法动作、逐样本归一（和恒为 1）、仅自对弈加 |
| 3 | 树复用 | 不校验状态直接用子树 | 复用前 `_same_state()` 校验，不通过就重建 |
| 4 | 终局价值 | 三处各写一遍 | 统一走 `_winner()` |

**验证**（`./venv/bin/python 4zero/check_mcts.py 100`）：

```
[1] 回溯符号 OK：黑走一步后白方赢 ⇒ Q(黑) = -1.0
[2] 无噪声 prior 和 = 1.000000；加噪声后 prior 和 = 1.000000
[3] 100 sims：访问了 4 个动作；树 Q vs 单步 MC 估计 n=6 corr=+0.818
ALL OK
```
400 sims 实测 **0.46 s**（1.15 ms/sim，含 OpenVINO fp32 推理）。

### 2.2 特征工程增量：`src/core/encoding_fast.py` —— FastEncoder

**为什么**：参考编码器每个局面都把 25 个平面全量重算，其中 **~82% 的时间**耗在
`_ge4_axis_sum_plane`（8 方向 × 2 色 的 Python 双重循环）。

**做法**：持久平面缓冲 + 增量修补

* 棋子平面：只改颜色变化的格子（一手 1 格；升仙是整条链）
* ge4 平面：按"每色每方向游程表"维护，一手只影响该格上游的游程，O(8×8) 整数运算
* 草/掩码/血量：81 元拷贝
* 历史平面：滚动 (14,9,9) 块，每手移两个平面

**正确性**：只有当新状态确实是上次编码状态的合法后继时才走快路径，否则**全量重建**，
所以输出与参考编码器**逐位相同**。

**实测**：比参考实现快约 **6×**（见 `gen_data_batch.py` 头注释）。

### 2.3 8.5× 数据生成：`gen_data_ov.py`

**后端**：OpenVINO CPU fp32（强制 f32，避免 CPU 插件掉到 bf16）。

**实测**（本机，batch 32 / 5 线程）：

| 后端 | 每局面耗时 |
|---|---|
| ONNX Runtime CPU EP | 1.75 ms/pos |
| **OpenVINO CPU fp32** | **0.21 ms/pos** |

**8.5×**；数值一致性：value max\|diff\| **2.9e-06**，policy max\|diff\| **7.4e-06**
（纯 fp32 结合律噪声，无精度损失）。

生成内容的多源标记也在这个脚本里：`src`（sym/asym）、`open_stones`（5–12 随机开局子）、
`hp0/hp1`（随机血量，20% 为 1–4 点不对称）。

## 三、引擎侧对应增量（`engine-side/`）

教师产出的是"局面 + (value, policy)"，我们把这批数据蒸馏进自己的 NNUE 引擎，
对应的代码增量在 `engine-side/`：

| 文件 | 作用 |
|---|---|
| `fascend/src/features.rs` | **612 维稀疏 + 113 维稠密**特征（基础/棋型/潜力打/致命/力量/链 六族），与引擎推理同源 |
| `fascend/src/search.rs` | depth-4 PVS 搜索；新增 `reset_for_position()`（清 TT + chance 采样计数 + history/killers），使**标签成为局面的纯函数** |
| `fascend/src/nnue.rs` | 量化推理（612→256 累加器 ⧺ 113 → 32 → 1） |
| `fascend/src/tt.rs` | 置换表 |
| `distill/src/bin/gen_labels.rs` | **GTL-lite**：用搜索的根值 + PV 回传值造标签，一次搜索放大 4.7× |
| `distill/src/bin/bridge.rs` | 教师 jsonl → 我们的特征（`.bin` 训练集），带合法性断言 |
| `ITERATION_LOG.md` | 全部 A/B 记录（标签确定化带来 +75 Elo 的关键证据） |

## 四、复现

```bash
# 1) 教师数据生成（8.5× 后端）
cd teacher && ./venv/bin/python 4zero/gen_data_ov.py \
    --onnx 4zero.onnx --games 200 --sims 400 --out data/out.jsonl

# 2) 搜索自检
./venv/bin/python 4zero/check_mcts.py 100

# 3) 桥接到我们引擎的特征（需先 cargo build --release）
./distill/target/release/bridge data/out.jsonl data/dst 10
```

## 五、未包含（可再生 / 体积原因）

| 内容 | 原因 |
|---|---|
| `4zero/data/`（6.4 GB jsonl） | 用 `gen_data_ov.py` 可再生 |
| `venv/`（约 2 GB） | 依赖见 `requirements.txt` |
| `__pycache__/`、`.git/` | 构建/版本产物 |
| `onnxruntime_profile_*.json` | 一次 profiling 的副产物 |
