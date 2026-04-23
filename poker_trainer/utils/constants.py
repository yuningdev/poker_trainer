"""
Shared enumerations used throughout the entire game.

All game-wide constants live here to avoid circular imports and to give
a single source of truth for every meaningful label.
"""

from enum import Enum, auto


class Suit(Enum):
    """The four suits of a standard deck."""

    SPADES = "♠"
    HEARTS = "♥"
    DIAMONDS = "♦"
    CLUBS = "♣"


class Rank(Enum):
    """
    Card ranks with integer values used for hand comparison.
    Ace is always high (14); low-Ace straights are handled in the evaluator.
    """

    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 11
    QUEEN = 12
    KING = 13
    ACE = 14

    def __str__(self) -> str:
        face = {11: "J", 12: "Q", 13: "K", 14: "A"}
        return face.get(self.value, str(self.value))


class Action(Enum):
    """Betting actions a player can take on their turn."""

    FOLD = auto()
    CHECK = auto()
    CALL = auto()
    RAISE = auto()
    ALL_IN = auto()


class Phase(Enum):
    """The sequential phases of a Texas Hold'em hand."""

    PRE_FLOP = auto()
    FLOP = auto()
    TURN = auto()
    RIVER = auto()
    SHOWDOWN = auto()


class HandRank(Enum):
    """
    Poker hand rankings, ordered from weakest (1) to strongest (10).
    The integer value is used for direct comparison.
    """

    HIGH_CARD = 1
    ONE_PAIR = 2
    TWO_PAIR = 3
    THREE_OF_A_KIND = 4
    STRAIGHT = 5
    FLUSH = 6
    FULL_HOUSE = 7
    FOUR_OF_A_KIND = 8
    STRAIGHT_FLUSH = 9
    ROYAL_FLUSH = 10

    def display_name(self) -> str:
        names = {
            1: "High Card",
            2: "One Pair",
            3: "Two Pair",
            4: "Three of a Kind",
            5: "Straight",
            6: "Flush",
            7: "Full House",
            8: "Four of a Kind",
            9: "Straight Flush",
            10: "Royal Flush",
        }
        return names[self.value]
