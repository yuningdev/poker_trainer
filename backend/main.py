"""
FastAPI application entry point.

Endpoints:
    WS /ws  — one WebSocket connection per game session

In production, also serves the built React frontend from frontend/dist/.
In development, the Vite dev server proxies /ws to this server.

Run:
    uv run uvicorn backend.main:app --reload --port 8000
"""

import logging
import pathlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from backend.session import GameSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Poker Trainer API")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session = GameSession(ws)
    logger.info("WebSocket connected: %s", ws.client)
    try:
        await session.run()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", ws.client)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        session.cancel()


# ── Serve built React frontend in production ──────────────────────────────────
_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
