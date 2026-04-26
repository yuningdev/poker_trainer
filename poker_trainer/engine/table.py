"""
Table — seat layout, blind levels, and community card storage.

The Table represents the physical playing surface.  It knows who is
seated, where the dealer button is, and what cards are face-up.  It does
NOT run game logic — that belongs to Game.

Design note:
    Table is deliberately passive (a data store + seat manager).
    This separation keeps Game's logic readable and ensures Table can be
    serialized / inspected without pulling in game-flow state.
"""

from __future__ import annotations

from typing import List

from poker_trainer.cards.card import Card
from poker_trainer.engine.pot import Pot
from poker_trainer.players.base_player import BasePlayer


class Table:
    """
    Represents the poker table for a single session.

    Attributes:
        seats:           All players at the table, in seat order.
        dealer_position: Index into *seats* of the current dealer button.
        small_blind:     Small blind chip amount.
        big_blind:       Big blind chip amount (typically 2× small blind).
        community_cards: Face-up board cards (0–5 during a hand).
        pot:             The Pot object tracking all chip contributions.

    Usage:
        table = Table(players, small_blind=10, big_blind=20)
        table.rotate_dealer()
        active = table.get_active_players()
    """

    def __init__(
        self,
        players: List[BasePlayer],
        small_blind: int = 10,
        big_blind: int = 20,
    ) -> None:
        if len(players) < 2:
            raise ValueError("A table needs at least 2 players.")
        self.seats: List[BasePlayer] = players
        self.dealer_position: int = 0
        self.small_blind: int = small_blind
        self.big_blind: int = big_blind
        self.community_cards: List[Card] = []
        self.pot: Pot = Pot()

    # ------------------------------------------------------------------
    # Hand setup helpers
    # ------------------------------------------------------------------

    def reset_for_new_hand(self) -> None:
        """
        Clear community cards, reset the pot, and reset each player's
        per-hand state (hole cards, is_active, current_bet).

        Bust players (chips == 0) are explicitly deactivated so they are
        never dealt cards or included in betting rounds.
        """
        self.community_cards = []
        self.pot.reset()
        for player in self.seats:
            player.clear_hand()          # clears hole cards, resets bet, sets is_active=True
            if player.chips == 0:
                player.is_active = False  # bust — cannot play this hand

    def rotate_dealer(self) -> None:
        """
        Move the dealer button one seat clockwise to the next player who
        still has chips.
        """
        n = len(self.seats)
        for _ in range(n):
            self.dealer_position = (self.dealer_position + 1) % n
            if self.seats[self.dealer_position].chips > 0:
                return

    # ------------------------------------------------------------------
    # Seat access helpers
    # ------------------------------------------------------------------

    def get_active_players(self) -> List[BasePlayer]:
        """Return players who have not folded and have chips."""
        return [p for p in self.seats if p.is_active and p.chips >= 0]

    def get_players_with_chips(self) -> List[BasePlayer]:
        """Return all players who still have a non-zero chip stack."""
        return [p for p in self.seats if p.chips > 0]

    def seat_order_from(self, start_index: int) -> List[BasePlayer]:
        """
        Return all seats starting from *start_index*, wrapping around.

        Args:
            start_index: Index into self.seats to start from.

        Returns:
            All players in clockwise order beginning at start_index.
        """
        n = len(self.seats)
        return [self.seats[(start_index + i) % n] for i in range(n)]

    @property
    def small_blind_position(self) -> int:
        """Index of the small blind seat (one left of dealer)."""
        n = len(self.seats)
        for i in range(1, n + 1):
            idx = (self.dealer_position + i) % n
            if self.seats[idx].chips > 0:
                return idx
        return (self.dealer_position + 1) % n

    @property
    def big_blind_position(self) -> int:
        """Index of the big blind seat (two left of dealer)."""
        n = len(self.seats)
        sb = self.small_blind_position
        for i in range(1, n + 1):
            idx = (sb + i) % n
            if self.seats[idx].chips > 0:
                return idx
        return (sb + 1) % n

    def __repr__(self) -> str:
        names = [p.name for p in self.seats]
        return (
            f"Table(seats={names}, dealer={self.dealer_position}, "
            f"pot={self.pot.total})"
        )
