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
