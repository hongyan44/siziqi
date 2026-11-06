"""Incremental (fast) version of AlphaZeroStateEncoder.

The 25-plane encoding is recomputed from scratch once per position in the
reference implementation.  Profiling shows ~82% of that time is spent in
`_ge4_axis_sum_plane`, which does 16 python double-loops (8 directions x 2
players) over the 9x9 board for every single position.

This encoder keeps the planes in a persistent buffer and patches them:

  * stone planes      : only the cells whose colour changed since the previous
                        position (a move flips 1 cell; an ascend removes a
                        whole chain).
  * plants / mask / hp: cheap 81-element copies (O(81) is below measurement
                        noise, the savings come from ge4).
  * ge4 planes        : maintained through per-player, per-direction run
                        length tables.  Placing/removing a stone only changes
                        the run lengths upstream of that cell in each of the 8
                        directions, so a flip costs O(8 * 8) integer ops and
                        only the touched cells have their score recomputed.
  * history planes    : a rolling (14, 9, 9) block, shifted by two planes per
                        move instead of rebuilding 14 boolean grids.

The fast path is only taken when the new state really is the successor of the
previously encoded state; otherwise a full rebuild is done, so results are
always identical to the reference encoder.
"""
from __future__ import annotations

import numpy as np

from .encoding import AlphaZeroStateEncoder
from .state import GameState
from .types import Player, Phase

# direction table: 0=up 1=down 2=left 3=right 4=up-left 5=down-right 6=up-right 7=down-left
_DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]
# axis = (positive dir index, negative dir index);  v, h, d45, d135
_AXES = [(0, 1), (2, 3), (6, 7), (4, 5)]
_INV = [1, 0, 3, 2, 5, 4, 7, 6]


def _build_tables(H: int = 9, W: int = 9):
    n = H * W
    nxt = []  # nxt[d][m] = index of m + dir_d, or -1
    prv = []  # prv[d][m] = index of m - dir_d, or -1
    for dr, dc in _DIRS:
        a = [-1] * n
        b = [-1] * n
        for r in range(H):
            for c in range(W):
                m = r * W + c
                nr, nc = r + dr, c + dc
                if 0 <= nr < H and 0 <= nc < W:
                    a[m] = nr * W + nc
                nr, nc = r - dr, c - dc
                if 0 <= nr < H and 0 <= nc < W:
                    b[m] = nr * W + nc
        nxt.append(a)
        prv.append(b)
    return nxt, prv


