"""4zero（ONNX + MCTS） vs v9.1（NNUE 612 + PVS）**等时**对局，并把每一手直播出去。

分工
----
* **Python 是裁判**：`Engine.step` 产出真局面、判终局、写 live.json。
* **Rust 是顾问**：`fascend/target/release/examples/arena` 常驻进程，收到完整着法表后
  重放、搜索、回一手，并**回传它自己看到的盘面**。
* 每手都拿两边的盘面做对拍：一旦规则不一致立刻报错停下，而不是悄悄下完一整局。
  这是这个脚本最重要的一个断言——它同时验证了两套规则引擎。

时间
----
双方每手同一个预算 `--time-ms`（默认 300ms）。Rust 侧是 `SearchConfig::time_ms`，
Python 侧是 `MCTS.run(time_ms=...)`。实测耗时写进 `moves[i].ms`，UI 会显示。

    teacher/venv/bin/python teacher/4zero/arena_match.py --games 6 --time-ms 300
    teacher/venv/bin/python teacher/4zero/arena_match.py --games 2 --time-ms 100 --dry
"""
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import openvino as ov

from src.ai.mcts import MCTS
from src.core.board import Board
from src.core.encoding import AlphaZeroStateEncoder
from src.core.engine import Engine
from src.core.rules import RulesConfig
from src.core.state import GameState
from src.core.types import Move, Phase, Player

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB = os.path.join(ROOT, "web")
ARENA_BIN = os.path.join(ROOT, "fascend", "target", "release", "examples", "arena")
MODEL_V91 = os.path.join(ROOT, "distill", "v9.qad.bin")
ONNX = os.path.join(ROOT, "teacher", "4zero.onnx")

STONE_CH = ".bwBWxX"
SOFT_SEEN = False
def clamp1(v: float) -> float:
    """评估一律夹在 [-1,1]：v9.1 找到必杀时 score 是 90 万级的 mate 分，
    原样除 4000 会得到 ±225，画到折线和表格里就撑爆了。"""
    return max(-1.0, min(1.0, float(v)))


SIDE_META = {
    "a": {
        "id": "4zero",
        "name": "4zero",
        "sub": "ONNX ResNet · MCTS",
        "detail": "根节点 Q + 机会节点树搜索",
        "accent": "#c8792c",
    },
    "b": {
        "id": "v9.1",
        "name": "v9.1",
        "sub": "NNUE 612 · PVS",
        "detail": "等时 alpha-beta",
        "accent": "#5f9ea0",
    },
}


class BlightEngine(Engine):
    """灾荒：永不刷草（与 fascend 的 `Mode::Blight` 一致）。"""

    def _refresh_plants(self, *a, **k):
        return None


class OVModel:
    """把 OpenVINO compiled_model 包成 MCTS 要的 `infer_np` 接口。"""

    def __init__(self, path: str, threads: int = 5):
        core = ov.Core()
        model = core.read_model(path)
        self.compiled = core.compile_model(
            model,
            "CPU",
            {"INFERENCE_NUM_THREADS": threads, "INFERENCE_PRECISION_HINT": "f32"},
        )
        self.port_in = self.compiled.input(0)
        self.port_v = self.compiled.output(0)  # 与 gen_data_ov.py 一致：out(0)=value
        self.port_p = self.compiled.output(1)

    def infer_np(self, x: np.ndarray) -> Tuple[np.ndarray, float]:
        res = self.compiled({self.port_in: np.ascontiguousarray(x, dtype=np.float32)})
        v = float(np.asarray(res[self.port_v]).reshape(-1)[0])
        logits = np.asarray(res[self.port_p]).reshape(-1)
        return logits, v


class Arena:
    """fascend 常驻搜索进程。"""

    def __init__(self, model: str):
        if not os.path.exists(ARENA_BIN):
            raise SystemExit(
                f"找不到 {ARENA_BIN}\n先构建：cd fascend && cargo build --release --example arena"
            )
        self.p = subprocess.Popen(
            [ARENA_BIN, model],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None,
            text=True,
            bufsize=1,
        )
        hello = self.cmd({"t": "ping"})
        if hello.get("t") != "ok":
            raise SystemExit(f"arena 启动失败: {hello}")
        self.info = hello

    def cmd(self, obj: dict) -> dict:
        assert self.p.stdin is not None and self.p.stdout is not None
        self.p.stdin.write(json.dumps(obj) + "\n")
        self.p.stdin.flush()
        line = self.p.stdout.readline()
        if not line:
            raise SystemExit("arena 进程意外退出（stdout 关闭）")
        return json.loads(line)

    def move(self, moves: List[int], time_ms: int, gid: int) -> dict:
        return self.cmd({"t": "move", "id": gid, "moves": moves, "time_ms": time_ms, "depth": 0})

    def close(self) -> None:
        try:
            self.cmd({"t": "quit"})
        except BaseException:
            pass
        try:
            self.p.wait(timeout=5)
        except Exception:
            self.p.kill()


