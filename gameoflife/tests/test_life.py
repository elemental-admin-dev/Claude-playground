import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from life import Board, GLIDER, PULSAR, PATTERNS, save_pattern, load_pattern, _centered_offset


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
