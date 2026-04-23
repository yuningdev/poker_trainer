"""
Entry point for `uv run poker` or `python -m poker_trainer`.

Configures the table, creates players, and starts the game.
Modify the PLAYER_CONFIGS list below to change the lineup.
"""

from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.ui.renderer import Renderer

# ------------------------------------------------------------------
# Game configuration
# ------------------------------------------------------------------

STARTING_CHIPS = 1_000
SMALL_BLIND = 10
BIG_BLIND = 20

# Each entry: (type, name)
# type must be one of: "human", "random", "passive", "aggressive"
PLAYER_CONFIGS = [
    ("human", "You"),
    ("aggressive", "Alice"),
    ("passive", "Bob"),
    ("random", "Charlie"),
]


def main() -> None:
    players = [
        PlayerFactory.create(ptype, name, STARTING_CHIPS)
        for ptype, name in PLAYER_CONFIGS
    ]
    table = Table(players, small_blind=SMALL_BLIND, big_blind=BIG_BLIND)
    dealer = Dealer()
    renderer = Renderer()

    renderer.show_message(
        f"[bold cyan]Welcome to Texas Hold'em![/bold cyan]\n"
        f"  Players: {', '.join(p.name for p in players)}\n"
        f"  Starting chips: {STARTING_CHIPS}  |  "
        f"Blinds: {SMALL_BLIND}/{BIG_BLIND}"
    )

    game = Game(table, dealer, renderer)
    game.run()


if __name__ == "__main__":
    main()
