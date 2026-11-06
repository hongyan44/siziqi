"""把 `web/games.jsonl` 里录下来的对局按节奏重放进 `web/live.json`。

跑引擎很贵（一局 300ms/手 要几十秒），回看没必要重算。UI 只认 live.json，
所以这里只是"放录像"：

    teacher/venv/bin/python teacher/4zero/replay_game.py                # 最近一次 run 的最后一局
    teacher/venv/bin/python teacher/4zero/replay_game.py --pace 30      # 每秒 30 手
    teacher/venv/bin/python teacher/4zero/replay_game.py --list         # 看录了哪些
    teacher/venv/bin/python teacher/4zero/replay_game.py --run 1761870000 --game 7
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB = os.path.join(ROOT, "web")
sys.path.insert(0, HERE)

from arena_match import SIDE_META  # noqa: E402


def load(path: str) -> list[dict]:
    if not os.path.exists(path):
        raise SystemExit(f"没有 {path}，先跑一局 arena_match.py")
    out = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def dump(path: str, payload: dict) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def match_block(run: int, rows: list[dict], cur_i: int) -> dict:
    meta = rows[0].get("meta", {})
    m = {
        "run": run,
        "mode": meta.get("mode", "blight"),
        "time_ms": meta.get("time_ms", 0),
        "games": meta.get("games", len(rows)),
        "open_plies": meta.get("open_plies", 8),
        "a": SIDE_META["a"],
        "b": SIDE_META["b"],
        "score": {"a": 0, "b": 0, "d": 0, "done": 0},
        "history": [],
    }
    for r in rows:
        if r["i"] > cur_i:
            continue
        # 录像里的每一局都是**已经下完**的，所以当前这一局也计入战绩；
        # 直播时不计，因为那时它还没结束。
        w = r["winner"]
        if w is None:
            m["score"]["d"] += 1
        else:
            m["score"][w] += 1
        m["score"]["done"] += 1
        m["history"].append(
            {"i": r["i"], "black": r["black"], "winner": w, "plies": r["plies"], "dur_ms": r["dur_ms"]}
        )
    return m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(WEB, "games.jsonl"))
    ap.add_argument("--out", default=os.path.join(WEB, "live.json"))
    ap.add_argument("--run", type=int, default=0, help="0 = 最近一次")
    ap.add_argument("--game", type=int, default=-1, help="-1 = 该 run 的最后一局")
    ap.add_argument("--pace", type=float, default=8.0, help="每秒重放几手")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    rows = load(args.src)
    if not rows:
        raise SystemExit("games.jsonl 是空的")
    runs: dict[int, list[dict]] = {}
    for r in rows:
        runs.setdefault(r.get("run", 0), []).append(r)
    if args.list:
        for run, rs in runs.items():
            ts = rs[0].get("ts", 0)
            print(f"run {run}  {time.strftime('%m-%d %H:%M', time.localtime(ts))}  "
                  f"{len(rs)} 局  {rs[0].get('meta', {}).get('time_ms', '?')}ms/手")
            for r in rs:
                print(f"   #{r['i']+1:02d} 黑={r['black']} 胜={r['winner']} {r['plies']:3d}手 {r['dur_ms']/1000:5.1f}s")
        return

    run = args.run or max(runs)
    rs = sorted(runs[run], key=lambda r: r["i"])
    i = args.game if args.game >= 0 else rs[-1]["i"]
    r = next((x for x in rs if x["i"] == i), None)
    if r is None:
        raise SystemExit(f"run {run} 没有第 {i} 局")
    g = r["game"]
    mb = match_block(run, rs, i)
    n = len(g["boards"]) - 1

    print(f"重放 run {run} 第 {i+1} 局：黑={r['black']} {n} 手 {args.pace:g} 手/秒")
    for k in range(n + 1):
        snap = {
            "i": i,
            "black": g["black"],
            "plies": k,
            "winner": g["winner"] if k == n else None,
            "hp": g["hps"][k],
            "grow": g.get("grow", 11),
            "charge": g.get("charge", 25),
            "chargef": g.get("chargef", [9, 9]),
            "over": g.get("over", 0),
            "ascend": g.get("ascend", 0),
            "last": g["moves"][k - 1]["mv"] if k > 0 else None,
            "plants": g.get("plants", []),
            "boards": g["boards"][: k + 1],
            "hps": g["hps"][: k + 1],
            "moves": g["moves"][:k],
            "elapsed_ms": g.get("elapsed_ms", 0),
        }
        # 手数是黑白严格交替的（攻防阶段也一样），所以第 k 手之后轮到
        # 黑当且仅当 k 是偶数。
        snap["to_play"] = 0 if k % 2 == 0 else 1
        if k < n:
            nxt = g["moves"][k]["side"]
            snap["pending"] = {"side": nxt, "since": time.time()}
        dump(args.out, {"v": 1, "ts": time.time(), "match": mb, "game": snap})
        if k < n and args.pace > 0:
            time.sleep(1.0 / args.pace)
    print("完成")


if __name__ == "__main__":
    main()