# ──────────────────────────────────────────────────────────────────────
# 盘面 / 规则对拍
# ──────────────────────────────────────────────────────────────────────
def cells_str(s: GameState) -> str:
    """Python 引擎视角的 81 格。

    注意攻防阶段两套引擎的**表示不同、语义相同**：
      * fascend：链上四子变成 `Stone::*Ascend`，仍留在棋盘上；
      * Python 移植版：把它们从 grid 里**删掉**，另存 `attack_chain_mask`。
    所以这里必须用 mask + 攻方颜色补出 `B`/`W`，否则会误判成"盘面不一致"。
    攻方 = 当前行棋方（守方）的对手。
    """
    g = s.board.grid
    mask = s.attack_chain_mask
    atk = None
    if mask is not None and bool(np.any(mask)):
        atk = "B" if s.to_play is Player.WHITE else "W"  # 守方是 to_play
    out = []
    for r in range(9):
        for c in range(9):
            if atk is not None and mask[r, c]:
                out.append(atk)
            else:
                out.append(STONE_CH[int(g[r, c])])
    return "".join(out)


def _owner(ch: str) -> str:
    if ch in ". xX":
        return "."
    return "b" if ch in "bBx" else "w"


def diff_state(py: GameState, rs: dict) -> Tuple[List[str], List[str]]:
    """对比两套规则引擎看到的状态。返回 (硬差异, 软差异)。

    硬差异 = 会影响棋局走向的：盘面、血量、行棋方、攻防阶段、手数。
    软差异 = 只给"刷草"当闸门的计数器：grow / charge / chargef / over。

    软差异是**已知的**、无害的：灾荒模式下两边都不刷草，这几个值再也不会被读。
    （fascend 把它们整段包在 `if natural_plant` 里，Python 的 4zero 移植版无条件下调。）
    所以只在第一次遇到时提示一次，不打断对局；硬差异则立刻中止。
    """
    hard: List[str] = []
    soft: List[str] = []
    mine = cells_str(py)
    theirs = rs.get("cells", "")
    if _owner_map(mine) != _owner_map(theirs):
        mi = [i for i, c in enumerate(mine) if c != "."]
        ri = [i for i, c in enumerate(theirs) if c != "."]
        hard.append(f"盘面 mine={mine} rust={theirs}")
        hard.append(f"  mine={[(i, mine[i]) for i in mi]}")
        hard.append(f"  rust={[(i, theirs[i]) for i in ri]}")
    elif mine != theirs:
        print(f"   WARN 棋子态标记不同 mine={mine} rust={theirs}", flush=True)
    if [int(py.hp[0]), int(py.hp[1])] != [int(rs["hp"][0]), int(rs["hp"][1])]:
        hard.append(f"血量 mine={list(map(int, py.hp))} rust={rs['hp']}")
    want_turn = 0 if py.to_play is Player.BLACK else 1
    if want_turn != int(rs["turn"]):
        hard.append(f"行棋方 mine={want_turn} rust={rs['turn']}")
    if (py.phase is Phase.ATTACK_DEFENSE) != (int(rs["ascend"]) != 0):
        hard.append(f"攻防 mine={py.phase.name} rust={rs['ascend']}")
    if int(py.turn) != int(rs["turn_count"]):
        hard.append(f"手数 mine={int(py.turn)} rust={rs['turn_count']}")
    if int(py.grow_count) != int(rs["grow"]):
        soft.append(f"grow {int(py.grow_count)}!={rs['grow']}")
    if int(py.unascend_charge) != int(rs["charge"]):
        soft.append(f"charge {int(py.unascend_charge)}!={rs['charge']}")
    want_cf = [int(py.Aunascend_charge_fast[0]), int(py.Aunascend_charge_fast[1])]
    if want_cf != [int(rs["chargef"][0]), int(rs["chargef"][1])]:
        soft.append(f"chargef {want_cf}!={rs['chargef']}")
    if int(bool(py.over_fill)) != int(rs["over"]):
        soft.append(f"over {int(bool(py.over_fill))}!={rs['over']}")
    return hard, soft


