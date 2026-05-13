"""
Stress test for the poker engine.
Tests chip conservation, side pots, chop scenarios, and action legality
across 20 hands with 8 players (mix of aggressive/passive/random bots).

Chip conservation invariants:
  - DURING a hand: sum(player.chips) + pot.total == starting_total
  - AFTER awarding (before next hand reset):
      sum(player.chips) == starting_total
      (pot.total still shows old contributions — not a bug, will reset)
"""
from __future__ import annotations

import random
import sys
from typing import List, Dict, Tuple, Optional

sys.path.insert(0, "/Users/rickchang/Desktop/new life/poker/poker_trainer")

from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.pot import Pot
from poker_trainer.players.base_player import BasePlayer
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.ui.renderer import Renderer
from poker_trainer.utils.constants import Action, Phase
from poker_trainer.strategies.base_strategy import GameState
from poker_trainer.cards.hand_evaluator import HandEvaluator


# ──────────────────────────────────────────────
# Silent renderer
# ──────────────────────────────────────────────

class SilentRenderer(Renderer):
    def show_hand_separator(self, hand_num): pass
    def show_phase_header(self, phase): pass
    def show_action(self, name, text): pass
    def show_showdown(self, players, community): pass
    def show_hand_result(self, winner, hand, amount): pass
    def show_message(self, msg): pass
    def show_table(self, table, player): pass
    def show_bot_thinking(self, name): pass
    def show_bust(self, name): pass
    def show_game_over(self, winner, chips): pass


# ──────────────────────────────────────────────
# Instrumented Game
# ──────────────────────────────────────────────

class InstrumentedGame(Game):
    """Game subclass that records chip conservation violations."""

    def __init__(self, table, dealer, renderer, starting_total: int):
        super().__init__(table, dealer, renderer)
        self.starting_total = starting_total
        self.violations: List[str] = []
        self._RUNOUT_DELAY = 0  # No sleep in stress test
        self._in_hand = False  # Track whether we're mid-hand

    def _check_mid_hand(self, context: str) -> None:
        """During a hand: sum(chips) + pot == starting_total."""
        if not self._in_hand:
            return
        all_chips = sum(p.chips for p in self.table.seats)
        pot = self.table.pot.total
        total = all_chips + pot
        if total != self.starting_total:
            msg = (
                f"MID-HAND CONSERVATION VIOLATION at {context}: "
                f"players={all_chips}, pot={pot}, total={total}, "
                f"expected={self.starting_total} "
                f"(diff={total - self.starting_total:+d})"
            )
            self.violations.append(msg)
            print(f"  *** VIOLATION: {msg}")

    def _check_post_hand(self, context: str) -> None:
        """After awarding: sum(chips) == starting_total (pot not yet cleared)."""
        all_chips = sum(p.chips for p in self.table.seats)
        if all_chips != self.starting_total:
            msg = (
                f"POST-HAND CONSERVATION VIOLATION at {context}: "
                f"players={all_chips}, expected={self.starting_total} "
                f"(diff={all_chips - self.starting_total:+d})"
            )
            self.violations.append(msg)
            print(f"  *** VIOLATION: {msg}")

    def _play_hand(self) -> None:
        self._in_hand = True
        # Don't check before reset_for_new_hand() — pot will be stale from last hand.
        # reset_for_new_hand() is the first call inside super()._play_hand().
        super()._play_hand()
        self._in_hand = False
        self._check_post_hand(f"end of hand #{self._hand_num}")

    def _award_pot(self) -> None:
        pot_before = self.table.pot.total
        chips_before_award = {p: p.chips for p in self.table.seats}

        super()._award_pot()

        # Verify total winnings == pot_before
        total_won = sum(
            p.chips - chips_before_award[p]
            for p in self.table.seats
            if p.chips > chips_before_award[p]
        )
        if total_won != pot_before:
            msg = (
                f"POT DISTRIBUTION ERROR in hand #{self._hand_num}: "
                f"pot was {pot_before}, distributed {total_won} "
                f"(diff={total_won - pot_before:+d})"
            )
            self.violations.append(msg)
            print(f"  *** VIOLATION: {msg}")

    def _post_blinds(self) -> None:
        sb_idx = self.table.small_blind_position
        bb_idx = self.table.big_blind_position
        if sb_idx == bb_idx:
            msg = f"BLIND ERROR in hand #{self._hand_num}: SB==BB at seat {sb_idx}"
            self.violations.append(msg)
            print(f"  *** VIOLATION: {msg}")
        super()._post_blinds()
        # After blinds: chips moved to pot, check mid-hand invariant
        self._check_mid_hand(f"after blinds, hand #{self._hand_num}")

    def _betting_round(self, start_pos: int, opening_round: bool = False) -> None:
        super()._betting_round(start_pos, opening_round)
        self._check_mid_hand(f"after betting round hand #{self._hand_num}")


