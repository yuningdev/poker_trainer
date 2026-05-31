"""
Factory for creating player instances by type name.

Using a factory keeps the game configuration decoupled from concrete player
and strategy classes.  Adding a new bot personality only requires:
    1. Writing a BettingStrategy subclass in strategies/.
    2. Adding one entry to _STRATEGY_MAP below.

Usage:
    player = PlayerFactory.create("aggressive", "Bob", chips=1000)
"""

from poker_trainer.players.base_player import BasePlayer
from poker_trainer.players.bot_player import BotPlayer
from poker_trainer.strategies.aggressive_strategy import AggressiveStrategy
from poker_trainer.strategies.passive_strategy import PassiveStrategy
from poker_trainer.strategies.random_strategy import RandomStrategy

_STRATEGY_MAP = {
    "random": RandomStrategy,
    "passive": PassiveStrategy,
    "aggressive": AggressiveStrategy,
}

#: All valid type strings accepted by PlayerFactory.create().
PLAYER_TYPES: list[str] = list(_STRATEGY_MAP.keys())


class PlayerFactory:
    """Constructs players from a type string."""

    @staticmethod
    def create(
        player_type: str,
        name: str,
        chips: int,
        think_min: float | None = None,
        think_max: float | None = None,
    ) -> BasePlayer:
        """
        Create a bot player of the given strategy type.

        Args:
            player_type: One of "random", "passive", "aggressive".
            name:        Display name for the player.
            chips:       Starting chip count.
            think_min:   Override the minimum thinking pause (sec).
            think_max:   Override the maximum thinking pause (sec).

        Returns:
            A fully initialized BasePlayer subclass instance.

        Raises:
            ValueError: If *player_type* is not recognized.
        """
        t = player_type.lower()
        if t in _STRATEGY_MAP:
            strategy = _STRATEGY_MAP[t]()
            kwargs: dict = {}
            if think_min is not None:
                kwargs["think_min"] = think_min
            if think_max is not None:
                kwargs["think_max"] = think_max
            return BotPlayer(name=name, chips=chips, strategy=strategy, **kwargs)
        raise ValueError(
            f"Unknown player type {player_type!r}. "
            f"Valid types: {PLAYER_TYPES}"
        )
