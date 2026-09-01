import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from life import (
    Board,
    GLIDER,
    BLINKER,
    PULSAR,
    TOAD,
    LWSS,
    R_PENTOMINO,
    PATTERNS,
    save_pattern,
    load_pattern,
    _centered_offset,
    _pattern_dimensions,
    _resolve_dimensions,
    preview_pattern,
    parse_args,
    run,
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


def test_toad_is_registered_pattern():
    assert PATTERNS["toad"] == TOAD


def test_toad_oscillates_with_period_two():
    board = Board.from_pattern(TOAD, 20, 20, offset=(5, 5))
    original = set(board.live_cells)
    stepped_once = board.step()
    assert stepped_once.live_cells != original  # actually changes shape each step
    assert stepped_once.step().live_cells == original  # back to itself after 2


def test_lwss_is_registered_pattern():
    assert PATTERNS["lwss"] == LWSS


def test_lwss_spaceship_translates_two_cells_right_after_four_steps():
    board = Board.from_pattern(LWSS, 30, 20, offset=(2, 2))
    original = set(board.live_cells)
    for _ in range(4):
        board = board.step()
    expected = {(x + 2, y) for x, y in original}
    assert board.live_cells == expected


def test_r_pentomino_is_registered_pattern():
    assert PATTERNS["r-pentomino"] == R_PENTOMINO


def test_r_pentomino_is_a_methuselah_not_a_still_life_or_early_oscillator():
    board = Board.from_pattern(R_PENTOMINO, 40, 40, offset=(15, 15))
    assert board.population() == 5
    seen_populations = set()
    for _ in range(20):
        seen_populations.add(board.population())
        board = board.step()
    # a still life or short-period oscillator would repeat only 1-2 distinct
    # population counts over 20 generations; the r-pentomino keeps growing
    # and shrinking chaotically for over a thousand generations in reality,
    # so 20 generations should already show many distinct population sizes.
    assert len(seen_populations) > 10


def test_pattern_dimensions_measures_a_pattern_own_bounding_box():
    assert _pattern_dimensions(GLIDER) == (3, 3)
    assert _pattern_dimensions(TOAD) == (4, 2)
    assert _pattern_dimensions(BLINKER) == (3, 1)


def test_preview_pattern_renders_at_the_pattern_own_size_with_no_padding():
    text = preview_pattern(GLIDER, "glider")
    lines = text.splitlines()
    assert lines[0] == "glider (3x3, population 5)"
    assert len(lines) == 1 + 3  # header + exactly the 3x3 board, no board padding
    assert all(len(line) == 3 for line in lines[1:])


def test_preview_pattern_population_matches_the_rendered_board():
    text = preview_pattern(TOAD, "toad")
    board_lines = text.splitlines()[1:]
    rendered_population = sum(line.count("#") for line in board_lines)
    assert "population 6" in text.splitlines()[0]
    assert rendered_population == 6


def test_preview_flag_prints_the_pattern_once_and_skips_the_simulation(capsys):
    run(parse_args(["--pattern", "glider", "--preview"]))
    out = capsys.readouterr().out
    assert "glider (3x3, population 5)" in out
    assert "generation" not in out  # the simulation loop never ran


def test_preview_flag_with_random_pattern_explains_it_needs_a_named_pattern(capsys):
    run(parse_args(["--preview"]))  # default --pattern is "random"
    out = capsys.readouterr().out
    assert "needs --pattern" in out
    assert "generation" not in out


def test_preview_flag_works_with_a_loaded_file(capsys):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("##\n.#\n")
        path = f.name
    try:
        run(parse_args(["--load", path, "--preview"]))
        out = capsys.readouterr().out
        assert f"{path} (2x2, population 3)" in out
    finally:
        os.remove(path)


def test_run_with_load_places_the_board_at_the_origin_not_re_centered(capsys):
    # A saved file's text already encodes the whole board's absolute layout
    # (render() pads the full board, not just the pattern's own bounding
    # box), so run() with --load must place it at (0, 0) like load_pattern
    # does directly - re-centering it (the way a named --pattern is
    # centered) would double-offset it away from where it was saved.
    #
    # Loading onto a *larger* board than it was saved at is what actually
    # distinguishes the two behaviors: _centered_offset of a 10x10 saved
    # board's full text onto a same-sized 10x10 target is (0, 0) either
    # way, silently passing even with the bug. Onto a 20x20 target it
    # isn't: correctly-placed keeps the cell at (1, 1); double-centered
    # would shift it to (1 + 5, 1 + 5) = (6, 6).
    board = Board(10, 10, {(1, 1)})
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        path = f.name
    try:
        save_pattern(board, path)
        run(parse_args(["--load", path, "--width", "20", "--height", "20", "--generations", "1", "--interval", "0"]))
        out = capsys.readouterr().out
        frame = out.split("\x1b[H\x1b[J", 1)[1]  # the one rendered frame, after the clear-screen sequence
        board_lines = frame.splitlines()[:20]
        assert board_lines[1][1] == "#"  # saved position (1, 1), not shifted to (6, 6)
        assert board_lines[6][6] == " "
    finally:
        os.remove(path)


def test_selected_source_precedence_matches_between_preview_and_simulation(capsys):
    # --load beats --pattern in both --preview and the real simulation -
    # this is exactly the precedence _selected_source centralizes.
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("#\n")
        path = f.name
    try:
        run(parse_args(["--load", path, "--pattern", "glider", "--preview"]))
        preview_out = capsys.readouterr().out
        assert path in preview_out
        assert "glider" not in preview_out
    finally:
        os.remove(path)