# ──────────────────────────────────────────────
# Direct chop logic test
# ──────────────────────────────────────────────

def test_chop_logic_direct():
    """
    Directly test _split_pot_among_winners for correct chop behavior.
    """
    print("\n" + "="*60)
    print("DIRECT CHOP LOGIC TEST")
    print("="*60)

    from poker_trainer.cards.card import Card
    from poker_trainer.cards.hand_evaluator import HandEvaluator
    from poker_trainer.utils.constants import Rank, Suit
    from poker_trainer.players.bot_player import BotPlayer
    from poker_trainer.strategies.passive_strategy import PassiveStrategy

    violations = []

    def make_player(name, chips=0):
        p = BotPlayer(name, chips, PassiveStrategy())
        p.is_active = True
        return p

    # Community board that makes both players use it as their best 5-card hand
    # (Royal Flush board — both players' hole cards are irrelevant)
    royal_board = [
        Card(Rank.ACE, Suit.SPADES), Card(Rank.KING, Suit.SPADES),
        Card(Rank.QUEEN, Suit.SPADES), Card(Rank.JACK, Suit.SPADES),
        Card(Rank.TEN, Suit.SPADES),
    ]

    # ── Test 1: Even split ──
    print("\nTest 1: Two-way chop, even split (pot=200)")
    p1, p2 = make_player("A"), make_player("B")
    p1.hole_cards = [Card(Rank.TWO, Suit.HEARTS), Card(Rank.THREE, Suit.DIAMONDS)]
    p2.hole_cards = [Card(Rank.TWO, Suit.CLUBS), Card(Rank.THREE, Suit.SPADES)]
    players = [p1, p2]
    table = Table(players, small_blind=10, big_blind=20)
    table.community_cards = royal_board
    table.pot._contributions = {p1: 100, p2: 100}
    game = Game(table, Dealer(), SilentRenderer())
    game._RUNOUT_DELAY = 0

    hr = {p1: HandEvaluator.evaluate(p1.hole_cards, royal_board),
          p2: HandEvaluator.evaluate(p2.hole_cards, royal_board)}
    result = game._split_pot_among_winners(200, [p1, p2], hr)
    assert p1.chips == 100 and p2.chips == 100, f"Expected 100/100, got {p1.chips}/{p2.chips}"
    total = p1.chips + p2.chips
    assert total == 200, f"Total should be 200, got {total}"
    print(f"  PASS: A={p1.chips}, B={p2.chips}")

    # ── Test 2: Odd chip to SB ──
    print("\nTest 2: Two-way chop, odd chip (pot=201, SB gets it)")
    p1, p2 = make_player("A"), make_player("B")
    p1.hole_cards = [Card(Rank.TWO, Suit.HEARTS), Card(Rank.THREE, Suit.DIAMONDS)]
    p2.hole_cards = [Card(Rank.TWO, Suit.CLUBS), Card(Rank.THREE, Suit.SPADES)]
    players = [p1, p2]
    # dealer=0, so SB=1 (p2)
    table = Table(players, small_blind=10, big_blind=20)
    table.community_cards = royal_board
    table.pot._contributions = {p1: 101, p2: 100}
    game = Game(table, Dealer(), SilentRenderer())
    game._RUNOUT_DELAY = 0

    hr = {p1: HandEvaluator.evaluate(p1.hole_cards, royal_board),
          p2: HandEvaluator.evaluate(p2.hole_cards, royal_board)}
    result = game._split_pot_among_winners(201, [p1, p2], hr)
    total = p1.chips + p2.chips
    assert total == 201, f"Total should be 201, got {total}"
    # SB is p2 (seat 1), odd chip goes to SB
    assert p2.chips == 101, f"SB (p2) should get 101 (odd chip), got {p2.chips}"
    assert p1.chips == 100, f"p1 should get 100, got {p1.chips}"
    print(f"  SB=p2, A={p1.chips}, B={p2.chips} (B gets odd chip)")
    print(f"  PASS")

    # ── Test 3: Three-way chop ──
    print("\nTest 3: Three-way chop (pot=300)")
    p1, p2, p3 = make_player("A"), make_player("B"), make_player("C")
    for p in [p1, p2, p3]:
        p.hole_cards = [Card(Rank.TWO, Suit.HEARTS), Card(Rank.THREE, Suit.DIAMONDS)]
    players = [p1, p2, p3]
    table = Table(players, small_blind=10, big_blind=20)
    table.community_cards = royal_board
    table.pot._contributions = {p1: 100, p2: 100, p3: 100}
    game = Game(table, Dealer(), SilentRenderer())
    game._RUNOUT_DELAY = 0

    hr = {p: HandEvaluator.evaluate(p.hole_cards, royal_board) for p in players}
    result = game._split_pot_among_winners(300, [p1, p2, p3], hr)
    total = p1.chips + p2.chips + p3.chips
    assert total == 300, f"Total should be 300, got {total}"
    assert p1.chips == 100 and p2.chips == 100 and p3.chips == 100
    print(f"  PASS: A=B=C=100")

    # ── Test 4: Three-way chop with 2 odd chips ──
    print("\nTest 4: Three-way chop (pot=302, 2 odd chips)")
    p1, p2, p3 = make_player("A"), make_player("B"), make_player("C")
    for p in [p1, p2, p3]:
        p.hole_cards = [Card(Rank.TWO, Suit.HEARTS), Card(Rank.THREE, Suit.DIAMONDS)]
    players = [p1, p2, p3]
    # dealer=0: SB=1 (p2), BB=2 (p3), so distance from SB: p2=0, p3=1, p1=2
    table = Table(players, small_blind=10, big_blind=20)
    table.community_cards = royal_board
    game = Game(table, Dealer(), SilentRenderer())
    game._RUNOUT_DELAY = 0

    hr = {p: HandEvaluator.evaluate(p.hole_cards, royal_board) for p in players}
    result = game._split_pot_among_winners(302, [p1, p2, p3], hr)
    total = p1.chips + p2.chips + p3.chips
    assert total == 302, f"Total should be 302, got {total}"
    # 302 // 3 = 100, remainder = 2
    # Closest to SB: p2 (SB itself), then p3, then p1
    assert p2.chips == 101, f"SB (p2) should get 101, got {p2.chips}"
    assert p3.chips == 101, f"BB (p3) should get 101, got {p3.chips}"
    assert p1.chips == 100, f"Dealer (p1) should get 100, got {p1.chips}"
    print(f"  SB=p2, BB=p3, Dealer=p1: A={p1.chips}, B={p2.chips}, C={p3.chips}")
    print(f"  PASS")

    # ── Test 5: Single winner (no chop) ──
    print("\nTest 5: Single winner wins full pot")
    from poker_trainer.cards.hand_evaluator import HandResult
    from poker_trainer.utils.constants import HandRank
    p1, p2 = make_player("Winner"), make_player("Loser")
    players = [p1, p2]
    table = Table(players, small_blind=10, big_blind=20)
    table.community_cards = []
    game = Game(table, Dealer(), SilentRenderer())
    game._RUNOUT_DELAY = 0

    hr = {
        p1: HandResult(HandRank.ROYAL_FLUSH, [14], []),
        p2: HandResult(HandRank.HIGH_CARD, [2], []),
    }
    result = game._split_pot_among_winners(500, [p1, p2], hr)
    assert p1.chips == 500, f"Winner should get 500, got {p1.chips}"
    assert p2.chips == 0, f"Loser should get 0, got {p2.chips}"
    print(f"  PASS: Winner=500, Loser=0")

    print(f"\nAll chop logic tests PASSED!")
    return violations


