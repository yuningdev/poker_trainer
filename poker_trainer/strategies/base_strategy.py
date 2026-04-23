"""
Abstract betting strategy and the GameState snapshot contract.

GameState is a frozen, read-only view of public game information.
Strategies receive it on every decision call; they may NOT mutate it.

Design note (Strategy Pattern):
    Separating the decision algorithm from the player object makes it
    trivial to add new bot personalities.  Write one class that inherits
    BettingStrategy, register it in PlayerFactory, done.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, List, Tuple

from poker_trainer.utils.constants import Action, Phase

if TYPE_CHECKING:
    from poker_trainer.players.base_player import BasePlayer


@dataclass(frozen=True)
class GameState:
    """
    Public information visible to all players at decision time.

    This snapshot is constructed by the engine before calling decide()
    and passed to every player (human or bot).  It is *frozen* so that
    strategies cannot accidentally corrupt game state.

    Attributes:
        community_cards:    Cards visible on the table (0–5).
        pot_total:          Total chips in the pot.
        current_bet:        The highest bet amount any player has wagered
                            in this round.
        min_raise:          The minimum legal raise increment.
        phase:              The current betting phase.
        active_player_count: Players who have not yet folded.
        legal_actions:      The set of actions this player may take.
        player_name:        Name of the player being asked to decide.
        player_chips:       Chips the deciding player currently holds.
        player_current_bet: Chips this player has already wagered this round.
    """

    community_cards: tuple = field(default_factory=tuple)
    pot_total: int = 0
    current_bet: int = 0
    min_raise: int = 0
    phase: Phase = Phase.PRE_FLOP
    active_player_count: int = 0
    legal_actions: tuple = field(default_factory=tuple)
    player_name: str = ""
    player_chips: int = 0
    player_current_bet: int = 0


class BettingStrategy(ABC):
    """
    Interface that all bot strategies must implement.

    Each concrete strategy encodes a distinct playing personality.
    The engine calls player.decide(state) which delegates here.
    """

    @abstractmethod
    def decide(
        self, state: GameState, player: "BasePlayer"
    ) -> Tuple[Action, int]:
        """
        Choose an action for *player* given public *state*.

        Args:
            state:  Frozen public game state.
            player: The bot player making the decision (read-only access
                    to hole_cards, chips, etc. is allowed).

        Returns:
            (Action, amount) — see BasePlayer.decide() for semantics.
        """

    # ------------------------------------------------------------------
    # Shared helpers available to all concrete strategies
    # ------------------------------------------------------------------

    @staticmethod
    def call_amount(state: GameState) -> int:
        """Chips needed for this player to match the current bet."""
        return max(0, state.current_bet - state.player_current_bet)

    @staticmethod
    def can_check(state: GameState) -> bool:
        return Action.CHECK in state.legal_actions

    @staticmethod
    def can_raise(state: GameState) -> bool:
        return Action.RAISE in state.legal_actions

    @staticmethod
    def clamp_raise(amount: int, player: "BasePlayer", state: GameState) -> int:
        """Clamp a proposed raise to the legal range [min_raise, all-in]."""
        return max(state.min_raise, min(amount, player.chips))
