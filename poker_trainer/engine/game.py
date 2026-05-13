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
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

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
        self._busted_players: set = set()  # tracks already-announced bust players
        self._RUNOUT_DELAY = 2.2          # seconds between streets during all-in runout

    # ------------------------------------------------------------------
    # 0.5BB rounding helpers
    # ------------------------------------------------------------------

    def _half_bb(self) -> int:
        """Minimum bet unit = 0.5 × big blind (integer floor)."""
        return max(1, self.table.big_blind // 2)

    def _round_to_half_bb(self, amount: int) -> int:
        """Round *amount* to the nearest 0.5 BB unit (minimum = 0.5 BB)."""
        unit = self._half_bb()
        return max(unit, int(round(amount / unit)) * unit)

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

        # Emit table state immediately after dealing so the frontend shows
        # cards right away — without this, TABLE_STATE only arrives when the
        # human player's turn comes (after all bots ahead have thought/acted).
        human = next((p for p in self.table.seats if p.is_human), None)
        if human:
            self.renderer.show_table(self.table, human)

        # Pre-flop: action starts left of big blind (UTG).
        self.renderer.show_phase_header("Pre-Flop")
        utg_pos = (self.table.big_blind_position + 1) % len(self.table.seats)
        self._betting_round(utg_pos, opening_round=True)

        if self._only_one_active():
            self._award_pot()
            self.table.rotate_dealer()
            return

        # Flop
        self.dealer.deal_flop(self.table.community_cards)
        self.renderer.show_phase_header("Flop")
        self._reset_bets()
        self._emit_runout_state_if_needed()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            self.table.rotate_dealer()
            return

        # Turn
        self.dealer.deal_turn(self.table.community_cards)
        self.renderer.show_phase_header("Turn")
        self._reset_bets()
        self._emit_runout_state_if_needed()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            self.table.rotate_dealer()
            return

        # River
        self.dealer.deal_river(self.table.community_cards)
        self.renderer.show_phase_header("River")
        self._reset_bets()
        self._emit_runout_state_if_needed()
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

        def _queue_from(start: int, exclude: "BasePlayer | None" = None) -> "deque[BasePlayer]":
            """Active non-all-in players in clockwise order from *start*, excluding *exclude*."""
            q: deque[BasePlayer] = deque()
            for offset in range(n):
                p = seats[(start + offset) % n]
                if p.is_active and not p.is_all_in and p is not exclude:
                    q.append(p)
            return q

        # Build the initial action queue clockwise from start_pos.
        # Every active non-all-in player must act at least once.
        queue = _queue_from(start_pos)

        while queue:
            player = queue.popleft()

            # Player might have gone all-in or folded while in the queue.
            if not player.is_active or player.is_all_in:
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

            # Show table state before human player acts; signal bots thinking.
            if player.is_human:
                self.renderer.show_table(self.table, player)
            else:
                self.renderer.show_bot_thinking(player.name)

            action, amount = player.decide(state)

            # --- Validate and apply action ---
            action, amount = self._validate_action(action, amount, player, legal, call_needed)

            if action == Action.FOLD:
                player.fold()
                self.renderer.show_action(player.name, "folds")

            elif action == Action.CHECK:
                self.renderer.show_action(player.name, "checks")

            elif action == Action.CALL:
                placed = player.place_chips(amount)
                self.table.pot.add(player, placed)
                self.renderer.show_action(player.name, f"calls {placed}")

            elif action in (Action.RAISE, Action.ALL_IN):
                placed = player.place_chips(amount)
                self.table.pot.add(player, placed)
                current_bet = player.current_bet
                min_raise = amount  # Update min-raise increment
                label = "goes all-in" if action == Action.ALL_IN else f"raises to {current_bet}"
                self.renderer.show_action(player.name, label)
                # Rebuild queue: everyone else who is active and not all-in,
                # starting clockwise from the seat AFTER this player.
                raiser_idx = seats.index(player)
                queue = _queue_from((raiser_idx + 1) % n, exclude=player)

            if not self.table.get_active_players() or self._only_one_active():
                break

    # ------------------------------------------------------------------
    # Showdown & pot award
    # ------------------------------------------------------------------

    def _award_pot(self) -> None:
        """
        Evaluate hands, determine winner(s), and distribute pot.

        Handles:
            - Single winner (everyone else folded).
            - Multi-way showdown with hand comparison.
            - Side pots for all-in players (excess chips returned to
              the stack-leader so they are never over-deducted).
        """
        active = [p for p in self.table.seats if p.is_active]

        if len(active) == 1:
            # Everyone else folded — no showdown needed.
            winner = active[0]
            amount = self.table.pot.total
            winner.receive_winnings(amount)
            self.renderer.show_action(winner.name, f"wins {amount} (uncontested)")
            self.renderer.show_hand_result(winner.name, "wins uncontested", amount)
            return

        # Showdown: reveal cards and evaluate.
        self.renderer.show_showdown(active, self.table.community_cards)

        # Evaluate each active player's best hand.
        hand_results: Dict[BasePlayer, HandResult] = {}
        for player in active:
            result = HandEvaluator.evaluate(
                player.hole_cards, self.table.community_cards
            )
            hand_results[player] = result
            self.renderer.show_message(f"  {player.name}: {result.display()}")

        # Split into side pots, each with its own eligible players list.
        # A side pot where only one player is eligible means that player's
        # excess chips are returned automatically (they "win" uncontested).
        side_pots = self.table.pot.calculate_side_pots()

        if not side_pots:
            # Fallback: single undivided pot → best overall hand wins.
            best_player = max(hand_results, key=lambda p: hand_results[p])
            total = self.table.pot.total
            best_player.receive_winnings(total)
            self.renderer.show_hand_result(
                best_player.name, hand_results[best_player].display(), total
            )
            return

        # Award each side pot to the eligible player with the best hand.
        awarded: Dict[BasePlayer, int] = {}
        for pot_amount, eligible in side_pots:
            # Only consider active (non-folded) players who are eligible.
            contestants = [
                (p, hand_results[p]) for p in eligible
                if p.is_active and p in hand_results
            ]
            if not contestants:
                continue
            winner, _ = max(contestants, key=lambda x: x[1])
            winner.receive_winnings(pot_amount)
            awarded[winner] = awarded.get(winner, 0) + pot_amount

        for player, total_won in awarded.items():
            hand_desc = (
                hand_results[player].display()
                if player in hand_results
                else "best hand"
            )
            self.renderer.show_hand_result(player.name, hand_desc, total_won)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _is_all_in_runout(self) -> bool:
        """True when ≥2 active players remain and ALL of them are all-in."""
        active = self.table.get_active_players()
        return len(active) >= 2 and all(p.is_all_in for p in active)

    def _emit_runout_state_if_needed(self) -> None:
        """
        During an all-in runout, broadcast the current community cards to the
        human player and pause so the frontend can animate each street
        individually instead of receiving flop/turn/river all at once.
        """
        if not self._is_all_in_runout():
            return
        human = next((p for p in self.table.seats if p.is_human), None)
        if human and human.is_active:
            self.renderer.show_table(self.table, human)
        time.sleep(self._RUNOUT_DELAY)

    def _legal_actions(
        self, player: BasePlayer, call_needed: int
    ) -> List[Action]:
        """Compute the set of legal actions for *player* this turn."""
        actions: List[Action] = []
        if call_needed > 0:
            actions.append(Action.FOLD)
            if call_needed >= player.chips:
                # Can only go all-in (not enough chips to call in full).
                actions.append(Action.ALL_IN)
            else:
                actions.append(Action.CALL)
                if player.chips > call_needed:
                    actions.append(Action.RAISE)
                actions.append(Action.ALL_IN)
        else:
            # No outstanding bet — can check or raise.
            actions.append(Action.CHECK)
            if player.chips > 0:
                actions.append(Action.RAISE)
                actions.append(Action.ALL_IN)
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
        if action == Action.ALL_IN:
            amount = player.chips
        if action == Action.RAISE:
            # Round to nearest 0.5 BB, then clamp to the chip stack.
            amount = self._round_to_half_bb(amount)
            amount = max(self._half_bb(), min(amount, player.chips))
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
        """
        Deactivate and announce any player who is newly bust this session.
        Setting is_active=False here ensures bust players are excluded from
        all subsequent hands even before reset_for_new_hand() is called.
        """
        for player in self.table.seats:
            if player.chips == 0 and player not in self._busted_players:
                player.is_active = False
                self._busted_players.add(player)
                self.renderer.show_bust(player.name)