# ──────────────────────────────────────────────
# Side pot unit tests
# ──────────────────────────────────────────────

def test_side_pot_calculation():
    print("\n" + "="*60)
    print("UNIT TESTS: Side Pot Calculation")
    print("="*60)

    class MockPlayer:
        def __init__(self, name): self.name = name

    # Test 1: A=1000, B=400
    print("\nTest 1: A=1000, B=400")
    p_a, p_b = MockPlayer("A"), MockPlayer("B")
    pot = Pot()
    pot.add(p_a, 1000)
    pot.add(p_b, 400)
    side_pots = pot.calculate_side_pots()
    print(f"  Side pots: {[(amt, [p.name for p in elig]) for amt, elig in side_pots]}")
    # A put in 1000, B put in 400.
    # cap=400: 400×2=800 for [A,B]. cap=1000: (1000-400)×1=600 for [A].
    assert len(side_pots) == 2, f"Expected 2 side pots, got {len(side_pots)}"
    assert side_pots[0][0] == 800, f"Main pot should be 800, got {side_pots[0][0]}"
    assert p_a in side_pots[0][1] and p_b in side_pots[0][1]
    assert side_pots[1][0] == 600, f"A's excess should be 600, got {side_pots[1][0]}"
    assert p_a in side_pots[1][1] and p_b not in side_pots[1][1]
    total = sum(amt for amt, _ in side_pots)
    assert total == 1400
    print(f"  PASS: Total={total}")

    # Test 2: A=1000, B=400, C=200
    print("\nTest 2: A=1000, B=400, C=200")
    p_a, p_b, p_c = MockPlayer("A"), MockPlayer("B"), MockPlayer("C")
    pot = Pot()
    pot.add(p_a, 1000)
    pot.add(p_b, 400)
    pot.add(p_c, 200)
    side_pots = pot.calculate_side_pots()
    print(f"  Side pots: {[(amt, [p.name for p in elig]) for amt, elig in side_pots]}")
    total = sum(amt for amt, _ in side_pots)
    assert total == 1600, f"Total should be 1600, got {total}"
    # C's level: 200×3=600. B's extra: (400-200)×2=400. A's excess: 600.
    assert side_pots[0][0] == 600 and set(side_pots[0][1]) == {p_a, p_b, p_c}
    assert side_pots[1][0] == 400 and set(side_pots[1][1]) == {p_a, p_b}
    assert side_pots[2][0] == 600 and side_pots[2][1] == [p_a]
    print(f"  PASS: Total={total}")

    # Test 3: Equal stacks
    print("\nTest 3: A=B=C=500 (equal)")
    p_a, p_b, p_c = MockPlayer("A"), MockPlayer("B"), MockPlayer("C")
    pot = Pot()
    pot.add(p_a, 500)
    pot.add(p_b, 500)
    pot.add(p_c, 500)
    side_pots = pot.calculate_side_pots()
    total = sum(amt for amt, _ in side_pots)
    assert total == 1500
    assert len(side_pots) == 1
    print(f"  PASS: Total={total}, single pot")

    # Test 4: A=1000, B=700, C=400, D=200
    print("\nTest 4: A=1000, B=700, C=400, D=200")
    p_a, p_b, p_c, p_d = MockPlayer("A"), MockPlayer("B"), MockPlayer("C"), MockPlayer("D")
    pot = Pot()
    pot.add(p_a, 1000)
    pot.add(p_b, 700)
    pot.add(p_c, 400)
    pot.add(p_d, 200)
    side_pots = pot.calculate_side_pots()
    print(f"  Side pots: {[(amt, [p.name for p in elig]) for amt, elig in side_pots]}")
    total = sum(amt for amt, _ in side_pots)
    assert total == 2300, f"Total should be 2300, got {total}"
    assert side_pots[0][0] == 800, f"D's level pot should be 800"
    assert p_d in side_pots[0][1]
    assert p_d not in side_pots[1][1]
    print(f"  PASS: Total={total}")

    # Test 5: Chip conservation — total of side pots always == sum of contributions
    print("\nTest 5: Chip conservation invariant")
    import random as rng
    rng.seed(99)
    for trial in range(20):
        class P:
            def __init__(self, n): self.name = n
        players_t = [P(f"p{i}") for i in range(rng.randint(2, 6))]
        contributions = {p: rng.randint(1, 1000) for p in players_t}
        pot2 = Pot()
        for p, amt in contributions.items():
            pot2.add(p, amt)
        total_in = sum(contributions.values())
        sp = pot2.calculate_side_pots()
        total_out = sum(a for a, _ in sp)
        assert total_in == total_out, f"Trial {trial}: in={total_in} out={total_out}"
    print("  PASS: 20 random trials all conserve chips")

    print("\nAll side pot unit tests PASSED!")
    return []


