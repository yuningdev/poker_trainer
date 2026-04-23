"""
Standard 52-card deck with shuffle and deal operations.

The Deck is the single source of cards in the game.  Only the Dealer
(engine/dealer.py) should call deal(); no other object touches the deck
directly.
"""

import random
from typing import List

from poker_trainer.cards.card import Card
from poker_trainer.utils.constants import Rank, Suit


class Deck:
    """
    A standard 52-card deck.

    The deck is built fresh on construction (or after reset()) and
    shuffled in-place.  Cards are dealt from the top (end of the list).

    Attributes:
        _cards: Internal stack of remaining cards (index -1 is "top").

    Usage:
        deck = Deck()
        deck.shuffle()
        hand = deck.deal(2)   # Returns 2 Card objects
    """

    def __init__(self) -> None:
        self._cards: List[Card] = self._build()
        self.shuffle()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def shuffle(self) -> None:
        """Shuffle the deck in place using a cryptographically random seed."""
        random.shuffle(self._cards)

    def deal(self, n: int = 1) -> List[Card]:
        """
        Remove and return *n* cards from the top of the deck.

        Args:
            n: Number of cards to deal (default 1).

        Returns:
            A list of *n* Card objects in deal order.

        Raises:
            ValueError: If there are fewer than *n* cards remaining.
        """
        if n > self.remaining:
            raise ValueError(
                f"Cannot deal {n} cards — only {self.remaining} remain."
            )
        dealt, self._cards = self._cards[-n:], self._cards[:-n]
        return list(reversed(dealt))

    def burn(self) -> Card:
        """
        Discard one card face-down (standard casino procedure before
        each community-card deal).

        Returns:
            The burned Card (discarded, not used in play).

        Raises:
            ValueError: If the deck is empty.
        """
        burned = self.deal(1)
        return burned[0]

    @property
    def remaining(self) -> int:
        """Number of cards still in the deck."""
        return len(self._cards)

    def reset(self) -> None:
        """Rebuild the full 52-card deck and shuffle it."""
        self._cards = self._build()
        self.shuffle()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build() -> List[Card]:
        """Return an ordered list of all 52 cards."""
        return [Card(rank, suit) for suit in Suit for rank in Rank]

    def __len__(self) -> int:
        return self.remaining

    def __repr__(self) -> str:
        return f"Deck({self.remaining} cards remaining)"
