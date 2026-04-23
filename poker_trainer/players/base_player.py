"""
Abstract base class for all player types.

Every player — human or bot — exposes the same interface to the game
engine.  The engine never cares *how* a decision is made; it only calls
decide() and reads the returned (Action, amount) tuple.

Design note:
    BasePlayer is intentionally thin.  It holds chip / card state and
    declares the decide() contract.  Subclasses add only what they need:
    HumanPlayer adds input handling; BotPlayer adds a strategy reference.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, List, Tuple

from poker_trainer.cards.card import Card
from poker_trainer.utils.constants import Action

if TYPE_CHECKING:
    from poker_trainer.engine.game import GameState


class BasePlayer(ABC):
    """
    Abstract base for human and bot players.

    Attributes:
        name:        Display name shown in the UI.
        chips:       Current chip count.
        hole_cards:  The two private cards dealt to this player.
        is_active:   False once the player folds or busts out.
        current_bet: Amount wagered in the *current* betting round
                     (reset to 0 at the start of each new round).
    """

    def __init__(self, name: str, chips: int) -> None:
        self.name = name
        self.chips = chips
        self.hole_cards: List[Card] = []
        self.is_active: bool = True
        self.current_bet: int = 0  # chips committed this round

    # ------------------------------------------------------------------
    # Contract that every subclass must implement
    # ------------------------------------------------------------------

    @abstractmethod
    def decide(self, state: "GameState") -> Tuple[Action, int]:
        """
        Choose an action given the current game state.

        Args:
            state: A frozen snapshot of the public game state.

        Returns:
            A (Action, amount) tuple.
            - FOLD / CHECK: amount is always 0.
            - CALL: amount is the chips needed to match current_bet.
            - RAISE / ALL_IN: amount is the *total* additional chips wagered
              on top of current_bet (i.e., the raise size, not the total pot
              contribution).
        """

    # ------------------------------------------------------------------
    # Chip and card management (called by the engine, not by subclasses)
    # ------------------------------------------------------------------

    def receive_cards(self, cards: List[Card]) -> None:
        """Add cards to this player's hand (called by Dealer)."""
        self.hole_cards.extend(cards)

    def clear_hand(self) -> None:
        """Discard hole cards and reset per-hand state at hand start."""
        self.hole_cards = []
        self.is_active = True
        self.current_bet = 0

    def reset_bet(self) -> None:
        """Reset per-round bet tracker (called between betting rounds)."""
        self.current_bet = 0

    def place_chips(self, amount: int) -> int:
        """
        Deduct *amount* chips and track them as wagered this round.
        If amount exceeds chips, goes all-in.

        Returns:
            The actual chips placed (may be less than requested if all-in).
        """
        actual = min(amount, self.chips)
        self.chips -= actual
        self.current_bet += actual
        return actual

    def receive_winnings(self, amount: int) -> None:
        """Credit *amount* chips to this player's stack."""
        self.chips += amount

    def fold(self) -> None:
        """Mark this player as inactive for the rest of the hand."""
        self.is_active = False

    @property
    def is_all_in(self) -> bool:
        """True if the player has no chips left but is still in the hand."""
        return self.chips == 0 and self.is_active

    @property
    def is_bust(self) -> bool:
        """True if the player has been eliminated (no chips, not in play)."""
        return self.chips == 0 and not self.is_active

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r}, chips={self.chips})"
