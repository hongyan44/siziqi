"""Compare 24 planes to Python and verify retained Web first-player plane 7.
Usage: 4ascend/.venv/bin/python tests/encoding_parity.py /path/to/rules_probe
"""
import sys
import subprocess
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / '4ascend'))
from src.core.board import Board
from src.core.state import GameState
from src.core.rules import RulesConfig
from src.core.types import Player, Phase
from src.core.encoding import AlphaZeroStateEncoder

# Reconstruct the shared game position independently from the C++ state dump,
# while keeping the PRE-move grids as history, exactly as Python Engine.step does.
rng = np.random.default_rng(812)
cases, expected = [], []
encoder = AlphaZeroStateEncoder()
for first in (0, 1):
    moves, history = [], []
    # Include a four-chain, a sub-four side branch, defense and >7 history.
    for a in [0, 9, 1, 10, 2, 11, 3, 12, 40, 30, 41, 31, 42, 32, 50, 33]:
        before = f'1 100 {first} 1 0 {len(moves)} ' + ' '.join(map(str, moves)) + '\n'
        dump = subprocess.check_output([sys.argv[1], 'step'], input=before.encode()).decode()
        data = np.fromstring(dump, sep=' ', dtype=int)
        grid = data[11::2].reshape(9, 9)
        history.append(np.where(grid <= 2, grid, 0).astype(np.uint8))
        moves.append(a)
        case = f'1 100 {first} 1 0 {len(moves)} ' + ' '.join(map(str, moves))
        dump = subprocess.check_output([sys.argv[1], 'step'], input=(case+'\n').encode()).decode()
        data = np.fromstring(dump, sep=' ', dtype=int)
        grid = data[11::2].reshape(9, 9)
        board = Board(9)
        board.grid[:] = np.where(grid <= 2, grid, 0)
        board.plants[:] = data[12::2].reshape(9, 9)
        state = GameState(RulesConfig(), board, to_play=Player(int(data[1])), turn=int(data[0]))
        state.phase = Phase.ATTACK_DEFENSE if data[2] == 1 else Phase.NORMAL
        state.attack_chain_mask = np.isin(grid, [3, 4]) if data[2] == 1 else None
        state.hp[:] = data[3:5]
        state.grow_count = int(data[5])
        state.last_moves = history.copy()
        cases.append(case)
        encoded = encoder.encode(state, state.to_play)
        # Plane 7 intentionally retains Web's first-player semantics.
        # All other planes are compared to the unmodified Python encoder.
        encoded[7, :, :] = float(int(data[1]) == first)
        expected.append(encoded)
output = subprocess.check_output([sys.argv[1], 'encode'], input=('\n'.join(cases)+'\n').encode()).decode()
actual = np.fromstring(output, sep=' ', dtype=np.float32).reshape(-1,25,9,9)
np.testing.assert_array_equal(actual, np.stack(expected))
print(f'PASS: {len(cases)} positions, {actual.size} values; 24 planes match Python, plane 7 matches Web first-player semantics.')
