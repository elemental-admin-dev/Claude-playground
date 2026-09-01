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
                    cx, cy = x + ox, y + oy
                    if 0 <= cx < width and 0 <= cy < height:
                        cells.add((cx, cy))
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

BLINKER = """
###
"""

PULSAR = """
..###...###..
.............
#....#.#....#
#....#.#....#
#....#.#....#
..###...###..
.............
..###...###..
#....#.#....#
#....#.#....#
#....#.#....#
.............
..###...###..
"""

GOSPER_GLIDER_GUN = """
........................#............
......................#.#............
............##......##............##
...........#...#....##............##
##........#.....#...##...............
##........#...#.##....#.#............
..........#.....#.......#............
...........#...#.....................
............##.......................
"""

TOAD = """
.###
###.
"""

LWSS = """
.####
#...#
....#
#..#.
"""

R_PENTOMINO = """
.##
##.
.#.
"""

PATTERNS = {
    "glider": GLIDER,
    "blinker": BLINKER,
    "pulsar": PULSAR,
    "gun": GOSPER_GLIDER_GUN,
    "toad": TOAD,
    "lwss": LWSS,
    "r-pentomino": R_PENTOMINO,
}


def save_pattern(board: Board, path: str) -> None:
    with open(path, "w") as f:
        f.write(board.render(alive_char="#", dead_char="."))
        f.write("\n")


def load_pattern(path: str, width: int, height: int) -> Board:
    with open(path) as f:
        return Board.from_pattern(f.read(), width, height)


def _terminal_size(default_width: int = 60, default_height: int = 20) -> tuple[int, int]:
    size = shutil.get_terminal_size(fallback=(default_width, default_height + 2))
    return size.columns, max(size.lines - 2, 5)


def _pattern_dimensions(pattern: str) -> tuple[int, int]:
    """The (width, height) of a pattern's own bounding box, independent of
    any board it might later be placed on."""
    rows = pattern.strip("\n").splitlines()
    height = len(rows)
    width = max((len(row) for row in rows), default=0)
    return width, height


def _centered_offset(pattern: str, width: int, height: int) -> tuple[int, int]:
    pattern_w, pattern_h = _pattern_dimensions(pattern)
    return max((width - pattern_w) // 2, 0), max((height - pattern_h) // 2, 0)


def preview_pattern(pattern: str, name: str) -> str:
    """Renders a pattern at its own natural size, with no surrounding board
    padding - a quick look at its shape without running the simulation."""
    width, height = _pattern_dimensions(pattern)
    board = Board.from_pattern(pattern, width, height)
    return f"{name} ({width}x{height}, population {board.population()})\n{board.render()}\n"


def _resolve_dimensions(width: int | None, height: int | None) -> tuple[int, int]:
    """Fill in unset (None) width/height from the terminal size. An explicitly
    passed 0 (or any other non-None value) is honored, not treated as unset."""
    if width is None or height is None:
        term_w, term_h = _terminal_size()
        width = term_w if width is None else width
        height = term_h if height is None else height
    return width, height


def run(args: argparse.Namespace) -> None:
    if args.preview:
        if args.load:
            with open(args.load) as f:
                sys.stdout.write(preview_pattern(f.read(), args.load))
        elif args.pattern in PATTERNS:
            sys.stdout.write(preview_pattern(PATTERNS[args.pattern], args.pattern))
        else:
            sys.stdout.write("--preview needs --pattern <name> or --load <file> (not 'random').\n")
        return

    width, height = _resolve_dimensions(args.width, args.height)

    if args.load:
        board = load_pattern(args.load, width, height)
    elif args.pattern in PATTERNS:
        pattern = PATTERNS[args.pattern]
        board = Board.from_pattern(pattern, width, height, offset=_centered_offset(pattern, width, height))
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
    finally:
        if args.save:
            save_pattern(board, args.save)


def _non_negative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError(f"must be non-negative, got {value!r}")
    return parsed


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conway's Game of Life in your terminal.")
    parser.add_argument("--width", type=int, default=None, help="board width (default: terminal width)")
    parser.add_argument("--height", type=int, default=None, help="board height (default: terminal height)")
    parser.add_argument("--density", type=float, default=0.3, help="initial live-cell density for random boards")
    parser.add_argument("--seed", type=int, default=None, help="random seed")
    parser.add_argument("--interval", type=_non_negative_float, default=0.1, help="seconds between generations")
    parser.add_argument("--generations", type=int, default=None, help="stop after N generations (default: run until stable or interrupted)")
    parser.add_argument("--pattern", choices=["random", *PATTERNS], default="random", help="initial pattern")
    parser.add_argument("--load", type=str, default=None, help="load initial pattern from a plaintext file (# alive, . dead)")
    parser.add_argument("--save", type=str, default=None, help="save the final board state to a plaintext file on exit")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="print --pattern or --load once at its natural size and exit, without running the simulation",
    )
    return parser.parse_args(argv)


def main() -> None:
    run(parse_args())


if __name__ == "__main__":
    main()