# ──────────────────────────────────────────────
# Chop / split pot test
# ──────────────────────────────────────────────

def test_chop_scenario():
    print("\n" + "="*60)
    print("UNIT TEST: Chop / Split Pot (via live game)")
    print("="*60)

    # We can't force a chop easily, but we verify chip conservation through
    # a game where ties are possible.
    players = [
        PlayerFactory.create("passive", f"Chop{i}", 200)
        for i in range(4)
    ]
    total = sum(p.chips for p in players)

    table = Table(players, small_blind=10, big_blind=20)
    dealer = Dealer()
    renderer = SilentRenderer()
    game = InstrumentedGame(table, dealer, renderer, starting_total=total)

    random.seed(777)
    for _ in range(10):
        if game._is_game_over():
            break
        game._hand_num += 1
        game._play_hand()
        game._remove_bust_players()

    print(f"  Played {game._hand_num} hands. Violations: {len(game.violations)}")
    if game.violations:
        for v in game.violations:
            print(f"  - {v}")
    else:
        print("  PASS: No violations in chop test game")

    return game.violations


# ──────────────────────────────────────────────
# BB action legality test
# ──────────────────────────────────────────────

def test_bb_action_preflop():
    print("\n" + "="*60)
    print("EDGE CASE TEST: BB action pre-flop (everyone limps)")
    print("="*60)

    from poker_trainer.players.bot_player import BotPlayer
    from poker_trainer.strategies.passive_strategy import PassiveStrategy

    bb_acted = []

    class TrackingPlayer(BotPlayer):
        def __init__(self, name, chips, track_bb=False):
            super().__init__(name, chips, PassiveStrategy())
            self.track_bb = track_bb
            self.decide_calls = 0

        def decide(self, state):
            self.decide_calls += 1
            if self.track_bb:
                bb_acted.append(state)
                if Action.CHECK in state.legal_actions:
                    return Action.CHECK, 0
            # All others: call (limp)
            if Action.CALL in state.legal_actions:
                return Action.CALL, state.current_bet - state.player_current_bet
            if Action.CHECK in state.legal_actions:
                return Action.CHECK, 0
            return Action.FOLD, 0

    players = [
        TrackingPlayer("P1", 1000),
        TrackingPlayer("P2", 1000),
        TrackingPlayer("BB", 1000, track_bb=True),
        TrackingPlayer("P4", 1000),
    ]

    # P1 = dealer (position 0), P2 = SB, BB = BB, P4 = UTG
    table = Table(players, small_blind=10, big_blind=20)
    dealer = Dealer()
    renderer = SilentRenderer()
    game = Game(table, dealer, renderer)
    game._RUNOUT_DELAY = 0
    game._hand_num = 1
    game._play_hand()

    bb_player = players[2]
    print(f"  BB decide() called {bb_player.decide_calls} time(s)")
    print(f"  BB states received: {len(bb_acted)}")

    violations = []
    if len(bb_acted) == 0:
        msg = "BB NEVER GOT TO ACT (may be a bug if everyone just called)"
        violations.append(msg)
        print(f"  *** {msg}")
    else:
        first_state = bb_acted[0]
        if Action.CHECK in first_state.legal_actions:
            print("  PASS: BB correctly got option to check when everyone limped")
        else:
            print(f"  NOTE: BB first action had legal_actions={first_state.legal_actions} (may have been raised to)")

    return violations


