"""
Aggressive betting strategy — fires big bets and rarely backs down.

Represents a "maniac" archetype: raises frequently, with large sizing,
and only folds under heavy pressure.

Action weights (when all three are available):
    FOLD   5%  — almost never folds
    CALL  20%  — prefers to raise rather than just call
    RAISE 75%  — bet/raise is the default action
"""

import random
from typing import Tuple

from poker_trainer.strategies.base_strategy import BettingStrategy, GameState
from poker_trainer.utils.constants import Action


class AggressiveStrategy(BettingStrategy):
    """
    Weighted-random strategy biased toward large raises.

    Raise size: 2× to all-in, randomly chosen in that range.
    """

    _WEIGHTS = {
        "fold": 5,
        "call": 20,
        "raise": 75,
    }

    def decide(self, state: GameState, player) -> Tuple[Action, int]:
        total = sum(self._WEIGHTS.values())
        roll = random.randint(1, total)

        if roll <= self._WEIGHTS["fold"]:
            bucket = "fold"
        elif roll <= self._WEIGHTS["fold"] + self._WEIGHTS["call"]:
            bucket = "call"
        else:
            bucket = "raise"

        # --- FOLD ---
        if bucket == "fold":
            if self.call_amount(state) > 0 and Action.FOLD in state.legal_actions:
                return Action.FOLD, 0
            bucket = "raise"  # Never fold for free — raise instead.

        # --- CALL ---
        if bucket == "call":
            if self.can_check(state):
                return Action.CHECK, 0
            amount = self.call_amount(state)
            if amount >= player.chips:
                return Action.ALL_IN, player.chips
            return Action.CALL, amount

        # --- RAISE ---
        if self.can_raise(state):
            lo = state.min_raise * 2
            # Cap raises at 4× the current minimum raise for realistic sizing.
            # Only go all-in when short-stacked (< 15 BB effective).
            big_blind = max(1, state.min_raise)
            short_stack = player.chips <= big_blind * 15
            hi = player.chips if short_stack else min(state.min_raise * 4, player.chips)

            if lo >= hi:
                # All-in only when short-stacked; otherwise just call/check.
                if short_stack:
                    return Action.ALL_IN, player.chips
                if self.can_check(state):
                    return Action.CHECK, 0
                amount = self.call_amount(state)
                if amount >= player.chips:
                    return Action.ALL_IN, player.chips
                return Action.CALL, amount

            amount = random.randint(lo, hi)
            amount = self.clamp_raise(amount, player, state)
            if amount >= player.chips:
                return Action.ALL_IN, player.chips
            return Action.RAISE, amount

        # Raise not legal.
        if self.can_check(state):
            return Action.CHECK, 0
        amount = self.call_amount(state)
        if amount >= player.chips:
            return Action.ALL_IN, player.chips
        return Action.CALL, amount
