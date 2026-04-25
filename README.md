# Poker Trainer

Texas Hold'em terminal game with AI opponents, built with Python and `rich`.

---

## Preconditions 環境需求

You only need **one tool** installed: `uv`. It will automatically handle Python and all dependencies for you.

只需要安裝 **一個工具**：`uv`。它會自動幫你安裝 Python 與所有相依套件。

### Step 1 — Install `uv`

**macOS / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then reload your shell (or open a new terminal window):
```bash
source $HOME/.local/bin/env
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Then reload your shell:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User")
```

> **No Python installed?** No problem. `uv` will download and manage Python 3.12 automatically when you run the next step.

---

### Step 2 — Clone or download the project

```bash
git clone git@github.com:yuningdev/poker_trainer.git
cd poker_trainer
```

Or download the ZIP from GitHub and unzip it, then `cd` into the folder.

---

### Step 3 — Install dependencies

```bash
uv sync
```

This creates a local virtual environment (`.venv/`) and installs everything. You will see output like:

```
Using CPython 3.12
Creating virtual environment at: .venv
Installed 11 packages in ...
```

---

### Step 4 — Play

```bash
uv run poker
```

That's it. No `python`, no `pip`, no `activate` needed.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `uv run poker` | Start the game |
| `uv run pytest -v` | Run all tests |
| `uv run python simulate.py` | Run bot simulation and generate report |
| `uv sync` | Re-install dependencies (e.g. after pulling updates) |

---

## Players & Strategies

The game ships with three AI personalities, all configurable in `poker_trainer/__main__.py`:

| Type | Description |
|------|-------------|
| `human` | You — reads input from the terminal |
| `aggressive` | Raises 75% of the time, large sizing (2× to all-in) |
| `passive` | Checks/calls 75% of the time, small raises |
| `random` | Picks uniformly from all legal actions |

---

## Project Structure

```
poker_trainer/
├── poker_trainer/
│   ├── cards/           # Card, Deck, HandEvaluator
│   ├── players/         # BasePlayer, HumanPlayer, BotPlayer, PlayerFactory
│   ├── strategies/      # BettingStrategy, Random/Passive/Aggressive
│   ├── engine/          # Dealer, Pot, Table, Game
│   ├── ui/              # Renderer (rich terminal output)
│   └── utils/           # Enums: Suit, Rank, Action, Phase, HandRank
└── tests/
```

## Design Patterns

- **Strategy** — `BotPlayer` delegates decisions to a swappable `BettingStrategy`.
- **Factory** — `PlayerFactory.create(type, name, chips)` decouples configuration from classes.
- **Template Method** — `Game._play_hand()` defines the fixed hand sequence; phases are overridable.
- **Value Object** — `Card` and `GameState` are frozen dataclasses; strategies cannot corrupt game state.

---

## Running Tests

```bash
uv run pytest -v
```

---

## Adding a New AI Strategy

1. Create `poker_trainer/strategies/my_strategy.py` inheriting `BettingStrategy`.
2. Add an entry to `_STRATEGY_MAP` in `poker_trainer/players/player_factory.py`.
3. Use `"my_strategy"` in `PLAYER_CONFIGS` in `__main__.py`.

---

## Troubleshooting

**`uv: command not found` after install**
Run `source $HOME/.local/bin/env` (macOS/Linux) or restart the terminal.

**`Permission denied` on macOS**
```bash
chmod +x $HOME/.local/bin/uv
```

**Windows antivirus blocks the install script**
Download the binary directly from [github.com/astral-sh/uv/releases](https://github.com/astral-sh/uv/releases) and place `uv.exe` anywhere on your `PATH`.
