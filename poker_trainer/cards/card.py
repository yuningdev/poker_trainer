"""
Immutable Card value object.

Cards are frozen dataclasses — they carry no mutable state and can be
safely stored in sets or used as dict keys.
"""

from dataclasses import dataclass

from poker_trainer.utils.constants import Rank, Suit


@dataclass(frozen=True, order=False)
class Card:
    """
    A single playing card identified by its rank and suit.

    Attributes:
        rank: The face value of the card (2–Ace).
        suit: The suit of the card (Spades, Hearts, Diamonds, Clubs).

    Examples:
        >>> Card(Rank.ACE, Suit.SPADES)
        Card(rank=<Rank.ACE: 14>, suit=<Suit.SPADES: '♠'>)
        >>> str(Card(Rank.KING, Suit.HEARTS))
        'K♥'
    """

    rank: Rank
    suit: Suit

    def __str__(self) -> str:
        return f"{self.rank}{self.suit.value}"

    def __repr__(self) -> str:
        return f"Card({self.rank!r}, {self.suit!r})"
