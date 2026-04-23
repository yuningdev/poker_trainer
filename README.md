# Poker Trainer

Texas Hold'em terminal game with AI opponents, built with Python and `rich`.

## Quick Start

```bash
# Install dependencies
uv sync

# Play the game
uv run poker
```

## Players & Strategies

The game ships with three AI personalities, all configurable in `poker_trainer/__main__.py`:

| Type | Description |
|------|-------------|
| `human` | You — reads input from the terminal |
| `aggressive` | Raises 75% of the time, large sizing (2× to all-in) |
| `passive` | Checks/calls 75% of the time, small raises |
| `random` | Picks uniformly from all legal actions |

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

## Running Tests

```bash
uv run pytest -v
```

## Adding a New AI Strategy

1. Create `poker_trainer/strategies/my_strategy.py` inheriting `BettingStrategy`.
2. Add an entry to `_STRATEGY_MAP` in `poker_trainer/players/player_factory.py`.
3. Use `"my_strategy"` in `PLAYER_CONFIGS` in `__main__.py`.
