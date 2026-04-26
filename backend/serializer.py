"""
Pure serialization functions: engine objects → JSON-serializable dicts.

Rules:
  - No side effects.
  - No imports from backend.* (prevents circular imports).
  - Fully unit-testable without FastAPI or asyncio.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from poker_trainer.cards.card import Card
from poker_trainer.cards.hand_evaluator import HandEvaluator
from poker_trainer.players.base_player import BasePlayer
from poker_trainer.strategies.base_strategy import GameState

if TYPE_CHECKING:
    from poker_trainer.engine.table import Table


# ── Primitives ────────────────────────────────────────────────────────────────

def card_to_dict(card: Card) -> dict:
    return {"rank": str(card.rank), "suit": card.suit.value}


def _player_status(player: BasePlayer) -> str:
    if player.chips == 0 and not player.is_active:
        return "bust"
    if player.is_all_in:
        return "all_in"
    if not player.is_active:
        return "folded"
    return "active"


def _infer_phase(community_card_count: int) -> str:
    """
    Derive phase from community card count.
    NOTE: GameState.phase is hardcoded to PRE_FLOP in the engine —
    this function is the authoritative source instead.
    """
    return {0: "PRE_FLOP", 3: "FLOP", 4: "TURN", 5: "RIVER"}.get(
        community_card_count, "PRE_FLOP"
    )


# ── Rule of 2 and 4 equity estimation ────────────────────────────────────────

def _calculate_rule_2_4(hole: list[Card], community: list[Card]) -> int | None:
    """
    Returns approximate win % using Rule of 2 and 4.
    Only computed at FLOP (3 community cards) or TURN (4 community cards).
    An "out" is any remaining deck card that improves the hand rank above
    the current rank when added to the community cards.
    """
    n = len(community)
    if n not in (3, 4):
        return None
    if not hole:
        return None

    from poker_trainer.utils.constants import Rank, Suit

    used: set[Card] = set(hole + community)
    remaining = [
        Card(rank, suit)
        for suit in Suit
        for rank in Rank
        if Card(rank, suit) not in used
    ]

    current = HandEvaluator.evaluate(hole, community)
    outs = sum(
        1 for c in remaining
        if HandEvaluator.evaluate(hole, community + [c]) > current
    )

    multiplier = 4 if n == 3 else 2
    return min(100, outs * multiplier)


# ── Table state ───────────────────────────────────────────────────────────────

def serialize_table_state(table: "Table", viewing_player: BasePlayer) -> dict:
    """
    Full table snapshot sent before the human player must act.
    Only viewing_player's hole_cards are included.
    human_equity is the Rule-of-2-and-4 win % estimate (FLOP/TURN only).
    """
    equity = _calculate_rule_2_4(
        viewing_player.hole_cards,
        list(table.community_cards),
    )
    return {
        "type": "TABLE_STATE",
        "phase": _infer_phase(len(table.community_cards)),
        "pot": table.pot.total,
        "community_cards": [card_to_dict(c) for c in table.community_cards],
        "dealer_position": table.dealer_position,
        "human_equity": equity,
        "players": [
            {
                "name": p.name,
                "chips": p.chips,
                "current_bet": p.current_bet,
                "status": _player_status(p),
                "is_human": p is viewing_player,
                "hole_cards": (
                    [card_to_dict(c) for c in p.hole_cards]
                    if p is viewing_player
                    else []
                ),
            }
            for p in table.seats
        ],
    }


# ── Action required ───────────────────────────────────────────────────────────

def serialize_action_required(state: GameState) -> dict:
    """
    Prompt payload sent to the browser when the human must act.
    Derived from the frozen GameState snapshot.
    """
    return {
        "type": "ACTION_REQUIRED",
        "legal_actions": [a.name.lower() for a in state.legal_actions],
        "call_amount": max(0, state.current_bet - state.player_current_bet),
        "min_raise": state.min_raise,
        "max_raise": state.player_chips,
        "pot": state.pot_total,
        "current_bet": state.current_bet,
        "player_chips": state.player_chips,
    }


# ── Showdown ──────────────────────────────────────────────────────────────────

def serialize_showdown(players: list[BasePlayer], community: list[Card]) -> dict:
    """Reveal all active players' hole cards at showdown."""
    entries = []
    for p in players:
        if p.is_active and p.hole_cards:
            result = HandEvaluator.evaluate(p.hole_cards, community)
            entries.append({
                "name": p.name,
                "hole_cards": [card_to_dict(c) for c in p.hole_cards],
                "hand_description": result.display(),
            })
    return {"type": "SHOWDOWN", "players": entries}
