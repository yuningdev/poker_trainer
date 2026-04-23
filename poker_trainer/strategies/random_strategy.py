"""
Random betting strategy — picks uniformly from all legal actions.

This is the simplest possible bot: no hand-reading, no pot-odds.
It is useful as a baseline opponent and as a test fixture.
"""

import random
from typing import Tuple

from poker_trainer.strategies.base_strategy import BettingStrategy, GameState
from poker_trainer.utils.constants import Action


class RandomStrategy(BettingStrategy):
    """
    Chooses uniformly at random from the set of legal actions.

    Raise amount is a random value in [min_raise, player.chips].
    If the player cannot afford a min_raise, goes all-in instead.

    Personality: unpredictable, roughly 33/33/33 fold/call/raise when
    all three actions are available.
    """

    def decide(self, state: GameState, player) -> Tuple[Action, int]:
        action = random.choice(list(state.legal_actions))

        if action == Action.FOLD:
            return Action.FOLD, 0

        if action in (Action.CHECK,):
            return Action.CHECK, 0

        if action == Action.CALL:
            amount = self.call_amount(state)
            # Go all-in automatically if player can't fully call.
            if amount >= player.chips:
                return Action.ALL_IN, player.chips
            return Action.CALL, amount

        if action == Action.RAISE:
            lo = state.min_raise
            hi = player.chips
            if lo >= hi:
                return Action.ALL_IN, hi
            amount = random.randint(lo, hi)
            return Action.RAISE, amount

        # Fallback to all-in (e.g. only legal action).
        return Action.ALL_IN, player.chips
