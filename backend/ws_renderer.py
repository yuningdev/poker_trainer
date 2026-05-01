"""
WsRenderer — Renderer subclass that emits structured events to the browser
instead of printing to stdout.

All show_* methods call _emit(), which delegates to a caller-supplied
emit_fn callable.  This decouples the renderer from asyncio internals and
allows both single-player (GameSession) and multiplayer (RoomSession) to
share the same renderer without changes.

emit_fn signature: (event: dict) -> None
    Called from the game thread.  Must be thread-safe (i.e. use
    asyncio.run_coroutine_threadsafe internally).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from poker_trainer.ui.renderer import Renderer

if TYPE_CHECKING:
    from poker_trainer.engine.table import Table
    from poker_trainer.players.base_player import BasePlayer
    from poker_trainer.cards.card import Card


class WsRenderer(Renderer):
    """
    Overrides all show_* methods to push JSON events via a caller-supplied
    emit_fn instead of printing to a Rich Console.

    Thread safety:
        The game loop runs in a ThreadPoolExecutor thread.
        The caller is responsible for making emit_fn thread-safe (typically
        via asyncio.run_coroutine_threadsafe).
    """

    def __init__(self, emit_fn: Callable[[dict], None]) -> None:
        """
        Args:
            emit_fn: Thread-safe callable that accepts a JSON-serialisable
                     dict and delivers it to the browser.  Must not block.
        """
        self._emit_fn = emit_fn

    def _emit(self, event: dict) -> None:
        """Delegate to the injected emit function."""
        self._emit_fn(event)

    # ── Renderer interface ────────────────────────────────────────────────────

    def show_table(self, table: "Table", viewing_player: "BasePlayer") -> None:
        from backend.serializer import serialize_table_state
        self._emit(serialize_table_state(table, viewing_player))

    def show_phase_header(self, phase_name: str) -> None:
        # Parse phase out of the header (may contain board cards like "Flop  A♠ K♥")
        phase = phase_name.split()[0].upper().replace("-", "_")
        phase_map = {
            "PRE": "PRE_FLOP",
            "PRE-FLOP": "PRE_FLOP",
            "FLOP": "FLOP",
            "TURN": "TURN",
            "RIVER": "RIVER",
            "SHOWDOWN": "SHOWDOWN",
        }
        self._emit({"type": "PHASE_CHANGE", "phase": phase_map.get(phase, phase_name)})

    def show_action(self, player_name: str, action_str: str) -> None:
        self._emit({"type": "ACTION_LOG", "player": player_name, "text": action_str})

    def show_hand_result(
        self, winner_name: str, hand_description: str, amount: int
    ) -> None:
        self._emit({
            "type": "HAND_RESULT",
            "winner": winner_name,
            "hand": hand_description,
            "amount": amount,
        })

    def show_showdown(
        self, players: list["BasePlayer"], community: list["Card"]
    ) -> None:
        from backend.serializer import serialize_showdown
        self._emit(serialize_showdown(players, community))

    def show_bust(self, player_name: str) -> None:
        self._emit({"type": "PLAYER_BUST", "player": player_name})

    def show_game_over(self, winner_name: str, chips: int) -> None:
        self._emit({"type": "GAME_OVER", "winner": winner_name, "chips": chips})

    def show_hand_separator(self, hand_num: int) -> None:
        self._emit({"type": "NEW_HAND", "hand_num": hand_num})

    def show_message(self, msg: str) -> None:
        # Strip rich markup tags
        import re
        plain = re.sub(r"\[/?[^\]]*\]", "", msg).strip()
        if plain:
            self._emit({"type": "MESSAGE", "text": plain})
