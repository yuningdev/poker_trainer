"""Tests for Deck dealing and burn mechanics."""

import pytest
from poker_trainer.cards.deck import Deck


def test_deck_starts_with_52_cards():
    deck = Deck()
    assert len(deck) == 52


def test_deal_removes_cards():
    deck = Deck()
    cards = deck.deal(5)
    assert len(cards) == 5
    assert deck.remaining == 47


def test_deal_all():
    deck = Deck()
    all_cards = deck.deal(52)
    assert len(all_cards) == 52
    assert deck.remaining == 0


def test_deal_too_many_raises():
    deck = Deck()
    with pytest.raises(ValueError):
        deck.deal(53)


def test_burn_removes_one():
    deck = Deck()
    deck.burn()
    assert deck.remaining == 51


def test_reset_restores_full_deck():
    deck = Deck()
    deck.deal(10)
    deck.reset()
    assert deck.remaining == 52


def test_no_duplicate_cards():
    deck = Deck()
    cards = deck.deal(52)
    assert len(set(cards)) == 52
