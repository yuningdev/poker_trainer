"""
Dealer — the sole orchestrator of card distribution.

The Dealer owns the Deck and is the only object permitted to call
deck.deal() or deck.burn().  This enforces the invariant that no
player or game logic can ever "peek at" or manipulate the deck.

Dealing procedure follows standard casino Texas Hold'em protocol:
    1. Burn one card before each community deal (flop/turn/river).
    2. Deal hole cards clockwise, one at a time, two passes.
    3. Community cards are appended to the shared list owned by Table.

Design note:
    Dealer is a pure actor.  It holds no state between deals except the
    Deck.  reset() rebuilds and reshuffles the deck for the next hand.
"""

from typing import List

from poker_trainer.cards.card import Card
from poker_trainer.cards.deck import Deck
from poker_trainer.players.base_player import BasePlayer


class Dealer:
    """
    Manages card distribution for a single game session.

    Attributes:
        deck: The 52-card deck this dealer draws from.

    Usage:
        dealer = Dealer()
        dealer.deal_hole_cards(active_players)
        dealer.deal_flop(community_cards)
        dealer.deal_turn(community_cards)
        dealer.deal_river(community_cards)
        dealer.reset()  # Next hand
    """

    def __init__(self) -> None:
        self.deck = Deck()

    def reset(self) -> None:
        """
        Prepare for a new hand: rebuild and shuffle the full 52-card deck.
        Must be called at the start of every hand before any deal method.
        """
        self.deck.reset()

    # ------------------------------------------------------------------
    # Hole cards
    # ------------------------------------------------------------------

    def deal_hole_cards(self, players: List[BasePlayer]) -> None:
        """
        Deal 2 hole cards to each active player in clockwise order.

        Standard two-pass deal: one card to each player, then a second
        card to each player.  No burn card before hole cards.

        Args:
            players: Active players in seat order (dealer position first
                     or UTG first — the caller controls order).
        """
        active = [p for p in players if p.is_active]
        for _ in range(2):
            for player in active:
                card = self.deck.deal(1)
                player.receive_cards(card)

    # ------------------------------------------------------------------
    # Community cards (each preceded by a burn card)
    # ------------------------------------------------------------------

    def deal_flop(self, community: List[Card]) -> None:
        """
        Burn one card then add three community cards (the Flop).

        Args:
            community: The shared list on the Table; modified in place.
        """
        self.deck.burn()
        community.extend(self.deck.deal(3))

    def deal_turn(self, community: List[Card]) -> None:
        """
        Burn one card then add one community card (the Turn).

        Args:
            community: The shared list on the Table; modified in place.
        """
        self.deck.burn()
        community.extend(self.deck.deal(1))

    def deal_river(self, community: List[Card]) -> None:
        """
        Burn one card then add one community card (the River).

        Args:
            community: The shared list on the Table; modified in place.
        """
        self.deck.burn()
        community.extend(self.deck.deal(1))
