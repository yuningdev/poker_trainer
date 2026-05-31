"""
Shared constants for the backend package.
"""

from poker_trainer.utils.constants import Action

# Maps WebSocket action strings to engine Action enum values.
# Used by both GameSession (session.py) and RoomSession (room_session.py).
ACTION_MAP: dict[str, Action] = {
    "fold":   Action.FOLD,
    "check":  Action.CHECK,
    "call":   Action.CALL,
    "raise":  Action.RAISE,
    "all_in": Action.ALL_IN,
}
