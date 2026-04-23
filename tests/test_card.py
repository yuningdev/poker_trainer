"""Tests for Card value object."""

import pytest
from poker_trainer.cards.card import Card
from poker_trainer.utils.constants import Rank, Suit


def test_card_str():
    assert str(Card(Rank.ACE, Suit.SPADES)) == "A♠"
    assert str(Card(Rank.KING, Suit.HEARTS)) == "K♥"
    assert str(Card(Rank.TWO, Suit.CLUBS)) == "2♣"
    assert str(Card(Rank.TEN, Suit.DIAMONDS)) == "10♦"


def test_card_equality():
    c1 = Card(Rank.ACE, Suit.SPADES)
    c2 = Card(Rank.ACE, Suit.SPADES)
    assert c1 == c2


def test_card_frozen():
    card = Card(Rank.JACK, Suit.HEARTS)
    with pytest.raises((AttributeError, TypeError)):
        card.rank = Rank.QUEEN  # type: ignore