class FastEncoder:
    """Drop-in replacement for AlphaZeroStateEncoder (same output)."""

    def __init__(self, last_k: int = 8):
        self.last_k = last_k
        self.H = 9
        self.W = 9
        self.buf = np.zeros((25, self.H, self.W), dtype=np.float32)
        self._ref = AlphaZeroStateEncoder(last_k)
        self._nxt, self._prv = _build_tables(self.H, self.W)
        # absolute stone planes (black, white), patched incrementally
        self._abs = np.zeros((2, self.H, self.W), dtype=np.float32)
        # ge4 per player, int16 (scores are 0..13)
        self._ge4 = np.zeros((2, self.H, self.W), dtype=np.int16)
        # run[d] per player, flat python lists for fast scalar access
        self._run = [[[0] * 81 for _ in range(8)] for _ in range(2)]
        self._pstone = [[0] * 81 for _ in range(2)]
        self._grid = [[0] * 81 for _ in range(2)]  # position memory for rebuilds
        # rolling history block: hist[0:2] = most recent past grid, hist[2:14] older
        self._hist = np.zeros((2 * (last_k - 1), self.H, self.W), dtype=np.float32)
        self._prev = None
        self._turn = -1
        self._as_player = None

    # ------------------------------------------------------------------ utils
    def _rebuild(self, s: GameState, as_player: Player) -> None:
        full = self._ref.encode(s, as_player)
        np.copyto(self.buf, full)
        grid = s.board.grid
        for p in (1, 2):
            flat = (grid == p).astype(np.int16).reshape(-1).tolist()
            self._pstone[p - 1] = flat
            for d in range(8):
                rd = self._run[p - 1][d]
                nxt = self._nxt[d]
                for m in range(81):
                    nm = nxt[m]
                    rd[m] = (1 + rd[nm]) if (nm >= 0 and flat[nm]) else 0
            scores = self._ge4_of_player(p)
            self._ge4[p - 1] = np.asarray(scores, dtype=np.int16).reshape(9, 9)
            self._abs[p - 1] = (grid == p)
        self._hist[:] = 0.0
        n = min(s.turn, self.last_k - 1)
        for j in range(1, n + 1):
            past = s.last_moves[-j]
            mv = s.turn - j
            p = 1 if mv % 2 == 0 else 2
            self._hist[2 * (j - 1)] = (past == p)
            self._hist[2 * (j - 1) + 1] = (past == (2 if p == 1 else 1))
        self._prev = self._snapshot(s)
        self._turn = s.turn
        self._as_player = as_player

    def _ge4_of_player(self, p: int) -> list:
        rp = self._run[p - 1]
        flat = self._pstone[p - 1]
        out = [0] * 81
        for m in range(81):
            if flat[m]:
                continue
            tot = 0
            anyv = False
            for a, b in _AXES:
                nb = rp[a][m] + rp[b][m]
                if nb >= 3:
                    tot += nb
                    anyv = True
            out[m] = tot + 1 if anyv else tot
        return out

    @staticmethod
    def _snapshot(s: GameState) -> dict:
        return {
            "grid": s.board.grid.copy(),
            "plants": s.board.plants.copy(),
            "hp": (int(s.hp[0]), int(s.hp[1])),
            "phase": s.phase,
            "grow": int(s.grow_count),
            "mask": None if s.attack_chain_mask is None else s.attack_chain_mask.copy(),
            "key": id(s) if False else None,
        }

    def _is_successor(self, s: GameState) -> bool:
        p = self._prev
        if p is None or s.turn != self._turn + 1:
            return False
        lm = s.last_moves
        if len(lm) != s.turn or lm is None or len(lm) == 0:
            return False
        prev = lm[-1]
        return prev is not None and np.array_equal(prev, p["grid"])

    # ------------------------------------------------------------------- patch
    def _flip(self, m: int, p: int, present: bool) -> set:
        """Update run tables for player p after the stone at flat index m changes."""
        rp = self._run[p - 1]
        st = self._pstone[p - 1]
        st[m] = 1 if present else 0
        touched = {m}
        for d in range(8):
            rd = rp[d]
            nxt = self._nxt[d]
            prv = self._prv[d]
            x = prv[m]
            while x >= 0:
                nx = nxt[x]
                new = (1 + rd[nx]) if (nx >= 0 and st[nx]) else 0
                if rd[x] == new:
                    break
                rd[x] = new
                touched.add(x)
                x = prv[x]
        # score only changes at cells whose run value changed (and at m itself,
        # whose own score is forced to 0 for player p when occupied)
        for x in touched:
            tot = 0
            anyv = False
            for a, b in _AXES:
                nb = rp[a][x] + rp[b][x]
                if nb >= 3:
                    tot += nb
                    anyv = True
            self._ge4[p - 1].reshape(-1)[x] = 0 if st[x] else (tot + 1 if anyv else tot)
        return touched

    # ---------------------------------------------------------------- encoding
    def encode(self, s: GameState, as_player: Player) -> np.ndarray:
        if not self._is_successor(s):
            self._rebuild(s, as_player)
            return self.buf

        prev = self._prev
        grid = s.board.grid
        buf = self.buf

        # ---- stones: absolute planes patched at changed cells -----------------
        changed = np.nonzero(grid != prev["grid"])
        if len(changed[0]):
            vals = grid[changed]
            self._abs[0][changed] = (vals == 1)
            self._abs[1][changed] = (vals == 2)
            old = prev["grid"][changed]
            for k in range(len(changed[0])):
                m = int(changed[0][k]) * 9 + int(changed[1][k])
                o, nv = int(old[k]), int(vals[k])
                if o:
                    self._flip(m, o, False)
                if nv:
                    self._flip(m, nv, True)

        if as_player is Player.BLACK:
            buf[0] = self._abs[0]
            buf[1] = self._abs[1]
            buf[4].fill(s.hp[0])
            buf[5].fill(s.hp[1])
            me_id, opp_id = 1, 2
        else:
            buf[0] = self._abs[1]
            buf[1] = self._abs[0]
            buf[4].fill(s.hp[1])
            buf[5].fill(s.hp[0])
            me_id, opp_id = 2, 1

        # ---- mask / plants / scalars -----------------------------------------
        if s.attack_chain_mask is None:
            buf[2].fill(0.0)
        else:
            np.copyto(buf[2], s.attack_chain_mask, casting="unsafe")
        np.copyto(buf[3], s.board.plants, casting="unsafe")
        buf[6].fill(1.0 if s.phase is Phase.ATTACK_DEFENSE else 0.0)
        buf[7].fill(1.0 if s.to_play is Player.BLACK else 0.0)
        buf[8].fill(1.0 if s.phase is Phase.ATTACK_DEFENSE else float(s.grow_count % 2))

        # ---- ge4 --------------------------------------------------------------
        buf[9] = self._ge4[me_id - 1]
        buf[10] = self._ge4[opp_id - 1]

        # ---- history: shift by two planes, insert the just-played grid --------
        hist = self._hist
        hist[2:] = hist[:-2]
        t = s.turn
        if t >= 1:
            g_prev = prev["grid"]
            mover = 1 if (t - 1) % 2 == 0 else 2
            hist[0] = (g_prev == mover)
            hist[1] = (g_prev == (2 if mover == 1 else 1))
        else:
            hist[0].fill(0.0)
            hist[1].fill(0.0)
        n = min(t, self.last_k - 1)
        buf[11:11 + 2 * n] = hist[:2 * n]

        self._prev = self._snapshot(s)
        self._turn = s.turn
        self._as_player = as_player
        return buf

    # ------------------------------------------------------------- batch helper
    def encode_into(self, s: GameState, as_player: Player, out: np.ndarray, idx: int) -> np.ndarray:
        np.copyto(out[idx], self.encode(s, as_player))
        return out[idx]

    @property
    def num_planes(self) -> int:
        return 25
