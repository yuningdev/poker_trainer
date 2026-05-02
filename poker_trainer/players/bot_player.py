"""
Bot player — delegates every decision to a pluggable BettingStrategy.

BotPlayer itself contains no decision logic.  All intelligence (or lack
thereof) lives in the strategy object.  To create a new bot personality,
write a new BettingStrategy subclass and pass it here.
"""

from __future__ import annotations

import random
import time
from typing import TYPE_CHECKING, Tuple

from poker_trainer.players.base_player import BasePlayer
from poker_trainer.strategies.base_strategy import BettingStrategy
from poker_trainer.utils.constants import Action

if TYPE_CHECKING:
    from poker_trainer.engine.game import GameState


class BotPlayer(BasePlayer):
    """
    An automated player driven by a BettingStrategy.

    When think_max > 0, bots simulate human reaction time by sleeping a
    random interval before returning their decision. The pause runs in
    the game thread (executor), so it doesn't block the asyncio event loop.

    Defaults to 0 (instant) so unit tests stay fast — multiplayer rooms
    explicitly pass values like 1.5–3.0s.
    """

    def __init__(
        self,
        name: str,
        chips: int,
        strategy: BettingStrategy,
        think_min: float = 0.0,
        think_max: float = 0.0,
    ) -> None:
        super().__init__(name, chips)
        self.strategy = strategy
        self.think_min = think_min
        self.think_max = think_max

    def decide(self, state: "GameState") -> Tuple[Action, int]:
        """Pause briefly to simulate thinking, then delegate to the strategy."""
        if self.think_max > 0:
            time.sleep(random.uniform(self.think_min, self.think_max))
        return self.strategy.decide(state, self)

    def __repr__(self) -> str:
        return (
            f"BotPlayer(name={self.name!r}, chips={self.chips}, "
            f"strategy={self.strategy.__class__.__name__})"
        )
