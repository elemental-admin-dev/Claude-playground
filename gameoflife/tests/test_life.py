import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from life import (
    Board,
    GLIDER,
    PULSAR,
    PATTERNS,
    save_pattern,
    load_pattern,
    _centered_offset,
    _resolve_dimensions,
    parse_args,
)


def test_still_life_block_is_stable():
    block = {(1, 1), (1, 2), (2, 1), (2, 2)}
    board = Board(5, 5, block)
    assert board.step().live_cells == block


def test_blinker_oscillates_with_period_two():
    horizontal = {(1, 2), (2, 2), (3, 2)}
    vertical = {(2, 1), (2, 2), (2, 3)}
    board = Board(5, 5, horizontal)
    assert board.step().live_cells == vertical
    assert board.step().step().live_cells == horizontal


def test_lonely_cell_dies():
    board = Board(5, 5, {(2, 2)})
    assert board.step().live_cells == set()


def test_overcrowded_cell_dies():
    board = Board(5, 5, {(1, 1), (1, 2), (2, 1), (2, 2), (2, 3)})
    assert (2, 2) not in board.step().live_cells


def test_dead_cell_with_three_neighbors_becomes_alive():
    board = Board(5, 5, {(1, 1), (1, 2), (2, 1)})
    assert (2, 2) in board.step().live_cells


def test_glider_pattern_translates_after_four_steps():
    board = Board.from_pattern(GLIDER, 20, 20, offset=(1, 1))
    original = set(board.live_cells)
    for _ in range(4):
        board = board.step()
    expected = {(x + 1, y + 1) for x, y in original}
    assert board.live_cells == expected


def test_cells_outside_bounds_are_dropped():
    board = Board(3, 3, {(0, 0)})
    stepped = board.step()
    assert all(0 <= x < 3 and 0 <= y < 3 for x, y in stepped.live_cells)


def test_render_dimensions_match_board_size():
    board = Board(4, 3, {(0, 0)})
    lines = board.render().splitlines()
    assert len(lines) == 3
    assert all(len(line) == 4 for line in lines)


def test_pulsar_is_a_registered_pattern():
    assert PATTERNS["pulsar"] == PULSAR


def test_pulsar_oscillates_with_period_three():
    board = Board.from_pattern(PULSAR, 20, 20, offset=(2, 2))
    original = set(board.live_cells)
    stepped = board.step().step().step()
    assert stepped.live_cells == original


def test_centered_offset_centers_pattern_in_board():
    ox, oy = _centered_offset(GLIDER, 10, 10)
    assert ox == 3 and oy == 3  # (10 - 3) // 2 for a 3x3 pattern


def test_save_then_load_round_trips_live_cells():
    board = Board.from_pattern(GLIDER, 10, 10, offset=(1, 1))
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        path = f.name
    try:
        save_pattern(board, path)
        loaded = load_pattern(path, 10, 10)
        assert loaded.live_cells == board.live_cells
    finally:
        os.remove(path)


def test_from_pattern_clips_cells_outside_the_declared_bounds():
    # A pattern with live cells at columns 0-4, loaded onto a 3-wide board:
    # cells at x=3,4 must not survive into live_cells, or population() and
    # step() would disagree about the board's state until the first step().
    wide_pattern = "#####"
    board = Board.from_pattern(wide_pattern, width=3, height=1)
    assert board.live_cells == {(0, 0), (1, 0), (2, 0)}
    assert board.population() == 3


def test_loading_a_saved_board_onto_a_smaller_board_clips_out_of_range_cells():
    # Glider at offset (3, 3) straddles the boundary of a 5x5 board: only its
    # (4, 3) cell is in range, the rest fall at x=5 or y=5 (out of 0..4).
    board = Board.from_pattern(GLIDER, 10, 10, offset=(3, 3))
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        path = f.name
    try:
        save_pattern(board, path)
        loaded = load_pattern(path, 5, 5)  # smaller than the saved board
        assert loaded.live_cells == {(4, 3)}
        assert all(0 <= x < 5 and 0 <= y < 5 for x, y in loaded.live_cells)
        assert loaded.population() == len(loaded.live_cells)
    finally:
        os.remove(path)


def test_resolve_dimensions_fills_in_only_unset_values():
    width, height = _resolve_dimensions(10, 20)
    assert (width, height) == (10, 20)


def test_resolve_dimensions_honors_an_explicit_zero_instead_of_treating_it_as_unset():
    # A falsy-zero check would silently replace 0 with the terminal size;
    # None is the only value that should trigger that fallback.
    width, height = _resolve_dimensions(0, 20)
    assert width == 0
    assert height == 20

    width, height = _resolve_dimensions(10, 0)
    assert width == 10
    assert height == 0


def test_resolve_dimensions_falls_back_to_terminal_size_when_unset():
    width, height = _resolve_dimensions(None, None)
    assert width > 0
    assert height > 0


def test_parse_args_rejects_a_negative_interval():
    with pytest.raises(SystemExit):
        parse_args(["--interval", "-1"])


def test_parse_args_accepts_a_zero_interval():
    args = parse_args(["--interval", "0"])
    assert args.interval == 0.0


def test_parse_args_accepts_a_positive_interval():
    args = parse_args(["--interval", "0.5"])
    assert args.interval == 0.5
