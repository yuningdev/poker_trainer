"""
5-of-7 Texas Hold'em hand evaluator.

Algorithm:
    1. Generate all C(n, 5) five-card combinations from hole + community cards.
    2. Evaluate each combination and keep the best HandResult.
    3. HandResult carries a (HandRank, tiebreakers) tuple so two results
       are fully comparable with standard Python tuple comparison.

Tiebreaker lists are always rank-values in descending significance order,
making multi-player comparison trivial: max(results).
"""

from dataclasses import dataclass, field
from itertools import combinations
from typing import List

from poker_trainer.cards.card import Card
from poker_trainer.utils.constants import HandRank, Rank


@dataclass
class HandResult:
    """
    The best five-card hand that can be made from a player's cards.

    Attributes:
        rank:        The HandRank category (e.g. FLUSH, TWO_PAIR).
        tiebreakers: Rank values (ints) in descending significance.
                     Used to break ties within the same HandRank.
        cards:       The five cards that form this hand.
    """

    rank: HandRank
    tiebreakers: List[int]
    cards: List[Card]

    # Make HandResult directly comparable (higher is better).
    def __lt__(self, other: "HandResult") -> bool:
        return (self.rank.value, self.tiebreakers) < (
            other.rank.value,
            other.tiebreakers,
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, HandResult):
            return NotImplemented
        return (self.rank.value, self.tiebreakers) == (
            other.rank.value,
            other.tiebreakers,
        )

    def __le__(self, other: "HandResult") -> bool:
        return self < other or self == other

    def __gt__(self, other: "HandResult") -> bool:
        return not self <= other

    def __ge__(self, other: "HandResult") -> bool:
        return not self < other

    def display(self) -> str:
        cards_str = "  ".join(str(c) for c in self.cards)
        return f"{self.rank.display_name()}  [{cards_str}]"


class HandEvaluator:
    """
    Stateless evaluator for Texas Hold'em hands.

    Usage:
        result = HandEvaluator.evaluate(hole_cards, community_cards)
        print(result.rank.display_name())
    """

    @staticmethod
    def evaluate(hole: List[Card], community: List[Card]) -> HandResult:
        """
        Find the best 5-card hand from *hole* + *community* cards.

        Args:
            hole:      The player's 2 hole cards.
            community: 3, 4, or 5 community cards (fewer on early streets).

        Returns:
            The best HandResult achievable.

        Raises:
            ValueError: If fewer than 2 cards are provided in total.
        """
        all_cards = hole + community
        if len(all_cards) < 2:
            raise ValueError("Need at least 2 cards to evaluate a hand.")

        # When fewer than 5 cards are available, evaluate with what we have.
        n = min(5, len(all_cards))
        best: HandResult | None = None
        for combo in combinations(all_cards, n):
            result = HandEvaluator._evaluate_five(list(combo))
            if best is None or result > best:
                best = result

        assert best is not None
        return best

    # ------------------------------------------------------------------
    # Private: evaluate exactly 5 cards
    # ------------------------------------------------------------------

    @staticmethod
    def _evaluate_five(cards: List[Card]) -> HandResult:
        """Classify a 5-card hand and return its HandResult."""
        ranks = sorted([c.rank.value for c in cards], reverse=True)
        suits = [c.suit for c in cards]
        is_flush = len(set(suits)) == 1
        is_straight, straight_high = HandEvaluator._check_straight(ranks)

        rank_counts: dict[int, int] = {}
        for r in ranks:
            rank_counts[r] = rank_counts.get(r, 0) + 1

        # Sort groups: (count desc, rank desc) for tiebreaker ordering.
        groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
        group_counts = [g[1] for g in groups]
        group_ranks = [g[0] for g in groups]

        def make(hr: HandRank, tb: List[int]) -> HandResult:
            return HandResult(rank=hr, tiebreakers=tb, cards=cards)

        # --- Royal Flush ---
        if is_flush and is_straight and straight_high == Rank.ACE.value:
            return make(HandRank.ROYAL_FLUSH, [straight_high])

        # --- Straight Flush ---
        if is_flush and is_straight:
            return make(HandRank.STRAIGHT_FLUSH, [straight_high])

        # --- Four of a Kind ---
        if group_counts == [4, 1]:
            return make(HandRank.FOUR_OF_A_KIND, group_ranks)

        # --- Full House ---
        if group_counts == [3, 2]:
            return make(HandRank.FULL_HOUSE, group_ranks)

        # --- Flush ---
        if is_flush:
            return make(HandRank.FLUSH, ranks)

        # --- Straight ---
        if is_straight:
            return make(HandRank.STRAIGHT, [straight_high])

        # --- Three of a Kind ---
        if group_counts == [3, 1, 1]:
            return make(HandRank.THREE_OF_A_KIND, group_ranks)

        # --- Two Pair ---
        if group_counts == [2, 2, 1]:
            return make(HandRank.TWO_PAIR, group_ranks)

        # --- One Pair ---
        if group_counts == [2, 1, 1, 1]:
            return make(HandRank.ONE_PAIR, group_ranks)

        # --- High Card ---
        return make(HandRank.HIGH_CARD, ranks)

    @staticmethod
    def _check_straight(ranks: List[int]) -> tuple[bool, int]:
        """
        Check whether sorted-descending rank values form a straight.

        Returns:
            (is_straight, high_card_value)
            For the wheel (A-2-3-4-5), high_card_value is 5.
        """
        unique = sorted(set(ranks), reverse=True)
        if len(unique) < 5:
            return False, 0
        # Normal straight: 5 consecutive values.
        if unique[0] - unique[4] == 4:
            return True, unique[0]
        # Wheel: A-2-3-4-5 (Ace plays low).
        if unique == [Rank.ACE.value, 5, 4, 3, 2]:
            return True, 5
        return False, 0
