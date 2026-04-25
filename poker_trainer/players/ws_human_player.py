"""
WebSocket-driven human player.

Replaces the stdin-blocking HumanPlayer with a thread-safe bridge:
  - decide() blocks the game thread on a threading.Event
  - submit_action() is called from the asyncio thread (WebSocket handler)
    and unblocks the waiting game thread

This allows Game.run() (synchronous) to co-exist with FastAPI (asyncio)
without rewriting the engine.
"""

from __future__ import annotations

import threading
from typing import Callable, Optional, Tuple, TYPE_CHECKING

from poker_trainer.players.base_player import BasePlayer
from poker_trainer.utils.constants import Action

if TYPE_CHECKING:
    from poker_trainer.strategies.base_strategy import GameState


class WsHumanPlayer(BasePlayer):
    """
    Human player whose decide() blocks until the WebSocket session
    delivers an action via submit_action().

    Thread model:
        Game loop  ── ThreadPoolExecutor worker thread
        FastAPI    ── asyncio event loop thread

        decide()         → clears Event, fires callback, then event.wait()
        submit_action()  → sets _pending_action, sets Event  (thread-safe)
    """

    def __init__(self, name: str, chips: int) -> None:
        super().__init__(name, chips)
        self._event = threading.Event()
        self._pending_action: Optional[Tuple[Action, int]] = None
        # Injected by GameSession after construction.
        # Signature: (state: GameState) -> None
        # Called from the game thread before blocking; must be thread-safe.
        self._on_decision_needed: Optional[Callable] = None

    def set_decision_callback(self, callback: Callable) -> None:
        """
        Register the callback that GameSession uses to push
        ACTION_REQUIRED to the browser before this player blocks.
        """
        self._on_decision_needed = callback

    def decide(self, state: "GameState") -> Tuple[Action, int]:
        """
        Block the game thread until the browser submits an action.

        1. Clears the event so we can wait on a fresh signal.
        2. Fires the decision callback so the browser receives
           ACTION_REQUIRED and can render the action buttons.
        3. Waits on threading.Event (releases the GIL — asyncio runs normally).
        4. Returns the action submitted by submit_action().
        """
        self._event.clear()
        self._pending_action = None

        if self._on_decision_needed is not None:
            self._on_decision_needed(state)

        # Blocks game thread; asyncio event loop continues unaffected.
        self._event.wait()

        assert self._pending_action is not None
        return self._pending_action

    def submit_action(self, action: Action, amount: int) -> None:
        """
        Called by the WebSocket message handler (asyncio thread).
        Stores the action and unblocks the waiting game thread.

        threading.Event.set() is documented as safe to call from
        any thread, including the asyncio thread.
        """
        self._pending_action = (action, amount)
        self._event.set()

    def force_fold(self) -> None:
        """
        Force a FOLD action — used by GameSession.cancel() on disconnect
        to prevent the game thread from blocking forever.
        """
        self.submit_action(Action.FOLD, 0)
