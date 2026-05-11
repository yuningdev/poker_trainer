"""
Pot management — tracks chip contributions and resolves side pots.

Side pots arise when a player goes all-in for less than others have
wagered.  They ensure an all-in player can only win as many chips as
they are eligible for (i.e., their contribution × number of callers).

Design note:
    Pot is purely a data structure + calculation helper.  It does NOT
    award chips — that responsibility belongs to Game._award_pot().
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, List, Tuple

if TYPE_CHECKING:
    from poker_trainer.players.base_player import BasePlayer


class Pot:
    """
    Tracks every player's total chip contribution to the pot this hand.

    Attributes:
        _contributions: Maps each player to their total chips in the pot.

    Usage:
        pot = Pot()
        pot.add(player_a, 100)
        pot.add(player_b, 50)
        print(pot.total)   # 150
        for player, max_win in pot.calculate_eligible_players():
            ...
    """

    def __init__(self) -> None:
        self._contributions: Dict["BasePlayer", int] = {}

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def add(self, player: "BasePlayer", amount: int) -> None:
        """Add *amount* chips from *player* to the pot."""
        self._contributions[player] = self._contributions.get(player, 0) + amount

    def reset(self) -> None:
        """Clear all contributions (called at the start of a new hand)."""
        self._contributions.clear()

    @property
    def total(self) -> int:
        """Total chips currently in the pot."""
        return sum(self._contributions.values())

    def get_contribution(self, player: "BasePlayer") -> int:
        """Return how many chips *player* has contributed this hand."""
        return self._contributions.get(player, 0)

    # ------------------------------------------------------------------
    # Side-pot calculation
    # ------------------------------------------------------------------

    def calculate_side_pots(
        self,
    ) -> List[Tuple[int, List["BasePlayer"]]]:
        """
        Split the pot into side pots, each with its set of eligible winners.

        Works by processing contribution levels from smallest to largest.
        At each level, every player who contributed at least that amount is
        eligible to contest that slice.

        Returns:
            [(amount, [eligible_players]), ...] from main pot to largest
            side pot.  An "eligible player" is one whose total contribution
            covers that level.

        Examples:
            A=1000, B=400 (both all-in):
              → [(800, [A, B]),  # main pot: 400 × 2
                 (600, [A])]     # excess: returned to A automatically

            A=1000, B=400, C=200 (all all-in):
              → [(600, [A,B,C]), # main pot: 200 × 3
                 (400, [A,B]),   # side pot 1: (400-200) × 2
                 (600, [A])]     # side pot 2: A's excess, returned to A
        """
        if not self._contributions:
            return []

        all_players = list(self._contributions.keys())
        remaining: Dict["BasePlayer", int] = dict(self._contributions)

        # Unique contribution caps, ascending
        caps = sorted(set(self._contributions.values()))
        pots: List[Tuple[int, List["BasePlayer"]]] = []
        prev_cap = 0

        for cap in caps:
            level = cap - prev_cap
            # Players whose total contribution reaches this cap are eligible.
            eligible = [p for p in all_players if self._contributions[p] >= cap]

            # Each player contributes at most `level` chips to this slice.
            slice_amount = 0
            for p in all_players:
                take = min(remaining.get(p, 0), level)
                slice_amount += take
                remaining[p] = remaining.get(p, 0) - take

            if slice_amount > 0:
                pots.append((slice_amount, eligible))

            prev_cap = cap

        return pots

    # kept for backward compatibility; prefer calculate_side_pots()
    def calculate_eligible_players(
        self,
    ) -> List[Tuple["BasePlayer", int]]:
        """Legacy wrapper — returns (player, max_win) like the old API."""
        return [(eligible[0], amount) for amount, eligible in self.calculate_side_pots()]

    def __repr__(self) -> str:
        entries = ", ".join(
            f"{p.name}:{v}" for p, v in self._contributions.items()
        )
        return f"Pot(total={self.total}, [{entries}])"
