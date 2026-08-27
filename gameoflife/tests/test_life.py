import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from life import Board, GLIDER


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
