"""Tests for betting strategies — all three personalities."""

import pytest
from poker_trainer.players.bot_player import BotPlayer
from poker_trainer.strategies.aggressive_strategy import AggressiveStrategy
from poker_trainer.strategies.base_strategy import GameState
from poker_trainer.strategies.passive_strategy import PassiveStrategy
from poker_trainer.strategies.random_strategy import RandomStrategy
from poker_trainer.utils.constants import Action, Phase


def make_state(
    current_bet: int = 0,
    player_current_bet: int = 0,
    player_chips: int = 500,
    min_raise: int = 20,
    legal_actions=None,
) -> GameState:
    if legal_actions is None:
        legal_actions = (Action.CHECK, Action.RAISE) if current_bet == 0 else (Action.FOLD, Action.CALL, Action.RAISE)
    return GameState(
        community_cards=(),
        pot_total=100,
        current_bet=current_bet,
        min_raise=min_raise,
        phase=Phase.PRE_FLOP,
        active_player_count=3,
        legal_actions=tuple(legal_actions),
        player_name="Bot",
        player_chips=player_chips,
        player_current_bet=player_current_bet,
    )


def make_bot(chips: int = 500) -> BotPlayer:
    return BotPlayer(name="Bot", chips=chips, strategy=RandomStrategy())


class TestRandomStrategy:
    def test_returns_legal_action(self):
        strategy = RandomStrategy()
        bot = make_bot()
        for _ in range(50):
            state = make_state()
            action, amount = strategy.decide(state, bot)
            assert action in state.legal_actions

    def test_check_state_no_amount(self):
        strategy = RandomStrategy()
        bot = make_bot()
        state = make_state(current_bet=0, legal_actions=(Action.CHECK,))
        action, amount = strategy.decide(state, bot)
        assert action == Action.CHECK
        assert amount == 0


class TestPassiveStrategy:
    def test_prefers_not_folding_for_free(self):
        """Passive player never folds when check is available."""
        strategy = PassiveStrategy()
        bot = make_bot()
        state = make_state(current_bet=0, legal_actions=(Action.CHECK, Action.RAISE))
        for _ in range(50):
            action, _ = strategy.decide(state, bot)
            assert action != Action.FOLD

    def test_returns_legal_action(self):
        strategy = PassiveStrategy()
        bot = make_bot()
        for _ in range(50):
            state = make_state(current_bet=40, player_current_bet=0)
            action, amount = strategy.decide(state, bot)
            assert action in state.legal_actions


class TestAggressiveStrategy:
    def test_never_folds_for_free(self):
        """Aggressive player never folds when check is available."""
        strategy = AggressiveStrategy()
        bot = make_bot()
        state = make_state(current_bet=0, legal_actions=(Action.CHECK, Action.RAISE))
        for _ in range(50):
            action, _ = strategy.decide(state, bot)
            assert action != Action.FOLD

    def test_returns_legal_action(self):
        strategy = AggressiveStrategy()
        bot = make_bot()
        for _ in range(50):
            state = make_state(current_bet=40, player_current_bet=0)
            action, amount = strategy.decide(state, bot)
            assert action in state.legal_actions

    def test_raise_amount_within_chips(self):
        strategy = AggressiveStrategy()
        bot = make_bot(chips=200)
        state = make_state(
            current_bet=40,
            player_current_bet=0,
            player_chips=200,
            min_raise=20,
            legal_actions=(Action.FOLD, Action.CALL, Action.RAISE),
        )
        for _ in range(30):
            action, amount = strategy.decide(state, bot)
            if action == Action.RAISE:
                assert amount <= 200
