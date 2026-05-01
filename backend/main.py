"""
FastAPI application entry point.

Endpoints:
    POST /api/rooms          — create a new multiplayer room
    GET  /api/rooms/{id}     — fetch room state (lobby info)
    WS   /ws/{room_id}       — multiplayer room WebSocket
    WS   /ws                 — legacy single-player WebSocket (preserved)

In production, also serves the built React frontend from frontend/dist/.
In development, the Vite dev server proxies /ws to this server.

Run:
    uv run uvicorn backend.main:app --reload --port 8000
"""

import logging
import pathlib
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from backend.session import GameSession
from backend.room_manager import room_manager, RoomConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Poker Trainer API")


# ── Room REST API ─────────────────────────────────────────────────────────────

@app.post("/api/rooms")
async def create_room(body: dict) -> dict:
    """
    Create a new multiplayer room.

    Request body (all optional, sane defaults applied):
        host_id:        str  — caller-supplied stable ID; generated if absent
        room_name:      str  — display name for the room
        total_seats:    int  — 2–9; human players + bot fill-ins
        big_blind:      int  — big blind amount
        starting_chips: int  — each player starts with this many chips
        time_bank:      int  — seconds per decision (0 = unlimited)
        bot_strategy:   str  — "random" | "passive" | "aggressive"

    Response:
        {"room_id": "A3F9C2", "host_id": "..."}
    """
    host_id: str = body.get("host_id") or uuid.uuid4().hex
    config = RoomConfig(
        room_name=str(body.get("room_name", "Poker Room")),
        total_seats=int(body.get("total_seats", 6)),
        big_blind=int(body.get("big_blind", 20)),
        starting_chips=int(body.get("starting_chips", 1000)),
        time_bank=int(body.get("time_bank", 30)),
        bot_strategy=str(body.get("bot_strategy", "random")),
    )
    room_id = room_manager.create_room(config, host_id)
    logger.info("Room created: %s (host=%s)", room_id, host_id)
    return {"room_id": room_id, "host_id": host_id}


@app.get("/api/rooms/{room_id}")
async def get_room(room_id: str) -> dict:
    """
    Fetch the current state of a room (lobby info, player list, config).

    Raises 404 if the room does not exist.
    """
    session = room_manager.get_room(room_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return session._room_state_msg()


# ── Multiplayer WebSocket endpoint ────────────────────────────────────────────

@app.websocket("/ws/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: str) -> None:
    """
    Multiplayer room WebSocket.

    Protocol (client → server):
        1. Accept connection.
        2. Client sends JOIN_ROOM as the very first message:
               {"type": "JOIN_ROOM", "player_id": "...", "name": "Alice"}
        3. Client sends PLAYER_ACTION or START_GAME messages afterwards.

    The server sends ROOM_STATE immediately after JOIN_ROOM, then game
    events (TABLE_STATE, ACTION_REQUIRED, etc.) once the game starts.
    """
    session = room_manager.get_room(room_id)
    if session is None:
        await websocket.accept()
        await websocket.send_json({"type": "ERROR", "message": "Room not found"})
        await websocket.close()
        return

    await websocket.accept()
    player_id: str | None = None

    try:
        # First message must be JOIN_ROOM.
        data = await websocket.receive_json()
        if data.get("type") != "JOIN_ROOM":
            await websocket.send_json(
                {"type": "ERROR", "message": "First message must be JOIN_ROOM"}
            )
            await websocket.close()
            return

        player_id = data.get("player_id") or uuid.uuid4().hex
        name = str(data.get("name", "Player"))

        # connect() handles both new joins and reconnections.
        await session.connect(websocket, player_id, name)

        # Main message loop.
        while True:
            msg = await websocket.receive_json()
            await session.handle_message(player_id, msg)

    except WebSocketDisconnect:
        logger.info("Room %s: player %r disconnected", room_id, player_id)
        if player_id is not None:
            await session.disconnect(player_id)
    except Exception as exc:
        logger.error("Room %s WebSocket error: %s", room_id, exc)
        if player_id is not None:
            await session.disconnect(player_id)


# ── Legacy single-player WebSocket endpoint (preserved) ──────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """Single-player game session — kept for backward compatibility."""
    await ws.accept()
    session = GameSession(ws)
    logger.info("Single-player WebSocket connected: %s", ws.client)
    try:
        await session.run()
    except WebSocketDisconnect:
        logger.info("Single-player WebSocket disconnected: %s", ws.client)
    except Exception as exc:
        logger.error("Single-player WebSocket error: %s", exc)
    finally:
        session.cancel()


# ── Serve built React frontend in production ──────────────────────────────────

_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
