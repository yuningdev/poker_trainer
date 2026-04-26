# Game Flow Bug Report & Fix Instructions

Branch: `features/process-check`  
Investigated: 2026-04-26

---

## Bug 1 — Eliminated players re-enter next hand

### Symptom
A player who went all-in and lost (chips = 0) continues to receive hole cards in the next hand
and is included in betting rounds as if they are still active.

### Root Cause
`_remove_bust_players()` in `game.py` announces the bust via the renderer but never sets
`player.is_active = False`. Combined with `reset_for_new_hand()` in `table.py` skipping
`clear_hand()` for players with `chips == 0`, the player retains `is_active = True` from
the previous hand and is incorrectly treated as active.

**Affected files:**
- `poker_trainer/engine/game.py` — `_remove_bust_players()` (line ~395): missing `player.is_active = False`
- `poker_trainer/engine/table.py` — `reset_for_new_hand()` (line ~67): skips `clear_hand()` for bust players

### Fix
1. In `table.py` `reset_for_new_hand()`: always call `clear_hand()` for ALL players, then explicitly
   set `is_active = False` for those with `chips == 0`.
2. In `game.py` `_remove_bust_players()`: only announce players newly busted this session
   (use a `_busted_players` set to avoid duplicate announcements across hands).

---

## Bug 2 — Human player bust: no restart UI, WebSocket should stay alive

### Symptom
When the human player runs out of chips mid-game, the bots continue playing and the WebSocket
stays open — but the human has no way to restart. The screen simply stops showing any action
buttons and the player is stuck watching the bots finish.

### Root Cause
The frontend `PLAYER_BUST` handler only appends a log entry; it does not check whether the
bust player is the human player, and sets no state that would trigger a restart overlay.

**Affected files:**
- `frontend/src/store/gameStore.ts` — `PLAYER_BUST` case: doesn't set a `humanBust` flag
- No `HumanBustOverlay` component exists to prompt for restart

### Fix
1. Add `humanBust: boolean` to `GameState` / store initial state.
2. In the `TABLE_STATE` handler, detect `players.some(p => p.is_human && p.status === 'bust')`
   and set `humanBust = true`.
3. Add a `HumanBustOverlay` component: when `humanBust` is true, show a full-screen overlay
   with "You've been eliminated" and a "Play Again" button (`window.location.reload()`).

---

## Bug 3 — All-in causes >7 cards per player (hole cards accumulate)

### Symptom
After a player goes all-in and busts, the next hand deals them 2 additional hole cards on top
of the 2 cards they still hold from the previous hand (4 hole cards total). Combined with 5
community cards, this results in 9 cards per player — the hand evaluator receives invalid input.

### Root Cause (same root as Bug 1)
Because `_remove_bust_players()` never sets `is_active = False` and `reset_for_new_hand()`
skips `clear_hand()` for bust players:
1. `hole_cards` from the previous hand are never cleared.
2. `deal_hole_cards()` in `dealer.py` filters by `p.is_active` — bust players pass this check.
3. `receive_cards()` in `base_player.py` uses `.extend()`, appending 2 new cards to the existing 2.

**Affected files (same as Bug 1 plus):**
- `poker_trainer/players/base_player.py` — `receive_cards()` uses `.extend()` (correct behaviour;
  the real fix is ensuring `hole_cards` is cleared before each hand via Bug 1's fix)

### Fix
Fixing Bug 1 (always calling `clear_hand()` and deactivating bust players before each hand)
fully resolves Bug 3. No change needed in `receive_cards()`.

---

## Bonus Fix — Dealer button does not rotate on early-exit hands

### Symptom
When a hand ends before the river (everyone folds / one player remains), the dealer button
stays in the same position. The same player is always dealer until a hand plays to the river.

### Root Cause
`_play_hand()` in `game.py` calls `self.table.rotate_dealer()` only after the river betting round.
The three early-exit `return` statements (after pre-flop, flop, and turn) skip `rotate_dealer()`.

**Affected file:**
- `poker_trainer/engine/game.py` — `_play_hand()` lines ~94, ~104, ~114

### Fix
Call `self.table.rotate_dealer()` before every `return` inside `_play_hand()`, including all
early exits.

---

## Implementation Plan

### Backend (`poker_trainer/`)

**`engine/game.py`**
- Add `self._busted_players: set = set()` to `__init__`
- `_play_hand()`: add `self.table.rotate_dealer()` before each early `return`
- `_remove_bust_players()`: rewrite to only announce newly busted players and NOT set
  `is_active` (that is now handled by `reset_for_new_hand`)

**`engine/table.py`**
- `reset_for_new_hand()`: always call `player.clear_hand()` for all players, then set
  `player.is_active = False` for those with `chips == 0`

### Frontend (`frontend/src/`)

**`types.ts`**
- Add `humanBust: boolean` to `GameState`

**`store/gameStore.ts`**
- Add `humanBust: false` to `initialState`
- In `TABLE_STATE` handler: detect human bust and set `humanBust = true`
- Reset `humanBust` to `false` in `reset()`

**`components/HumanBustOverlay.tsx`** _(new file)_
- Render when `humanBust === true`
- Show "You've been eliminated" message
- "Play Again" button calls `window.location.reload()`
- Allow watching the rest of the game (overlay dismissible)

**`components/HandResultOverlay.tsx`**
- Import and render `<HumanBustOverlay />`

---

## Test Coverage

Add / update tests in `tests/test_game.py`:

1. **`test_bust_player_excluded_next_hand`**: After a player busts, verify they have exactly
   0 hole cards and `is_active == False` at the start of the next hand.
2. **`test_max_seven_cards_after_allin`**: Run 10 all-in-heavy hands; assert no player ever
   holds more than 2 hole cards, and community cards never exceed 5.
3. **`test_dealer_rotates_on_early_exit`**: Simulate a hand where everyone folds pre-flop;
   assert `table.dealer_position` changed after the hand.
