"""Conway's Game of Life: a minimal, dependency-free implementation."""

from __future__ import annotations

import argparse
import shutil
import sys
import time
from itertools import product


class Board:
    """A Game of Life board on a fixed-size, non-wrapping grid."""

    def __init__(self, width: int, height: int, live_cells: set[tuple[int, int]] | None = None):
        self.width = width
        self.height = height
        self.live_cells = live_cells or set()

    @classmethod
    def random(cls, width: int, height: int, density: float = 0.3, seed: int | None = None) -> "Board":
        import random

        rng = random.Random(seed)
        cells = {(x, y) for x, y in product(range(width), range(height)) if rng.random() < density}
        return cls(width, height, cells)

    @classmethod
    def from_pattern(cls, pattern: str, width: int, height: int, offset: tuple[int, int] = (0, 0)) -> "Board":
        ox, oy = offset
        cells = set()
        for y, row in enumerate(pattern.strip("\n").splitlines()):
            for x, char in enumerate(row):
                if char in "#*O":
                    cells.add((x + ox, y + oy))
        return cls(width, height, cells)

    def neighbors(self, x: int, y: int) -> int:
        count = 0
        for dx, dy in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
            if (x + dx, y + dy) in self.live_cells:
                count += 1
        return count

    def step(self) -> "Board":
        candidates = set()
        for x, y in self.live_cells:
            for dx, dy in product((-1, 0, 1), repeat=2):
                candidates.add((x + dx, y + dy))

        next_cells = set()
        for x, y in candidates:
            if not (0 <= x < self.width and 0 <= y < self.height):
                continue
            n = self.neighbors(x, y)
            alive = (x, y) in self.live_cells
            if (alive and n in (2, 3)) or (not alive and n == 3):
                next_cells.add((x, y))
        return Board(self.width, self.height, next_cells)

    def render(self, alive_char: str = "#", dead_char: str = " ") -> str:
        lines = []
        for y in range(self.height):
            lines.append("".join(alive_char if (x, y) in self.live_cells else dead_char for x in range(self.width)))
        return "\n".join(lines)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Board) and self.live_cells == other.live_cells

    def population(self) -> int:
        return len(self.live_cells)


GLIDER = """
.#.
..#
###
"""

PULSAR_BLINKER = """
###
"""


def _terminal_size(default_width: int = 60, default_height: int = 20) -> tuple[int, int]:
    size = shutil.get_terminal_size(fallback=(default_width, default_height + 2))
    return size.columns, max(size.lines - 2, 5)


def run(args: argparse.Namespace) -> None:
    width, height = args.width, args.height
    if width is None or height is None:
        term_w, term_h = _terminal_size()
        width = width or term_w
        height = height or term_h

    if args.pattern == "glider":
        board = Board.from_pattern(GLIDER, width, height, offset=(1, 1))
    elif args.pattern == "blinker":
        board = Board.from_pattern(PULSAR_BLINKER, width, height, offset=(width // 2 - 1, height // 2))
    else:
        board = Board.random(width, height, density=args.density, seed=args.seed)

    generation = 0
    try:
        while args.generations is None or generation < args.generations:
            sys.stdout.write("\x1b[H\x1b[J")  # move cursor home, clear screen
            sys.stdout.write(board.render())
            sys.stdout.write(f"\ngeneration {generation}  population {board.population()}\n")
            sys.stdout.flush()

            next_board = board.step()
            if next_board == board:
                sys.stdout.write("stabilized; stopping.\n")
                break
            board = next_board
            generation += 1
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conway's Game of Life in your terminal.")
    parser.add_argument("--width", type=int, default=None, help="board width (default: terminal width)")
    parser.add_argument("--height", type=int, default=None, help="board height (default: terminal height)")
    parser.add_argument("--density", type=float, default=0.3, help="initial live-cell density for random boards")
    parser.add_argument("--seed", type=int, default=None, help="random seed")
    parser.add_argument("--interval", type=float, default=0.1, help="seconds between generations")
    parser.add_argument("--generations", type=int, default=None, help="stop after N generations (default: run until stable or interrupted)")
    parser.add_argument("--pattern", choices=["random", "glider", "blinker"], default="random", help="initial pattern")
    return parser.parse_args(argv)


def main() -> None:
    run(parse_args())


if __name__ == "__main__":
    main()
