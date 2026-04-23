"""
Bot player — delegates every decision to a pluggable BettingStrategy.

BotPlayer itself contains no decision logic.  All intelligence (or lack
thereof) lives in the strategy object.  To create a new bot personality,
write a new BettingStrategy subclass and pass it here.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Tuple

from poker_trainer.players.base_player import BasePlayer
from poker_trainer.strategies.base_strategy import BettingStrategy
from poker_trainer.utils.constants import Action

if TYPE_CHECKING:
    from poker_trainer.engine.game import GameState


class BotPlayer(BasePlayer):
    """
    An automated player driven by a BettingStrategy.

    Attributes:
        strategy: The decision-making algorithm (Strategy pattern).

    Example:
        bot = BotPlayer("Alice", chips=1000, strategy=AggressiveStrategy())
    """

    def __init__(self, name: str, chips: int, strategy: BettingStrategy) -> None:
        super().__init__(name, chips)
        self.strategy = strategy

    def decide(self, state: "GameState") -> Tuple[Action, int]:
        """Delegate the decision entirely to the strategy."""
        return self.strategy.decide(state, self)

    def __repr__(self) -> str:
        return (
            f"BotPlayer(name={self.name!r}, chips={self.chips}, "
            f"strategy={self.strategy.__class__.__name__})"
        )
