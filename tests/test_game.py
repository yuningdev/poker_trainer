"""
Integration-level tests for the game engine.

These tests run the bot-only game loop for a few hands to verify that
no exceptions are raised and that chip conservation holds (total chips
across all players remain constant throughout).
"""

import pytest
from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.ui.renderer import Renderer


def make_bot_game(chips: int = 500):
    players = [
        PlayerFactory.create("aggressive", "Alice", chips),
        PlayerFactory.create("passive", "Bob", chips),
        PlayerFactory.create("random", "Charlie", chips),
    ]
    table = Table(players, small_blind=10, big_blind=20)
    dealer = Dealer()
    renderer = Renderer()
    game = Game(table, dealer, renderer)
    return game, players


class TestChipConservation:
    """Total chips must never change — they only move between players."""

    def test_chips_conserved_single_hand(self, capsys):
        game, players = make_bot_game(chips=300)
        total_before = sum(p.chips for p in players)
        game._play_hand()
        total_after = sum(p.chips for p in players)
        assert total_before == total_after, (
            f"Chips leaked: before={total_before}, after={total_after}"
        )

    def test_chips_conserved_multiple_hands(self, capsys):
        game, players = make_bot_game(chips=300)
        total_before = sum(p.chips for p in players)
        for _ in range(5):
            if game._is_game_over():
                break
            game._play_hand()
            game._remove_bust_players()
        total_after = sum(p.chips for p in players)
        assert total_before == total_after


class TestBustPlayerExclusion:
    """Eliminated players must never re-enter the game."""

    def test_bust_player_excluded_next_hand(self, capsys):
        """After bust, player is inactive and not re-dealt cards next hand."""
        game, players = make_bot_game(chips=100)
        bust_detected = False
        for _ in range(30):
            if game._is_game_over():
                break
            game._play_hand()
            game._remove_bust_players()
            # After each hand + remove, check the start of the NEXT hand
            if any(p.chips == 0 for p in players) and not game._is_game_over():
                bust_detected = True
                # Simulate start of next hand to verify bust player excluded
                game.table.reset_for_new_hand()
                game.dealer.reset()
                game.dealer.deal_hole_cards(game.table.seat_order_from(0))
                for p in players:
                    if p.chips == 0:
                        assert not p.is_active, f"{p.name} is bust but still active"
                        assert len(p.hole_cards) == 0, (
                            f"{p.name} is bust but has {len(p.hole_cards)} hole cards"
                        )
                # Don't play further — we verified the fix
                break
        # Test is only meaningful if a bust actually occurred
        if not bust_detected:
            pytest.skip("No player busted in 30 hands — try with lower chips")

    def test_max_two_hole_cards_per_player(self, capsys):
        """No player should ever hold more than 2 hole cards mid-hand."""
        game, players = make_bot_game(chips=200)
        for _ in range(20):
            if game._is_game_over():
                break
            game.table.reset_for_new_hand()
            game.dealer.reset()
            game.dealer.deal_hole_cards(game.table.seat_order_from(0))
            for p in players:
                if p.is_active:
                    assert len(p.hole_cards) <= 2, (
                        f"{p.name} has {len(p.hole_cards)} hole cards — expected ≤ 2"
                    )
            game._play_hand()
            game._remove_bust_players()

    def test_community_cards_never_exceed_five(self, capsys):
        """Community cards must be at most 5 at any point in a hand."""
        game, players = make_bot_game(chips=300)
        for _ in range(15):
            if game._is_game_over():
                break
            game._play_hand()
            assert len(game.table.community_cards) <= 5, (
                f"Community cards exceeded 5: {len(game.table.community_cards)}"
            )
            game._remove_bust_players()

    def test_dealer_rotates_on_early_exit(self, capsys):
        """Dealer button must advance each hand as long as 2+ players have chips."""
        game, players = make_bot_game(chips=500)
        seen_positions: list[int] = [game.table.dealer_position]
        for _ in range(15):
            if game._is_game_over():
                break
            before = game.table.dealer_position
            game._play_hand()
            game._remove_bust_players()
            after = game.table.dealer_position
            # Only assert rotation when 2+ players still have chips
            active_count = sum(1 for p in players if p.chips > 0)
            if active_count >= 2:
                assert after != before, (
                    f"Dealer did not rotate (stayed at {before}) with {active_count} active players"
                )
            seen_positions.append(after)
        # Ensure we actually played hands (not trivially skipped)
        assert len(seen_positions) > 1, "No hands were played"


class TestPlayerFactory:
    def test_all_types_created(self):
        from poker_trainer.players.human_player import HumanPlayer
        from poker_trainer.players.bot_player import BotPlayer
        human = PlayerFactory.create("human", "P1", 500)
        assert isinstance(human, HumanPlayer)
        for t in ("random", "passive", "aggressive"):
            bot = PlayerFactory.create(t, "P", 500)
            assert isinstance(bot, BotPlayer)

    def test_invalid_type_raises(self):
        with pytest.raises(ValueError):
            PlayerFactory.create("cheater", "P", 500)
