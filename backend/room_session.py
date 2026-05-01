"""
RoomSession — one instance per poker room.

Manages the full lifecycle of a multiplayer room:
  1. Lobby phase: players join via WebSocket.
  2. Game phase:  host sends START_GAME, engine runs in a thread executor.
  3. Finished:    GAME_OVER broadcast; players may still be connected.

Key design points:
  - All human players share a single asyncio.Queue for events.
  - _pump_events() drains that queue and broadcasts to every connected WS.
  - Each WsHumanPlayer has its own submit_action() target, so ACTION_REQUIRED
    is broadcast to all clients but only the correct player's frontend shows
    the action buttons (filtered client-side by name / player_id).
  - Reconnection: if a player_id is already registered, the new WebSocket
    replaces the old one without interrupting the game thread.
  - Disconnection during game: the slot is kept (status="playing") so the
    player can reconnect; on their turn the time_bank auto-folds for them.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import logging
from typing import Optional, TYPE_CHECKING

from fastapi import WebSocket
from fastapi.websockets import WebSocketState

from poker_trainer.players.ws_human_player import WsHumanPlayer
from poker_trainer.players.player_factory import PlayerFactory
from poker_trainer.engine.dealer import Dealer
from poker_trainer.engine.game import Game
from poker_trainer.engine.table import Table
from poker_trainer.utils.constants import Action
from backend.serializer import serialize_action_required
from backend.ws_renderer import WsRenderer

if TYPE_CHECKING:
    from backend.room_manager import RoomConfig

logger = logging.getLogger(__name__)

ACTION_MAP: dict[str, Action] = {
    "fold":   Action.FOLD,
    "check":  Action.CHECK,
    "call":   Action.CALL,
    "raise":  Action.RAISE,
    "all_in": Action.ALL_IN,
}


class RoomSession:
    """
    Manages one poker room from lobby through game completion.

    ws_players dict structure:
        {
            player_id: {
                "ws":           WebSocket | None,
                "name":         str,
                "human_player": WsHumanPlayer | None,   # set once game starts
            }
        }
    """

    def __init__(self, room_id: str, config: "RoomConfig", host_id: str) -> None:
        self.room_id = room_id
        self.config = config
        self.host_id = host_id
        self.status: str = "waiting"   # "waiting" | "playing" | "finished"

        # Keyed by player_id (string supplied by the client).
        self.ws_players: dict[str, dict] = {}

        self._event_queue: Optional[asyncio.Queue] = None
        self._pump_task: Optional[asyncio.Task] = None
        self._executor: Optional[concurrent.futures.ThreadPoolExecutor] = None

    # ── WebSocket lifecycle ───────────────────────────────────────────────────

    async def connect(self, ws: WebSocket, player_id: str, name: str) -> None:
        """
        Called when a player's WebSocket connects (after ws.accept()).

        Handles both first-time joins and reconnections.
        """
        if player_id in self.ws_players:
            # Reconnection — swap in the new WebSocket.
            self.ws_players[player_id]["ws"] = ws
            logger.info("Room %s: player %r reconnected", self.room_id, player_id)
        else:
            # Fresh join — enforce seat limit.
            if len(self.ws_players) >= self.config.total_seats:
                await ws.send_json({"type": "ERROR", "message": "Room is full"})
                await ws.close()
                return
            self.ws_players[player_id] = {
                "ws": ws,
                "name": name,
                "human_player": None,
            }
            logger.info(
                "Room %s: player %r (%s) joined (%d/%d seats)",
                self.room_id, player_id, name,
                len(self.ws_players), self.config.total_seats,
            )

        # Send current room snapshot to this player.
        await ws.send_json(self._room_state_msg())

        # Notify everyone else.
        await self._broadcast(
            {"type": "PLAYER_JOINED", "player_id": player_id, "name": name},
            exclude=player_id,
        )

    async def disconnect(self, player_id: str) -> None:
        """
        Called when a player's WebSocket closes.

        During a game, the slot is kept (the player may reconnect).
        In the lobby, the slot is removed and others are notified.
        """
        if player_id not in self.ws_players:
            return

        logger.info("Room %s: player %r disconnected", self.room_id, player_id)

        if self.status == "playing":
            # Mark ws as gone but preserve the slot for reconnection.
            self.ws_players[player_id]["ws"] = None
        else:
            del self.ws_players[player_id]

        await self._broadcast({"type": "PLAYER_LEFT", "player_id": player_id})

    # ── Message routing ───────────────────────────────────────────────────────

    async def handle_message(self, player_id: str, msg: dict) -> None:
        """Route an incoming message from a specific player."""
        msg_type = msg.get("type")

        if msg_type == "START_GAME":
            if player_id != self.host_id:
                await self._send_error(player_id, "Only the host can start the game.")
                return
            if self.status != "waiting":
                await self._send_error(player_id, "Game already started.")
                return
            await self._start_game()

        elif msg_type == "PLAYER_ACTION":
            if self.status != "playing":
                return
            info = self.ws_players.get(player_id)
            if info is None or info["human_player"] is None:
                return
            action_str = msg.get("action", "")
            amount = int(msg.get("amount", 0))
            action = ACTION_MAP.get(action_str)
            if action is not None:
                info["human_player"].submit_action(action, amount)
            else:
                await self._send_error(player_id, f"Unknown action: {action_str!r}")

        else:
            logger.debug("Room %s: unhandled message type %r", self.room_id, msg_type)

    # ── Game startup ──────────────────────────────────────────────────────────

    async def _start_game(self) -> None:
        """
        Build the game, spin up the executor thread, and start pumping events.
        """
        self.status = "playing"
        loop = asyncio.get_running_loop()
        self._event_queue = asyncio.Queue()

        # Build WsHumanPlayer for every connected human.
        human_players: list[WsHumanPlayer] = []
        for pid, info in self.ws_players.items():
            hp = WsHumanPlayer(
                name=info["name"],
                chips=self.config.starting_chips,
                time_bank=self.config.time_bank,
                on_time_warning=self._make_time_warning_callback(loop, pid),
            )
            # Wire up the ACTION_REQUIRED callback.
            hp.set_decision_callback(self._make_decision_callback(loop))
            info["human_player"] = hp
            human_players.append(hp)

        # Fill remaining seats with bots.
        bot_count = self.config.total_seats - len(human_players)
        bots = [
            PlayerFactory.create(
                self.config.bot_strategy,
                f"Bot {i + 1}",
                self.config.starting_chips,
            )
            for i in range(bot_count)
        ]

        all_players = human_players + bots

        # Build the engine components.
        renderer = WsRenderer(
            lambda event: asyncio.run_coroutine_threadsafe(
                self._event_queue.put(event), loop  # type: ignore[union-attr]
            )
        )
        table = Table(
            all_players,
            small_blind=self.config.big_blind // 2,
            big_blind=self.config.big_blind,
        )
        dealer = Dealer()
        game = Game(table, dealer, renderer)

        # Run the synchronous game loop in a background thread.
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        loop.run_in_executor(self._executor, game.run)

        # Drain events to all connected clients.
        self._pump_task = asyncio.create_task(self._pump_events())

        # Announce game start to the room.
        await self._broadcast({"type": "GAME_STARTED", "room_id": self.room_id})

    # ── Event pump ────────────────────────────────────────────────────────────

    async def _pump_events(self) -> None:
        """
        Drain the shared event queue and broadcast each event to all
        connected players.  Runs until the game finishes or is cancelled.
        """
        while self.status == "playing":
            try:
                event = await asyncio.wait_for(
                    self._event_queue.get(),  # type: ignore[union-attr]
                    timeout=1.0,
                )
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                logger.error("Room %s pump error: %s", self.room_id, exc)
                break

            await self._broadcast(event)

            if event.get("type") == "GAME_OVER":
                self.status = "finished"
                break

        logger.info("Room %s: pump_events exiting (status=%s)", self.room_id, self.status)

    # ── Broadcast helpers ─────────────────────────────────────────────────────

    async def _broadcast(self, msg: dict, exclude: Optional[str] = None) -> None:
        """
        Send *msg* to every currently-connected player, optionally skipping
        the player identified by *exclude*.

        Dead WebSockets (None or closed) are silently removed.
        """
        dead: list[str] = []
        for pid, info in self.ws_players.items():
            if pid == exclude:
                continue
            ws = info.get("ws")
            if ws is None:
                continue
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_json(msg)
            except Exception as exc:
                logger.warning(
                    "Room %s: send to player %r failed (%s)", self.room_id, pid, exc
                )
                dead.append(pid)

        for pid in dead:
            await self.disconnect(pid)

    async def _send_error(self, player_id: str, message: str) -> None:
        info = self.ws_players.get(player_id)
        if info and info.get("ws"):
            try:
                await info["ws"].send_json({"type": "ERROR", "message": message})
            except Exception:
                pass

    # ── Callbacks for game thread ─────────────────────────────────────────────

    def _make_decision_callback(
        self, loop: asyncio.AbstractEventLoop
    ):
        """
        Returns a callback that serialises GameState → ACTION_REQUIRED dict
        and places it on the event queue.  Called from the game thread.

        The ACTION_REQUIRED is broadcast to all clients; the frontend filters
        by player name so only the correct player sees the action panel.
        """
        def callback(state) -> None:
            event = serialize_action_required(state)
            # Attach which player's turn it is so clients can filter.
            event["player_name"] = state.player_name
            asyncio.run_coroutine_threadsafe(
                self._event_queue.put(event),  # type: ignore[union-attr]
                loop,
            )

        return callback

    def _make_time_warning_callback(
        self, loop: asyncio.AbstractEventLoop, player_id: str
    ):
        """
        Returns a callback that emits TIME_WARNING events tagged with
        *player_id* so the frontend can show a countdown to the right player.
        """
        def callback(seconds_remaining: int) -> None:
            asyncio.run_coroutine_threadsafe(
                self._event_queue.put(  # type: ignore[union-attr]
                    {
                        "type": "TIME_WARNING",
                        "player_id": player_id,
                        "seconds_remaining": seconds_remaining,
                    }
                ),
                loop,
            )

        return callback

    # ── Room state snapshot ───────────────────────────────────────────────────

    def _room_state_msg(self) -> dict:
        """JSON-serialisable room snapshot (used for REST and WS handshakes)."""
        return {
            "type": "ROOM_STATE",
            "room_id": self.room_id,
            "room_name": self.config.room_name,
            "host_id": self.host_id,
            "status": self.status,
            "players": [
                {"player_id": pid, "name": info["name"]}
                for pid, info in self.ws_players.items()
            ],
            "config": {
                "total_seats": self.config.total_seats,
                "big_blind": self.config.big_blind,
                "starting_chips": self.config.starting_chips,
                "time_bank": self.config.time_bank,
                "bot_strategy": self.config.bot_strategy,
            },
        }

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def cancel(self) -> None:
        """
        Force-terminate all human players (unblocks game thread) and clean up.
        Called when the room is explicitly destroyed or the server shuts down.
        """
        for info in self.ws_players.values():
            hp = info.get("human_player")
            if hp is not None:
                hp.force_fold()

        if self._pump_task is not None and not self._pump_task.done():
            self._pump_task.cancel()

        if self._executor is not None:
            self._executor.shutdown(wait=False)
