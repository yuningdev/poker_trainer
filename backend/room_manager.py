"""
RoomManager — in-memory registry of all active poker rooms.

A room is created via POST /api/rooms and identified by a short uppercase
hex ID (e.g. "A3F9C2").  The manager holds RoomSession objects (not raw
RoomInfo) so that the WebSocket endpoint can call session methods directly.

Singleton usage:
    from backend.room_manager import room_manager, RoomConfig
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional


@dataclass
class RoomConfig:
    """Immutable configuration for a single poker room."""

    room_name: str
    total_seats: int       # 2–9 inclusive
    big_blind: int         # e.g. 20
    starting_chips: int    # e.g. 1000
    time_bank: int         # seconds per decision; 0 = unlimited
    bot_strategy: str      # "aggressive" | "passive" | "random"


@dataclass
class RoomInfo:
    """
    Lightweight snapshot of a room — useful for REST responses.
    The live state lives in RoomSession; this is only used for serialisation.
    """

    room_id: str
    config: RoomConfig
    host_id: str
    players: dict           # player_id → {"name": str, "seat": int}
    status: Literal["waiting", "playing", "finished"]
    created_at: float = field(default_factory=time.time)


class RoomManager:
    """In-memory registry of all active rooms."""

    def __init__(self) -> None:
        # Maps room_id (uppercase) → RoomSession instance.
        self._rooms: dict[str, object] = {}

    def create_room(self, config: RoomConfig, host_id: str) -> str:
        """
        Allocate a new room and return its six-character uppercase ID.

        The import of RoomSession is deferred here to avoid the circular
        dependency: room_manager ← room_session ← room_manager.
        """
        room_id = uuid.uuid4().hex[:6].upper()
        # Avoid the (astronomically unlikely) collision.
        while room_id in self._rooms:
            room_id = uuid.uuid4().hex[:6].upper()

        from backend.room_session import RoomSession  # deferred to break cycle
        self._rooms[room_id] = RoomSession(room_id, config, host_id)
        return room_id

    def get_room(self, room_id: str) -> Optional[object]:
        """Return the RoomSession for *room_id*, or None if not found."""
        return self._rooms.get(room_id.upper())

    def remove_room(self, room_id: str) -> None:
        """Delete a room from the registry (e.g. after GAME_OVER)."""
        self._rooms.pop(room_id.upper(), None)

    def list_rooms(self) -> list[dict]:
        """Return a summary list for the lobby (if ever needed)."""
        result = []
        for rid, session in self._rooms.items():
            result.append(session._room_state_msg())  # type: ignore[attr-defined]
        return result


# Module-level singleton — import this everywhere.
room_manager = RoomManager()
