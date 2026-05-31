# Work Log — Poker Trainer

---

## 2026-05-31 — backend-cleanup

**Branch:** `feature/2026-05-31`
**Status:** ✅ All tests passed

### What was done
- Extracted duplicate `ACTION_MAP` from `session.py` and `room_session.py` into new `backend/constants.py`
- Converted `poker_trainer/ui/renderer.py` to an ABC with `@abstractmethod` on all `show_*` methods; added `NullRenderer` to tests
- Removed legacy terminal CLI: deleted `__main__.py`, `HumanPlayer`, `poker` entry point in `pyproject.toml`; moved `simulate.py` / `stress_test.py` to `scripts/`; trimmed `RoomManager` of unused `RoomInfo` dataclass and `list_rooms()`; simplified `GameSession.run()` (removed multi-game while-loop)

### Test results
- Frontend lint: ⚠️ pre-existing `cross-spawn` corruption in node_modules (unrelated to changes)
- Frontend build (tsc): ✅
- Backend pytest: ✅ 41 passed, 1 skipped

---

## 2026-05-01 — multiplayer-rooms

**Branch:** `multiplayer-rooms/2026-05-01`
**Status:** ✅ All tests passed

### What was done
- Built full multiplayer room system: room creation via REST API, per-room WebSocket routing, lobby waiting phase → game lifecycle
- Added invite link sharing (6-char room code), player list with bot placeholders, host-only Start Game button, room settings display
- Added time bank enforcement: auto check/fold on expiry, per-second countdown, animated TimerBar (yellow at 10s, red at 5s)
- Added React Router for lobby (`/`) and room (`/room/:id`) pages; player identity persisted in localStorage

### Test results
- Frontend lint: ⚠️ 3 pre-existing errors in unchanged files (CommunityCards, GameTable, DealContext)
- Frontend build (tsc): ✅
- Backend pytest: ✅ 37 passed

---