def _owner_map(cells: str) -> str:
    return "".join(_owner(ch) for ch in cells)


def winner_of(s: GameState) -> Optional[int]:
    """与 fascend `ed_win` 同序：血量 → 满盘比血量/子数。0=黑 1=白 None=未完/和。"""
    hp = [int(s.hp[0]), int(s.hp[1])]
    if hp[0] > 0 and hp[1] <= 0:
        return 0
    if hp[0] <= 0 and hp[1] > 0:
        return 1
    grid = s.board.grid
    total = int((grid != 0).sum())
    if total == 81:
        if hp[0] != hp[1]:
            return 0 if hp[0] > hp[1] else 1
        b = int((grid == 1).sum())
        w = int((grid == 2).sum())
        if b != w:
            return 0 if b > w else 1
    if int(s.turn) >= int(s.cfg.max_turns):
        return None
    return None


def is_over(s: GameState) -> bool:
    if int(s.hp[0]) <= 0 or int(s.hp[1]) <= 0:
        return True
    if int((s.board.grid != 0).sum()) == 81:
        return True
    return int(s.turn) >= int(s.cfg.max_turns)


# ──────────────────────────────────────────────────────────────────────
# 直播输出
# ──────────────────────────────────────────────────────────────────────
class Live:
    def __init__(self, path: str, match: dict, dry: bool):
        self.path = path
        self.match = match
        self.dry = dry
        self.t0 = time.time()
        self.games: List[dict] = []

    def write(self, game: dict) -> None:
        payload = {"v": 1, "ts": time.time(), "match": self.match, "game": game}
        if self.dry:
            return
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, self.path)

    def log(self, msg: str) -> None:
        print(f"[{time.time()-self.t0:7.1f}s] {msg}", flush=True)