# ──────────────────────────────────────────────
# Multi-way all-in edge case
# ──────────────────────────────────────────────

def test_multiway_allin_game():
    print("\n" + "="*60)
    print("EDGE CASE TEST: Multi-way all-in game (different stack sizes)")
    print("="*60)

    player_configs = [
        ("Short", 100, "aggressive"),
        ("Medium", 500, "aggressive"),
        ("Deep", 2000, "aggressive"),
        ("ShortB", 150, "aggressive"),
    ]
    total_chips = sum(chips for _, chips, _ in player_configs)

    players = [
        PlayerFactory.create(strategy, name, chips)
        for name, chips, strategy in player_configs
    ]

    table = Table(players, small_blind=25, big_blind=50)
    dealer = Dealer()
    renderer = SilentRenderer()
    game = InstrumentedGame(table, dealer, renderer, starting_total=total_chips)

    random.seed(55)
    for hand_idx in range(15):
        alive = table.get_players_with_chips()
        if len(alive) <= 1:
            print(f"  Game ended after {hand_idx} hands (only 1 player left)")
            break
        game._hand_num += 1
        game._play_hand()
        game._remove_bust_players()
        total_player_chips = sum(p.chips for p in players)
        if total_player_chips != total_chips:
            msg = f"POST-HAND VIOLATION hand #{game._hand_num}: player chips={total_player_chips}, expected={total_chips}"
            game.violations.append(msg)
            print(f"  *** {msg}")

    print(f"  Played {game._hand_num} hands. Violations: {len(game.violations)}")
    if game.violations:
        for v in game.violations:
            print(f"    {v}")
    else:
        print("  PASS: No chip violations in multi-way all-in test")
    return game.violations


