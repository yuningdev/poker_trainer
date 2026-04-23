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

    def calculate_eligible_players(
        self,
    ) -> List[Tuple["BasePlayer", int]]:
        """
        Compute the maximum amount each eligible player can win.

        This handles all-in situations by splitting the pot into layers.
        A player can only win, from each opponent, as many chips as they
        themselves contributed from that opponent.

        Returns:
            A list of (player, max_winnable_amount) tuples, sorted by
            max_winnable_amount ascending.  Pass this to the showdown
            resolver to award pots in the correct order.

        Example:
            Player A contributed 100, Player B 200, Player C 200.
            A can win at most 100×3=300 (main pot).
            B and C split the 200 side pot if A wins the main.
        """
        if not self._contributions:
            return []

        players = list(self._contributions.keys())
        contribs = dict(self._contributions)  # copy

        result: List[Tuple["BasePlayer", int]] = []

        # Process from smallest to largest contribution.
        sorted_by_contrib = sorted(contribs.items(), key=lambda x: x[1])

        remaining: Dict["BasePlayer", int] = dict(contribs)
        for player, cap in sorted_by_contrib:
            if remaining.get(player, 0) == 0:
                continue
            # This player can win cap chips from every other player.
            pot_slice = 0
            for p in players:
                take = min(remaining.get(p, 0), cap)
                pot_slice += take
                remaining[p] = remaining.get(p, 0) - take
            if pot_slice > 0:
                result.append((player, pot_slice))

        return result

    def __repr__(self) -> str:
        entries = ", ".join(
            f"{p.name}:{v}" for p, v in self._contributions.items()
        )
        return f"Pot(total={self.total}, [{entries}])"
