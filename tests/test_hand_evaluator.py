"""Tests for the hand evaluator — all 10 hand categories."""

import pytest
from poker_trainer.cards.card import Card
from poker_trainer.cards.hand_evaluator import HandEvaluator
from poker_trainer.utils.constants import HandRank, Rank, Suit


def c(rank: Rank, suit: Suit) -> Card:
    return Card(rank, suit)


# Shorthand suits
S, H, D, C = Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS


class TestHandEvaluator:
    def test_royal_flush(self):
        hole = [c(Rank.ACE, S), c(Rank.KING, S)]
        comm = [c(Rank.QUEEN, S), c(Rank.JACK, S), c(Rank.TEN, S), c(Rank.TWO, H), c(Rank.THREE, H)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.ROYAL_FLUSH

    def test_straight_flush(self):
        hole = [c(Rank.NINE, S), c(Rank.EIGHT, S)]
        comm = [c(Rank.SEVEN, S), c(Rank.SIX, S), c(Rank.FIVE, S), c(Rank.TWO, H), c(Rank.THREE, H)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.STRAIGHT_FLUSH

    def test_four_of_a_kind(self):
        hole = [c(Rank.ACE, S), c(Rank.ACE, H)]
        comm = [c(Rank.ACE, D), c(Rank.ACE, C), c(Rank.TWO, H), c(Rank.THREE, S), c(Rank.FOUR, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.FOUR_OF_A_KIND

    def test_full_house(self):
        hole = [c(Rank.ACE, S), c(Rank.ACE, H)]
        comm = [c(Rank.ACE, D), c(Rank.KING, C), c(Rank.KING, H), c(Rank.TWO, S), c(Rank.THREE, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.FULL_HOUSE

    def test_flush(self):
        hole = [c(Rank.ACE, S), c(Rank.KING, S)]
        comm = [c(Rank.TEN, S), c(Rank.SEVEN, S), c(Rank.THREE, S), c(Rank.TWO, H), c(Rank.FOUR, H)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.FLUSH

    def test_straight(self):
        hole = [c(Rank.NINE, S), c(Rank.EIGHT, H)]
        comm = [c(Rank.SEVEN, D), c(Rank.SIX, C), c(Rank.FIVE, S), c(Rank.TWO, H), c(Rank.THREE, H)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.STRAIGHT

    def test_wheel_straight(self):
        """A-2-3-4-5 is a valid straight with Ace playing low."""
        hole = [c(Rank.ACE, S), c(Rank.TWO, H)]
        comm = [c(Rank.THREE, D), c(Rank.FOUR, C), c(Rank.FIVE, S), c(Rank.KING, H), c(Rank.QUEEN, H)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.STRAIGHT

    def test_three_of_a_kind(self):
        hole = [c(Rank.ACE, S), c(Rank.ACE, H)]
        comm = [c(Rank.ACE, D), c(Rank.KING, C), c(Rank.TWO, H), c(Rank.THREE, S), c(Rank.FOUR, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.THREE_OF_A_KIND

    def test_two_pair(self):
        hole = [c(Rank.ACE, S), c(Rank.ACE, H)]
        comm = [c(Rank.KING, D), c(Rank.KING, C), c(Rank.TWO, H), c(Rank.THREE, S), c(Rank.FOUR, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.TWO_PAIR

    def test_one_pair(self):
        hole = [c(Rank.ACE, S), c(Rank.ACE, H)]
        comm = [c(Rank.KING, D), c(Rank.QUEEN, C), c(Rank.TWO, H), c(Rank.THREE, S), c(Rank.FOUR, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.ONE_PAIR

    def test_high_card(self):
        hole = [c(Rank.ACE, S), c(Rank.KING, H)]
        comm = [c(Rank.JACK, D), c(Rank.NINE, C), c(Rank.TWO, H), c(Rank.FOUR, S), c(Rank.SIX, D)]
        result = HandEvaluator.evaluate(hole, comm)
        assert result.rank == HandRank.HIGH_CARD

    def test_hand_comparison(self):
        """Flush beats straight."""
        flush_result = HandEvaluator.evaluate(
            [c(Rank.ACE, S), c(Rank.KING, S)],
            [c(Rank.TEN, S), c(Rank.SEVEN, S), c(Rank.THREE, S), c(Rank.TWO, H), c(Rank.FOUR, H)],
        )
        straight_result = HandEvaluator.evaluate(
            [c(Rank.NINE, S), c(Rank.EIGHT, H)],
            [c(Rank.SEVEN, D), c(Rank.SIX, C), c(Rank.FIVE, H), c(Rank.TWO, D), c(Rank.THREE, C)],
        )
        assert flush_result > straight_result
