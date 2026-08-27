# Game of Life

A small, dependency-free terminal implementation of Conway's Game of Life.

## Run

```
python3 life.py                          # random board, sized to your terminal
python3 life.py --pattern glider         # classic glider
python3 life.py --pattern blinker
python3 life.py --width 40 --height 20 --density 0.25 --seed 1
python3 life.py --generations 50 --interval 0.05
```

Press Ctrl+C to stop early.

## Test

```
pip install pytest
python3 -m pytest tests/
```
