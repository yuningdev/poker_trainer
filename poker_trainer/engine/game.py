"""
Game — the central orchestrator of Texas Hold'em logic.

Architecture (Template Method Pattern):
    run()           — outer loop: keep playing hands until one player wins
    _play_hand()    — template: post blinds → deal → bet loop → showdown
    _betting_round()— inner loop: ask each player to act until pots equalize

The engine never imports concrete player or strategy types; it only knows
about the BasePlayer interface.  All display output is delegated to the
Renderer.  All card operations are delegated to the Dealer.

GameState (frozen dataclass) is the read-only snapshot passed to every
player on their turn.  Bot strategies and HumanPlayer read it; nothing
modifies it.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from poker_trainer.cards.hand_evaluator import HandEvaluator, HandResult
from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.table import Table
from poker_trainer.players.base_player import BasePlayer
from poker_trainer.strategies.base_strategy import GameState
from poker_trainer.ui.renderer import Renderer
from poker_trainer.utils.constants import Action, Phase


class Game:
    """
    Runs a full Texas Hold'em session until one player holds all chips.

    Attributes:
        table:    The Table (seats, blinds, community cards, pot).
        dealer:   The Dealer (deck + card distribution).
        renderer: The Renderer (all terminal output).
        _hand_num: Counter of hands played this session.

    Usage:
        game = Game(table, dealer, renderer)
        game.run()
    """

    def __init__(self, table: Table, dealer: Dealer, renderer: Renderer) -> None:
        self.table = table
        self.dealer = dealer
        self.renderer = renderer
        self._hand_num = 0

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def run(self) -> None:
        """
        Main game loop.  Plays hands until exactly one player has chips.
        """
        while not self._is_game_over():
            self._hand_num += 1
            self.renderer.show_hand_separator(self._hand_num)
            self._play_hand()
            self._remove_bust_players()

        winners = self.table.get_players_with_chips()
        if winners:
            w = winners[0]
            self.renderer.show_game_over(w.name, w.chips)

    # ------------------------------------------------------------------
    # Hand template (Template Method pattern)
    # ------------------------------------------------------------------

    def _play_hand(self) -> None:
        """
        Orchestrate a single hand:
            setup → blinds → hole cards → pre-flop bet
            → flop → bet → turn → bet → river → bet → showdown
        """
        self.table.reset_for_new_hand()
        self.dealer.reset()

        self._post_blinds()
        self.dealer.deal_hole_cards(self.table.seat_order_from(0))

        # Pre-flop: action starts left of big blind (UTG).
        self.renderer.show_phase_header("Pre-Flop")
        utg_pos = (self.table.big_blind_position + 1) % len(self.table.seats)
        self._betting_round(utg_pos, opening_round=True)

        if self._only_one_active():
            self._award_pot()
            return

        # Flop
        self.dealer.deal_flop(self.table.community_cards)
        self.renderer.show_phase_header("Flop")
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            return

        # Turn
        self.dealer.deal_turn(self.table.community_cards)
        self.renderer.show_phase_header("Turn")
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            return

        # River
        self.dealer.deal_river(self.table.community_cards)
        self.renderer.show_phase_header("River")
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        self._award_pot()
        self.table.rotate_dealer()

    # ------------------------------------------------------------------
    # Blinds
    # ------------------------------------------------------------------

    def _post_blinds(self) -> None:
        """
        Force the small and big blind bets and add them to the pot.
        """
        sb_idx = self.table.small_blind_position
        bb_idx = self.table.big_blind_position
        sb_player = self.table.seats[sb_idx]
        bb_player = self.table.seats[bb_idx]

        sb_amount = sb_player.place_chips(self.table.small_blind)
        self.table.pot.add(sb_player, sb_amount)
        self.renderer.show_action(sb_player.name, f"posts small blind {sb_amount}")

        bb_amount = bb_player.place_chips(self.table.big_blind)
        self.table.pot.add(bb_player, bb_amount)
        self.renderer.show_action(bb_player.name, f"posts big blind {bb_amount}")

    # ------------------------------------------------------------------
    # Betting round
    # ------------------------------------------------------------------

    def _betting_round(self, start_pos: int, opening_round: bool = False) -> None:
        """
        Run one betting round starting from the player at *start_pos*.

        The round ends when every active (non-all-in) player has either:
            - Matched the current highest bet, OR
            - Folded.

        Args:
            start_pos:     Seat index of the first player to act.
            opening_round: True during pre-flop so the big blind gets to
                           act even if everyone just called.
        """
        seats = self.table.seats
        n = len(seats)
        current_bet = max(p.current_bet for p in seats)
        min_raise = self.table.big_blind

        # Track who still needs to act.  Starts as all active players.
        # Resets to all-except-raiser whenever a raise occurs.
        to_act = set(
            p for p in self.table.get_active_players()
            if not p.is_all_in
        )

        # Pre-flop: big blind already "bet"; they get to raise if no one
        # raised.  We handle this by including them in to_act initially.

        acted: set[BasePlayer] = set()

        # Iterate clockwise from start_pos
        i = start_pos
        safety = 0
        while to_act and safety < n * 10:
            safety += 1
            player = seats[i % n]
            i += 1

            if player not in to_act:
                # Check whether we've gone all the way around and can stop.
                if not to_act:
                    break
                continue

            # Build legal actions for this player.
            call_needed = current_bet - player.current_bet
            legal = self._legal_actions(player, call_needed)

            state = GameState(
                community_cards=tuple(self.table.community_cards),
                pot_total=self.table.pot.total,
                current_bet=current_bet,
                min_raise=min_raise,
                phase=Phase.PRE_FLOP,
                active_player_count=len(self.table.get_active_players()),
                legal_actions=tuple(legal),
                player_name=player.name,
                player_chips=player.chips,
                player_current_bet=player.current_bet,
            )

            # Show table state before human player acts.
            if player.is_human:
                self.renderer.show_table(self.table, player)

            action, amount = player.decide(state)

            # --- Validate and apply action ---
            action, amount = self._validate_action(action, amount, player, legal, call_needed)

            if action == Action.FOLD:
                player.fold()
                self.renderer.show_action(player.name, "folds")
                to_act.discard(player)
                acted.add(player)

            elif action == Action.CHECK:
                self.renderer.show_action(player.name, "checks")
                to_act.discard(player)
                acted.add(player)

            elif action == Action.CALL:
                placed = player.place_chips(amount)
                self.table.pot.add(player, placed)
                self.renderer.show_action(player.name, f"calls {placed}")
                to_act.discard(player)
                acted.add(player)

            elif action in (Action.RAISE, Action.ALL_IN):
                placed = player.place_chips(amount)
                self.table.pot.add(player, placed)
                current_bet = player.current_bet
                min_raise = amount  # Update min raise increment
                label = "goes all-in" if action == Action.ALL_IN else f"raises to {current_bet}"
                self.renderer.show_action(player.name, label)
                # Everyone else (who is active and not all-in) must act again.
                to_act = set(
                    p for p in self.table.get_active_players()
                    if p != player and not p.is_all_in
                )
                acted.add(player)

            if not self.table.get_active_players() or self._only_one_active():
                break

        # Collect any uncollected bets into the pot (safety net).
        # (Already collected per-action above.)

    # ------------------------------------------------------------------
    # Showdown & pot award
    # ------------------------------------------------------------------

    def _award_pot(self) -> None:
        """
        Evaluate hands, determine winner(s), and distribute pot.

        Handles:
            - Single winner (everyone else folded).
            - Multi-way showdown with hand comparison.
            - Side pots for all-in players.
        """
        active = [p for p in self.table.seats if p.is_active]

        if len(active) == 1:
            # Everyone else folded — no showdown needed.
            winner = active[0]
            amount = self.table.pot.total
            winner.receive_winnings(amount)
            self.renderer.show_action(winner.name, f"wins {amount} (uncontested)")
            return

        # Showdown: reveal cards and evaluate.
        self.renderer.show_showdown(active, self.table.community_cards)

        # Evaluate each active player's best hand.
        results: List[Tuple[BasePlayer, HandResult]] = []
        for player in active:
            result = HandEvaluator.evaluate(
                player.hole_cards, self.table.community_cards
            )
            results.append((player, result))
            self.renderer.show_message(
                f"  {player.name}: {result.display()}"
            )

        # Handle side pots.
        eligible_slices = self.table.pot.calculate_eligible_players()

        if not eligible_slices:
            # Fallback: give entire pot to best hand.
            best_player, best_result = max(results, key=lambda x: x[1])
            total = self.table.pot.total
            best_player.receive_winnings(total)
            self.renderer.show_hand_result(
                best_player.name, best_result.display(), total
            )
            return

        # Award each pot slice to the eligible player with the best hand.
        awarded: dict[BasePlayer, int] = {}
        for eligible_player, max_win in eligible_slices:
            eligible_results = [
                (p, r) for p, r in results if p.is_active
            ]
            if not eligible_results:
                continue
            winner, win_result = max(eligible_results, key=lambda x: x[1])
            amount = min(max_win, self.table.pot.total)
            winner.receive_winnings(amount)
            awarded[winner] = awarded.get(winner, 0) + amount

        for player, amount in awarded.items():
            result_map = dict(results)
            hand_desc = result_map[player].display() if player in result_map else "best hand"
            self.renderer.show_hand_result(player.name, hand_desc, amount)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _legal_actions(
        self, player: BasePlayer, call_needed: int
    ) -> List[Action]:
        """Compute the set of legal actions for *player* this turn."""
        actions: List[Action] = []
        if call_needed > 0:
            actions.append(Action.FOLD)
            if call_needed >= player.chips:
                actions.append(Action.ALL_IN)
            else:
                actions.append(Action.CALL)
                if player.chips > call_needed:
                    actions.append(Action.RAISE)
        else:
            # No outstanding bet — can check or raise.
            actions.append(Action.CHECK)
            if player.chips > 0:
                actions.append(Action.RAISE)
        return actions

    def _validate_action(
        self,
        action: Action,
        amount: int,
        player: BasePlayer,
        legal: List[Action],
        call_needed: int,
    ) -> Tuple[Action, int]:
        """
        Ensure the chosen action is legal; fall back to a safe default.
        """
        if action not in legal:
            # Coerce to the safest legal action.
            if Action.CHECK in legal:
                return Action.CHECK, 0
            if Action.CALL in legal:
                return Action.CALL, min(call_needed, player.chips)
            return Action.FOLD, 0
        # Clamp amounts to chip stack.
        if action == Action.RAISE:
            amount = max(1, min(amount, player.chips))
        if action == Action.CALL:
            amount = min(amount, player.chips)
        return action, amount

    def _reset_bets(self) -> None:
        """Zero out per-round bet trackers between phases."""
        for player in self.table.seats:
            player.reset_bet()

    def _only_one_active(self) -> bool:
        """True if only one player hasn't folded."""
        return len([p for p in self.table.seats if p.is_active]) == 1

    def _is_game_over(self) -> bool:
        """True if only one player still has chips."""
        return len(self.table.get_players_with_chips()) <= 1

    def _remove_bust_players(self) -> None:
        """Announce and note any player who lost all chips this hand."""
        for player in self.table.seats:
            if player.chips == 0:
                self.renderer.show_bust(player.name)
