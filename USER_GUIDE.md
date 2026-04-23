# Poker Trainer — User Guide 使用手冊

> Texas Hold'em terminal game with AI opponents  
> 德州撲克終端機遊戲，對抗 AI 對手

---

## Table of Contents 目錄

- [English Guide](#english-guide)
  - [Installation](#installation)
  - [Starting the Game](#starting-the-game)
  - [How to Play](#how-to-play)
  - [Actions](#actions)
  - [Game Flow](#game-flow)
  - [AI Opponents](#ai-opponents)
  - [Customizing the Game](#customizing-the-game)
  - [Running Tests](#running-tests)
- [繁體中文說明](#繁體中文說明)
  - [安裝方式](#安裝方式)
  - [啟動遊戲](#啟動遊戲)
  - [遊戲玩法](#遊戲玩法)
  - [行動指令](#行動指令)
  - [遊戲流程](#遊戲流程)
  - [AI 對手介紹](#ai-對手介紹)
  - [自訂遊戲設定](#自訂遊戲設定)
  - [執行測試](#執行測試)

---

# English Guide

## Installation

**Requirements:** Python 3.11+, [uv](https://github.com/astral-sh/uv) package manager.

```bash
# 1. Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env

# 2. Navigate to the project folder
cd poker_trainer

# 3. Install all dependencies
uv sync
```

---

## Starting the Game

```bash
uv run poker
```

That's it. The game runs entirely in your terminal — no browser or GUI needed.

---

## How to Play

Poker Trainer plays **Texas Hold'em**, the world's most popular poker variant.

### Objective
Be the last player with chips. Win chips by having the best hand at showdown, or by making all opponents fold before showdown.

### The Deck & Cards
- Standard 52-card deck, reshuffled every hand.
- Cards are shown with colored suit symbols:
  - **♠ Spades** / **♣ Clubs** — white
  - **♥ Hearts** / **♦ Diamonds** — red

### Hand Rankings (weakest → strongest)

| Rank | Name | Example |
|------|------|---------|
| 1 | High Card | A K J 8 3 (different suits) |
| 2 | One Pair | A A K Q J |
| 3 | Two Pair | A A K K Q |
| 4 | Three of a Kind | A A A K Q |
| 5 | Straight | 5 6 7 8 9 (any suits) |
| 6 | Flush | A K 9 5 2 (all same suit) |
| 7 | Full House | A A A K K |
| 8 | Four of a Kind | A A A A K |
| 9 | Straight Flush | 5 6 7 8 9 (all same suit) |
| 10 | Royal Flush | 10 J Q K A (all same suit) |

> **Tip:** The game automatically finds your best 5-card hand from your 2 hole cards + up to 5 community cards.

---

## Actions

When it is your turn, the prompt shows which actions are available:

```
Your action ([f]old  [c]heck  [r]aise):
```

| Input | Action | When Available | Description |
|-------|--------|----------------|-------------|
| `f` | **Fold** | Always (when facing a bet) | Discard your hand and forfeit the pot |
| `c` | **Check** | When no bet is outstanding | Pass without wagering chips |
| `ca` | **Call** | When facing a bet | Match the current bet |
| `r` | **Raise** | When you have enough chips | Increase the bet; you will be prompted for an amount |
| `a` | **All-in** | Always | Wager all your remaining chips |

### Raise Amount
After typing `r`, you will be prompted:
```
Raise amount (20–500):
```
Enter any whole number in the shown range. The minimum raise is the big blind (20 by default).

---

## Game Flow

Each hand follows this sequence:

```
1. Blinds Posted
   └─ Small blind (10) and big blind (20) are automatically deducted.

2. Hole Cards Dealt
   └─ You receive 2 private cards (shown in green panel).

3. Pre-Flop Betting
   └─ Action starts left of the big blind. You act when the ▶ marker is on your name.

4. Flop (3 community cards revealed)
   └─ Another betting round. Action starts from the small blind seat.

5. Turn (1 more community card)
   └─ Another betting round.

6. River (1 final community card)
   └─ Final betting round.

7. Showdown
   └─ Remaining players reveal hands. Best hand wins the pot.
       Side pots are resolved if any player went all-in.
```

### Reading the Screen

```
──────────────────── Flop ────────────────────

╭─ Board ─────────────────╮
│  A♠   K♥   7♦           │
╰─────────────────────────╯

  Pot: 80 chips

  Player     Chips   Bet   Status
  ▶ You       960     20    active
    Alice      940     20    active
    Bob       1000      0    folded
    Charlie    980     20    active

╭─ Your Hand (You) ──────╮
│  Q♠   J♠               │
╰────────────────────────╯

  Your action ([f]old  [ca]ll  [r]aise):
```

- **Board** — community cards visible to everyone.
- **Pot** — total chips at stake.
- **▶** — marks your seat.
- **Your Hand** — your private hole cards (only you see these).

---

## AI Opponents

Three AI personality types are available, each with a distinct betting style:

| Type | Fold | Check/Call | Raise | Raise Sizing |
|------|------|------------|-------|--------------|
| `random` | 33% | 33% | 33% | Random (min → all-in) |
| `passive` | 10% | 75% | 15% | 1× – 2× current bet |
| `aggressive` | 5% | 20% | 75% | 2× current bet → all-in |

**Random** — completely unpredictable; useful as a beginner sparring partner.  
**Passive** — a "calling station"; rarely folds, rarely raises big. Exploit by betting large.  
**Aggressive** — a "maniac"; fires big bets constantly. Exploit by trapping with strong hands.

---

## Customizing the Game

Open `poker_trainer/__main__.py` to change the game setup:

```python
STARTING_CHIPS = 1_000   # Chips each player starts with
SMALL_BLIND    = 10      # Small blind amount
BIG_BLIND      = 20      # Big blind amount (usually 2× small)

PLAYER_CONFIGS = [
    ("human",      "You"),      # ← This is you
    ("aggressive", "Alice"),
    ("passive",    "Bob"),
    ("random",     "Charlie"),
]
```

- Change `"human"` to `"aggressive"` etc. to watch bots play each other.
- Add or remove rows to change the number of players (minimum 2).
- Adjust `STARTING_CHIPS` and blinds to change game length and pacing.

### Adding a Custom AI Strategy

1. Create `poker_trainer/strategies/my_strategy.py`:
   ```python
   from poker_trainer.strategies.base_strategy import BettingStrategy, GameState
   from poker_trainer.utils.constants import Action

   class MyStrategy(BettingStrategy):
       def decide(self, state: GameState, player) -> tuple[Action, int]:
           # Your logic here
           return Action.CHECK, 0
   ```
2. Register it in `poker_trainer/players/player_factory.py`:
   ```python
   from poker_trainer.strategies.my_strategy import MyStrategy
   _STRATEGY_MAP["my_strategy"] = MyStrategy
   ```
3. Use `"my_strategy"` in `PLAYER_CONFIGS`.

---

## Running Tests

```bash
uv run pytest -v
```

Expected output: **33 passed**.

The test suite covers:
- `test_card.py` — Card display and immutability
- `test_deck.py` — Dealing, burning, resetting, no duplicate cards
- `test_hand_evaluator.py` — All 10 hand categories + tiebreaker comparison
- `test_strategies.py` — Legal-action enforcement for all 3 AI types
- `test_game.py` — Chip conservation across single and multiple hands

---

---

# 繁體中文說明

## 安裝方式

**需求：** Python 3.11 以上、[uv](https://github.com/astral-sh/uv) 套件管理器。

```bash
# 1. 安裝 uv（若尚未安裝）
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env

# 2. 進入專案資料夾
cd poker_trainer

# 3. 安裝所有相依套件
uv sync
```

---

## 啟動遊戲

```bash
uv run poker
```

遊戲完全在終端機中運行，不需要瀏覽器或圖形介面。

---

## 遊戲玩法

Poker Trainer 採用**德州撲克（Texas Hold'em）**規則，是全球最普及的撲克變體。

### 遊戲目標
成為最後一位擁有籌碼的玩家。透過在攤牌（Showdown）時持有最強牌型，或讓所有對手蓋牌（Fold），即可贏得底池。

### 牌組與牌面
- 標準 52 張牌，每手牌開始前重新洗牌。
- 花色以顏色區分：
  - **♠ 黑桃** / **♣ 梅花** — 白色
  - **♥ 紅心** / **♦ 方塊** — 紅色

### 牌型大小（由小到大）

| 排名 | 牌型名稱 | 範例 |
|------|----------|------|
| 1 | 高牌 High Card | A K J 8 3（不同花色） |
| 2 | 一對 One Pair | A A K Q J |
| 3 | 兩對 Two Pair | A A K K Q |
| 4 | 三條 Three of a Kind | A A A K Q |
| 5 | 順子 Straight | 5 6 7 8 9（任意花色） |
| 6 | 同花 Flush | A K 9 5 2（同花色） |
| 7 | 葫蘆 Full House | A A A K K |
| 8 | 四條 Four of a Kind | A A A A K |
| 9 | 同花順 Straight Flush | 5 6 7 8 9（同花色） |
| 10 | 皇家同花順 Royal Flush | 10 J Q K A（同花色） |

> **提示：** 遊戲會自動從你的 2 張底牌加上最多 5 張公共牌中，找出最強的 5 張牌組合。

---

## 行動指令

輪到你行動時，終端機會提示目前可用的指令：

```
Your action ([f]old  [c]heck  [r]aise):
```

| 輸入 | 指令 | 可用時機 | 說明 |
|------|------|----------|------|
| `f` | **蓋牌 Fold** | 面對下注時 | 放棄手牌，退出本手牌 |
| `c` | **過牌 Check** | 無待跟注時 | 不下注直接過牌 |
| `ca` | **跟注 Call** | 面對下注時 | 跟上目前最高注額 |
| `r` | **加注 Raise** | 籌碼足夠時 | 提高注額；輸入後會詢問加注金額 |
| `a` | **全押 All-in** | 任何時機 | 押上全部剩餘籌碼 |

### 加注金額
輸入 `r` 後，系統會提示：
```
Raise amount (20–500):
```
輸入範圍內的整數即可。最小加注額預設為大盲注（20）。

---

## 遊戲流程

每手牌依下列順序進行：

```
1. 強制下注（Blinds）
   └─ 小盲注（10）與大盲注（20）自動從對應玩家扣除。

2. 發底牌（Hole Cards）
   └─ 每位玩家獲得 2 張私人底牌（顯示於綠色面板）。

3. 翻牌前下注（Pre-Flop）
   └─ 從大盲注左側玩家開始行動。輪到你時畫面會顯示 ▶ 標記。

4. 翻牌（Flop）— 公開 3 張公共牌
   └─ 新一輪下注，從小盲注位置開始。

5. 轉牌（Turn）— 再公開 1 張公共牌
   └─ 新一輪下注。

6. 河牌（River）— 最後 1 張公共牌
   └─ 最後一輪下注。

7. 攤牌（Showdown）
   └─ 剩餘玩家亮出底牌，最強牌型贏得底池。
       若有玩家全押，依規則分配主池與邊池。
```

### 畫面說明

```
──────────────────── Flop ────────────────────

╭─ Board ─────────────────╮
│  A♠   K♥   7♦           │
╰─────────────────────────╯

  Pot: 80 chips

  Player     Chips   Bet   Status
  ▶ You       960     20    active
    Alice      940     20    active
    Bob       1000      0    folded
    Charlie    980     20    active

╭─ Your Hand (You) ──────╮
│  Q♠   J♠               │
╰────────────────────────╯

  Your action ([f]old  [ca]ll  [r]aise):
```

| 區塊 | 說明 |
|------|------|
| **Board（牌面）** | 所有玩家可見的公共牌 |
| **Pot（底池）** | 目前底池總額 |
| **▶** | 標示目前輪到你行動 |
| **Your Hand（你的手牌）** | 只有你看得見的 2 張底牌 |
| **Status** | `active` 仍在牌局中、`folded` 已蓋牌、`all-in` 全押中 |

---

## AI 對手介紹

遊戲內建三種 AI 性格，各有不同的下注風格：

| 類型 | 蓋牌機率 | 過牌/跟注機率 | 加注機率 | 加注金額 |
|------|----------|---------------|----------|----------|
| `random`（隨機） | 33% | 33% | 33% | 隨機（最小注 → 全押） |
| `passive`（保守） | 10% | 75% | 15% | 1× ─ 2× 目前注額 |
| `aggressive`（激進） | 5% | 20% | 75% | 2× 目前注額 → 全押 |

**Random（隨機）** — 完全不可預測，適合初學者練習。  
**Passive（保守）** — 「跟注機器」，鮮少蓋牌也鮮少大注。**對策：手牌強時大力下注，榨取其籌碼。**  
**Aggressive（激進）** — 「瘋狂砲手」，頻繁下大注。**對策：靜待強牌，以慢打誘敵。**

---

## 自訂遊戲設定

開啟 `poker_trainer/__main__.py` 修改遊戲參數：

```python
STARTING_CHIPS = 1_000   # 每位玩家起始籌碼
SMALL_BLIND    = 10      # 小盲注金額
BIG_BLIND      = 20      # 大盲注金額（通常為小盲注的 2 倍）

PLAYER_CONFIGS = [
    ("human",      "You"),      # ← 這是你
    ("aggressive", "Alice"),
    ("passive",    "Bob"),
    ("random",     "Charlie"),
]
```

- 將 `"human"` 改為 `"aggressive"` 等，可讓機器人對戰機器人。
- 增刪列數可改變玩家人數（最少 2 人）。
- 調整 `STARTING_CHIPS` 與盲注改變遊戲節奏與長度。

### 新增自訂 AI 策略

1. 建立 `poker_trainer/strategies/my_strategy.py`：
   ```python
   from poker_trainer.strategies.base_strategy import BettingStrategy, GameState
   from poker_trainer.utils.constants import Action

   class MyStrategy(BettingStrategy):
       def decide(self, state: GameState, player) -> tuple[Action, int]:
           # 在此撰寫你的策略邏輯
           return Action.CHECK, 0
   ```
2. 在 `poker_trainer/players/player_factory.py` 中註冊：
   ```python
   from poker_trainer.strategies.my_strategy import MyStrategy
   _STRATEGY_MAP["my_strategy"] = MyStrategy
   ```
3. 在 `PLAYER_CONFIGS` 中使用 `"my_strategy"`。

---

## 執行測試

```bash
uv run pytest -v
```

預期結果：**33 passed（全部通過）**。

測試涵蓋範圍：

| 測試檔案 | 測試內容 |
|----------|----------|
| `test_card.py` | 牌面顯示與不可變性 |
| `test_deck.py` | 發牌、燒牌、重置、無重複牌 |
| `test_hand_evaluator.py` | 全部 10 種牌型 + 同牌型比較 |
| `test_strategies.py` | 三種 AI 類型的合法行動驗證 |
| `test_game.py` | 單手與多手牌的籌碼守恆驗證 |
