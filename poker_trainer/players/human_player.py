"""
Human player — reads decisions from stdin with validation.

The human player is shown their hole cards and the public game state by
the Renderer before this class asks for input.  This class is only
responsible for parsing and validating the raw input string.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Tuple

from poker_trainer.players.base_player import BasePlayer
from poker_trainer.utils.constants import Action

if TYPE_CHECKING:
    from poker_trainer.engine.game import GameState


class HumanPlayer(BasePlayer):
    """
    Player whose decisions come from keyboard input.

    Displays a compact action prompt and re-prompts on invalid input.
    Legal actions are enforced: the player cannot choose an action that
    is not in state.legal_actions.
    """

    @property
    def is_human(self) -> bool:
        return True

    def decide(self, state: "GameState") -> Tuple[Action, int]:
        """
        Prompt the human for an action and return a validated (Action, int).

        The loop continues until the player enters a valid choice.
        """
        action_map = {
            "f": Action.FOLD,
            "c": Action.CHECK,
            "ca": Action.CALL,
            "r": Action.RAISE,
            "a": Action.ALL_IN,
        }
        label_map = {
            Action.FOLD: "[f]old",
            Action.CHECK: "[c]heck",
            Action.CALL: "[ca]ll",
            Action.RAISE: "[r]aise",
            Action.ALL_IN: "[a]ll-in",
        }

        options = "  ".join(
            label_map[a] for a in label_map if a in state.legal_actions
        )

        while True:
            raw = input(f"  Your action ({options}): ").strip().lower()
            action = action_map.get(raw)

            if action is None or action not in state.legal_actions:
                print(f"  Invalid choice. Choose from: {options}")
                continue

            if action == Action.FOLD:
                return Action.FOLD, 0

            if action == Action.CHECK:
                return Action.CHECK, 0

            if action == Action.CALL:
                amount = max(0, state.current_bet - state.player_current_bet)
                return Action.CALL, min(amount, self.chips)

            if action == Action.ALL_IN:
                return Action.ALL_IN, self.chips

            if action == Action.RAISE:
                amount = self._ask_raise_amount(state)
                return Action.RAISE, amount

    def _ask_raise_amount(self, state: "GameState") -> int:
        """Prompt for a raise size and validate the range."""
        lo = state.min_raise
        hi = self.chips
        while True:
            try:
                raw = input(f"  Raise amount ({lo}–{hi}): ").strip()
                amount = int(raw)
                if lo <= amount <= hi:
                    return amount
                print(f"  Must be between {lo} and {hi}.")
            except ValueError:
                print("  Please enter a whole number.")
