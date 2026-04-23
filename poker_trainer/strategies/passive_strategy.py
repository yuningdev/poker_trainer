"""
Passive betting strategy — prefers checking and calling over raising.

A passive bot rarely raises and never folds unless forced to pay chips it
cannot cover.  Represents a "calling station" archetype common at low-stakes
tables.

Action weights (when all three are available):
    FOLD  10%  — very reluctant to fold
    CHECK/CALL  75%  — happy to see cheap cards
    RAISE  15%  — occasionally steps on the gas
"""

import random
from typing import Tuple

from poker_trainer.strategies.base_strategy import BettingStrategy, GameState
from poker_trainer.utils.constants import Action


class PassiveStrategy(BettingStrategy):
    """
    Weighted-random strategy biased toward check/call.

    Raise size: 1× to 2× the current bet, clamped to player chips.
    """

    _WEIGHTS = {
        "fold": 10,
        "passive": 75,  # check or call, whichever is legal
        "raise": 15,
    }

    def decide(self, state: GameState, player) -> Tuple[Action, int]:
        total = sum(self._WEIGHTS.values())
        roll = random.randint(1, total)

        # Determine bucket
        if roll <= self._WEIGHTS["fold"]:
            bucket = "fold"
        elif roll <= self._WEIGHTS["fold"] + self._WEIGHTS["passive"]:
            bucket = "passive"
        else:
            bucket = "raise"

        # --- FOLD ---
        if bucket == "fold":
            # Only fold if there is actually a cost to calling.
            if self.call_amount(state) > 0 and Action.FOLD in state.legal_actions:
                return Action.FOLD, 0
            # Otherwise check instead of folding for free.
            bucket = "passive"

        # --- CHECK / CALL ---
        if bucket == "passive":
            if self.can_check(state):
                return Action.CHECK, 0
            amount = self.call_amount(state)
            if amount >= player.chips:
                return Action.ALL_IN, player.chips
            return Action.CALL, amount

        # --- RAISE ---
        if self.can_raise(state):
            lo = state.min_raise
            hi = min(player.chips, max(state.current_bet * 2, state.min_raise))
            amount = random.randint(lo, max(lo, hi))
            amount = self.clamp_raise(amount, player, state)
            if amount >= player.chips:
                return Action.ALL_IN, player.chips
            return Action.RAISE, amount

        # Raise not legal — fall back to call/check.
        if self.can_check(state):
            return Action.CHECK, 0
        amount = self.call_amount(state)
        if amount >= player.chips:
            return Action.ALL_IN, player.chips
        return Action.CALL, amount
