"""
GameSession — one instance per WebSocket connection.

Bridges the synchronous Game.run() loop (in a ThreadPoolExecutor)
with the async FastAPI WebSocket handler.

Lifecycle:
    1. wait for START_GAME message
    2. build players, table, dealer, renderer
    3. run game.run() in executor
    4. pump events from asyncio.Queue → WebSocket (sender task)
    5. read browser messages → dispatch to WsHumanPlayer (receiver task)
    6. on disconnect: cancel() unblocks any waiting game thread
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import logging
from typing import Optional

from fastapi import WebSocket
from fastapi.websockets import WebSocketState

from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.players.ws_human_player import WsHumanPlayer
from poker_trainer.utils.constants import Action
from backend.serializer import serialize_action_required
from backend.ws_renderer import WsRenderer

logger = logging.getLogger(__name__)

ACTION_MAP: dict[str, Action] = {
    "fold":   Action.FOLD,
    "check":  Action.CHECK,
    "call":   Action.CALL,
    "raise":  Action.RAISE,
    "all_in": Action.ALL_IN,
}


class GameSession:
    """Manages one complete game over a single WebSocket connection."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._human_player: Optional[WsHumanPlayer] = None
        self._cancelled = False

    # ── Public ───────────────────────────────────────────────────────────────

    async def run(self) -> None:
        """Entry point called by the WebSocket endpoint. Loops to support multiple games."""
        loop = asyncio.get_running_loop()

        while not self._cancelled:
            config = await self._wait_for_start()
            if config is None:
                return

            # Reset per-game state so old events don't leak into the new game.
            self._event_queue = asyncio.Queue()

            game = self._build_game(config, loop)
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            game_future = loop.run_in_executor(executor, game.run)

            sender   = asyncio.create_task(self._pump_events())
            receiver = asyncio.create_task(self._receive_actions())

            try:
                await asyncio.gather(game_future, return_exceptions=True)
                # Yield to the event loop so any run_coroutine_threadsafe callbacks
                # (e.g. GAME_OVER) have a chance to put their events in the queue,
                # and sender can drain them to the browser before we cancel it.
                await asyncio.sleep(0)
                await asyncio.sleep(0)
            finally:
                sender.cancel()
                receiver.cancel()
                await asyncio.gather(sender, receiver, return_exceptions=True)
                executor.shutdown(wait=False)

            if self._cancelled:
                return
            # Loop back and wait for the next START_GAME.

    def cancel(self) -> None:
        """Called on WebSocket disconnect to unblock the game thread."""
        self._cancelled = True
        if self._human_player is not None:
            self._human_player.force_fold()

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def _wait_for_start(self) -> Optional[dict]:
        """Block until the browser sends START_GAME."""
        try:
            msg = await self.ws.receive_json()
            if msg.get("type") == "START_GAME":
                return msg.get("config", {})
        except Exception as e:
            logger.warning("Failed waiting for START_GAME: %s", e)
        return None

    def _build_game(self, config: dict, loop: asyncio.AbstractEventLoop) -> Game:
        renderer = WsRenderer(
            lambda event: asyncio.run_coroutine_threadsafe(
                self._event_queue.put(event), loop
            )
        )

        human = WsHumanPlayer(
            name=config.get("human_name", "You"),
            chips=config.get("starting_chips", 1000),
        )

        # Callback fired from game thread before human.decide() blocks.
        # Pushes ACTION_REQUIRED to the browser.
        def on_decision_needed(state) -> None:
            asyncio.run_coroutine_threadsafe(
                self._event_queue.put(serialize_action_required(state)),
                loop,
            )

        human.set_decision_callback(on_decision_needed)
        self._human_player = human

        bots = [
            PlayerFactory.create(b["strategy"], b["name"], config.get("starting_chips", 1000))
            for b in config.get("bots", [])
        ]

        players = [human] + bots
        table = Table(
            players,
            small_blind=config.get("small_blind", 10),
            big_blind=config.get("big_blind", 20),
        )
        dealer = Dealer()
        return Game(table, dealer, renderer)

    # ── Async tasks ───────────────────────────────────────────────────────────

    async def _pump_events(self) -> None:
        """Drain the event queue and forward each event to the WebSocket."""
        while not self._cancelled:
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=0.5)
                if self.ws.client_state == WebSocketState.CONNECTED:
                    await self.ws.send_json(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.warning("pump_events error: %s", e)
                break

    async def _receive_actions(self) -> None:
        """Read browser messages and dispatch PLAYER_ACTION to the game thread."""
        while not self._cancelled:
            try:
                msg = await self.ws.receive_json()
            except Exception:
                break

            msg_type = msg.get("type")

            if msg_type == "PLAYER_ACTION" and self._human_player is not None:
                action_str = msg.get("action", "")
                amount = int(msg.get("amount", 0))
                action = ACTION_MAP.get(action_str)
                if action is not None:
                    self._human_player.submit_action(action, amount)
                else:
                    await self._send_error(f"Unknown action: {action_str!r}")

            elif msg_type == "START_GAME":
                # Restart not supported mid-game; inform the client.
                await self._send_error("Game already running. Reconnect to start a new game.")

    async def _send_error(self, message: str) -> None:
        try:
            await self.ws.send_json({"type": "ERROR", "message": message})
        except Exception:
            pass