# ──────────────────────────────────────────────
# Main stress test
# ──────────────────────────────────────────────

def run_stress_test(
    num_hands: int = 20,
    num_players: int = 8,
    starting_chips: int = 1000,
    small_blind: int = 10,
    big_blind: int = 20,
    seed: int = 42,
    label: str = "",
    strategies: List[str] = None,
) -> List[str]:
    random.seed(seed)
    STRATEGIES = strategies or ["aggressive", "passive", "random"]

    players = [
        PlayerFactory.create(STRATEGIES[i % len(STRATEGIES)], f"P{i+1}", starting_chips)
        for i in range(num_players)
    ]
    total_chips = starting_chips * num_players

    title = f"STRESS TEST {label}: {num_players} players, {num_hands} hands, {starting_chips} chips each"
    print(f"\n{'='*60}")
    print(title)
    print("="*60)

    table = Table(players, small_blind=small_blind, big_blind=big_blind)
    dealer = Dealer()
    renderer = SilentRenderer()
    game = InstrumentedGame(table, dealer, renderer, starting_total=total_chips)

    for hand_idx in range(num_hands):
        alive = table.get_players_with_chips()
        if len(alive) <= 1:
            print(f"  Game ended after {hand_idx} hands")
            break

        game._hand_num += 1
        game._play_hand()
        game._remove_bust_players()

        # Post-hand check: sum of player chips == starting total
        total_player_chips = sum(p.chips for p in players)
        if total_player_chips != total_chips:
            msg = (
                f"POST-HAND VIOLATION hand #{game._hand_num}: "
                f"player chips={total_player_chips}, expected={total_chips}"
            )
            game.violations.append(msg)
            print(f"  *** {msg}")

    alive_count = len(table.get_players_with_chips())
    print(f"  Completed: {game._hand_num} hands, {alive_count} players alive")
    print(f"  Violations: {len(game.violations)}")
    if game.violations:
        for v in game.violations:
            print(f"    - {v}")
    else:
        print("  PASS: No violations!")

    return game.violations


# ──────────────────────────────────────────────
# Run all tests
# ──────────────────────────────────────────────

if __name__ == "__main__":
    all_violations = []

    print("POKER ENGINE STRESS TEST")
    print("=" * 60)

    all_violations.extend(test_chop_logic_direct())
    all_violations.extend(test_side_pot_calculation())
    all_violations.extend(test_chop_scenario())
    all_violations.extend(test_bb_action_preflop())
    all_violations.extend(test_multiway_allin_game())

    all_violations.extend(run_stress_test(
        num_hands=20, num_players=8, starting_chips=1000,
        small_blind=10, big_blind=20, seed=42, label="A (aggressive)"
    ))
    all_violations.extend(run_stress_test(
        num_hands=20, num_players=6, starting_chips=500,
        small_blind=25, big_blind=50, seed=123, label="B"
    ))
    all_violations.extend(run_stress_test(
        num_hands=20, num_players=8, starting_chips=300,
        small_blind=10, big_blind=20, seed=999, label="C (short stacks)"
    ))
    all_violations.extend(run_stress_test(
        num_hands=50, num_players=8, starting_chips=2000,
        small_blind=10, big_blind=20, seed=555, label="D (long game)",
        strategies=["passive", "random", "passive", "random", "passive", "random", "aggressive", "passive"]
    ))
    all_violations.extend(run_stress_test(
        num_hands=30, num_players=8, starting_chips=5000,
        small_blind=50, big_blind=100, seed=777, label="E (big blinds)",
        strategies=["passive", "passive", "random", "random", "aggressive", "passive", "random", "passive"]
    ))

    # Test chop logic directly
    v7 = test_chop_logic_direct()
    all_violations.extend(v7)

    # More seeds for thorough coverage
    for seed in [111, 222, 333, 444, 666, 888]:
        all_violations.extend(run_stress_test(
            num_hands=20, num_players=8, starting_chips=1000,
            small_blind=10, big_blind=20, seed=seed,
            label=f"seed={seed}"
        ))

    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    if all_violations:
        print(f"FAILED: {len(all_violations)} total violations found")
        for v in all_violations:
            print(f"  - {v}")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED: No violations found!")
        sys.exit(0)