# ──────────────────────────────────────────────────────────────────────
# 一局
# ──────────────────────────────────────────────────────────────────────
def play_game(
    gid: int,
    black: str,
    opening: List[int],
    live: Live,
    eng: BlightEngine,
    mcts: MCTS,
    arena: Arena,
    args: argparse.Namespace,
    run_id: int,
) -> dict:
    global SOFT_SEEN
    cfg = RulesConfig()
    state = GameState(cfg=cfg, board=Board(9))
    moves: List[int] = []
    recs: List[dict] = []
    boards = [cells_str(state)]
    hps = [[int(state.hp[0]), int(state.hp[1])]]

    for mv in opening:
        state = eng.step(state, Move(mv // 9, mv % 9))
        moves.append(mv)
        boards.append(cells_str(state))
        hps.append([int(state.hp[0]), int(state.hp[1])])
        recs.append({"n": len(moves) - 1, "side": _side_of(state, black, after=True),
                     "mv": mv, "ms": 0, "eval": 0.0, "note": "open"})

    winner: Optional[int] = None
    think_ms: List[float] = []
    start = time.time()

    def snapshot(pending: Optional[dict] = None) -> dict:
        g = {
            "i": gid,
            "black": black,
            "to_play": 0 if state.to_play is Player.BLACK else 1,
            "plies": len(moves),
            "winner": winner,
            "hp": [int(state.hp[0]), int(state.hp[1])],
            "grow": int(state.grow_count),
            "charge": int(state.unascend_charge),
            "chargef": [int(state.Aunascend_charge_fast[0]), int(state.Aunascend_charge_fast[1])],
            "over": int(bool(state.over_fill)),
            "ascend": 1 if state.phase is Phase.ATTACK_DEFENSE else 0,
            "last": moves[-1] if moves else None,
            "plants": [[int(r) * 9 + int(c), int(state.board.plants[r, c])]
                       for r, c in np.argwhere(state.board.plants > 0)] if np.any(state.board.plants) else [],
            "boards": boards,
            "hps": hps,
            "moves": recs,
            "elapsed_ms": int((time.time() - start) * 1000),
        }
        if pending:
            g["pending"] = pending
        return g

    # 开局之后先落一次盘，让 UI 立刻有东西看
    live.write(snapshot())

    while not is_over(state) and len(moves) < 300:
        side = _side_of(state, black)
        live.write(snapshot({"side": side, "since": time.time()}))
        t0 = time.time()
        if side == "a":
            pi, root = mcts.run(state, add_noise=False, time_ms=args.time_ms)
            mv = int(np.argmax(pi))
            ch = root.children
            tot = sum(c.N for c in ch.values()) or 1
            q = sum(c.Q * c.N for c in ch.values()) / tot
            top = sorted(
                ({"mv": int(a), "p": round(float(c.N) / tot, 3)} for a, c in ch.items()),
                key=lambda d: -d["p"],
            )[:3]
            py_eval = clamp1(q if state.to_play is Player.WHITE else -q)
            stats = {"sims": int(mcts.last_stats.get("sims", 0)), "q": round(float(q), 3),
                     "top": top, "eval": round(float(py_eval), 3)}
        else:
            resp = arena.move(moves, args.time_ms, gid)
            if resp.get("t") != "move":
                raise SystemExit(f"arena 在 {len(moves)} 手返回 {resp}")
            hard, soft = diff_state(state, resp["state"])
            if hard:
                print("\n!! 规则不一致（第 %d 手，v9.1 视角）" % len(moves), flush=True)
                for b in hard:
                    print("   " + b, flush=True)
                raise SystemExit(3)
            if soft and not SOFT_SEEN:
                SOFT_SEEN = True
                print(
                    "   已知软差异（灾荒下不参与，忽略）: " + "; ".join(soft),
                    flush=True,
                )
            mv = int(resp["mv"])
            sc = int(resp["score"])
            py_eval = clamp1(sc / 4000.0 if state.to_play is Player.WHITE else -sc / 4000.0)
            stats = {"nodes": int(resp["nodes"]), "depth": int(resp["depth"]),
                     "score": sc, "eval": round(float(py_eval), 3), "mate": bool(resp.get("mate"))}
        dt = (time.time() - t0) * 1000.0
        think_ms.append(dt)

        state = eng.step(state, Move(mv // 9, mv % 9))
        moves.append(mv)
        boards.append(cells_str(state))
        hps.append([int(state.hp[0]), int(state.hp[1])])
        rec = {"n": len(moves) - 1, "side": side, "mv": mv, "ms": int(round(dt))}
        rec.update(stats)
        recs.append(rec)

        winner = winner_of(state) if is_over(state) else None
        live.write(snapshot())
        if winner is None and is_over(state):
            live.log(f"  第 {gid+1} 局：终局但无胜者（双负/满盘/超手）")
            break
        if winner is not None:
            live.log(
                f"  第 {gid+1} 局：{'黑' if winner == 0 else '白'}胜 · {len(moves)} 手 · "
                f"{(time.time()-start):.1f}s"
            )

    # 终局：只让 Rust 重放、不搜索，两边对一次胜负口径
    resp = arena.cmd({"t": "state", "id": gid, "moves": moves})
    if resp.get("t") != "state":
        raise SystemExit(f"arena state 返回 {resp}")
    rw = resp["state"].get("winner")
    if rw is not None and winner is not None and int(rw) != winner:
        print(f"!! 胜负不一致 python={winner} rust={rw}", flush=True)
        raise SystemExit(3)
    if winner is None and rw is not None:
        winner = int(rw)

    dur = int((time.time() - start) * 1000)
    live.log(
        f"  第 {gid+1} 局 / {args.games}：{len(moves)} 手  {dur/1000:.1f}s  "
        f"思考 {np.mean(think_ms):.0f}ms/手 (min {min(think_ms):.0f} max {max(think_ms):.0f})"
        if think_ms else ""
    )
    return {
        "run": run_id,
        "ts": int(time.time()),
        "meta": {
            "mode": "blight",
            "time_ms": args.time_ms,
            "games": args.games,
            "open_plies": args.open_plies,
        },
        "i": gid,
        "black": black,
        "winner": ("a" if (winner == 0) == (black == "a") else "b") if winner is not None else None,
        "winner_color": winner,
        "plies": len(moves),
        "dur_ms": dur,
        "think_ms_mean": round(float(np.mean(think_ms)), 1) if think_ms else 0.0,
        "game": snapshot(),
    }


def _side_of(state: GameState, black: str, after: bool = False) -> str:
    """当前行棋方是 a 还是 b。`after=True` 时返回**刚走完那一手**的一方。"""
    turn = state.to_play
    if after:
        turn = turn.other()
    black_to_move = turn is Player.BLACK
    return "a" if black_to_move == (black == "a") else "b"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=6)
    ap.add_argument("--time-ms", type=int, default=300)
    ap.add_argument("--open-plies", type=int, default=8)
    ap.add_argument("--first", choices=["a", "b"], default="a", help="第 0 局谁执黑，之后交替")
    ap.add_argument("--seed", type=int, default=20261031)
    ap.add_argument("--model", default=MODEL_V91)
    ap.add_argument("--onnx", default=ONNX)
    ap.add_argument("--out", default=os.path.join(WEB, "live.json"))
    ap.add_argument("--dry", action="store_true", help="不写 live.json（只跑对局）")
    args = ap.parse_args()

    os.makedirs(WEB, exist_ok=True)
    model = OVModel(args.onnx)
    eng = BlightEngine(win_k=4)
    mcts = MCTS(
        model=model,
        encoder=AlphaZeroStateEncoder(),
        engine=eng,
        board_size=9,
        c_puct=2.0,
        sims=1_000_000,  # 由时间预算真正决定
        reuse_tree=False,
        chance_c=1.0,
        chance_cap=8,
    )
    arena = Arena(args.model)
    print(f"[arena] rust: {arena.info}", flush=True)

    run_id = int(time.time())
    match = {
        "run": run_id,
        "mode": "blight",
        "time_ms": args.time_ms,
        "games": args.games,
        "open_plies": args.open_plies,
        "a": SIDE_META["a"],
        "b": SIDE_META["b"],
        "score": {"a": 0, "b": 0, "d": 0, "done": 0},
        "history": [],
    }
    live = Live(args.out, match, args.dry)

    results = []
    try:
        for gid in range(args.games):
            black = "a" if (gid % 2 == 0) == (args.first == "a") else "b"
            rng = random.Random(args.seed * 1000 + gid // 2)
            # 成对局共用同一个随机开局：先把开局走出来，记着法
            probe = GameState(cfg=RulesConfig(), board=Board(9))
            opening: List[int] = []
            for _ in range(args.open_plies):
                legal = probe.legal_moves()
                if not legal or probe.is_terminal():
                    break
                mv = legal[rng.randrange(len(legal))]
                opening.append(mv.r * 9 + mv.c)
                probe = eng.step(probe, mv)

            live.log(f"第 {gid+1}/{args.games} 局  黑={black}  开局 {len(opening)} 手")
            r = play_game(gid, black, opening, live, eng, mcts, arena, args, run_id)
            results.append(r)
            w = r["winner"]
            if w is None:
                match["score"]["d"] += 1
            else:
                match["score"][w] += 1
            match["score"]["done"] += 1
            match["history"].append(
                {"i": gid, "black": black, "winner": w, "plies": r["plies"], "dur_ms": r["dur_ms"]}
            )
            # 收尾再写一次：比分/流水进 UI
            last = r["game"]
            last["winner"] = r["winner_color"]
            live.write(last)
            with open(os.path.join(WEB, "games.jsonl"), "a", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    finally:
        arena.close()

    s = match["score"]
    n = s["a"] + s["b"] + s["d"]
    if n:
        pts = s["a"] + 0.5 * s["d"]
        print(
            f"\n4zero {s['a']} : {s['b']} v9.1   D={s['d']}   "
            f"4zero 得分率 {100*pts/n:.1f}%   每手 {args.time_ms}ms 等时",
            flush=True,
        )
        for r in results:
            print(f"  #{r['i']+1:02d} 黑={r['black']} 胜={r['winner']} {r['plies']:3d}手 {r['dur_ms']/1000:.1f}s")
        print("\n按颜色拆：", flush=True)
        for side in ("a", "b"):
            bs = [r for r in results if r["black"] == side]
            w = sum(1 for r in bs if r["winner"] == side)
            print(f"  {SIDE_META[side]['name']:>6} 执黑 {w}胜{len(bs)-w}负")
        for side in ("a", "b"):
            ws = [r for r in results if r["black"] != side]
            w = sum(1 for r in ws if r["winner"] == side)
            print(f"  {SIDE_META[side]['name']:>6} 执白 {w}胜{len(ws)-w}负")
        # 成对局：同一个开局、颜色互换的两局，胜者颜色是否相同
        same = diff = 0
        for k in range(0, len(results) - 1, 2):
            r1, r2 = results[k], results[k + 1]
            c1 = r1["winner"] == r1["black"] if r1["winner"] else None
            c2 = r2["winner"] == r2["black"] if r2["winner"] else None
            if c1 is None or c2 is None:
                continue
            if c1 == c2:
                same += 1
            else:
                diff += 1
        if same + diff:
            print(f"\n成对局：{same+diff} 对里 {same} 对两局同色获胜、{diff} 对不同色 "
                  f"→ 有效信息 {diff} 对", flush=True)


if __name__ == "__main__":
    main()
