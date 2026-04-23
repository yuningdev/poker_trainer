"""
Simulation script — 5 hands, 8 players (A–H), tabular report.

Each hand produces one table with columns:
    玩家 | 底牌 | 翻牌前 | 翻牌 (board) | 轉牌 (board) | 河牌 (board) | 最終牌型 | 結果

Player A is the designated "human" seat (first-person perspective).
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from poker_trainer.cards.card import Card
from poker_trainer.cards.hand_evaluator import HandEvaluator
from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.players.base_player import BasePlayer
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.ui.renderer import Renderer
from poker_trainer.utils.constants import Suit

# ── Config ───────────────────────────────────────────────────────────────────

random.seed(42)
NUM_HANDS   = 5
CHIPS       = 1_000
SMALL_BLIND = 10
BIG_BLIND   = 20

# Player A is "you" (aggressive so it actually does something interesting).
# Rename all players A–H.
PLAYER_CONFIGS = [
    ("aggressive", "A"),   # A = first-person player
    ("passive",    "B"),
    ("random",     "C"),
    ("aggressive", "D"),
    ("passive",    "E"),
    ("random",     "F"),
    ("aggressive", "G"),
    ("passive",    "H"),
]

STRATEGY_LABEL = {
    "A": "aggressive",
    "B": "passive",
    "C": "random",
    "D": "aggressive",
    "E": "passive",
    "F": "random",
    "G": "aggressive",
    "H": "passive",
}

# ── Per-hand structured data ──────────────────────────────────────────────────

@dataclass
class PlayerHandRecord:
    name: str
    hole_cards: str = ""
    actions: dict[str, list[str]] = field(default_factory=lambda: {
        "pre_flop": [], "flop": [], "turn": [], "river": []
    })
    final_hand: str = ""
    chips_delta: int = 0
    outcome: str = ""   # "wins X", "folds", "eliminated", ""

@dataclass
class HandRecord:
    hand_num: int
    board: dict[str, str] = field(default_factory=lambda: {
        "flop": "", "turn": "", "river": ""
    })
    players: list[PlayerHandRecord] = field(default_factory=list)
    pot: int = 0
    winner: str = ""
    winner_hand: str = ""
    winner_amount: int = 0

# ── Silent renderer that records structured events ────────────────────────────

class StructuredRenderer(Renderer):
    """
    Completely silent renderer.  Stores all events in HandRecord objects
    so the report builder can lay them out freely.
    """

    def __init__(self, player_names: list[str]) -> None:
        self.hands: list[HandRecord] = []
        self._current: HandRecord | None = None
        self._current_phase: str = "pre_flop"
        self._player_names = player_names
        self._chips_before: dict[str, int] = {}
        # map name -> PlayerHandRecord for current hand
        self._precs: dict[str, PlayerHandRecord] = {}

    # ── Hand lifecycle ────────────────────────────────────────────────────────

    def begin_hand(self, hand_num: int, chips_snapshot: dict[str, int]) -> None:
        self._current = HandRecord(hand_num=hand_num)
        self._chips_before = dict(chips_snapshot)
        self._precs = {
            name: PlayerHandRecord(name=name)
            for name in self._player_names
        }
        self._current.players = list(self._precs.values())
        self._current_phase = "pre_flop"

    def end_hand(self) -> None:
        if self._current:
            self.hands.append(self._current)

    def record_hole_cards(self, name: str, cards: list[Card]) -> None:
        if name in self._precs:
            self._precs[name].hole_cards = "  ".join(str(c) for c in cards)

    def record_final_hand(self, name: str, description: str) -> None:
        if name in self._precs:
            self._precs[name].final_hand = description

    def record_chips_after(self, name: str, chips_after: int) -> None:
        if name in self._precs:
            before = self._chips_before.get(name, 0)
            self._precs[name].chips_delta = chips_after - before

    # ── Renderer interface (all silent) ───────────────────────────────────────

    def show_phase_header(self, phase_name: str) -> None:
        pn = phase_name.lower()
        if "pre" in pn:
            self._current_phase = "pre_flop"
        elif "flop" in pn:
            self._current_phase = "flop"
            # Board cards embedded in phase_name by ObservableGame
            if self._current and "  " in phase_name:
                board = phase_name.split("  ", 1)[1].strip()
                if not self._current.board["flop"]:
                    self._current.board["flop"] = board
        elif "turn" in pn:
            self._current_phase = "turn"
            if self._current and "  " in phase_name:
                cards = phase_name.split("  ", 1)[1].strip().split("  ")
                if len(cards) >= 4:
                    self._current.board["turn"] = cards[-1]
        elif "river" in pn:
            self._current_phase = "river"
            if self._current and "  " in phase_name:
                cards = phase_name.split("  ", 1)[1].strip().split("  ")
                if len(cards) >= 5:
                    self._current.board["river"] = cards[-1]

    def show_action(self, player_name: str, action_str: str) -> None:
        if player_name in self._precs and self._current_phase:
            phase = self._current_phase
            # Fold → mark outcome
            if "folds" in action_str:
                self._precs[player_name].actions[phase].append("蓋牌")
                if not self._precs[player_name].outcome:
                    self._precs[player_name].outcome = "fold"
            elif "posts small blind" in action_str:
                amt = action_str.split()[-1]
                self._precs[player_name].actions[phase].append(f"小盲 {amt}")
            elif "posts big blind" in action_str:
                amt = action_str.split()[-1]
                self._precs[player_name].actions[phase].append(f"大盲 {amt}")
            elif "checks" in action_str:
                self._precs[player_name].actions[phase].append("過牌")
            elif "calls" in action_str:
                amt = action_str.split()[-1]
                self._precs[player_name].actions[phase].append(f"跟注 {amt}")
            elif "raises to" in action_str:
                amt = action_str.split()[-1]
                self._precs[player_name].actions[phase].append(f"加注 {amt}")
            elif "all-in" in action_str:
                self._precs[player_name].actions[phase].append("全押")
            elif "wins" in action_str:
                pass  # handled in show_hand_result

    def show_hand_result(self, winner_name: str, hand_description: str, amount: int) -> None:
        if self._current:
            self._current.winner = winner_name
            self._current.winner_hand = hand_description
            self._current.winner_amount = amount
            if winner_name in self._precs:
                self._precs[winner_name].outcome = f"贏得 {amount}"

    def show_showdown(self, players, community) -> None:
        for p in players:
            if p.is_active and p.hole_cards:
                result = HandEvaluator.evaluate(p.hole_cards, community)
                self.record_final_hand(p.name, result.rank.display_name())

    def show_bust(self, player_name: str) -> None:
        if player_name in self._precs:
            if not self._precs[player_name].outcome:
                self._precs[player_name].outcome = "淘汰"
            else:
                self._precs[player_name].outcome += "（淘汰）"

    def show_table(self, table, viewing_player) -> None: pass
    def show_game_over(self, winner_name, chips) -> None: pass
    def show_hand_separator(self, hand_num) -> None: pass
    def show_message(self, msg) -> None: pass


# ── Patched Game ──────────────────────────────────────────────────────────────

class ObservableGame(Game):
    def __init__(self, table: Table, dealer: Dealer, renderer: StructuredRenderer) -> None:
        super().__init__(table, dealer, renderer)
        self._srec: StructuredRenderer = renderer

    def _play_hand(self) -> None:
        self.table.reset_for_new_hand()
        self.dealer.reset()

        # Snapshot chips before the hand
        chips_snap = {p.name: p.chips for p in self.table.seats}
        self._srec.begin_hand(self._hand_num, chips_snap)

        self._post_blinds()
        self.dealer.deal_hole_cards(self.table.seat_order_from(0))

        # Snapshot hole cards (active players only)
        for p in self.table.seats:
            if p.hole_cards and p.chips >= 0 and p.is_active:
                self._srec.record_hole_cards(p.name, p.hole_cards)

        # Pre-flop
        self._srec.show_phase_header("Pre-Flop")
        utg_pos = (self.table.big_blind_position + 1) % len(self.table.seats)
        self._betting_round(utg_pos, opening_round=True)

        if self._only_one_active():
            self._award_pot()
            self._finalize_hand()
            return

        self.dealer.deal_flop(self.table.community_cards)
        self._srec.show_phase_header(
            "Flop  " + "  ".join(str(c) for c in self.table.community_cards)
        )
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            self._finalize_hand()
            return

        self.dealer.deal_turn(self.table.community_cards)
        self._srec.show_phase_header(
            "Turn  " + "  ".join(str(c) for c in self.table.community_cards)
        )
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        if self._only_one_active():
            self._award_pot()
            self._finalize_hand()
            return

        self.dealer.deal_river(self.table.community_cards)
        self._srec.show_phase_header(
            "River  " + "  ".join(str(c) for c in self.table.community_cards)
        )
        self._reset_bets()
        self._betting_round(self.table.small_blind_position)

        self._award_pot()
        self._finalize_hand()
        self.table.rotate_dealer()

    def _finalize_hand(self) -> None:
        for p in self.table.seats:
            self._srec.record_chips_after(p.name, p.chips)
        self._srec.end_hand()


# ── Markdown table builder ────────────────────────────────────────────────────

def _action_cell(actions: list[str]) -> str:
    """Join multiple actions in one phase into a readable cell."""
    if not actions:
        return "—"
    return " → ".join(actions)


def _card_str(s: str) -> str:
    return f"`{s}`" if s else "—"


def build_report(players: list[BasePlayer], hands: list[HandRecord]) -> str:
    lines: list[str] = []

    lines += [
        "# 德州撲克模擬報告 Texas Hold'em Simulation Report",
        "",
        f"- **玩家數:** 8 人（A–H，A 為第一人稱玩家）",
        f"- **手數:** {NUM_HANDS}",
        f"- **起始籌碼:** {CHIPS}",
        f"- **盲注:** {SMALL_BLIND} / {BIG_BLIND}",
        f"- **隨機種子:** 42",
        "",
        "## 玩家策略 Player Strategies",
        "",
        "| 玩家 | 策略 | 蓋牌率 | 跟/過率 | 加注率 |",
        "|------|------|--------|---------|--------|",
        "| **A** ⭐（你）| aggressive | 5% | 20% | 75% |",
        "| B | passive | 10% | 75% | 15% |",
        "| C | random | 33% | 33% | 33% |",
        "| D | aggressive | 5% | 20% | 75% |",
        "| E | passive | 10% | 75% | 15% |",
        "| F | random | 33% | 33% | 33% |",
        "| G | aggressive | 5% | 20% | 75% |",
        "| H | passive | 10% | 75% | 15% |",
        "",
        "---",
        "",
    ]

    for hand in hands:
        winner_label = (
            f"**{hand.winner}** 以 `{hand.winner_hand}` 贏得 **{hand.winner_amount}** chips"
            if hand.winner else "—"
        )

        # Assemble board row
        flop_board  = _card_str(hand.board.get("flop", ""))
        turn_board  = _card_str(hand.board.get("turn", ""))
        river_board = _card_str(hand.board.get("river", ""))

        lines += [
            f"## Hand #{hand.hand_num}",
            "",
            f"| 公共牌 | 翻牌（Flop） | 轉牌（Turn） | 河牌（River） |",
            f"|--------|------------|------------|------------|",
            f"| Board  | {flop_board} | {turn_board} | {river_board} |",
            "",
            "### 決策紀錄 Decision Table",
            "",
            "| 玩家 | 底牌 | 翻牌前（Pre-Flop） | 翻牌（Flop） | 轉牌（Turn） | 河牌（River） | 最終牌型 | 籌碼變化 |",
            "|------|------|-----------------|------------|------------|------------|----------|----------|",
        ]

        for pr in hand.players:
            name_label = f"**{pr.name}** ⭐" if pr.name == "A" else pr.name
            hole       = _card_str(pr.hole_cards) if pr.hole_cards else "（已淘汰）"
            pre_flop   = _action_cell(pr.actions["pre_flop"])
            flop       = _action_cell(pr.actions["flop"])
            turn       = _action_cell(pr.actions["turn"])
            river      = _action_cell(pr.actions["river"])
            hand_type  = pr.final_hand if pr.final_hand else "（未攤牌）"
            delta      = pr.chips_delta
            delta_str  = f"+{delta}" if delta > 0 else str(delta)

            lines.append(
                f"| {name_label} | {hole} | {pre_flop} | {flop} | {turn} | {river} | {hand_type} | {delta_str} |"
            )

        lines += [
            "",
            f"> 🏆 {winner_label}",
            "",
            "---",
            "",
        ]

    # Final standings
    sorted_players = sorted(players, key=lambda p: -p.chips)
    lines += [
        "## 最終排名 Final Standings",
        "",
        "| 排名 | 玩家 | 策略 | 最終籌碼 | 總盈虧 |",
        "|------|------|------|----------|--------|",
    ]
    medals = ["🥇", "🥈", "🥉"] + [""] * 10
    for i, p in enumerate(sorted_players):
        delta = p.chips - CHIPS
        sign = "+" if delta >= 0 else ""
        medal = medals[i] if p.chips > 0 else "💀"
        strat = STRATEGY_LABEL.get(p.name, "")
        you = " ⭐（你）" if p.name == "A" else ""
        lines.append(f"| {medal} | {p.name}{you} | {strat} | {p.chips} | {sign}{delta} |")

    lines.append("")
    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    players = [
        PlayerFactory.create(ptype, name, CHIPS)
        for ptype, name in PLAYER_CONFIGS
    ]
    table    = Table(players, small_blind=SMALL_BLIND, big_blind=BIG_BLIND)
    dealer   = Dealer()
    renderer = StructuredRenderer([name for _, name in PLAYER_CONFIGS])
    game     = ObservableGame(table, dealer, renderer)

    for i in range(NUM_HANDS):
        if game._is_game_over():
            break
        game._hand_num = i + 1
        game._play_hand()
        game._remove_bust_players()

    report = build_report(players, renderer.hands)

    output_path = "SIMULATION_REPORT.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"✓ Report written → {output_path}")
    print()
    for p in sorted(players, key=lambda x: -x.chips):
        d = p.chips - CHIPS
        print(f"  {p.name}  {p.chips:>5}  ({'+'if d>=0 else ''}{d})")


if __name__ == "__main__":
    main()
